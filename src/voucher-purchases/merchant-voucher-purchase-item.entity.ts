import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
} from 'typeorm';

@Entity('merchant_voucher_purchase_items')
export class MerchantVoucherPurchaseItem {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    // Purchase order relationship
    @Column({ type: 'uuid' })
    purchase_id: string;

    @ManyToOne('MerchantVoucherPurchase', 'purchaseItems')
    @JoinColumn({ name: 'purchase_id' })
    purchase: any;

    // Product identification (from Ubiqfy)
    @Column({ type: 'varchar' })
    product_type_code: string; // e.g., "Voucher"

    @Column({ type: 'varchar' })
    product_code: string; // e.g., "iTunes"

    @Column({ type: 'varchar' })
    provider_code: string; // e.g., "Apple"

    @Column({ type: 'varchar' })
    product_option_code: string; // e.g., "iTunes-10-SAR"

    // Product display information
    @Column({ type: 'varchar' })
    product_name: string; // e.g., "iTunes Gift Card"

    @Column({ type: 'varchar' })
    product_option_name: string; // e.g., "iTunes 10 SAR"

    // Order quantities and pricing
    @Column({ type: 'int' })
    quantity_ordered: number; // How many vouchers to purchase

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    unit_face_value: number; // Face value per voucher (e.g., 10.00 SAR)

    @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
    unit_wholesale_price: number; // What we pay Ubiqfy per voucher

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    total_face_value: number; // quantity * unit_face_value

    @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true })
    total_wholesale_cost: number; // quantity * unit_wholesale_price

    @Column({ default: 'USD' })
    currency: string; // Currency for wholesale cost calculations (always USD for Ubiqfy)    // Processing status for this item
    @Column({ type: 'int', default: 0 })
    vouchers_generated: number; // How many vouchers successfully generated

    @Column({ type: 'int', default: 0 })
    vouchers_failed: number; // How many vouchers failed to generate

    @Column({ default: false })
    is_completed: boolean; // All vouchers for this item processed

    // Relations
    @OneToMany('MerchantVoucherPurchaseDetail', 'purchaseItem', { cascade: true })
    voucherDetails: any[];

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
