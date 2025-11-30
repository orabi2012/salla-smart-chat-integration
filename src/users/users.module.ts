import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './users.entity';
import { SallaStoresModule } from '../salla-stores/salla-stores.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), SallaStoresModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
