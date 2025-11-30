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
import { SallaStore } from '../salla-stores/salla-stores.entity';
import { User } from '../users/users.entity';

export enum PurchaseOrderStatus {
    DRAFT = 'draft',           // Can edit/delete
    PENDING = 'pending',       // Can edit/delete  
    PROCESSING = 'processing', // Cannot edit - DoTransaction in progress
    COMPLETED = 'completed',   // All vouchers processed successfully
    PARTIALLY_COMPLETED = 'partially_completed', // Some vouchers failed
    FAILED = 'failed',         // Processing failed
    CANCELLED = 'cancelled'    // User cancelled
}

@Entity('merchant_voucher_purchases')
export class MerchantVoucherPurchase {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    // Store/Merchant relationship
    @Column({ type: 'uuid' })
    salla_store_id: string;

    @ManyToOne(() => SallaStore)
    @JoinColumn({ name: 'salla_store_id' })
    sallaStore: SallaStore;

    // User who created the purchase order
    @Column({ type: 'uuid' })
    created_by_user_id: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'created_by_user_id' })
    createdByUser: User;

    // Purchase order details
    @Column({ unique: true })
    purchase_order_number: string; // Our generated order number (e.g., PO-2025-001)

    @Column({
        type: 'enum',
        enum: PurchaseOrderStatus,
        default: PurchaseOrderStatus.DRAFT,
    })
    status: PurchaseOrderStatus;

    // Financial details - only keep what's essential
    @Column({ type: 'decimal', precision: 12, scale: 4 })
    total_wholesale_cost: number; // Total cost we pay to Ubiqfy

    @Column({ default: 'SAR' })
    currency: string;

    // Processing tracking - simplified
    @Column({ type: 'int', default: 0 })
    total_vouchers_ordered: number;

    @Column({ type: 'int', default: 0 })
    total_vouchers_generated: number;

    @Column({ type: 'int', default: 0 })
    total_vouchers_failed: number;

    // Balance validation - essential for processing
    @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true })
    ubiqfy_balance_before: number; // Balance before processing

    @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true })
    ubiqfy_balance_after: number; // Balance after processing

    // Processing timestamps - essential
    @Column({ type: 'timestamp', nullable: true })
    processing_started_at: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    processing_completed_at: Date | null;

    // Error handling - essential
    @Column({ type: 'text', nullable: true })
    error_message: string | null;

    // Success tracking and navigation
    @Column({ type: 'text', nullable: true })
    success_message: string | null;

    @Column({ type: 'varchar', nullable: true })
    navigation_url: string | null; // URL to navigate after successful processing

    // Relations
    @OneToMany('MerchantVoucherPurchaseItem', 'purchase', { cascade: true })
    purchaseItems: any[];

    @OneToMany('MerchantVoucherPurchaseDetail', 'purchase', { cascade: true })
    voucherDetails: any[];

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
