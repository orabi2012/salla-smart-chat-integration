import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';

export enum VoucherStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    GENERATED = 'generated',
    DELIVERED = 'delivered',
    FAILED = 'failed',
    CANCELLED = 'cancelled',
}

@Entity('merchant_voucher_purchase_details')
export class MerchantVoucherPurchaseDetail {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    // Purchase and item relationships
    @Column({ type: 'uuid' })
    purchase_id: string;

    @ManyToOne('MerchantVoucherPurchase', 'voucherDetails')
    @JoinColumn({ name: 'purchase_id' })
    purchase: any;

    @Column({ type: 'uuid' })
    purchase_item_id: string;

    @ManyToOne('MerchantVoucherPurchaseItem', 'voucherDetails')
    @JoinColumn({ name: 'purchase_item_id' })
    purchaseItem: any;

    // DoTransaction request data (UNIQUE external_id is critical)
    @Column({ unique: true })
    external_id: string; // purchase_order_number + product_option_code + 0xx_sequence

    @Column({ type: 'int' })
    sequence_number: number; // Voucher sequence within the purchase item (1, 2, 3...)

    // DoTransaction response fields (based on your example)
    @Column({ default: false })
    operation_succeeded: boolean;

    @Column({ type: 'text', nullable: true })
    error_text: string | null; // From DoTransaction response

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    response_amount: number | null; // e.g., 9.30 from response

    @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
    amount_wholesale: number | null; // e.g., 9.114000 from response

    @Column({ type: 'varchar', nullable: true })
    serial_number: string | null; // e.g., "29256254392666871111"

    @Column({ type: 'bigint', nullable: true })
    transaction_id: number | null; // e.g., 515045

    @Column({ type: 'bigint', nullable: true })
    provider_transaction_id: number | null; // e.g., 516

    @Column({ type: 'varchar', nullable: true })
    reference: string | null; // e.g., "IAA9G86QUQLYZ3XF"

    @Column({ type: 'text', nullable: true })
    redeem_url: string | null; // Redemption URL if provided

    // Legacy voucher fields (for backward compatibility)
    @Column({ type: 'text', nullable: true })
    voucher_code: string | null;

    @Column({ type: 'text', nullable: true })
    voucher_pin: string | null;

    @Column({ type: 'json', nullable: true })
    voucher_data: any; // Store complete voucher response

    // Processing status
    @Column({
        type: 'enum',
        enum: VoucherStatus,
        default: VoucherStatus.PENDING,
    })
    status: VoucherStatus;

    @Column({ type: 'timestamp', nullable: true })
    processed_at: Date | null;

    @Column({ type: 'int', default: 0 })
    retry_count: number;

    @Column({ type: 'json', nullable: true })
    ubiqfy_response: any; // Store full Ubiqfy DoTransaction response

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    // Additional tracking fields
    @Column({ type: 'timestamp', nullable: true })
    request_sent_at: Date | null; // When DoTransaction was called

    @Column({ type: 'timestamp', nullable: true })
    response_received_at: Date | null; // When response was received

    @Column({ type: 'int', nullable: true })
    response_time_ms: number | null; // Response time in milliseconds

    // Salla sync tracking
    @Column({ type: 'boolean', default: false })
    salla_synced: boolean; // Whether voucher codes have been attached to Salla

    @Column({ type: 'timestamp', nullable: true })
    salla_synced_at: Date | null; // When voucher was synced to Salla

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
