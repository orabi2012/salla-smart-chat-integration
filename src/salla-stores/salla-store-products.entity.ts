import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { SallaStore } from './salla-stores.entity';
import { UbiqfyProduct } from '../ubiqfy-products/ubiqfy-product.entity';
import { SallaStoreProductOption } from './salla-store-product-option.entity';

@Entity('salla_store_products')
@Index(['salla_store_id', 'ubiqfy_product_id'], { unique: true }) // Prevent duplicate entries
export class SallaStoreProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  salla_store_id: string;

  @Column()
  ubiqfy_product_id: string;

  // Relationship with SallaStore
  @ManyToOne(() => SallaStore, (store) => store.storeProducts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'salla_store_id' })
  sallaStore: SallaStore;

  // Relationship with UbiqfyProduct
  @ManyToOne(() => UbiqfyProduct, (product) => product.storeProducts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ubiqfy_product_id' })
  ubiqfyProduct: UbiqfyProduct;

  // Store-specific product configuration
  @Column({ default: true })
  is_active: boolean;

  @Column({ nullable: true })
  salla_category_id: string; // Main Category ID in Salla store

  @Column({ nullable: true })
  salla_country_subcategory_id: string; // Country Subcategory ID in Salla store

  @Column({ type: 'json', nullable: true })
  sync_errors: any;

  // Relationship with product options
  @OneToMany(() => SallaStoreProductOption, (option) => option.storeProduct)
  options: SallaStoreProductOption[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
