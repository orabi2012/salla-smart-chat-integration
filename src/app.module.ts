import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module';
import { AppController } from './app.controller';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SallaStoresModule } from './salla-stores/salla-stores.module';
import { ClientsModule } from './clients/clients.module';
import { StoreModule } from './store/store.module';
import { AdminModule } from './admin/admin.module';
import { UtilsModule } from './utils/utils.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    SallaStoresModule,
    ClientsModule,
    StoreModule,
    UsersModule,
    AdminModule,
    UtilsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
