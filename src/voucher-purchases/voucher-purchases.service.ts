import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MerchantVoucherPurchase, PurchaseOrderStatus } from './merchant-voucher-purchase.entity';
import { MerchantVoucherPurchaseItem } from './merchant-voucher-purchase-item.entity';
import { MerchantVoucherPurchaseDetail, VoucherStatus } from './merchant-voucher-purchase-detail.entity';
import { isValidUUID } from '../utils/uuid.helper';

@Injectable()
export class VoucherPurchasesService {
    private readonly logger = new Logger(VoucherPurchasesService.name);

    constructor(
        @InjectRepository(MerchantVoucherPurchase)
        private readonly purchaseRepository: Repository<MerchantVoucherPurchase>,
        @InjectRepository(MerchantVoucherPurchaseItem)
        private readonly purchaseItemRepository: Repository<MerchantVoucherPurchaseItem>,
        @InjectRepository(MerchantVoucherPurchaseDetail)
        private readonly purchaseDetailRepository: Repository<MerchantVoucherPurchaseDetail>,
    ) { }

    /**
     * Create a new draft purchase order
     */
    async createDraftPurchase(storeId: string, userId: string): Promise<MerchantVoucherPurchase> {
        // Validate UUID format
        if (!userId || !isValidUUID(userId)) {
            throw new BadRequestException('Invalid user ID format. User ID must be a valid UUID.');
        }
        if (!storeId || !isValidUUID(storeId)) {
            throw new BadRequestException('Invalid store ID format. Store ID must be a valid UUID.');
        }

        const purchaseOrderNumber = await this.generatePurchaseOrderNumber();

        const purchase = new MerchantVoucherPurchase();
        purchase.salla_store_id = storeId;
        purchase.created_by_user_id = userId;
        purchase.purchase_order_number = purchaseOrderNumber;
        purchase.status = PurchaseOrderStatus.DRAFT;
        purchase.total_wholesale_cost = 0;
        purchase.currency = 'USD'; // Ubiqfy transactions are always in USD
        purchase.total_vouchers_ordered = 0;

        return await this.purchaseRepository.save(purchase);
    }

    /**
     * Generate unique purchase order number
     */
    private async generatePurchaseOrderNumber(): Promise<string> {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        // Find highest order number for today
        const todayPrefix = `PO-${year}${month}${day}`;
        const existingOrders = await this.purchaseRepository
            .createQueryBuilder('purchase')
            .where('purchase.purchase_order_number LIKE :prefix', { prefix: `${todayPrefix}%` })
            .orderBy('purchase.purchase_order_number', 'DESC')
            .limit(1)
            .getOne();

        let sequence = 1;
        if (existingOrders) {
            const lastNumber = existingOrders.purchase_order_number;
            const lastSequence = parseInt(lastNumber.substring(lastNumber.length - 3));
            sequence = lastSequence + 1;
        }

        return `${todayPrefix}-${String(sequence).padStart(3, '0')}`;
    }

    /**
     * Add item to purchase order
     */
    async addPurchaseItem(purchaseId: string, itemData: {
        product_type_code: string;
        product_code: string;
        provider_code: string;
        product_option_code: string;
        product_name: string;
        product_option_name: string;
        quantity_ordered: number;
        unit_face_value: number;
        unit_wholesale_price?: number;
    }): Promise<MerchantVoucherPurchaseItem> {
        // Verify purchase exists and is editable
        const purchase = await this.purchaseRepository.findOne({
            where: { id: purchaseId }
        });

        if (!purchase) {
            throw new Error('Purchase order not found');
        }

        if (!this.isPurchaseEditable(purchase.status)) {
            throw new Error(`Cannot modify purchase in ${purchase.status} status`);
        }

        // Create purchase item
        const item = new MerchantVoucherPurchaseItem();
        item.purchase_id = purchaseId;
        item.product_type_code = itemData.product_type_code;
        item.product_code = itemData.product_code;
        item.provider_code = itemData.provider_code;
        item.product_option_code = itemData.product_option_code;
        item.product_name = itemData.product_name;
        item.product_option_name = itemData.product_option_name;
        item.quantity_ordered = itemData.quantity_ordered;
        item.unit_face_value = itemData.unit_face_value;
        item.unit_wholesale_price = itemData.unit_wholesale_price || 0;
        item.total_face_value = itemData.quantity_ordered * itemData.unit_face_value;
        item.total_wholesale_cost = itemData.quantity_ordered * (itemData.unit_wholesale_price || 0);
        item.currency = 'USD'; // Wholesale cost currency (always USD for Ubiqfy)

        const savedItem = await this.purchaseItemRepository.save(item);

        // Create individual voucher detail records immediately when item is added
        await this.createVoucherDetailRecordsForItem(purchaseId, savedItem);

        // Update purchase totals
        await this.updatePurchaseTotals(purchaseId);

        return savedItem;
    }

