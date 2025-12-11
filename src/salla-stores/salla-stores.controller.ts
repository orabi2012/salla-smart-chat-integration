import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SallaStoresService } from './salla-stores.service';
import { SallaWebhookManagementService } from './salla-webhook-management.service';
import { SallaStore, SyncStatus } from './salla-stores.entity';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { StoreAccessGuard } from '../auth/store-access.guard';
import { isValidUUID } from '../utils/uuid.helper';
import { SallaIntegrationService } from './salla-integration.service';

type SimplifiedProduct = {
  sku: string | null;
  type: string | null;
  name: string | null;
  customer_url: string | null;
  price_amount: number | string | null;
  price_currency: string | null;
  description: string | null;
  quantity: number | string | null;
  status: string | null;
  is_available: boolean | string | null;
  sale_price_amount: number | string | null;
  sale_end: string | null;
  main_image: string | null;
  primary_category_name: string | null;
};

@Controller('salla-stores')
export class SallaStoresController {
  constructor(
    private readonly sallaStoresService: SallaStoresService,
    private readonly sallaWebhookManagementService: SallaWebhookManagementService,
    private readonly sallaIntegrationService: SallaIntegrationService,
  ) { }

  private validateUUID(id: string): void {
    if (!isValidUUID(id)) {
      throw new HttpException('Invalid UUID format', HttpStatus.BAD_REQUEST);
    }
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
  async create(@Body() createStoreDto: Partial<SallaStore>) {
    if (!createStoreDto.salla_store_id) {
      throw new HttpException(
        'Salla Store ID is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existingStore = await this.sallaStoresService.findBySallaStoreId(
      createStoreDto.salla_store_id,
    );
    if (existingStore) {
      throw new HttpException('Store already exists', HttpStatus.CONFLICT);
    }

    try {
      return await this.sallaStoresService.create(createStoreDto);
    } catch (error) {
      throw new HttpException(
        'Failed to create store',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
  async findAll() {
    return await this.sallaStoresService.findAll();
  }

  @Get('active')
  @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
  async findActiveStores() {
    return await this.sallaStoresService.findActiveStores();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), StoreAccessGuard)
  async findById(@Param('id') id: string) {
    this.validateUUID(id);
    const store = await this.sallaStoresService.findById(id);
    if (!store) {
      throw new HttpException('Store not found', HttpStatus.NOT_FOUND);
    }
    return store;
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
  async update(
    @Param('id') id: string,
    @Body() updateData: Partial<SallaStore>,
  ) {
    this.validateUUID(id);
    const updatedStore = await this.sallaStoresService.update(id, updateData);
    if (!updatedStore) {
      throw new HttpException('Store not found', HttpStatus.NOT_FOUND);
    }
    return updatedStore;
  }

  @Get(':sallaStoreId/products')
  async getStoreProducts(@Param('sallaStoreId') sallaStoreId: string) {
    const { simplifiedProducts } =
      await this.getSimplifiedProductsForStore(sallaStoreId);

    return simplifiedProducts;
  }

  @Get(':sallaStoreId/products/html')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async getStoreProductsHtml(@Param('sallaStoreId') sallaStoreId: string) {
    const { store, simplifiedProducts } =
      await this.getSimplifiedProductsForStore(sallaStoreId);

    return this.renderProductsHtml(store, simplifiedProducts);
  }

  @Put(':id/toggle-active')
  @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
  async toggleActive(@Param('id') id: string) {
    this.validateUUID(id);
    const updatedStore = await this.sallaStoresService.toggleActive(id);
    if (!updatedStore) {
      throw new HttpException('Store not found', HttpStatus.NOT_FOUND);
    }
    return updatedStore;
  }

  @Put(':id/sync-status')
  @UseGuards(AuthGuard('jwt'))
  async updateSyncStatus(
    @Param('id') id: string,
    @Body() body: { status: SyncStatus; errorMessage?: string },
  ) {
    this.validateUUID(id);
    await this.sallaStoresService.updateSyncStatus(
      id,
      body.status,
      body.errorMessage,
    );
    return { message: 'Sync status updated successfully' };
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async delete(@Param('id') id: string) {
    this.validateUUID(id);
    const store = await this.sallaStoresService.findById(id);
    if (!store) {
      throw new HttpException('Store not found', HttpStatus.NOT_FOUND);
    }
    await this.sallaStoresService.delete(id);
    return { message: 'Store deleted successfully' };
  }

  // =====================
  // WEBHOOK MANAGEMENT
  // =====================

  /**
   * Register webhooks for a store
   * POST /salla-stores/:id/webhooks/register
   * Body: { "webhook_base_url": "https://yourdomain.com" }
   */
  @Post(':id/webhooks/register')
  @UseGuards(AuthGuard('jwt'))
  async registerWebhooks(
    @Param('id') id: string,
    @Body() body: { webhook_base_url: string },
  ) {
    this.validateUUID(id);

    if (!body.webhook_base_url) {
      throw new HttpException(
        'webhook_base_url is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const results =
        await this.sallaWebhookManagementService.registerWebhooksForStore(
          id,
          body.webhook_base_url,
        );

      return {
        message: 'Webhook registration completed',
        success: true,
        data: {
          total_webhooks: results.length,
          successful: results.filter((r) => r.status === 'success').length,
          failed: results.filter((r) => r.status === 'failed').length,
          results: results,
        },
      };
    } catch (error) {
      throw new HttpException(
        `Failed to register webhooks: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * List webhooks for a store
   * GET /salla-stores/:id/webhooks
   */
  @Get(':id/webhooks')
  @UseGuards(AuthGuard('jwt'))
  async listWebhooks(@Param('id') id: string) {
    this.validateUUID(id);

    try {
      const webhooks =
        await this.sallaWebhookManagementService.listWebhooks(id);
      return {
        message: 'Webhooks retrieved successfully',
        success: true,
        data: webhooks,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to list webhooks: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get available webhook events
   * GET /salla-stores/:id/webhooks/events
   */
  @Get(':id/webhooks/events')
  @UseGuards(AuthGuard('jwt'))
  async getWebhookEvents(@Param('id') id: string) {
    this.validateUUID(id);

    try {
      const events =
        await this.sallaWebhookManagementService.getWebhookEvents(id);
      return {
        message: 'Webhook events retrieved successfully',
        success: true,
        data: events,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get webhook events: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Deactivate a specific webhook
   * DELETE /salla-stores/:id/webhooks/:webhook_id
   */
  @Delete(':id/webhooks/:webhook_id')
  @UseGuards(AuthGuard('jwt'))
  async deactivateWebhook(
    @Param('id') id: string,
    @Param('webhook_id') webhookId: string,
  ) {
    this.validateUUID(id);

    try {
      const result = await this.sallaWebhookManagementService.deactivateWebhook(
        id,
        parseInt(webhookId),
      );
      return {
        message: 'Webhook deactivated successfully',
        success: true,
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to deactivate webhook: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async getSimplifiedProductsForStore(sallaStoreId: string) {
    const store = await this.sallaStoresService.findBySallaStoreId(
      sallaStoreId,
    );

    if (!store) {
      throw new HttpException('Store not found', HttpStatus.NOT_FOUND);
    }

    const products = await this.sallaIntegrationService.getSallaProducts(
      store.id,
    );

    const simplifiedProducts = this.simplifyProducts(products);

    return { store, simplifiedProducts };
  }

  private simplifyProducts(products: any[]): SimplifiedProduct[] {
    return products.map((product) => ({
      sku: product?.sku ?? null,
      type: product?.type ?? null,
      name: product?.name ?? null,
      customer_url: product?.urls?.customer ?? null,
      price_amount: this.extractPriceAmount(product?.price),
      price_currency: this.extractPriceCurrency(
        product?.price,
        product?.currency,
      ),
      description: product?.description ?? null,
      quantity: product?.quantity ?? null,
      status: product?.status ?? null,
      is_available: product?.is_available ?? null,
      sale_price_amount: this.extractPriceAmount(
        product?.sale_price ?? product?.salePrice,
      ),
      sale_end: product?.sale_end ?? product?.saleEnd ?? null,
      main_image: this.resolveMainImage(product),
      primary_category_name: Array.isArray(product?.categories)
        ? product.categories[0]?.name ?? null
        : null,
    }));
  }

  private extractPriceAmount(price: any): number | string | null {
    if (price === undefined || price === null) {
      return null;
    }

    if (typeof price === 'number' || typeof price === 'string') {
      return price;
    }

    if (typeof price === 'object') {
      const candidate =
        price.amount ??
        price.value ??
        price.current ??
        price.price ??
        price.total ??
        price.selling_price;

      if (candidate !== undefined && candidate !== null) {
        return candidate;
      }
    }

    return null;
  }

  private extractPriceCurrency(price: any, fallback?: string): string | null {
    if (!price && !fallback) {
      return null;
    }

    if (price && typeof price === 'object') {
      const currency = price.currency ?? price.currency_code ?? price.code;
      if (currency) {
        return currency;
      }
    }

    return fallback ?? null;
  }

  private resolveMainImage(product: any): string | null {
    if (product?.main_image) {
      return product.main_image;
    }

    const mediaSources = [product?.media, product?.images, product?.gallery];
    for (const source of mediaSources) {
      if (Array.isArray(source) && source.length > 0) {
        const first = source[0];
        if (typeof first === 'string') {
          return first;
        }
        if (first && typeof first === 'object') {
          const url =
            first.url ?? first.image_url ?? first.image ?? first.src ?? null;
          if (url) {
            return url;
          }
        }
      }
    }

    return null;
  }

  private renderProductsHtml(
    store: SallaStore,
    products: SimplifiedProduct[],
  ): string {
    const columns: Array<{ key: keyof SimplifiedProduct; label: string }> = [
      { key: 'sku', label: 'SKU' },
      { key: 'type', label: 'Type' },
      { key: 'name', label: 'Name' },
      { key: 'customer_url', label: 'Customer URL' },
      { key: 'price_amount', label: 'Price Amount' },
      { key: 'price_currency', label: 'Currency' },
      { key: 'description', label: 'Description' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'status', label: 'Status' },
      { key: 'is_available', label: 'Is Available' },
      { key: 'sale_price_amount', label: 'Sale Price Amount' },
      { key: 'sale_end', label: 'Sale End' },
      { key: 'main_image', label: 'Main Image' },
      { key: 'primary_category_name', label: 'Primary Category' },
    ];

    const headerRow = columns
      .map((column) => `<th>${this.escapeHtml(column.label)}</th>`)
      .join('');

    const bodyRows = products
      .map((product) => {
        const cells = columns
          .map((column) => {
            const value = product[column.key] ?? '';
            return `<td>${this.escapeHtml(value)}</td>`;
          })
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>${this.escapeHtml(
      store.salla_store_name || 'Salla Store Products',
    )}</title><style>body{font-family:Arial,Helvetica,sans-serif;margin:16px;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #ccc;padding:8px;text-align:left;}th{background-color:#f4f4f4;}</style></head><body><h1>${this.escapeHtml(
      store.salla_store_name || 'Salla Store Products',
    )}</h1><table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
  }

  private escapeHtml(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value).replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return char;
      }
    });
  }
}
