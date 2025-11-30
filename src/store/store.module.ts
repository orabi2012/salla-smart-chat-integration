import { Module } from '@nestjs/common';
import { StoreController } from './store.controller';
import { SallaStoresModule } from '../salla-stores/salla-stores.module';

@Module({
    imports: [SallaStoresModule],
    controllers: [StoreController],
})
export class StoreModule { }
