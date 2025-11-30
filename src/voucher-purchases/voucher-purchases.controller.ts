import { Controller, Get, Post, Body, Param, Logger, ValidationPipe, UsePipes, Delete, Put, UseGuards, Request, Render, Response } from '@nestjs/common';
import { VoucherPurchasesService } from './voucher-purchases.service';
import { DoTransactionService } from './dotransaction.service';
import { MerchantVoucherPurchase } from './merchant-voucher-purchase.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SallaStore } from '../salla-stores/salla-stores.entity';
import { AuthGuard } from '@nestjs/passport';

@Controller('voucher-purchases')
export class VoucherPurchasesController {
    private readonly logger = new Logger(VoucherPurchasesController.name);

    constructor(
        private readonly voucherPurchasesService: VoucherPurchasesService,
        private readonly doTransactionService: DoTransactionService,
        @InjectRepository(SallaStore)
        private readonly sallaStoreRepository: Repository<SallaStore>,
    ) { }

    // ================= WEB ROUTES =================

    /**
     * Purchase Orders management page
     */
    @Get('/purchase-orders')
    @UseGuards(AuthGuard('jwt'))
    @Render('purchase/index')
    async purchaseOrdersIndex(@Request() req) {
        try {
            const user = req.user;

            // Get all purchase orders - for super admin show all, for regular users show only their store's orders
            let purchaseOrders: any[] = [];
            let stats = { total: 0, completed: 0, pending: 0, totalValue: 0 };

            if (user.isSuperadmin) {
                purchaseOrders = await this.voucherPurchasesService.getAllPurchases();
            } else if (user.assignedStoreId) {
                purchaseOrders = await this.voucherPurchasesService.getPurchasesForStore(user.assignedStoreId);
            }

            // Calculate stats
            if (purchaseOrders.length > 0) {
                stats.total = purchaseOrders.length;
                stats.completed = purchaseOrders.filter(p => p.status === 'completed').length;
                stats.pending = purchaseOrders.filter(p => p.status === 'pending' || p.status === 'processing').length;
                stats.totalValue = purchaseOrders.reduce((sum, p) => sum + (parseFloat(p.total_wholesale_cost) || 0), 0);
            }

            // Enhance purchase orders with additional data including success/failure stats
            const enhancedOrders = await Promise.all(purchaseOrders.map(async (order) => {
                const store = await this.sallaStoreRepository.findOne({ where: { id: order.salla_store_id } });
                const itemCount = order.purchaseItems ? order.purchaseItems.length : 0;

                // Get voucher details for success/failure statistics
                let voucherStats = {
                    totalVouchers: order.total_vouchers_ordered || 0,
                    successfulVouchers: order.total_vouchers_generated || 0,
                    failedVouchers: order.total_vouchers_failed || 0,
                    successRate: 0,
                    actualCostOfSuccessful: 0
                };

                // Calculate success rate and actual cost of successful vouchers only
                if (voucherStats.totalVouchers > 0) {
                    voucherStats.successRate = Math.round((voucherStats.successfulVouchers / voucherStats.totalVouchers) * 100);
                }

                // For completed orders, calculate the cost of only successful vouchers
                if (order.status === 'completed' && order.voucherDetails && order.voucherDetails.length > 0) {
                    voucherStats.actualCostOfSuccessful = order.voucherDetails
                        .filter(detail => detail.operation_succeeded === true)
                        .reduce((sum, detail) => sum + (parseFloat(detail.amount_wholesale) || 0), 0);
                }

                return {
                    ...order,
                    storeName: store ? store.salla_store_name : 'Unknown Store',
                    itemCount,
                    voucherStats
                };
            }));

            return {
                title: 'Purchase Orders Management',
                user: user,
                purchaseOrders: enhancedOrders,
                stats
            };
        } catch (error) {
            this.logger.error('Error loading purchase orders page:', error);
            return {
                title: 'Purchase Orders Management',
                user: req.user,
                purchaseOrders: [],
                stats: { total: 0, completed: 0, pending: 0, totalValue: 0 },
                errorMessage: 'Failed to load purchase orders'
            };
        }
    }