    /**
     * Remove item from purchase order
     */
    async removePurchaseItem(purchaseId: string, itemId: string): Promise<{ success: boolean; message: string }> {
        // Verify purchase exists and is editable
        const purchase = await this.purchaseRepository.findOne({
            where: { id: purchaseId }
        });

        if (!purchase) {
            throw new Error('Purchase order not found');
        }

        if (!this.isPurchaseEditable(purchase.status)) {
            throw new Error(`Cannot modify purchase in ${purchase.status} status`);
        }

        // Find and remove the item
        const item = await this.purchaseItemRepository.findOne({
            where: { id: itemId, purchase_id: purchaseId }
        });

        if (!item) {
            throw new Error('Purchase item not found');
        }

        // Remove associated voucher details first
        await this.purchaseDetailRepository.delete({
            purchase_item_id: itemId
        });

        // Remove the item
        await this.purchaseItemRepository.remove(item);

        // Update purchase totals
        await this.updatePurchaseTotals(purchaseId);

        this.logger.log(`Removed item ${item.product_name} and its voucher details from purchase ${purchase.purchase_order_number}`);

        return { success: true, message: 'Item removed successfully' };
    }

    /**
     * Update item quantity in purchase order
     */
    async updatePurchaseItemQuantity(purchaseId: string, itemId: string, newQuantity: number): Promise<MerchantVoucherPurchaseItem> {
        // Validate quantity
        if (!newQuantity || newQuantity < 1) {
            throw new Error('Quantity must be at least 1');
        }

        // Verify purchase exists and is editable
        const purchase = await this.purchaseRepository.findOne({
            where: { id: purchaseId }
        });

        if (!purchase) {
            throw new Error('Purchase order not found');
        }

        if (!this.isPurchaseEditable(purchase.status)) {
            throw new Error(`Cannot modify purchase in ${purchase.status} status`);
        }

        // Find and update the item
        const item = await this.purchaseItemRepository.findOne({
            where: { id: itemId, purchase_id: purchaseId }
        });

        if (!item) {
            throw new Error('Purchase item not found');
        }

        const oldQuantity = item.quantity_ordered;

        // Update quantities and costs
        item.quantity_ordered = newQuantity;
        item.total_face_value = newQuantity * item.unit_face_value;
        item.total_wholesale_cost = newQuantity * item.unit_wholesale_price;

        const updatedItem = await this.purchaseItemRepository.save(item);

        // Handle voucher details quantity changes
        if (newQuantity !== oldQuantity) {
            // Remove all existing voucher details for this item
            await this.purchaseDetailRepository.delete({
                purchase_item_id: itemId
            });

            // Create new voucher details with correct quantity
            await this.createVoucherDetailRecordsForItem(purchaseId, updatedItem);
        }

        // Update purchase totals
        await this.updatePurchaseTotals(purchaseId);

        this.logger.log(`Updated item ${item.product_name} quantity from ${oldQuantity} to ${newQuantity} and regenerated voucher details`);

        return updatedItem;
    }

    /**
     * Check if purchase order can be edited
     */
    private isPurchaseEditable(status: PurchaseOrderStatus): boolean {
        return status === PurchaseOrderStatus.DRAFT || status === PurchaseOrderStatus.PENDING;
    }

    /**
     * Update purchase order totals
     */
    private async updatePurchaseTotals(purchaseId: string): Promise<void> {
        const purchase = await this.purchaseRepository.findOne({
            where: { id: purchaseId },
            relations: ['purchaseItems']
        });

        if (!purchase) return;

        const items = await this.purchaseItemRepository.find({
            where: { purchase_id: purchaseId }
        });

        purchase.total_wholesale_cost = items.reduce((sum, item) => sum + Number(item.total_wholesale_cost), 0);
        purchase.total_vouchers_ordered = items.reduce((sum, item) => sum + item.quantity_ordered, 0);

        await this.purchaseRepository.save(purchase);
    }

    /**
     * Submit purchase order for processing
     */
    async submitPurchaseOrder(purchaseId: string): Promise<void> {
        const purchase = await this.purchaseRepository.findOne({
            where: { id: purchaseId },
            relations: ['purchaseItems']
        });

        if (!purchase) {
            throw new Error('Purchase order not found');
        }

        if (!this.isPurchaseEditable(purchase.status)) {
            throw new Error(`Cannot submit purchase in ${purchase.status} status`);
        }

        // Validate purchase has items
        const items = await this.purchaseItemRepository.find({
            where: { purchase_id: purchaseId }
        });

        if (items.length === 0) {
            throw new Error('Purchase order must have at least one item');
        }

        // Balance validation will be done during processing step
        // Use POST /voucher-purchases/:purchaseId/check-balance before processing

        // Change status to pending
        purchase.status = PurchaseOrderStatus.PENDING;
        await this.purchaseRepository.save(purchase);

        // Create individual voucher detail records
        await this.createVoucherDetailRecords(purchaseId, items);
    }

