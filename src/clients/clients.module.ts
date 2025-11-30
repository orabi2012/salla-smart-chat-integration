import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { SallaStoresModule } from '../salla-stores/salla-stores.module';

@Module({
  imports: [SallaStoresModule],
  controllers: [ClientsController],
})
export class ClientsModule {}
