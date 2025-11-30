/**
 * Purchase order management JavaScript functionality
 * Handles purchase order cancellation and related modal interactions
 */

// Global variable for purchase order management
let orderToCancel = null;

/**
 * Initialize purchase order management functionality
 */
function initializePurchaseOrderManagement() {
    // Initialize the confirm cancel order button
    const confirmButton = document.getElementById('confirmCancelOrder');
    if (confirmButton) {
        confirmButton.addEventListener('click', handleCancelOrderConfirm);
    }
}

/**
 * Cancel order - show confirmation modal
 * @param {string} orderId - The order ID to cancel
 * @param {string} orderNumber - The order number for display
 */
function cancelOrder(orderId, orderNumber) {
    orderToCancel = orderId;
    document.getElementById('cancelOrderNumber').textContent = orderNumber;

    const cancelModal = new bootstrap.Modal(document.getElementById('cancelOrderModal'));
    cancelModal.show();
}

/**
 * Handle the cancel order confirmation
 */
function handleCancelOrderConfirm() {
    if (!orderToCancel) return;

    fetch(`/voucher-purchases/${orderToCancel}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showSuccessToast('Purchase order cancelled successfully!', 1500);

                // Reload page after a short delay
                setTimeout(() => {
                    location.reload();
                }, 1500);
            } else {
                showErrorToast('Failed to cancel order: ' + (data.message || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showErrorToast('Failed to cancel order');
        });
}

/**
 * Delete purchase order - show confirmation modal
 * @param {string} orderId - The order ID to delete
 * @param {string} orderNumber - The order number for display
 */
function deletePurchaseOrder(orderId, orderNumber) {
    // This function is called from create.ejs, implement if needed
    console.log('Delete purchase order:', orderId, orderNumber);
    // Implementation would be similar to cancelOrder but with different endpoint and modal
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    initializePurchaseOrderManagement();
});

// Export functions for global access
window.cancelOrder = cancelOrder;
window.deletePurchaseOrder = deletePurchaseOrder;
