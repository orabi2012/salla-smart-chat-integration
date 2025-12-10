import {
  Body,
  Controller,
  Delete,
  Get,
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
    const store = await this.sallaStoresService.findBySallaStoreId(
      sallaStoreId,
    );

    if (!store) {
      throw new HttpException('Store not found', HttpStatus.NOT_FOUND);
    }

    const products = await this.sallaIntegrationService.getSallaProducts(
      store.id,
    );
    return {
      store_id: store.id,
      salla_store_id: store.salla_store_id,
      total: products.length,
      data: products,
    };
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
}
