/**
 * Purchase Orders Page JavaScript
 */

// Global variables
let orderToDelete = null;

/**
 * Initialize the page when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function () {
    initializeTooltips();
    initializeDeleteModal();
});

/**
 * Initialize Bootstrap tooltips
 */
function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

/**
 * Initialize delete confirmation modal
 */
function initializeDeleteModal() {
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
    }
}

/**
 * Show delete confirmation modal
 * @param {string} orderId - The ID of the order to delete
 * @param {string} orderNumber - The order number for display
 */
function deletePurchaseOrder(orderId, orderNumber) {
    orderToDelete = orderId;
    const orderNumberElement = document.getElementById('orderNumber');
    if (orderNumberElement) {
        orderNumberElement.textContent = orderNumber;
    }

    const deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
    deleteModal.show();
}

/**
 * Handle the confirm delete action
 */
function handleConfirmDelete() {
    if (!orderToDelete) {
        showToast('No order selected for deletion', 'error');
        return;
    }

    // Show loading state
    const confirmBtn = document.getElementById('confirmDelete');
    const originalText = confirmBtn.textContent;
    confirmBtn.textContent = 'Deleting...';
    confirmBtn.disabled = true;

    // Send delete request
    fetch(`/voucher-purchases/${orderToDelete}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('Purchase order deleted successfully', 'success');
                // Reload page after short delay
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                showToast('Failed to delete purchase order: ' + (data.message || 'Unknown error'), 'error');
                // Reset button state
                confirmBtn.textContent = originalText;
                confirmBtn.disabled = false;
            }
        })
        .catch(error => {
            console.error('Error deleting purchase order:', error);
            showToast('An error occurred while deleting the purchase order', 'error');
            // Reset button state
            confirmBtn.textContent = originalText;
            confirmBtn.disabled = false;
        });

    // Close modal
    const deleteModal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
    if (deleteModal) {
        deleteModal.hide();
    }

    // Reset order to delete
    orderToDelete = null;
}

/**
 * Show toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of toast (success, error, warning, info)
 */
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        console.warn('Toast container not found');
        return;
    }

    const toastId = 'toast-' + Date.now();
    const iconMap = {
        success: 'check-circle',
        error: 'exclamation-triangle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };

    const colorMap = {
        success: 'success',
        error: 'danger',
        warning: 'warning',
        info: 'info'
    };

    const icon = iconMap[type] || iconMap.info;
    const color = colorMap[type] || colorMap.info;

    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center text-white bg-${color} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-${icon} me-2"></i>
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHtml);

    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: 5000
    });

    toast.show();

    // Clean up toast element after it's hidden
    toastElement.addEventListener('hidden.bs.toast', function () {
        toastElement.remove();
    });
}

/**
 * Refresh the current page
 */
function refreshPage() {
    window.location.reload();
}

/**
 * Navigate to create new order
 * @param {string} storeId - The store ID
 */
function createNewOrder(storeId) {
    if (storeId) {
        window.location.href = `/store/${storeId}/purchase-order`;
    } else {
        showToast('Store ID not found', 'error');
    }
}

/**
 * View order details
 * @param {string} storeId - The store ID
 * @param {string} orderId - The order ID
 */
function viewOrderDetails(storeId, orderId) {
    if (storeId && orderId) {
        window.location.href = `/store/${storeId}/purchase-order?orderId=${orderId}`;
    } else {
        showToast('Missing order or store information', 'error');
    }
}

/**
 * Calculate display status for completed orders
 * @param {Object} purchase - The purchase order object
 * @returns {Object} - Object with displayStatus and statusClass
 */
function calculateOrderStatus(purchase) {
    let displayStatus = purchase.status;
    let statusClass = purchase.status.toLowerCase();

    // For completed orders, check if partially successful
    if (purchase.status.toLowerCase() === 'completed' && purchase.voucherDetails && purchase.voucherDetails.length > 0) {
        const successfulCount = purchase.voucherDetails.filter(detail => detail.operation_succeeded === true).length;
        const totalCount = purchase.voucherDetails.length;

        if (successfulCount === 0) {
            displayStatus = 'FAILED';
            statusClass = 'failed';
        } else if (successfulCount < totalCount) {
            displayStatus = 'PARTIAL SUCCESS';
            statusClass = 'partially_completed';
        } else {
            displayStatus = 'COMPLETED';
            statusClass = 'completed';
        }
    }

    return { displayStatus, statusClass };
}

/**
 * Calculate successful cost for completed orders
 * @param {Object} purchase - The purchase order object
 * @returns {number} - The successful cost amount
 */
function calculateSuccessfulCost(purchase) {
    let successfulCost = parseFloat(purchase.total_wholesale_cost) || 0;

    if (purchase.voucherDetails && purchase.voucherDetails.length > 0) {
        successfulCost = purchase.voucherDetails
            .filter(detail => detail.operation_succeeded === true)
            .reduce((sum, detail) => sum + (parseFloat(detail.amount_wholesale) || 0), 0);
    }

    return successfulCost;
}

/**
 * Calculate voucher statistics for completed orders
 * @param {Object} purchase - The purchase order object
 * @returns {Object} - Object with voucher counts and success rate
 */
function calculateVoucherStats(purchase) {
    if (!purchase.voucherDetails || purchase.voucherDetails.length === 0) {
        return null;
    }

    const successfulCount = purchase.voucherDetails.filter(detail => detail.operation_succeeded === true).length;
    const failedCount = purchase.voucherDetails.filter(detail => detail.operation_succeeded === false).length;
    const totalCount = purchase.voucherDetails.length;
    const successRate = totalCount > 0 ? Math.round((successfulCount / totalCount) * 100) : 0;

    return { successfulCount, failedCount, totalCount, successRate };
}

// Export functions for global use
window.deletePurchaseOrder = deletePurchaseOrder;
window.showToast = showToast;
window.refreshPage = refreshPage;
window.createNewOrder = createNewOrder;
window.viewOrderDetails = viewOrderDetails;
window.calculateOrderStatus = calculateOrderStatus;
window.calculateSuccessfulCost = calculateSuccessfulCost;
window.calculateVoucherStats = calculateVoucherStats;
