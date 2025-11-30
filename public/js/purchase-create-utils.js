/**
 * Purchase Order Create Page Utilities
 * Handles dynamic calculations and UI updates for purchase order creation
 */

class PurchaseCreateUtils {
    constructor() {
        this.initializePageData();
        this.initializeUI();
    }

    initializePageData() {
        try {
            const pageDataElement = document.getElementById('page-data');
            if (pageDataElement) {
                this.pageData = JSON.parse(pageDataElement.textContent);
            }
        } catch (error) {
            console.error('Error parsing page data:', error);
        }
    }

    initializeUI() {
        // Initialize any dynamic UI components
        this.updateVoucherStatistics();
        this.updateStatusDisplay();
    }

    /**
     * Calculate and display voucher statistics for completed orders
     */
    updateVoucherStatistics() {
        if (!this.pageData?.existingOrder?.voucherDetails) return;

        const voucherDetails = this.pageData.existingOrder.voucherDetails;
        const successful = voucherDetails.filter(d => d.operation_succeeded === true);
        const failed = voucherDetails.filter(d => d.operation_succeeded === false);
        const successfulAmount = successful.reduce((sum, d) => sum + (parseFloat(d.amount_wholesale) || 0), 0);

        console.log('Voucher Statistics:', {
            total: voucherDetails.length,
            successful: successful.length,
            failed: failed.length,
            successfulAmount: successfulAmount
        });
    }

    /**
     * Update status display based on voucher success/failure
     */
    updateStatusDisplay() {
        if (!this.pageData?.existingOrder) return;

        const order = this.pageData.existingOrder;

        if (order.status === 'COMPLETED' && order.voucherDetails && order.voucherDetails.length > 0) {
            const successfulCount = order.voucherDetails.filter(d => d.operation_succeeded === true).length;
            const totalCount = order.voucherDetails.length;

            let displayStatus = order.status;
            let statusClass = 'success';

            if (successfulCount === 0) {
                displayStatus = 'FAILED';
                statusClass = 'danger';
            } else if (successfulCount < totalCount) {
                displayStatus = 'PARTIAL SUCCESS';
                statusClass = 'warning';
            }

            console.log('Status Analysis:', {
                originalStatus: order.status,
                displayStatus: displayStatus,
                statusClass: statusClass,
                successfulCount: successfulCount,
                totalCount: totalCount
            });
        }
    }

    /**
     * Check if order has successful vouchers for invoice generation
     */
    hasSuccessfulVouchers() {
        if (!this.pageData?.existingOrder?.voucherDetails) return false;

        const successfulCount = this.pageData.existingOrder.voucherDetails
            .filter(d => d.operation_succeeded === true).length;

        return successfulCount > 0;
    }

    /**
     * Get voucher statistics
     */
    getVoucherStats() {
        if (!this.pageData?.existingOrder?.voucherDetails) {
            return { successful: 0, failed: 0, total: 0, successfulAmount: 0 };
        }

        const voucherDetails = this.pageData.existingOrder.voucherDetails;
        const successful = voucherDetails.filter(d => d.operation_succeeded === true);
        const failed = voucherDetails.filter(d => d.operation_succeeded === false);
        const successfulAmount = successful.reduce((sum, d) => sum + (parseFloat(d.amount_wholesale) || 0), 0);

        return {
            successful: successful.length,
            failed: failed.length,
            total: voucherDetails.length,
            successfulAmount: successfulAmount,
            successRate: voucherDetails.length > 0 ? Math.round((successful.length / voucherDetails.length) * 100) : 0
        };
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    window.purchaseCreateUtils = new PurchaseCreateUtils();
});

// Export for use in other scripts
window.PurchaseCreateUtils = PurchaseCreateUtils;
