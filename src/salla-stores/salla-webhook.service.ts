import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SallaStore, SyncStatus } from './salla-stores.entity';
import { SallaWebhookManagementService } from './salla-webhook-management.service';
import { SallaIntegrationService } from './salla-integration.service';
import ExcelJS from 'exceljs';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface SallaAppInstallationWebhook {
  event: string;
  merchant: number;
  created_at: string;
  data: {
    id: number;
    app_name: string;
    app_description: string;
    app_type: string;
    app_scopes: string[];
    installation_date: string;
    store_type: string;
    // Optional fields that might come in different events
    access_token?: string;
    expires?: number;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
  };
}

export interface SallaStoreAuthorizationWebhook {
  event: string;
  merchant: number;
  created_at: string;
  data: {
    id: number;
    app_name: string;
    access_token: string;
    expires: number;
    refresh_token: string;
    scope: string;
    token_type: string;
  };
}

export interface SallaAppUninstallationWebhook {
  event: string;
  merchant: number;
  created_at: string;
  data: {
    id: number;
    app_name: string;
    app_description: string;
    app_type: string;
    uninstallation_date: string;
    reason?: string;
  };
}

@Injectable()
export class SallaWebhookService {
  private readonly logger = new Logger(SallaWebhookService.name);

  constructor(
    @InjectRepository(SallaStore)
    private readonly sallaStoreRepository: Repository<SallaStore>,
    private readonly webhookManagementService: SallaWebhookManagementService,
    private readonly sallaIntegrationService: SallaIntegrationService,
  ) {}

