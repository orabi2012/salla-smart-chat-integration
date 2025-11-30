import { Module } from '@nestjs/common';
import { StoreController } from './store.controller';
import { VoucherPurchasesModule } from '../voucher-purchases/voucher-purchases.module';
import { SallaStoresModule } from '../salla-stores/salla-stores.module';

@Module({
    imports: [VoucherPurchasesModule, SallaStoresModule],
    controllers: [StoreController],
})
export class StoreModule { }
