import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SallaStore, SyncStatus } from './salla-stores.entity';

@Injectable()
export class SallaStoresService {
  constructor(
    @InjectRepository(SallaStore)
    private readonly sallaStoreRepo: Repository<SallaStore>,
  ) { }

  async create(sallaStoreData: Partial<SallaStore>): Promise<SallaStore> {
    const sallaStore = this.sallaStoreRepo.create(sallaStoreData);
    return await this.sallaStoreRepo.save(sallaStore);
  }

  async findAll(): Promise<SallaStore[]> {
    return await this.sallaStoreRepo.find({
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: string): Promise<SallaStore | null> {
    return await this.sallaStoreRepo.findOne({ where: { id } });
  }

  async findBySallaStoreId(salla_store_id: string): Promise<SallaStore | null> {
    return await this.sallaStoreRepo.findOne({ where: { salla_store_id } });
  }

  async findActiveStores(): Promise<SallaStore[]> {
    return await this.sallaStoreRepo.find({
      where: { is_active: true },
      order: { created_at: 'DESC' },
    });
  }

  async updateSyncStatus(
    id: string,
    status: SyncStatus,
    errorMessage?: string,
  ): Promise<void> {
    const updateData: any = {
      sync_status: status,
      last_sync_at: new Date(),
    };

    if (errorMessage) {
      updateData.last_error_message = errorMessage;
    }

    await this.sallaStoreRepo.update(id, updateData);
  }

  async incrementProductCount(id: string, count: number = 1): Promise<void> {
    await this.sallaStoreRepo.increment({ id }, 'total_products_synced', count);
  }

  async setProductCount(id: string, count: number): Promise<void> {
    await this.sallaStoreRepo.update(id, { total_products_synced: count });
  }

  async update(
    id: string,
    updateData: Partial<SallaStore>,
  ): Promise<SallaStore | null> {
    // Find the entity first
    const entity = await this.sallaStoreRepo.findOne({ where: { id } });
    if (!entity) {
      return null;
    }

    // Apply updates to the entity
    Object.assign(entity, updateData);

    // Save the entity (this will trigger @BeforeUpdate hooks)
    const savedEntity = await this.sallaStoreRepo.save(entity);
    return savedEntity;
  }

  async delete(id: string): Promise<void> {
    await this.sallaStoreRepo.delete(id);
  }

  async toggleActive(id: string): Promise<SallaStore | null> {
    const store = await this.findById(id);
    if (store) {
      store.is_active = !store.is_active;
      return await this.sallaStoreRepo.save(store);
    }
    return null;
  }

}

