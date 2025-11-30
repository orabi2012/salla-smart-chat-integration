import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantVoucherPurchase } from './merchant-voucher-purchase.entity';
import { MerchantVoucherPurchaseItem } from './merchant-voucher-purchase-item.entity';
import { MerchantVoucherPurchaseDetail } from './merchant-voucher-purchase-detail.entity';
import { SallaStoreProductOption } from '../salla-stores/salla-store-product-option.entity';
import { SallaStore } from '../salla-stores/salla-stores.entity';
import { VoucherPurchasesService } from './voucher-purchases.service';
import { VoucherPurchasesController } from './voucher-purchases.controller';
import { DoTransactionService } from './dotransaction.service';
import { UbiqfyProductsModule } from '../ubiqfy-products/ubiqfy-products.module';
import { SallaStoresModule } from '../salla-stores/salla-stores.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            MerchantVoucherPurchase,
            MerchantVoucherPurchaseItem,
            MerchantVoucherPurchaseDetail,
            SallaStoreProductOption,
            SallaStore
        ]),
        UbiqfyProductsModule,
        SallaStoresModule
    ],
    controllers: [VoucherPurchasesController],
    providers: [VoucherPurchasesService, DoTransactionService],
    exports: [VoucherPurchasesService, DoTransactionService],
})
export class VoucherPurchasesModule { }
