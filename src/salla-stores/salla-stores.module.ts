import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SallaStore } from './salla-stores.entity';
import { SallaStoreProduct } from './salla-store-products.entity';
import { SallaStoreProductOption } from './salla-store-product-option.entity';
import { UbiqfyProduct } from '../ubiqfy-products/ubiqfy-product.entity';
import { SallaStoresService } from './salla-stores.service';
import { SallaStoreProductsService } from './salla-store-products.service';
import { SallaStoreProductOptionsService } from './salla-store-product-options.service';
import { SallaIntegrationService } from './salla-integration.service';
import { SallaOAuthService } from './salla-oauth.service';
import { SallaWebhookService } from './salla-webhook.service';
import { SallaWebhookManagementService } from './salla-webhook-management.service';
import { SallaStoresController } from './salla-stores.controller';
import { SallaDevController } from './salla-dev.controller';
import { SallaWebhookController } from './salla-webhook.controller';
import { UbiqfyProductsModule } from '../ubiqfy-products/ubiqfy-products.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([SallaStore, SallaStoreProduct, SallaStoreProductOption, UbiqfyProduct]),
        ConfigModule,
        UbiqfyProductsModule
    ],
    controllers: [SallaStoresController, SallaDevController, SallaWebhookController],
    providers: [SallaStoresService, SallaStoreProductsService, SallaStoreProductOptionsService, SallaIntegrationService, SallaOAuthService, SallaWebhookService, SallaWebhookManagementService],
    exports: [SallaStoresService, SallaStoreProductsService, SallaStoreProductOptionsService, SallaIntegrationService, SallaOAuthService, SallaWebhookService, SallaWebhookManagementService],
})
export class SallaStoresModule { }
