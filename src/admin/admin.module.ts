import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { SallaStoresModule } from '../salla-stores/salla-stores.module';
import { UsersModule } from '../users/users.module';

@Module({
    imports: [SallaStoresModule, UsersModule],
    controllers: [AdminController],
})
export class AdminModule { }