    // ================= API ROUTES =================

    /**
     * Get all purchases for a store
     */
    @Get('store/:storeId')
    async getPurchasesForStore(@Param('storeId') storeId: string): Promise<MerchantVoucherPurchase[]> {
        return await this.voucherPurchasesService.getPurchasesForStore(storeId);
    }

    /**
     * Get purchase with details
     */
    @Get(':purchaseId')
    async getPurchaseDetails(@Param('purchaseId') purchaseId: string): Promise<MerchantVoucherPurchase | null> {
        return await this.voucherPurchasesService.getPurchaseWithDetails(purchaseId);
    }

    /**
     * Delete purchase order and all related records
     */
    @Delete(':purchaseId')
    async deletePurchaseOrder(@Param('purchaseId') purchaseId: string) {
        try {
            const result = await this.voucherPurchasesService.deletePurchaseOrder(purchaseId);
            return {
                success: result.success,
                message: result.message
            };
        } catch (error) {
            this.logger.error(`Failed to delete purchase order ${purchaseId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create new draft purchase
     */
    @Post('create/:storeId/:userId')
    async createDraftPurchase(
        @Param('storeId') storeId: string,
        @Param('userId') userId: string,
        @Body() createData?: {
            products?: {
                product_type_code: string;
                product_code: string;
                provider_code: string;
                product_option_code: string;
                product_name: string;
                product_option_name: string;
                unit_face_value: number;
                unit_wholesale_price: number;
                quantity_needed: number;
            }[]
        }
    ) {
        try {
            const purchaseOrder = await this.voucherPurchasesService.createDraftPurchase(storeId, userId);

            // If products are provided, add them to the purchase order
            if (createData?.products && createData.products.length > 0) {
                for (const product of createData.products) {
                    await this.voucherPurchasesService.addPurchaseItem(purchaseOrder.id, {
                        product_type_code: product.product_type_code,
                        product_code: product.product_code,
                        provider_code: product.provider_code,
                        product_option_code: product.product_option_code,
                        product_name: product.product_name,
                        product_option_name: product.product_option_name,
                        quantity_ordered: product.quantity_needed,
                        unit_face_value: product.unit_face_value,
                        unit_wholesale_price: product.unit_wholesale_price
                    });
                }

                // Get the updated purchase order with items
                const updatedPurchase = await this.voucherPurchasesService.getPurchaseWithDetails(purchaseOrder.id);
                return {
                    success: true,
                    message: `Purchase order created with ${createData.products.length} items`,
                    purchaseOrder: updatedPurchase
                };
            }

            return {
                success: true,
                message: 'Draft purchase order created',
                purchaseOrder
            };
        } catch (error) {
            return {
                success: false,
                message: error.message || 'Failed to create purchase order'
            };
        }
    }

    /**
     * Add item to purchase
     */
    @Post(':purchaseId/items')
    async addPurchaseItem(
        @Param('purchaseId') purchaseId: string,
        @Body() itemData: {
            product_type_code: string;
            product_code: string;
            provider_code: string;
            product_option_code: string;
            product_name: string;
            product_option_name: string;
            quantity_ordered: number;
            unit_face_value: number;
            unit_wholesale_price?: number;
        }
    ) {
        return await this.voucherPurchasesService.addPurchaseItem(purchaseId, itemData);
    }

    /**
     * Remove item from purchase
     */
    @Delete(':purchaseId/items/:itemId')
    async removePurchaseItem(
        @Param('purchaseId') purchaseId: string,
        @Param('itemId') itemId: string
    ) {
        return await this.voucherPurchasesService.removePurchaseItem(purchaseId, itemId);
    }

    /**
     * Update item quantity
     */
    @Put(':purchaseId/items/:itemId')
    async updatePurchaseItemQuantity(
        @Param('purchaseId') purchaseId: string,
        @Param('itemId') itemId: string,
        @Body() updateData: { quantity_ordered: number }
    ) {
        return await this.voucherPurchasesService.updatePurchaseItemQuantity(purchaseId, itemId, updateData.quantity_ordered);
    }

    /**
     * Update pricing for all store products (bulk update)
     */
    @Post('update-pricing/:storeId')
    async updateStorePricing(@Param('storeId') storeId: string) {
        this.logger.log(`Updating pricing for store ${storeId}`);

        try {
            const result = await this.doTransactionService.updateAllStorePricing(storeId);
            return {
                storeId: storeId,
                updatedProducts: result.updatedCount,
                message: `Updated pricing for ${result.updatedCount} products`
            };
        } catch (error) {
            this.logger.error(`Failed to update pricing for store ${storeId}:`, error);
            return {
                storeId: storeId,
                error: error.message
            };
        }
    }

    /**
     * Check balance and update pricing before processing
     */
    @Post(':purchaseId/check-balance')
    async checkBalance(@Param('purchaseId') purchaseId: string) {
        this.logger.log(`Checking balance for purchase ${purchaseId}`);

        try {
            const balanceCheck = await this.doTransactionService.checkBalanceAndUpdatePricing(purchaseId);

            return {
                purchaseId: purchaseId,
                balance: balanceCheck.balance,
                totalCost: balanceCheck.totalCost,
                sufficient: balanceCheck.sufficient,
                canProcess: balanceCheck.sufficient,
                message: balanceCheck.sufficient
                    ? 'Balance is sufficient, ready to process'
                    : `Insufficient balance. Required: ${balanceCheck.totalCost}, Available: ${balanceCheck.balance}`
            };
        } catch (error) {
            this.logger.error(`Balance check failed for purchase ${purchaseId}:`, error);
            return {
                purchaseId: purchaseId,
                error: error.message,
                canProcess: false
            };
        }
    }

    /**
     * Confirm purchase order - check balance and perform transaction
     */
    @Post(':purchaseId/confirm')
    async confirmPurchaseOrder(@Param('purchaseId') purchaseId: string) {
        this.logger.log(`Confirming purchase order ${purchaseId}`);

        try {
            // Step 1: Check balance with cent precision
            const balanceCheck = await this.doTransactionService.checkBalanceAndUpdatePricing(purchaseId);

            if (!balanceCheck.sufficient) {
                return {
                    success: false,
                    purchaseId: purchaseId,
                    message: `Insufficient balance. Required: $${balanceCheck.totalCost.toFixed(2)}, Available: $${balanceCheck.balance.toFixed(2)}`,
                    balance: balanceCheck.balance,
                    totalCost: balanceCheck.totalCost,
                    sufficient: false
                };
            }

            // Step 2: Submit the order first to change status to PENDING and create voucher detail records
            await this.voucherPurchasesService.submitPurchaseOrder(purchaseId);

            // Step 3: Process the purchase order (perform transactions based on merchant_voucher_purchase_details)
            await this.doTransactionService.processPurchaseOrder(purchaseId);

            return {
                success: true,
                purchaseId: purchaseId,
                message: 'Order confirmed successfully. Vouchers are being processed.',
                balance: balanceCheck.balance,
                totalCost: balanceCheck.totalCost
            };

        } catch (error) {
            this.logger.error(`Failed to confirm purchase order ${purchaseId}:`, error);
            return {
                success: false,
                purchaseId: purchaseId,
                message: `Failed to confirm order: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * Submit purchase order for processing
     */
    @Post(':purchaseId/submit')
    async submitPurchaseOrder(@Param('purchaseId') purchaseId: string) {
        await this.voucherPurchasesService.submitPurchaseOrder(purchaseId);
        return { message: 'Purchase order submitted for processing' };
    }

    /**
     * Process purchase order through DoTransaction
     */
    @Post(':purchaseId/process')
    async processPurchaseOrder(@Param('purchaseId') purchaseId: string) {
        this.logger.log(`Processing purchase order ${purchaseId}`);

        // Process in background
        this.doTransactionService.processPurchaseOrder(purchaseId)
            .catch(error => {
                this.logger.error(`Background processing failed for purchase ${purchaseId}:`, error);
            });

        return {
            message: 'Purchase order processing started',
            purchaseId: purchaseId
        };
    }

    /**
     * Retry failed vouchers
     */
    @Post(':purchaseId/retry-failed')
    async retryFailedVouchers(@Param('purchaseId') purchaseId: string) {
        this.logger.log(`Retrying failed vouchers for purchase ${purchaseId}`);

        // Process in background
        this.doTransactionService.retryFailedVouchers(purchaseId)
            .catch(error => {
                this.logger.error(`Retry failed for purchase ${purchaseId}:`, error);
            });

        return {
            message: 'Failed vouchers retry started',
            purchaseId: purchaseId
        };
    }

    /**
     * Test endpoint - Get Ubiqfy balance
     */
    @Get('test/balance/:storeId')
    async testGetBalance(@Param('storeId') storeId: string) {
        this.logger.log('Testing Ubiqfy balance endpoint');

        try {
            // Get store data first
            const store = await this.sallaStoreRepository.findOne({ where: { id: 'default-store-id' } });
            const balanceInfo = await this.doTransactionService.getUbiqfyBalanceInfo(store);
            return {
                success: true,
                balance: balanceInfo.balance,
                status: balanceInfo.status,
                message: 'Balance retrieved successfully'
            };
        } catch (error) {
            this.logger.error('Balance test failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Test endpoint - Get product pricing
     */
    @Get('test/pricing/:productOptionCode')
    async testGetPricing(@Param('productOptionCode') productOptionCode: string) {
        this.logger.log(`Testing product pricing for ${productOptionCode}`);

        try {
            const pricing = await this.doTransactionService.getProductPricingInfo(productOptionCode);
            return {
                success: true,
                pricing: pricing,
                message: 'Pricing retrieved successfully'
            };
        } catch (error) {
            this.logger.error('Pricing test failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get processing status
     */
    @Get(':purchaseId/status')
    async getProcessingStatus(@Param('purchaseId') purchaseId: string) {
        const purchase = await this.voucherPurchasesService.getPurchaseWithDetails(purchaseId);
        if (!purchase) {
            return { error: 'Purchase not found' };
        }

        return {
            purchaseId: purchase.id,
            status: purchase.status,
            totalVouchersOrdered: purchase.total_vouchers_ordered,
            totalVouchersGenerated: purchase.total_vouchers_generated,
            totalVouchersFailed: purchase.total_vouchers_failed,
            processingStartedAt: purchase.processing_started_at,
            processingCompletedAt: purchase.processing_completed_at,
            errorMessage: purchase.error_message
        };
    }

    /**
     * Manually attach voucher codes to Salla products
     */
    @Post(':purchaseId/attach-to-salla')
    async attachVoucherCodesToSalla(@Param('purchaseId') purchaseId: string) {
        this.logger.log(`Manually attaching voucher codes to Salla for purchase ${purchaseId}`);

        try {
            await this.doTransactionService.attachAllVoucherCodesToSalla(purchaseId);

            return {
                success: true,
                purchaseId: purchaseId,
                message: 'Voucher codes successfully attached to Salla products'
            };

        } catch (error) {
            this.logger.error(`Failed to attach codes to Salla for purchase ${purchaseId}:`, error);
            return {
                success: false,
                purchaseId: purchaseId,
                message: `Failed to attach codes to Salla: ${error.message}`,
                error: error.message
            };
        }
    }
}
