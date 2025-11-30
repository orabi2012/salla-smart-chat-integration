import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SallaStoreProduct } from './salla-store-products.entity';
import { SallaStoreProductOptionsService } from './salla-store-product-options.service';
import { SallaStore } from './salla-stores.entity';
import { UbiqfyProduct } from '../ubiqfy-products/ubiqfy-product.entity';

@Injectable()
export class SallaStoreProductsService {
  constructor(
    @InjectRepository(SallaStoreProduct)
    private readonly storeProductRepository: Repository<SallaStoreProduct>,
    @InjectRepository(SallaStore)
    private readonly sallaStoreRepository: Repository<SallaStore>,
    @InjectRepository(UbiqfyProduct)
    private readonly ubiqfyProductRepository: Repository<UbiqfyProduct>,
    private readonly optionsService: SallaStoreProductOptionsService,
  ) { }

  async linkProductsToStore(
    storeId: string,
    productCodes: string[],
  ): Promise<SallaStoreProduct[]> {
    const store = await this.sallaStoreRepository.findOne({
      where: { id: storeId },
    });
    if (!store) {
      throw new Error(`Store with ID ${storeId} not found`);
    }

    const products = await this.ubiqfyProductRepository.find({
      where: { product_code: In(productCodes) },
      relations: ['options'], // Include options for syncing
    });

    if (products.length !== productCodes.length) {
      const foundCodes = products.map((p) => p.product_code);
      const missingCodes = productCodes.filter(
        (code) => !foundCodes.includes(code),
      );
      throw new Error(
        `Products not found with codes: ${missingCodes.join(', ')}`,
      );
    }

    const storeProducts: SallaStoreProduct[] = [];

    for (const product of products) {
      // Check if relationship already exists
      const existing = await this.storeProductRepository.findOne({
        where: {
          salla_store_id: storeId,
          ubiqfy_product_id: product.id,
        },
      });

      if (!existing) {
        const storeProduct = this.storeProductRepository.create({
          salla_store_id: storeId,
          ubiqfy_product_id: product.id,
          is_active: true,
        });

        const saved = await this.storeProductRepository.save(storeProduct);
        storeProducts.push(saved);

        // Sync options for the newly linked product
        if (product.options && product.options.length > 0) {
          await this.optionsService.syncOptionsForStoreProduct(
            saved.id,
            product.options,
            {
              currency: store.salla_currency,
              conversionRate: store.currency_conversion_rate || 1.0,
            },
          );
          console.log(
            `✅ Synced ${product.options.length} options for newly linked product: ${product.name}`,
          );
        }
      } else {
        storeProducts.push(existing);

        // Also sync options for existing products to keep them up-to-date
        if (product.options && product.options.length > 0) {
          await this.optionsService.syncOptionsForStoreProduct(
            existing.id,
            product.options,
            {
              currency: store.salla_currency,
              conversionRate: store.currency_conversion_rate || 1.0,
            },
          );

          // Cleanup removed options
          const currentOptionCodes = product.options.map(
            (option) => option.product_option_code,
          );
          await this.optionsService.cleanupRemovedOptions(
            existing.id,
            currentOptionCodes,
          );

          console.log(
            `🔄 Updated ${product.options.length} options for existing product: ${product.name}`,
          );
        }
      }
    }

    return storeProducts;
  }

  async getStoreProducts(
    storeId: string,
    includeInactive = false,
  ): Promise<SallaStoreProduct[]> {
    const whereCondition: any = { salla_store_id: storeId };
    if (!includeInactive) {
      whereCondition.is_active = true;
    }

    return this.storeProductRepository.find({
      where: whereCondition,
      relations: ['ubiqfyProduct', 'ubiqfyProduct.options'],
      order: { created_at: 'DESC' },
    });
  }

  async unlinkProductFromStore(
    storeId: string,
    productId: string,
  ): Promise<void> {
    await this.storeProductRepository.delete({
      salla_store_id: storeId,
      ubiqfy_product_id: productId,
    });
  }

