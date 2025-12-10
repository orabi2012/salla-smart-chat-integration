import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SallaStore } from './salla-stores.entity';
import { SallaStoresService } from './salla-stores.service';
import { SallaOAuthService } from './salla-oauth.service';
import { SallaWebhookService } from './salla-webhook.service';
import { SallaWebhookManagementService } from './salla-webhook-management.service';
import { SallaStoresController } from './salla-stores.controller';
import { SallaDevController } from './salla-dev.controller';
import { SallaWebhookController } from './salla-webhook.controller';
import { SallaIntegrationService } from './salla-integration.service';


@Module({
  imports: [TypeOrmModule.forFeature([SallaStore]), ConfigModule],
  controllers: [
    SallaStoresController,
    SallaDevController,
    SallaWebhookController,
  ],
  providers: [
    SallaStoresService,
    SallaOAuthService,
    SallaWebhookService,
    SallaWebhookManagementService,
    SallaIntegrationService,

  ],
  exports: [
    SallaStoresService,
    SallaOAuthService,
    SallaWebhookService,
    SallaWebhookManagementService,
    SallaIntegrationService,

  ],
})
export class SallaStoresModule { }
