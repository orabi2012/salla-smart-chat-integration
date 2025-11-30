import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SallaStore, SyncStatus } from './salla-stores.entity';
import { SallaStoreProductOption } from './salla-store-product-option.entity';
import { UbiqfyProductsService } from '../ubiqfy-products/ubiqfy-products.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SallaStoresService {
  constructor(
    @InjectRepository(SallaStore)
    private readonly sallaStoreRepo: Repository<SallaStore>,
    @InjectRepository(SallaStoreProductOption)
    private readonly sallaStoreProductOptionRepo: Repository<SallaStoreProductOption>,
    private readonly ubiqfyProductsService: UbiqfyProductsService,
    private readonly configService: ConfigService,
  ) { }

  async create(sallaStoreData: Partial<SallaStore>): Promise<SallaStore> {
    const sallaStore = this.sallaStoreRepo.create(sallaStoreData);
    return await this.sallaStoreRepo.save(sallaStore);
  }

  async findAll(): Promise<SallaStore[]> {
    return await this.sallaStoreRepo.find({
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: string): Promise<SallaStore | null> {
    return await this.sallaStoreRepo.findOne({ where: { id } });
  }

  async findBySallaStoreId(salla_store_id: string): Promise<SallaStore | null> {
    return await this.sallaStoreRepo.findOne({ where: { salla_store_id } });
  }

  async findActiveStores(): Promise<SallaStore[]> {
    return await this.sallaStoreRepo.find({
      where: { is_active: true },
      order: { created_at: 'DESC' },
    });
  }

  async updateSyncStatus(
    id: string,
    status: SyncStatus,
    errorMessage?: string,
  ): Promise<void> {
    const updateData: any = {
      sync_status: status,
      last_sync_at: new Date(),
    };

    if (errorMessage) {
      updateData.last_error_message = errorMessage;
    }

    await this.sallaStoreRepo.update(id, updateData);
  }

  async incrementProductCount(id: string, count: number = 1): Promise<void> {
    await this.sallaStoreRepo.increment({ id }, 'total_products_synced', count);
  }

  async setProductCount(id: string, count: number): Promise<void> {
    await this.sallaStoreRepo.update(id, { total_products_synced: count });
  }

  async update(
    id: string,
    updateData: Partial<SallaStore>,
  ): Promise<SallaStore | null> {
    // Find the entity first
    const entity = await this.sallaStoreRepo.findOne({ where: { id } });
    if (!entity) {
      return null;
    }

    // Apply updates to the entity
    Object.assign(entity, updateData);

    // Save the entity (this will trigger @BeforeUpdate hooks)
    const savedEntity = await this.sallaStoreRepo.save(entity);
    return savedEntity;
  }

  async delete(id: string): Promise<void> {
    await this.sallaStoreRepo.delete(id);
  }

  async toggleActive(id: string): Promise<SallaStore | null> {
    const store = await this.findById(id);
    if (store) {
      store.is_active = !store.is_active;
      return await this.sallaStoreRepo.save(store);
    }
    return null;
  }

  async getUbiqfyAuthData(id: string): Promise<{
    Username: string;
    Password: string;
    TerminalKey: string;
  } | null> {
    const store = await this.findById(id);
    if (!store) {
      return null;
    }

    return {
      Username: store.ubiqfy_username,
      Password: store.getDecryptedPassword(),
      TerminalKey: store.ubiqfy_terminal_key,
    };
  }

  async authenticateWithUbiqfy(id: string): Promise<any> {
    const store = await this.findById(id);
    if (!store) {
      throw new Error('Store not found');
    }

    // Use environment variables for Ubiqfy URLs
    const baseUrl = store.ubiqfy_sandbox
      ? process.env.SANDBOX_UBIQFY_URL || 'https://api-sandbox.ubiqfy.com'
      : process.env.PRODUCTION_UBIQFY_URL || 'https://api.ubiqfy.com';

    const authPayload = {
      Username: store.ubiqfy_username,
      Password: store.getDecryptedPassword(),
      TerminalKey: store.ubiqfy_terminal_key,
    };

    try {
      console.log(`[Ubiqfy Auth] Attempting authentication with URL: ${baseUrl}/Authenticate`);
      console.log(`[Ubiqfy Auth] Store ID: ${id}, Sandbox: ${store.ubiqfy_sandbox}`);
      console.log(`[Ubiqfy Auth] Username: ${store.ubiqfy_username}, TerminalKey: ${store.ubiqfy_terminal_key}`);

      const response = await fetch(`${baseUrl}/Authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(authPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Ubiqfy Auth Error] ${response.status} - ${errorText}`);
        throw new Error(
          `Ubiqfy authentication failed: ${response.status} - ${errorText}`,
        );
      }

      const result = await response.json();

      // Check if authentication was successful
      if (result.OperationSucceeded) {
        // Try different possible field names for balance/plafond
        const possibleBalanceFields = [
          'Plafond',
          'Balance',
          'balance',
          'plafond',
          'Amount',
          'amount',
          'AvailableBalance',
          'CurrentBalance',
        ];
        let balanceValue: any = null;

        for (const field of possibleBalanceFields) {
          if (result[field] !== undefined && result[field] !== null) {
            balanceValue = result[field];
            break;
          }
        }

        // Update store with balance from the response
        if (balanceValue !== null && balanceValue !== undefined) {
          const numericBalance = parseFloat(String(balanceValue));
          await this.sallaStoreRepo.update(id, {
            ubiqfy_plafond: numericBalance,
            plafond_last_updated: new Date(),
          });
        }

        await this.updateSyncStatus(
          id,
          SyncStatus.SUCCESS,
          'Ubiqfy authentication successful',
        );
        return {
          success: true,
          token: result.Token,
          plafond: balanceValue,
          baseUrl: baseUrl,
          message: 'Authentication successful',
        };
      } else {
        throw new Error(
          `Ubiqfy authentication failed: ${result.ErrorText || 'Unknown error'}`,
        );
      }
    } catch (error) {
      console.error(`[Ubiqfy Auth] Authentication failed for store ${id}:`, error);

      // Provide more specific error messages based on error type
      let errorMessage = error.message;
      if (error.message === 'fetch failed') {
        errorMessage = `Network error: Cannot connect to Ubiqfy API at ${baseUrl}. This could be due to:
        - Server is down or unreachable
        - Network connectivity issues
        - Firewall blocking the connection
        - SSL/TLS certificate issues
        - Port ${baseUrl.includes(':5276') ? '5276' : '443'} is blocked`;
      }

      await this.updateSyncStatus(
        id,
        SyncStatus.FAILED,
        `Ubiqfy auth failed: ${errorMessage}`,
      );
      throw new Error(errorMessage);
    }
  }

  async fetchUbiqfyProducts(id: string): Promise<any> {
    const store = await this.findById(id);
    if (!store) {
      throw new Error('Store not found');
    }

    // First authenticate to get the token
    const authResult = await this.authenticateWithUbiqfy(id);
    if (!authResult.success || !authResult.token) {
      throw new Error('Authentication failed - no token received');
    }

    // Use environment variables for Ubiqfy URLs
    const baseUrl = store.ubiqfy_sandbox
      ? process.env.SANDBOX_UBIQFY_URL || 'https://api-sandbox.ubiqfy.com'
      : process.env.PRODUCTION_UBIQFY_URL || 'https://api.ubiqfy.com';

    const productsPayload = {
      Token: authResult.token,
      ProductTypeCode: store.ubiqfy_producttypecode || 'Voucher',
      GetVisible: false,
      GetMandatory: true,
    };

    try {
      const response = await fetch(`${baseUrl}/GetAvailableProduct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productsPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Ubiqfy products fetch failed: ${response.status} - ${errorText}`,
        );
      }

      const result = await response.json();

      // Check if the request was successful
      if (result.OperationSucceeded) {
        const productsData = result.AvailableProductList || [];

        // Save products to database
        let savedProducts: any[] = [];
        if (productsData.length > 0) {
          try {
            savedProducts =
              await this.ubiqfyProductsService.saveProductsFromApiResponse(
                productsData,
              );
          } catch (error) {
            // Continue execution even if database save fails
          }
        }

        // Extract distinct countries from products
        const distinctCountries = [
          ...new Set(
            productsData
              .map((product) => product.CountryIso)
              .filter((country) => country && country.trim() !== ''),
          ),
        ].sort();

        await this.updateSyncStatus(
          id,
          SyncStatus.SUCCESS,
          'Ubiqfy products fetched successfully',
        );
        return {
          success: true,
          products: productsData,
          savedProducts: savedProducts.length,
          message: 'Products fetched successfully',
          metadata: {
            productTypeCode: productsPayload.ProductTypeCode,
            productCount: productsData.length,
            savedToDatabase: savedProducts.length,
            distinctCountries: distinctCountries,
          },
        };
      } else {
        throw new Error(
          `Ubiqfy products fetch failed: ${result.ErrorText || 'Unknown error'}`,
        );
      }
    } catch (error) {
      await this.updateSyncStatus(
        id,
        SyncStatus.FAILED,
        `Ubiqfy products fetch failed: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get all synced product options for a store for stock management
   */
  async getSyncedProductOptions(storeId: string): Promise<any[]> {
    const store = await this.sallaStoreRepo.findOne({
      where: { id: storeId },
      relations: [
        'storeProducts',
        'storeProducts.options',
        'storeProducts.ubiqfyProduct'
      ]
    });

    if (!store) {
      return [];
    }

    // Flatten all synced options from all products
    const syncedOptions: any[] = [];
    for (const storeProduct of store.storeProducts) {
      for (const option of storeProduct.options) {
        if (option.is_synced_to_salla && option.salla_product_id) {
          syncedOptions.push({
            id: option.id,
            option_code: option.option_code,
            option_name: option.option_name,
            salla_product_id: option.salla_product_id,
            stock_level: option.stock_level || 1,
            salla_stock: option.salla_stock ?? 0, // Use 0 instead of null for unknown stock
            min_face_value: option.min_face_value,
            product_currency_code: option.product_currency_code || 'USD', // This is already ProductCurrencyCode
            country_iso: storeProduct.ubiqfyProduct?.country_iso || null,
            original_price_usd: option.original_price_usd, // Now contains wholesale price (cost)
            retail_price_usd: option.retail_price_usd, // Contains retail price (sale)
            wholesale_price_usd: option.wholesale_price_usd, // Duplicate for compatibility
            store_currency_price: option.store_currency_price,
            custom_price: option.custom_price,
            last_synced_at: option.last_synced_at,
            product_name: storeProduct.ubiqfyProduct?.name || 'Unknown Product',
            product_code: storeProduct.ubiqfyProduct?.product_code || 'Unknown',
            provider_code: storeProduct.ubiqfyProduct?.provider_code || 'Unknown',
            store_currency: store.salla_currency || 'USD',
          });
        }
      }
    }

    return syncedOptions.sort((a, b) => a.product_name.localeCompare(b.product_name));
  }

  /**
   * Update stock levels for multiple product options
   */
  async updateStockLevels(stockLevels: Array<{ optionId: string, stockLevel: number }>): Promise<number> {
    let updatedCount = 0;

    for (const item of stockLevels) {
      try {
        const result = await this.sallaStoreProductOptionRepo.update(
          { id: item.optionId },
          { stock_level: item.stockLevel }
        );

        if (result.affected && result.affected > 0) {
          updatedCount++;
        }
      } catch (error) {
        console.error(`Failed to update stock level for option ${item.optionId}:`, error);
        // Continue with other updates even if one fails
      }
    }

    return updatedCount;
  }

  /**
   * Get product stock from Salla API by product ID
   */
  async getSallaProductStock(accessToken: string, productId: string): Promise<any> {
    const sallaBaseUrl = this.configService.get<string>('SALLA_BASE_URL');

    try {
      const response = await fetch(`${sallaBaseUrl}/products/${productId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get product stock: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.data; // Salla API returns data in a wrapper
    } catch (error) {
      console.error(`Error fetching stock for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Refresh single product option stock from Salla API
   */
  async refreshSingleProductStock(optionId: string, sallaProductId: string): Promise<{ success: boolean, stock?: number, message?: string }> {
    try {
      // Get the product option to find the store
      const option = await this.sallaStoreProductOptionRepo.findOne({
        where: { id: optionId },
        relations: ['storeProduct', 'storeProduct.sallaStore']
      });

      if (!option || !option.storeProduct?.sallaStore) {
        return { success: false, message: 'Product option or store not found' };
      }

      // Use the salla_product_id from the database, not the passed parameter
      const actualSallaProductId = option.salla_product_id;

      if (!actualSallaProductId) {
        return { success: false, message: 'Product is not synced to Salla' };
      } const store = option.storeProduct.sallaStore;
      if (!store.salla_access_token) {
        return { success: false, message: 'Store access token not available' };
      }

      // Get product data from Salla using the correct product ID from database
      const productData = await this.getSallaProductStock(store.salla_access_token, actualSallaProductId);

      // Find the matching SKU in the product data
      let stockQuantity: number | null = null;

      if (productData.skus && Array.isArray(productData.skus)) {
        // Look for the specific SKU that matches our option
        const matchingSku = productData.skus.find(sku =>
          sku.sku === option.option_code
        );

        if (matchingSku) {
          stockQuantity = matchingSku.unlimited_quantity ? 999999 : (matchingSku.stock_quantity || 0);
        } else {
          // If no specific SKU found, use the main product quantity
          stockQuantity = productData.quantity || 0;
        }
      } else {
        // For simple products without SKUs
        stockQuantity = productData.quantity || 0;
      }

      // Update the database
      await this.sallaStoreProductOptionRepo.update(
        { id: optionId },
        {
          salla_stock: stockQuantity
        }
      );

      return {
        success: true,
        stock: stockQuantity ?? 0,
        message: `Stock updated to ${stockQuantity ?? 0}`
      };

    } catch (error) {
      console.error(`Error refreshing stock for option ${optionId}:`, error);
      return {
        success: false,
        message: error.message || 'Failed to refresh stock'
      };
    }
  }

  /**
   * Refresh stock for all synced products in a store
   */
  async refreshAllStoreStock(storeId: string): Promise<{ success: boolean, updated: number, errors: number, message: string, stockData?: any[] }> {
    try {
      const store = await this.sallaStoreRepo.findOne({ where: { id: storeId } });
      if (!store) {
        return { success: false, updated: 0, errors: 1, message: 'Store not found' };
      }

      if (!store.salla_access_token) {
        return { success: false, updated: 0, errors: 1, message: 'Store access token not available' };
      }

      // Get all synced product options for this store
      const syncedOptions = await this.getSyncedProductOptions(storeId);

      if (syncedOptions.length === 0) {
        return { success: true, updated: 0, errors: 0, message: 'No synced products found' };
      }

      let updated = 0;
      let errors = 0;
      const stockData: { optionId: string, stock: number }[] = [];

      // Process each product option
      for (const option of syncedOptions) {
        try {
          const result = await this.refreshSingleProductStock(option.id, option.salla_product_id);
          if (result.success) {
            updated++;
            // Collect stock data for UI updates
            stockData.push({
              optionId: option.id,
              stock: result.stock || 0
            });
          } else {
            errors++;
            console.error(`Failed to update stock for option ${option.id}: ${result.message}`);
          }
        } catch (error) {
          errors++;
          console.error(`Error processing option ${option.id}:`, error);
        }

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      return {
        success: true,
        updated,
        errors,
        message: `Updated ${updated} products, ${errors} errors`,
        stockData
      };

    } catch (error) {
      console.error(`Error refreshing all stock for store ${storeId}:`, error);
      return {
        success: false,
        updated: 0,
        errors: 1,
        message: error.message || 'Failed to refresh stock'
      };
    }
  }
}