  async updateStoreProduct(
    id: string,
    updates: Partial<SallaStoreProduct>,
  ): Promise<SallaStoreProduct> {
    await this.storeProductRepository.update(id, updates);
    const updatedProduct = await this.storeProductRepository.findOne({
      where: { id },
      relations: ['ubiqfyProduct', 'ubiqfyProduct.options'],
    });

    if (!updatedProduct) {
      throw new Error(`Store product with ID ${id} not found after update`);
    }

    return updatedProduct;
  }

  async toggleProductActive(
    storeId: string,
    productId: string,
  ): Promise<SallaStoreProduct> {
    const storeProduct = await this.storeProductRepository.findOne({
      where: {
        salla_store_id: storeId,
        ubiqfy_product_id: productId,
      },
    });

    if (!storeProduct) {
      throw new Error('Store product relationship not found');
    }

    storeProduct.is_active = !storeProduct.is_active;
    return this.storeProductRepository.save(storeProduct);
  }

  async bulkLinkProducts(
    storeId: string,
    productData: Array<{
      productCode: string;
      optionCode?: string;
      customPrice?: number;
      markupPercentage?: number;
      isActive?: boolean;
      // Essential pricing data from Ubiqfy API
      minValue?: number;
      maxValue?: number;
      minFaceValue?: number;
      productCurrencyCode?: string;
      minWholesaleValue?: number;
      maxWholesaleValue?: number;
    }>,
  ): Promise<SallaStoreProduct[]> {
    console.log(
      '🔄 BulkLinkProducts called with data:',
      JSON.stringify(productData, null, 2),
    );

    // Get store information for currency conversion
    const store = await this.sallaStoreRepository.findOne({
      where: { id: storeId },
    });
    if (!store) {
      throw new Error(`Store with ID ${storeId} not found`);
    }

    const storeInfo = {
      currency: store.salla_currency,
      conversionRate: store.currency_conversion_rate || 1.0,
    };

    const productCodes = [...new Set(productData.map((p) => p.productCode))]; // Remove duplicates
    const products = await this.ubiqfyProductRepository.find({
      where: { product_code: In(productCodes) },
      relations: ['options'],
    });

    const storeProducts: SallaStoreProduct[] = [];
    const processedProductIds = new Set<string>();

    for (const productInfo of productData) {
      console.log(`Processing product data:`, productInfo);

      const product = products.find(
        (p) => p.product_code === productInfo.productCode,
      );
      if (!product) {
        console.log(`⚠️  Product not found: ${productInfo.productCode}`);
        continue; // Skip if product not found
      }

      // Create store product if not already processed
      let storeProduct: SallaStoreProduct | null = null;
      if (!processedProductIds.has(product.id)) {
        // Check if relationship already exists
        storeProduct = await this.storeProductRepository.findOne({
          where: {
            salla_store_id: storeId,
            ubiqfy_product_id: product.id,
          },
        });

        if (storeProduct) {
          // Update existing
          storeProduct.is_active =
            productInfo.isActive !== undefined
              ? productInfo.isActive
              : storeProduct.is_active;
          console.log(`📝 Updated existing store product: ${storeProduct.id}`);
        } else {
          // Create new
          storeProduct = this.storeProductRepository.create({
            salla_store_id: storeId,
            ubiqfy_product_id: product.id,
            is_active:
              productInfo.isActive !== undefined ? productInfo.isActive : true,
          });
          console.log(
            `🆕 Created new store product for: ${product.product_code}`,
          );
        }

        storeProduct = await this.storeProductRepository.save(storeProduct);
        storeProducts.push(storeProduct);
        processedProductIds.add(product.id);
      } else {
        // Get the already processed store product
        const existingStoreProduct = storeProducts.find(
          (sp) => sp.ubiqfy_product_id === product.id,
        );
        if (existingStoreProduct) {
          storeProduct = existingStoreProduct;
        } else {
          storeProduct = await this.storeProductRepository.findOne({
            where: {
              salla_store_id: storeId,
              ubiqfy_product_id: product.id,
            },
          });
        }
        console.log(`🔄 Reusing existing store product: ${storeProduct?.id}`);
      }

      // Handle option-level data if provided
      if (productInfo.optionCode && storeProduct) {
        const ubiqfyOption = product.options?.find(
          (opt) => opt.product_option_code === productInfo.optionCode,
        );
        if (ubiqfyOption) {
          console.log(
            `💰 Processing option ${productInfo.optionCode} with customPrice: ${productInfo.customPrice}, markup: ${productInfo.markupPercentage}%`,
          );

          // Prepare frontend pricing data 
          const frontendPricingData = {
            minValue: productInfo.minValue,
            maxValue: productInfo.maxValue,
            minFaceValue: productInfo.minFaceValue,
            productCurrencyCode: productInfo.productCurrencyCode,
            minWholesaleValue: productInfo.minWholesaleValue,
            maxWholesaleValue: productInfo.maxWholesaleValue,
          };

          // Create or update the option with custom pricing
          const savedOption =
            await this.optionsService.createOrUpdateOptionWithCustomPricing(
              storeProduct.id,
              ubiqfyOption,
              productInfo.customPrice,
              productInfo.markupPercentage,
              productInfo.isActive,
              frontendPricingData,
              storeInfo, // Pass store currency information
            );

          console.log(
            `✅ Option saved with ID: ${savedOption.id}, custom_price: ${savedOption.custom_price}, markup: ${savedOption.markup_percentage}%`,
          );
        } else {
          console.log(
            `⚠️  Option not found: ${productInfo.optionCode} for product ${productInfo.productCode}`,
          );
        }
      }
    }

    console.log(
      `✅ BulkLinkProducts completed. Processed ${storeProducts.length} store products.`,
    );
    return storeProducts;
  }

