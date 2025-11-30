import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/users.entity';
import { SallaStore } from './salla-stores/salla-stores.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>('NODE_ENV') === 'production';
        const sslEnabled =
          config.get<string>('DB_SSL_ENABLED', 'false') === 'true';
        const dbHost = config.get<string>('DB_HOST');

        // Check if connecting to a remote database (like Render.com)
        const isRemoteDb =
          dbHost &&
          !dbHost.includes('localhost') &&
          !dbHost.includes('127.0.0.1');

        let sslConfig: boolean | object = false;
        if (sslEnabled || isRemoteDb) {
          sslConfig = {
            rejectUnauthorized: false, // For remote databases, often need this
          };
        }

        return {
          type: 'postgres',
          host: dbHost,
          port: config.get<number>('DB_PORT'),
          username: config.get<string>('DB_USERNAME'),
          password: config.get<string>('DB_PASSWORD'),
          database: config.get<string>('DB_DATABASE'),
          entities: [User, SallaStore],
          synchronize: !isProduction,
          ssl: sslConfig,
          timezone: 'Asia/Riyadh', // KSA timezone (UTC+3)
          extra: {
            connectionTimeoutMillis: 10000,
            idleTimeoutMillis: 10000,
            // Set PostgreSQL timezone for this connection
            timezone: 'Asia/Riyadh',
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
