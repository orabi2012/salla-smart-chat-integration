import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';
import { SallaStore } from './salla-stores.entity';
import { isValidUUID } from '../utils/uuid.helper';
import { SallaOAuthService } from './salla-oauth.service';

@Injectable()
export class SallaIntegrationService {
  private readonly logger = new Logger(SallaIntegrationService.name);
  private readonly baseUrl: string;
  private readonly appId?: string;
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly tokenRefreshBufferMs = 60_000;

  constructor(
    @InjectRepository(SallaStore)
    private readonly sallaStoreRepository: Repository<SallaStore>,
    private readonly configService: ConfigService,
    private readonly sallaOAuthService: SallaOAuthService,
  ) {
    this.baseUrl =
      this.configService.get<string>('SALLA_BASE_URL') ??
      process.env.SALLA_BASE_URL ??
      'https://api.salla.dev/admin/v2';

    this.appId =
      this.configService.get<string>('SALLA_APP_ID') ??
      process.env.SALLA_APP_ID;

    this.clientId =
      this.configService.get<string>('SALLA_CLIENT_ID') ??
      process.env.SALLA_CLIENT_ID;

    this.clientSecret =
      this.configService.get<string>('SALLA_CLIENT_SECRET') ??
      process.env.SALLA_CLIENT_SECRET;
  }

  async getSallaProducts(storeId: string): Promise<any[]> {
    const store = await this.getStoreOrThrow(storeId);

    return this.performSallaRequest(
      store,
      async (activeStore) => {
        const response = await axios.get(`${this.baseUrl}/products`, {
          headers: this.buildHeaders(activeStore),
        });

        return response.data?.data ?? [];
      },
      'Failed to fetch Salla products',
    );
  }

  async getSallaStoreInfo(storeId: string): Promise<any> {
    const store = await this.getStoreOrThrow(storeId);

    return this.performSallaRequest(
      store,
      async (activeStore) => {
        const response = await axios.get(`${this.baseUrl}/store/info`, {
          headers: this.buildHeaders(activeStore),
        });

        return response.data?.data ?? {};
      },
      'Failed to fetch Salla store info',
    );
  }

  async getAppSettings(storeId: string): Promise<any | null> {
    if (!this.appId) {
      return null;
    }

    const store = await this.getStoreOrThrow(storeId);

    return this.performSallaRequest(
      store,
      async (activeStore) => {
        const response = await axios.get(
          `${this.baseUrl}/apps/${this.appId}/settings`,
          {
            headers: this.buildHeaders(activeStore),
          },
        );

        return response.data?.data ?? null;
      },
      'Failed to fetch Salla app settings',
    );
  }

  private async getStoreOrThrow(storeIdentifier: string): Promise<SallaStore> {
    const identifier = storeIdentifier?.trim();

    if (!identifier) {
      throw new HttpException('Store identifier is required', HttpStatus.BAD_REQUEST);
    }

    const whereClause = isValidUUID(identifier)
      ? { id: identifier }
      : { salla_store_id: identifier };

    const store = await this.sallaStoreRepository.findOne({
      where: whereClause,
    });
    if (!store) {
      throw new HttpException('Store not found', HttpStatus.NOT_FOUND);
    }
    if (
      !store.salla_access_token ||
      store.salla_access_token === 'pending' ||
      store.salla_access_token === 'REVOKED'
    ) {
      throw new HttpException(
        'Salla access token missing for store',
        HttpStatus.BAD_REQUEST,
      );
    }
    return store;
  }

  private buildHeaders(store: SallaStore) {
    return {
      Authorization: `Bearer ${store.salla_access_token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  private async performSallaRequest<T>(
    store: SallaStore,
    executor: (activeStore: SallaStore) => Promise<T>,
    defaultErrorMessage: string,
  ): Promise<T> {
    let currentStore = await this.ensureValidAccessToken(store);

    try {
      return await executor(currentStore);
    } catch (error) {
      if (
        this.shouldAttemptTokenRefresh(error) &&
        this.canRefreshAccessToken(currentStore)
      ) {
        currentStore = await this.ensureValidAccessToken(currentStore, true);
        try {
          return await executor(currentStore);
        } catch (retryError) {
          throw this.createSallaHttpException(
            retryError,
            defaultErrorMessage,
          );
        }
      }

      throw this.createSallaHttpException(error, defaultErrorMessage);
    }
  }

  // Refresh tokens slightly before expiry to reduce race conditions.
  private async ensureValidAccessToken(
    store: SallaStore,
    force = false,
  ): Promise<SallaStore> {
    if (!this.canRefreshAccessToken(store)) {
      return store;
    }

    const expiry = store.salla_token_expiry
      ? new Date(store.salla_token_expiry).getTime()
      : undefined;
    const now = Date.now();

    const needsRefresh =
      force ||
      !expiry ||
      expiry - this.tokenRefreshBufferMs <= now;

    if (!needsRefresh) {
      return store;
    }

    return this.refreshAccessToken(store);
  }

  private canRefreshAccessToken(store: SallaStore): boolean {
    return (
      !!this.clientId &&
      !!this.clientSecret &&
      !!store.salla_refresh_token &&
      store.salla_refresh_token !== 'pending' &&
      store.salla_refresh_token !== 'REVOKED'
    );
  }

  private shouldAttemptTokenRefresh(error: any): boolean {
    const status = error?.response?.status;
    return (
      status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN
    );
  }

  private async refreshAccessToken(store: SallaStore): Promise<SallaStore> {
    if (!this.canRefreshAccessToken(store)) {
      return store;
    }

    try {
      this.logger.log(
        `Refreshing Salla access token for store ${store.salla_store_id}`,
      );

      const tokens = await this.sallaOAuthService.refreshToken(
        store.salla_refresh_token,
        this.clientId!,
        this.clientSecret!,
      );

      store.salla_access_token = tokens.access_token;
      if (tokens.refresh_token) {
        store.salla_refresh_token = tokens.refresh_token;
      }

      const expiresIn = tokens.expires_in ?? 3600;
      store.salla_token_expiry = new Date(Date.now() + expiresIn * 1000);

      await this.sallaStoreRepository.save(store);
      return store;
    } catch (error) {
      const message =
        error?.response?.data?.error_description ?? error?.message ??
        'Unknown token refresh error';
      this.logger.error(
        `Failed to refresh Salla token for store ${store.salla_store_id}: ${message}`,
      );

      throw new HttpException(
        'Failed to refresh Salla access token',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  private createSallaHttpException(
    error: any,
    fallbackMessage: string,
  ): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    const status = error?.response?.status ?? HttpStatus.BAD_GATEWAY;
    const message =
      error?.response?.data?.message ??
      error?.response?.data?.error_description ??
      fallbackMessage;

    return new HttpException(message, status);
  }
}
