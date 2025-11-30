import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordService } from './password.service';
import { PasswordMigrationService } from './password-migration.service';
import { SallaStore } from '../salla-stores/salla-stores.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SallaStore])],
  providers: [PasswordService, PasswordMigrationService],
  exports: [PasswordService, PasswordMigrationService],
})
export class UtilsModule {}
