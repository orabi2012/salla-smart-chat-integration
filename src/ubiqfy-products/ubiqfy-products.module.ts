import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UbiqfyProduct } from './ubiqfy-product.entity';
import { UbiqfyProductOption } from './ubiqfy-product-option.entity';
import { UbiqfyProductsService } from './ubiqfy-products.service';
import { UbiqfyProductsController } from './ubiqfy-products.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UbiqfyProduct, UbiqfyProductOption])],
  controllers: [UbiqfyProductsController],
  providers: [UbiqfyProductsService],
  exports: [UbiqfyProductsService],
})
export class UbiqfyProductsModule {}
