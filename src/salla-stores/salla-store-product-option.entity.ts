import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SallaStoreProduct } from './salla-store-products.entity';

@Entity('salla_store_product_options')
export class SallaStoreProductOption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  salla_store_product_id: string;

  @Column({ type: 'varchar', length: 255 })
  option_code: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  option_name: string | null;

  /**
   * Wholesale price from Ubiqfy API in USD (MinWholesaleValue - cost price)
   * This is the cost price we pay to Ubiqfy
   */
  @Column({ type: 'decimal', precision: 15, scale: 6 })
  original_price_usd: number;

  /**
   * Retail price from Ubiqfy API in USD (MinValue - sale price) 
   * This is the selling price from Ubiqfy API
   */
  @Column({ type: 'decimal', precision: 15, scale: 6, nullable: true })
  retail_price_usd: number;

  /**
   * Wholesale price from Ubiqfy API in USD (MinWholesaleValue - cost price)
   * Duplicate for backward compatibility - will be removed later
   */
  @Column({ type: 'decimal', precision: 15, scale: 6, nullable: true, default: 0 })
  wholesale_price_usd: number;

  /**
   * Price converted to store currency (calculated automatically)
   */
  @Column({ type: 'decimal', precision: 15, scale: 6 })
  store_currency_price: number;

  /**
   * Custom price set by user in store currency
   * If set, this overrides store_currency_price
   */
  @Column({ type: 'decimal', precision: 15, scale: 6, nullable: true })
  custom_price: number | null;

  /**
   * Markup percentage applied to the final price
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  markup_percentage: number;

  /**
   * Salla product ID when this option is synced to Salla
   * Each option becomes a separate product in Salla
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  salla_product_id: string | null;

  @Column({ type: 'boolean', default: false })
  is_synced_to_salla: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_synced_at: Date | null;

  // Stock Management
  @Column({ type: 'int', default: 1, nullable: false })
  stock_level: number; // Minimum stock level to maintain (0 = unlimited, >0 = minimum threshold)

  @Column({ type: 'int', nullable: true })
  salla_stock: number | null; // Current stock from Salla store

  // Available voucher stock tracking
  @Column({ type: 'int', default: 0 })
  stock_quantity: number; // Current available voucher codes

  @Column({ type: 'timestamp', nullable: true })
  last_stock_update: Date | null; // When stock was last updated

  /**
   * Minimum face value for DoTransaction purchases from Ubiqfy
   * Synced from ubiqfy_product_options.min_face_value during sync process
   */
  @Column({ type: 'decimal', precision: 15, scale: 6, nullable: true })
  min_face_value: number | null;

  /**
   * Product currency code from Ubiqfy API
   * Synced from ubiqfy_product_options.product_currency_code during sync process
   */
  @Column({ type: 'varchar', length: 10, nullable: true })
  product_currency_code: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => SallaStoreProduct, (storeProduct) => storeProduct.options)
  @JoinColumn({ name: 'salla_store_product_id' })
  storeProduct: SallaStoreProduct;
}