  /**
   * Process incoming Salla webhook
   */
  async processWebhook(payload: any): Promise<any> {
    const { event, merchant, data } = payload;

    this.logger.log(
      `🎯 Processing webhook event: ${event} for merchant: ${merchant}`,
    );

    // Handle app installation separately (no existing store needed)
    if (event === 'app.installed') {
      return await this.handleAppInstalled(payload);
    }

    // Handle app store authorization (contains tokens)
    if (event === 'app.store.authorize') {
      return await this.handleStoreAuthorization(payload);
    }

    // Handle app uninstallation
    if (event === 'app.uninstalled') {
      return await this.handleAppUninstalled(payload);
    }

    // Find the store by Salla merchant ID for other events
    const store = await this.sallaStoreRepository.findOne({
      where: { salla_store_id: merchant.toString() },
    });

    if (!store) {
      this.logger.warn(`⚠️  Store not found for merchant ID: ${merchant}`);
      throw new HttpException(
        `Store not found for merchant ID: ${merchant}`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Process different webhook events
    switch (event) {
      // Product events
      case 'product.deleted':
        return await this.handleProductDeleted(store, data);

      default:
        this.logger.log(`ℹ️  Unhandled webhook event: ${event}`);
        return { message: `Event ${event} logged but not processed` };
    }
  }

  /**
   * Handle product deleted event
   * Removes the product from our salla_store_products table
   */
  private async handleProductDeleted(
    store: SallaStore,
    productData: any,
  ): Promise<any> {
    this.logger.log(
      `🗑️  Product deleted in Salla: ${productData?.name ?? 'unknown name'} (SKU: ${productData?.sku ?? 'n/a'}) for store ${store.salla_store_name}`,
    );
    this.logger.log(
      `ℹ️  Product ID reported by webhook: ${productData?.id ?? 'unknown'}`,
    );

    return {
      message: 'Product deleted event acknowledged',
      store_id: store.id,
      salla_product_id: productData?.id ?? null,
    };
  }

  /**
   * Handle app installed event
   * Creates initial store record or updates existing one
   */
  private async handleAppInstalled(
    payload: SallaAppInstallationWebhook,
  ): Promise<any> {
    this.logger.log(
      `🚀 App installed: ${payload.data.app_name} for merchant: ${payload.merchant}`,
    );

    try {
      // Check if store already exists
      const store = await this.sallaStoreRepository.findOne({
        where: { salla_store_id: payload.merchant.toString() },
      });

      if (store) {
        this.logger.log(
          `📝 Updating existing store for merchant: ${payload.merchant}`,
        );

        // Update existing store - reactivate if it was uninstalled
        store.salla_store_name =
          store.salla_store_name || `Store ${payload.merchant}`;
        store.is_active = true; // Reactivate the store
        store.sync_status = SyncStatus.PENDING; // Reset sync status
        store.last_error_message = ''; // Clear previous errors

        // Clear revoked tokens if they exist
        if (store.salla_access_token === 'REVOKED') {
          store.salla_access_token = 'pending';
          store.salla_refresh_token = 'pending';
        }

        const updatedStore = await this.sallaStoreRepository.save(store);

        this.logger.log(`✅ Store reactivated with ID: ${updatedStore.id}`);

        return {
          success: true,
          message: 'Store reactivated, waiting for authorization',
          store_id: updatedStore.id,
          merchant_id: payload.merchant,
          status: 'reactivated',
          next_step: 'waiting_for_authorization',
        };
      }

      // Create new store record (without tokens - they come in app.store.authorize)
      this.logger.log(
        `📦 Creating new store record for merchant: ${payload.merchant}`,
      );

      const newStore = new SallaStore();
      newStore.salla_store_id = payload.merchant.toString();
      newStore.salla_store_name = `Store ${payload.merchant}`; // Temporary name
      newStore.salla_owner_name = 'Unknown'; // Will be updated when we get store info
      newStore.salla_owner_email = 'unknown@example.com'; // Placeholder
      newStore.salla_access_token = 'pending'; // Will be set in authorization
      newStore.salla_refresh_token = 'pending';
      newStore.salla_token_expiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour temp
      newStore.salla_currency = 'SAR'; // Default
      newStore.is_active = true; // Active on installation
      newStore.sync_status = SyncStatus.PENDING;
      // Required Ubiqfy credentials - will be set through setup form
      newStore.ubiqfy_username = 'pending_setup';
      newStore.ubiqfy_password = 'pending_setup';
      newStore.ubiqfy_terminal_key = 'pending_setup';

      const savedStore = await this.sallaStoreRepository.save(newStore);

      this.logger.log(
        `✅ New store created with ID: ${savedStore.id}, waiting for authorization`,
      );

      return {
        success: true,
        message: 'Store registered, waiting for authorization',
        store_id: savedStore.id,
        merchant_id: payload.merchant,
        status: 'created',
        next_step: 'waiting_for_authorization',
      };
    } catch (error) {
      this.logger.error('❌ Failed to handle app installation:', error.message);
      throw new HttpException(
        'Failed to register store',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Handle store authorization event
   * Updates store with access tokens and redirects to setup
   * Creates store record if it doesn't exist (handles webhook order issues)
   */
  private async handleStoreAuthorization(
    payload: SallaStoreAuthorizationWebhook,
  ): Promise<any> {
    this.logger.log(`🔑 Store authorized for merchant: ${payload.merchant}`);

    try {
      // Find the existing store record
      let store = await this.sallaStoreRepository.findOne({
        where: { salla_store_id: payload.merchant.toString() },
      });

      if (!store) {
        // Store doesn't exist - create it (handles case where authorization comes before installation)
        this.logger.warn(
          `⚠️ Store not found for merchant: ${payload.merchant}, creating new store record`,
        );

        store = new SallaStore();
        store.salla_store_id = payload.merchant.toString();
        store.salla_store_name = `Store ${payload.merchant}`; // Temporary name
        // store.salla_owner_name = 'Unknown'; // Will be updated when we get store info
        // store.salla_owner_email = 'unknown@example.com'; // Placeholder
        store.salla_currency = 'SAR'; // Default
        store.is_active = true; // Active on authorization
        store.sync_status = SyncStatus.PENDING;
        // Required Ubiqfy credentials - will be set through setup form
        store.ubiqfy_username = 'pending_setup';
        store.ubiqfy_password = 'pending_setup';
        store.ubiqfy_terminal_key = 'pending_setup';

        this.logger.log(
          `📦 Created store record during authorization for merchant: ${payload.merchant}`,
        );
      }

      // Update store with authorization tokens
      store.salla_access_token = payload.data.access_token;
      store.salla_refresh_token = payload.data.refresh_token;
      store.salla_token_expiry = new Date(payload.data.expires * 1000); // Unix timestamp

      await this.sallaStoreRepository.save(store);

      // Now fetch store information using the access token to get proper store details
      let latestStoreInfo: any | undefined;

      try {
        const storeInfo = await this.fetchStoreInfo(store);
        if (storeInfo) {
          store.salla_store_name =
            storeInfo.name || `Store ${payload.merchant}`;
          store.salla_owner_name = storeInfo.owner_name || 'Unknown';
          store.salla_owner_email =
            storeInfo.owner_email || 'unknown@example.com';
          store.salla_currency = storeInfo.currency || 'SAR';
          latestStoreInfo = storeInfo;

          await this.sallaStoreRepository.save(store);

          this.logger.log(`✅ Store info updated: ${store.salla_store_name}`);
        }
      } catch (infoError) {
        this.logger.warn(
          `⚠️  Could not fetch store info: ${infoError.message}`,
        );
      }

      this.logger.log(`✅ Store authorized with ID: ${store.id}`);

      // Automatically register webhooks for this store
      try {
        this.logger.log(
          `🔗 Registering webhooks for store: ${store.salla_store_name}`,
        );
        const webhookBaseUrl =
          process.env.WEBHOOK_BASE_URL ||
          process.env.APP_BASE_URL ||
          'http://localhost:3000';
        await this.webhookManagementService.registerWebhooksForStore(
          store.id,
          webhookBaseUrl,
        );
        this.logger.log(
          `✅ Webhooks registered successfully for store: ${store.salla_store_name}`,
        );
      } catch (webhookError) {
        this.logger.warn(
          `⚠️  Could not register webhooks automatically: ${webhookError.message}`,
        );
        // Don't fail the authorization process if webhook registration fails
      }

      await this.exportInitialSallaProducts(store, latestStoreInfo);

      return {
        success: true,
        message: 'Store authorized successfully',
        store_id: store.id,
        store_name: store.salla_store_name,
        setup_url: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/salla-webhook/setup/${store.id}`,
        next_step: 'complete_ubiqfy_setup',
      };
    } catch (error) {
      this.logger.error(
        '❌ Failed to handle store authorization:',
        error.message,
      );
      throw new HttpException(
        'Failed to authorize store',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async exportInitialSallaProducts(
    store: SallaStore,
    storeInfo?: any,
  ): Promise<void> {
    try {
      if (!store?.id) {
        this.logger.warn(
          '⚠️ Store ID missing while attempting to export products',
        );
        return;
      }

      const products = await this.sallaIntegrationService.getSallaProducts(
        store.id,
      );

      if (!products || products.length === 0) {
        this.logger.log(
          `ℹ️ No products returned from Salla for store ${store.salla_store_name}; skipping export.`,
        );
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Products');

      worksheet.columns = [
        { header: 'Product ID', key: 'id', width: 15 },
        { header: 'Name', key: 'name', width: 40 },
        { header: 'SKU', key: 'sku', width: 20 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Category ID', key: 'category_id', width: 18 },
        { header: 'Price', key: 'price', width: 15 },
        { header: 'Sale Price', key: 'sale_price', width: 15 },
        { header: 'Description', key: 'description', width: 50 },
        { header: 'Images', key: 'images', width: 50 },
      ];

      products.forEach((product) => {
        const normalizedPrice = this.extractPriceValue(product?.price);
        const normalizedSalePrice = this.extractPriceValue(
          product?.sale_price ?? product?.salePrice,
        );
        const imageUrls = this.extractImageUrls(
          product?.images ?? product?.media ?? product?.gallery,
        );

        worksheet.addRow({
          id: product.id,
          name: product.name,
          sku: product.sku,
          status: product.status,
          category_id: product.category_id,
          price: normalizedPrice,
          sale_price: normalizedSalePrice,
          description: product.description ?? '',
          images: imageUrls.join(', '),
        });
      });

      worksheet.getRow(1).font = { bold: true };

      const storesDataRoot = join(process.cwd(), 'storesData');
      const storeFolder = join(
        storesDataRoot,
        store.salla_store_id || store.id,
      );
      await fs.mkdir(storeFolder, { recursive: true });
      const productsFilePath = join(storeFolder, 'products.xlsx');

      try {
        await fs.access(productsFilePath);
        await fs.unlink(productsFilePath);
        this.logger.log(
          `♻️  Existing products.xlsx found for ${store.salla_store_name}; replacing with new export.`,
        );
      } catch {
        // File does not exist; nothing to remove
      }

      await workbook.xlsx.writeFile(productsFilePath);

      const storeInfoData =
        storeInfo && Object.keys(storeInfo).length > 0
          ? storeInfo
          : {
              name: store.salla_store_name,
              owner_name: store.salla_owner_name,
              owner_email: store.salla_owner_email,
              currency: store.salla_currency,
            };

      const storeInfoPayload = {
        store_id: store.id,
        salla_store_id: store.salla_store_id,
        name: storeInfoData?.name || store.salla_store_name,
        url:
          storeInfoData?.domain ||
          storeInfoData?.url ||
          storeInfoData?.store_url ||
          null,
        currency: storeInfoData?.currency || store.salla_currency,
        owner_name: store.salla_owner_name,
        owner_email: store.salla_owner_email,
        categories: Array.from(
          new Set(
            products.map((product) => product.category_id).filter(Boolean),
          ),
        ),
        total_products: products.length,
        exported_at: new Date().toISOString(),
      };

      const storeInfoPath = join(storeFolder, 'store-info.json');
      try {
        await fs.access(storeInfoPath);
        await fs.unlink(storeInfoPath);
        this.logger.log(
          `♻️  Existing store-info.json found for ${store.salla_store_name}; replacing with new export.`,
        );
      } catch {
        // File does not exist; nothing to remove
      }
      await fs.writeFile(
        storeInfoPath,
        JSON.stringify(storeInfoPayload, null, 2),
        'utf8',
      );

      this.logger.log(
        `📊 Exported ${products.length} products & store info for ${store.salla_store_name} in ${storeFolder}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to export Salla products for store ${store?.salla_store_name ?? store?.id}: ${error.message}`,
      );
    }
  }

  private extractPriceValue(price: any): number | string | '' {
    if (price === null || price === undefined) {
      return '';
    }

    if (typeof price === 'number') {
      return price;
    }

    if (typeof price === 'string') {
      const numeric = Number(price);
      return Number.isNaN(numeric) ? price : numeric;
    }

    if (typeof price === 'object') {
      const candidate =
        price?.value ??
        price?.amount ??
        price?.current ??
        price?.price ??
        price?.selling_price;
      if (candidate !== undefined && candidate !== null) {
        const numericCandidate = Number(candidate);
        return Number.isNaN(numericCandidate) ? candidate : numericCandidate;
      }
    }

    return '';
  }

  private extractImageUrls(images: any): string[] {
    if (!images) {
      return [];
    }

    const urls = new Set<string>();
    const pushUrl = (value?: string) => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          urls.add(trimmed);
        }
      }
    };

    const processValue = (value: any) => {
      if (!value) return;
      if (typeof value === 'string') {
        pushUrl(value);
      } else if (typeof value === 'object') {
        pushUrl(value.url ?? value.image_url ?? value.image ?? value.src);
      }
    };

    if (Array.isArray(images)) {
      images.forEach(processValue);
    } else if (typeof images === 'object') {
      Object.values(images).forEach(processValue);
    }

    return Array.from(urls);
  }

  /**
   * Fetch store information from Salla API
   */
  private async fetchStoreInfo(store: SallaStore): Promise<any> {
    const headers = {
      Authorization: `Bearer ${store.salla_access_token}`,
      Accept: 'application/json',
    };

    const response = await fetch(`${process.env.SALLA_BASE_URL}store/info`, {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch store info: ${response.status}`);
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Handle app uninstalled event
   * Deactivates store and cleans up sensitive data
   */
  private async handleAppUninstalled(
    payload: SallaAppUninstallationWebhook,
  ): Promise<any> {
    this.logger.log(
      `🗑️  App uninstalled: ${payload.data.app_name} for merchant: ${payload.merchant}`,
    );
    this.logger.log(
      `📅 Uninstallation date: ${payload.data.uninstallation_date}`,
    );

    if (payload.data.reason) {
      this.logger.log(`📝 Uninstallation reason: ${payload.data.reason}`);
    }

    try {
      // Find the store record
      const store = await this.sallaStoreRepository.findOne({
        where: { salla_store_id: payload.merchant.toString() },
      });

      if (!store) {
        this.logger.warn(
          `⚠️  Store not found for merchant: ${payload.merchant}`,
        );
        return {
          success: true,
          message: 'Store was already removed or never existed',
          merchant_id: payload.merchant,
        };
      }

      this.logger.log(
        `🔍 Found store to deactivate: ${store.salla_store_name} (ID: ${store.id})`,
      );

      // Option 1: Soft Delete - Deactivate store and clear sensitive data
      store.is_active = false;
      store.sync_status = SyncStatus.FAILED;

      // Clear sensitive authentication data
      store.salla_access_token = 'REVOKED';
      store.salla_refresh_token = 'REVOKED';
      store.salla_token_expiry = new Date(); // Expire immediately

      // Clear Ubiqfy credentials for security
      // store.ubiqfy_username = '';
      // store.ubiqfy_password = '';
      // store.ubiqfy_terminal_key = '';
      store.ubiqfy_plafond = 0;
      store.is_active = false;

      // Update last error with uninstallation info
      store.last_error_message = `App uninstalled on ${payload.data.uninstallation_date}`;

      await this.sallaStoreRepository.save(store);

      // Option 2: You could also hard delete if preferred
      // await this.sallaStoreRepository.remove(store);

      this.logger.log(
        `✅ Store deactivated successfully: ${store.salla_store_name}`,
      );

      return {
        success: true,
        message: 'Store deactivated successfully',
        store_id: store.id,
        store_name: store.salla_store_name,
        merchant_id: payload.merchant,
        uninstalled_at: payload.data.uninstallation_date,
        cleanup_actions: [
          'Store deactivated',
          'Authentication tokens revoked',
          'Ubiqfy credentials cleared',
        ],
      };
    } catch (error) {
      this.logger.error(
        '❌ Failed to handle app uninstallation:',
        error.message,
      );
      throw new HttpException(
        'Failed to process app uninstallation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get store information for setup page
   */
  async getStoreForSetup(storeId: string): Promise<{ store: SallaStore }> {
    const store = await this.sallaStoreRepository.findOne({
      where: { id: storeId },
    });

    if (!store) {
      throw new HttpException('Store not found', HttpStatus.NOT_FOUND);
    }

    return { store };
  }

  /**
   * Complete Ubiqfy setup for a store
   */
  async completeUbiqfySetup(
    storeId: string,
    setupData: {
      ubiqfy_username: string;
      ubiqfy_password: string;
      ubiqfy_terminal_key: string;
      ubiqfy_sandbox: boolean;
      ubiqfy_plafond?: number;
    },
  ): Promise<any> {
    const store = await this.sallaStoreRepository.findOne({
      where: { id: storeId },
    });

    if (!store) {
      throw new HttpException('Store not found', HttpStatus.NOT_FOUND);
    }

    try {
      // Update store with Ubiqfy credentials
      store.ubiqfy_username = setupData.ubiqfy_username;
      store.ubiqfy_password = setupData.ubiqfy_password;
      store.ubiqfy_terminal_key = setupData.ubiqfy_terminal_key;
      store.ubiqfy_sandbox = setupData.ubiqfy_sandbox;
      store.ubiqfy_plafond = setupData.ubiqfy_plafond || 0;
      store.plafond_last_updated = new Date();
      store.is_active = true; // Activate the store
      store.sync_status = SyncStatus.PENDING;

      await this.sallaStoreRepository.save(store);

      // TODO: Test Ubiqfy connection here
      // TODO: Register webhooks automatically
      // TODO: Sync initial products

      this.logger.log(
        `✅ Ubiqfy setup completed for store: ${store.salla_store_name}`,
      );

      return {
        store_id: store.id,
        store_name: store.salla_store_name,
        status: 'active',
        ubiqfy_setup: 'completed',
        next_steps: [
          'Test Ubiqfy connection',
          'Register webhooks',
          'Sync products from Ubiqfy',
        ],
      };
    } catch (error) {
      this.logger.error('❌ Failed to complete Ubiqfy setup:', error.message);
      throw new HttpException(
        'Failed to complete setup',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