    /**
     * Create individual voucher detail records for DoTransaction
     */
    private async createVoucherDetailRecords(purchaseId: string, items: MerchantVoucherPurchaseItem[]): Promise<void> {
        const purchase = await this.purchaseRepository.findOne({ where: { id: purchaseId } });
        if (!purchase) return;

        for (const item of items) {
            await this.createVoucherDetailRecordsForItem(purchaseId, item);
        }

        this.logger.log(`Created ${purchase.total_vouchers_ordered} voucher detail records for purchase ${purchase.purchase_order_number}`);
    }

    /**
     * Create individual voucher detail records for a single item
     */
    private async createVoucherDetailRecordsForItem(purchaseId: string, item: MerchantVoucherPurchaseItem): Promise<void> {
        const purchase = await this.purchaseRepository.findOne({ where: { id: purchaseId } });
        if (!purchase) return;

        // Check if voucher detail records already exist for this item
        const existingDetails = await this.purchaseDetailRepository.find({
            where: {
                purchase_id: purchaseId,
                purchase_item_id: item.id
            }
        });

        if (existingDetails.length > 0) {
            this.logger.log(`Voucher detail records already exist for item ${item.product_name} (${existingDetails.length} records)`);
            return;
        }

        // Get the current highest sequence number for this purchase to avoid duplicates
        const lastDetail = await this.purchaseDetailRepository
            .createQueryBuilder('detail')
            .where('detail.purchase_id = :purchaseId', { purchaseId })
            .orderBy('detail.sequence_number', 'DESC')
            .limit(1)
            .getOne();

        let startingSequence = (lastDetail?.sequence_number || 0) + 1;

        for (let sequence = startingSequence; sequence < startingSequence + item.quantity_ordered; sequence++) {
            const detail = new MerchantVoucherPurchaseDetail();
            detail.purchase_id = purchaseId;
            detail.purchase_item_id = item.id;
            detail.external_id = `${purchase.purchase_order_number}-${item.product_option_code}-${sequence.toString().padStart(3, '0')}`;
            detail.sequence_number = sequence;
            detail.status = VoucherStatus.PENDING;

            await this.purchaseDetailRepository.save(detail);
        }

        this.logger.log(`Created ${item.quantity_ordered} voucher detail records for item ${item.product_name}`);
    }

    /**
     * Get purchase order with details
     */
    async getPurchaseWithDetails(purchaseId: string): Promise<MerchantVoucherPurchase | null> {
        return await this.purchaseRepository.findOne({
            where: { id: purchaseId },
            relations: [
                'sallaStore',
                'purchaseItems',
                'voucherDetails',
                'voucherDetails.purchaseItem'  // Load the purchase item relationship for voucher details
            ]
        });
    }

    /**
     * Get all purchases for a store
     */
    async getPurchasesForStore(storeId: string): Promise<MerchantVoucherPurchase[]> {
        return await this.purchaseRepository.find({
            where: { salla_store_id: storeId },
            relations: ['purchaseItems', 'voucherDetails'],
            order: { created_at: 'DESC' }
        });
    }

    /**
     * Get all purchases (for super admin)
     */
    async getAllPurchases(): Promise<MerchantVoucherPurchase[]> {
        return await this.purchaseRepository.find({
            relations: ['purchaseItems', 'sallaStore', 'voucherDetails'],
            order: { created_at: 'DESC' }
        });
    }

    /**
     * Delete a purchase order and all related records (cascade)
     */
    async deletePurchaseOrder(purchaseId: string): Promise<{ success: boolean; message: string }> {
        // Verify purchase exists
        const purchase = await this.purchaseRepository.findOne({
            where: { id: purchaseId },
            relations: ['purchaseItems', 'voucherDetails']
        });

        if (!purchase) {
            throw new Error('Purchase order not found');
        }

        // Check if purchase can be deleted (only DRAFT orders can be deleted)
        if (purchase.status !== PurchaseOrderStatus.DRAFT) {
            throw new Error(`Cannot delete purchase order in ${purchase.status} status. Only DRAFT orders can be deleted.`);
        }

        try {
            // Use a transaction to ensure all deletions succeed or rollback
            await this.purchaseRepository.manager.transaction(async (manager) => {
                // First delete voucher details if they exist
                if (purchase.voucherDetails && purchase.voucherDetails.length > 0) {
                    await manager.delete('MerchantVoucherPurchaseDetail', {
                        purchase_id: purchaseId
                    });
                }

                // Then delete purchase items if they exist
                if (purchase.purchaseItems && purchase.purchaseItems.length > 0) {
                    await manager.delete('MerchantVoucherPurchaseItem', {
                        purchase_id: purchaseId
                    });
                }

                // Finally delete the main purchase order
                await manager.delete('MerchantVoucherPurchase', {
                    id: purchaseId
                });
            });

            this.logger.log(`Successfully deleted purchase order ${purchase.purchase_order_number} and all related records`);

            return {
                success: true,
                message: `Purchase order ${purchase.purchase_order_number} and all related records deleted successfully`
            };
        } catch (error) {
            this.logger.error(`Failed to delete purchase order ${purchase.purchase_order_number}: ${error.message}`);
            throw new Error(`Failed to delete purchase order: ${error.message}`);
        }
    }
}
