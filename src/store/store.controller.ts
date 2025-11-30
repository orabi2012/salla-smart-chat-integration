import {
    Controller,
    Get,
    UseGuards,
    Request,
    Res,
    Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StoreAccessGuard } from '../auth/store-access.guard';
import { VoucherPurchasesService } from '../voucher-purchases/voucher-purchases.service';
import { SallaStoresService } from '../salla-stores/salla-stores.service';

@Controller('store')
@UseGuards(AuthGuard('jwt'))
export class StoreController {
    constructor(
        private readonly voucherPurchasesService: VoucherPurchasesService,
        private readonly sallaStoresService: SallaStoresService
    ) { }

    @Get()
    async getStore(@Request() req, @Res() res) {
        // If user is superadmin, redirect to clients page
        if (req.user.isSuperadmin) {
            return res.redirect('/clients');
        }

        // If user has no assigned store, show error
        if (!req.user.assignedStoreId) {
            return res.render('error', {
                title: 'No Store Assigned',
                message: 'No store has been assigned to your account. Please contact an administrator.',
                user: req.user,
            });
        }

        // Check if the assigned store is active
        try {
            const store = await this.sallaStoresService.findById(req.user.assignedStoreId);
            if (!store) {
                return res.render('error', {
                    title: 'Store Not Found',
                    message: 'Your assigned store could not be found. Please contact an administrator.',
                    user: req.user,
                });
            }

            if (!store.is_active) {
                return res.render('error', {
                    title: 'Store Inactive',
                    message: 'Your assigned store is currently inactive. Please contact an administrator for assistance.',
                    user: req.user,
                });
            }
        } catch (error) {
            console.error('Error checking store status:', error);
            return res.render('error', {
                title: 'System Error',
                message: 'Unable to verify store access. Please try again later or contact an administrator.',
                user: req.user,
            });
        }

        // Redirect to the existing clients/edit page with the user's assigned store
        return res.redirect(`/clients/edit/${req.user.assignedStoreId}`);
    }

    @Get(':storeId/purchase-orders')
    @UseGuards(StoreAccessGuard)
    async getPurchaseOrdersIndex(@Request() req, @Res() res) {
        try {
            // Get all purchase orders for this store
            const purchases = await this.voucherPurchasesService.getPurchasesForStore(req.params.storeId);
            const store = await this.sallaStoresService.findById(req.params.storeId);

            return res.render('store/purchase-orders', {
                title: 'Purchase Orders',
                user: req.user,
                store: store,
                purchases: purchases
            });
        } catch (error) {
            console.error('Error loading purchase orders:', error);
            return res.render('error', {
                title: 'Error',
                message: 'Unable to load purchase orders. Please try again later.',
                user: req.user,
            });
        }
    }

    @Get(':storeId/purchase-order')
    @UseGuards(StoreAccessGuard)
    async getPurchaseOrderPage(@Request() req, @Res() res, @Query('orderId') orderId?: string) {
        let existingOrder: any = null;

        if (orderId) {
            try {
                // Load existing purchase order if orderId is provided
                existingOrder = await this.voucherPurchasesService.getPurchaseWithDetails(orderId);
            } catch (error) {
                console.error('Error loading existing purchase order:', error);
            }
        }

        return res.render('purchase/create', {
            title: existingOrder ? 'Edit Purchase Order' : 'Create Purchase Order',
            user: req.user,
            storeId: req.params.storeId,
            userId: req.user.userId,
            existingOrder: existingOrder,
            orderId: orderId || null,
        });
    }

    @Get(':storeId/purchase-order/:orderId/invoice')
    @UseGuards(StoreAccessGuard)
    async getPurchaseOrderInvoice(@Request() req, @Res() res) {
        const orderId = req.params.orderId;
        const storeId = req.params.storeId;

        console.log('Invoice route called with:', { storeId, orderId });

        if (!orderId) {
            return res.status(400).render('error', {
                title: 'Missing Order ID',
                message: 'Order ID is required to generate invoice.',
                user: req.user,
            });
        }

        try {
            // Load purchase order with all details
            const order = await this.voucherPurchasesService.getPurchaseWithDetails(orderId);

            if (!order) {
                return res.status(404).render('error', {
                    title: 'Order Not Found',
                    message: 'The requested purchase order could not be found.',
                    user: req.user,
                });
            }

            // Filter only successful voucher details
            const successfulVouchers = order.voucherDetails?.filter(detail => detail.operation_succeeded === true) || [];

            // Group vouchers by product name
            const groupedVouchers = {};
            let globalIndex = 0;

            successfulVouchers.forEach((voucher) => {
                const productName = voucher.purchaseItem?.product_option_name || 'Unknown Product';
                if (!groupedVouchers[productName]) {
                    groupedVouchers[productName] = {
                        vouchers: [],
                        totalAmount: 0,
                        count: 0
                    };
                }

                groupedVouchers[productName].vouchers.push({ ...voucher, globalIndex: ++globalIndex });
                groupedVouchers[productName].totalAmount += parseFloat(voucher.amount_wholesale) || 0;
                groupedVouchers[productName].count++;
            });

            // Calculate totals for successful vouchers
            const totals = {
                totalAmount: successfulVouchers.reduce((sum, detail) => sum + (parseFloat(detail.amount_wholesale) || 0), 0),
                totalCount: successfulVouchers.length,
                originalTotal: Number(order.total_wholesale_cost) || 0,
                originalCount: order.voucherDetails?.length || 0
            };

            return res.render('purchase/invoice', {
                title: `Invoice - Order #${order.purchase_order_number}`,
                user: req.user,
                order: order,
                successfulVouchers: successfulVouchers,
                groupedVouchers: groupedVouchers,
                totals: totals,
                storeId: req.params.storeId,
            });
        } catch (error) {
            console.error('Error loading purchase order for invoice:', error);
            return res.status(500).render('error', {
                title: 'Server Error',
                message: 'An error occurred while loading the invoice. Please try again.',
                user: req.user,
            });
        }
    }

    @Get(':storeId/test-purchase')
    @UseGuards(StoreAccessGuard)
    async getTestPurchaseOrderPage(@Request() req, @Res() res, @Query('orderId') orderId?: string) {
        let existingOrder: any = null;

        if (orderId) {
            try {
                // Load existing purchase order if orderId is provided
                existingOrder = await this.voucherPurchasesService.getPurchaseWithDetails(orderId);
                console.log('Loaded existing order:', JSON.stringify(existingOrder, null, 2));
            } catch (error) {
                console.error('Error loading existing purchase order:', error);
            }
        }

        return res.render('purchase/test', {
            title: 'Test Purchase Order Page',
            user: req.user,
            storeId: req.params.storeId,
            userId: req.user.userId,
            existingOrder: existingOrder,
            orderId: orderId || null,
        });
    }
}
