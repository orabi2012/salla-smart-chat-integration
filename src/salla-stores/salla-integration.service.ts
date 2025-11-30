import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';
import { SallaStore } from './salla-stores.entity';

@Injectable()
export class SallaIntegrationService {
  private readonly baseUrl =
    process.env.SALLA_BASE_URL ?? 'https://api.salla.dev/admin/v2';

  constructor(
    @InjectRepository(SallaStore)
    private readonly sallaStoreRepository: Repository<SallaStore>,
  ) {}

  async getSallaProducts(storeId: string): Promise<any[]> {
    const store = await this.getStoreOrThrow(storeId);

    try {
      const response = await axios.get(`${this.baseUrl}/products`, {
        headers: this.buildHeaders(store),
      });

      return response.data?.data ?? [];
    } catch (error) {
      const status = error.response?.status ?? HttpStatus.BAD_GATEWAY;
      const message =
        error.response?.data?.message ?? 'Failed to fetch Salla products';
      throw new HttpException(message, status);
    }
  }

  private async getStoreOrThrow(storeId: string): Promise<SallaStore> {
    const store = await this.sallaStoreRepository.findOne({
      where: { id: storeId },
    });
    if (!store) {
      throw new HttpException('Store not found', HttpStatus.NOT_FOUND);
    }
    if (!store.salla_access_token) {
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
}