  async getSyncedProducts(storeId: string): Promise<any[]> {
    // Now we need to get synced options since sync status is at option level
    const storeProducts = await this.storeProductRepository.find({
      where: {
        salla_store_id: storeId,
        is_active: true,
      },
      relations: ['ubiqfyProduct', 'options'],
    });

    const results: any[] = [];

    for (const storeProduct of storeProducts) {
      // Check if any options are synced
      const syncedOptions =
        storeProduct.options?.filter((option) => option.salla_product_id) || [];

      if (syncedOptions.length > 0) {
        results.push({
          id: storeProduct.id,
          productCode: storeProduct.ubiqfyProduct.product_code,
          productName: storeProduct.ubiqfyProduct.name,
          isActive: storeProduct.is_active,
          syncedOptionsCount: syncedOptions.length,
          totalOptionsCount: storeProduct.options?.length || 0,
          options: syncedOptions.map((option) => ({
            id: option.id,
            optionCode: option.option_code,
            optionName: option.option_name,
            customPrice: option.custom_price,
            markupPercentage: option.markup_percentage,
            sallaProductId: option.salla_product_id,
            lastSyncedAt: option.last_synced_at,
          })),
          linkedAt: storeProduct.created_at,
          updatedAt: storeProduct.updated_at,
        });
      }
    }

    return results;
  }

