import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { SallaStoresModule } from '../salla-stores/salla-stores.module';
import { VoucherPurchasesModule } from '../voucher-purchases/voucher-purchases.module';

@Module({
  imports: [SallaStoresModule, VoucherPurchasesModule],
  controllers: [ClientsController],
})
export class ClientsModule { }
