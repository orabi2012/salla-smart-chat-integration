import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalStrategy } from './local.strategy';
import { JwtStrategy } from './jwt.strategy';
import { SuperAdminGuard } from './super-admin.guard';
import { StoreAccessGuard } from './store-access.guard';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/users.entity';
import { SallaStoresModule } from '../salla-stores/salla-stores.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'defaultSecretKey',
      signOptions: { expiresIn: '1d' },
    }),
    TypeOrmModule.forFeature([User]),
    SallaStoresModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    SuperAdminGuard,
    StoreAccessGuard,
    UsersService,
  ],
  exports: [AuthService, SuperAdminGuard, StoreAccessGuard],
})
export class AuthModule {}