  /**
   * Sync options for all linked products in a store
   * This should be called after linking products to ensure options are up-to-date
   */
  async syncOptionsForStore(storeId: string): Promise<void> {
    const store = await this.sallaStoreRepository.findOne({
      where: { id: storeId },
    });
    if (!store) {
      throw new Error(`Store with ID ${storeId} not found`);
    }

    const storeProducts = await this.storeProductRepository.find({
      where: { salla_store_id: storeId, is_active: true },
      relations: ['ubiqfyProduct', 'ubiqfyProduct.options'],
    });

    for (const storeProduct of storeProducts) {
      if (
        storeProduct.ubiqfyProduct.options &&
        storeProduct.ubiqfyProduct.options.length > 0
      ) {
        // Sync options for this product
        await this.optionsService.syncOptionsForStoreProduct(
          storeProduct.id,
          storeProduct.ubiqfyProduct.options,
          {
            currency: store.salla_currency,
            conversionRate: store.currency_conversion_rate || 1.0,
          },
        );

        // Cleanup removed options
        const currentOptionCodes = storeProduct.ubiqfyProduct.options.map(
          (option) => option.product_option_code,
        );
        await this.optionsService.cleanupRemovedOptions(
          storeProduct.id,
          currentOptionCodes,
        );

        console.log(
          `✅ Synced ${storeProduct.ubiqfyProduct.options.length} options for product: ${storeProduct.ubiqfyProduct.name}`,
        );
      }
    }
  }

  /**
   * Get store product with its options
   */
  async getStoreProductWithOptions(storeProductId: string) {
    const storeProduct = await this.storeProductRepository.findOne({
      where: { id: storeProductId },
      relations: ['ubiqfyProduct', 'sallaStore', 'options'],
    });

    if (!storeProduct) {
      throw new Error('Store product not found');
    }

    return storeProduct;
  }

  /**
   * Migrate existing store products to use the new options system
   * This should be called once to populate the options table for existing products
   */
  async migrateExistingProductsToNewSystem(): Promise<{
    processed: number;
    created: number;
    errors: { productCode: string; error: string }[];
  }> {
    console.log(
      '🚀 Starting migration of existing products to new options system...',
    );

    const result = {
      processed: 0,
      created: 0,
      errors: [] as { productCode: string; error: string }[],
    };

    try {
      // Get all existing store products with their Ubiqfy product and options
      const storeProducts = await this.storeProductRepository.find({
        relations: ['ubiqfyProduct', 'ubiqfyProduct.options', 'options', 'sallaStore'],
      });

      console.log(`📋 Found ${storeProducts.length} store products to process`);

      for (const storeProduct of storeProducts) {
        try {
          result.processed++;

          // Skip if this product already has options in the new system
          if (storeProduct.options && storeProduct.options.length > 0) {
            console.log(
              `⏭️  Skipping ${storeProduct.ubiqfyProduct.product_code} - already has options in new system`,
            );
            continue;
          }

          // Skip if the Ubiqfy product doesn't have options
          if (
            !storeProduct.ubiqfyProduct.options ||
            storeProduct.ubiqfyProduct.options.length === 0
          ) {
            console.log(
              `⏭️  Skipping ${storeProduct.ubiqfyProduct.product_code} - no Ubiqfy options available`,
            );
            continue;
          }

          console.log(
            `🔄 Migrating ${storeProduct.ubiqfyProduct.product_code} with ${storeProduct.ubiqfyProduct.options.length} options`,
          );

          // Sync options for this product
          const createdOptions =
            await this.optionsService.syncOptionsForStoreProduct(
              storeProduct.id,
              storeProduct.ubiqfyProduct.options,
              {
                currency: storeProduct.sallaStore.salla_currency,
                conversionRate: storeProduct.sallaStore.currency_conversion_rate || 1.0,
              },
            );

          result.created += createdOptions.length;
          console.log(
            `✅ Created ${createdOptions.length} options for ${storeProduct.ubiqfyProduct.product_code}`,
          );
        } catch (error) {
          console.error(
            `❌ Error migrating ${storeProduct.ubiqfyProduct.product_code}:`,
            error.message,
          );
          result.errors.push({
            productCode: storeProduct.ubiqfyProduct.product_code,
            error: error.message,
          });
        }
      }

      console.log(
        `🎉 Migration completed! Processed: ${result.processed}, Created: ${result.created}, Errors: ${result.errors.length}`,
      );
      return result;
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }
}
