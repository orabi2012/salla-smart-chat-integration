/**
 * Store management JavaScript functionality
 * Handles store status toggling, modal interactions, and AJAX requests
 */

// Global variables for store management
let storeToToggle = null;
let toggleAction = null;

/**
 * Initialize store management functionality
 */
function initializeStoreManagement() {
    // Initialize the confirm status toggle button
    const confirmButton = document.getElementById('confirmStatusToggle');
    if (confirmButton) {
        confirmButton.addEventListener('click', handleStoreStatusToggleConfirm);
    }

    // Alternative modal button for stores with different modal structure
    const confirmStoreStatusBtn = document.getElementById('confirmStoreStatusBtn');
    if (confirmStoreStatusBtn) {
        // This will be handled dynamically in toggleStoreStatus function
    }
}

/**
 * Toggle store status - show confirmation modal
 * @param {string} storeId - The store ID to toggle
 * @param {string} storeName - The store name for display
 * @param {boolean} newStatus - The new status (true = activate, false = deactivate)
 */
function toggleStoreStatus(storeId, storeName, newStatus) {
    storeToToggle = storeId;
    toggleAction = newStatus ? 'activate' : 'deactivate';

    // Check for standard status toggle modal
    const statusToggleModal = document.getElementById('statusToggleModal');
    if (statusToggleModal) {
        const statusModal = new bootstrap.Modal(statusToggleModal);
        const statusAction = document.getElementById('statusAction');
        const statusStoreName = document.getElementById('statusStoreName');
        const statusDescription = document.getElementById('statusDescription');
        const confirmButton = document.getElementById('confirmStatusToggle');

        statusStoreName.textContent = storeName;
        statusAction.textContent = toggleAction;

        if (toggleAction === 'activate') {
            statusDescription.textContent = 'This store will be accessible and users can manage products.';
            statusDescription.className = 'text-success mb-0';
            confirmButton.className = 'btn btn-success';
            confirmButton.innerHTML = '<i class="fas fa-toggle-on me-1"></i>Activate Store';
        } else {
            statusDescription.textContent = 'This store will be inaccessible and users cannot manage products.';
            statusDescription.className = 'text-warning mb-0';
            confirmButton.className = 'btn btn-warning';
            confirmButton.innerHTML = '<i class="fas fa-toggle-off me-1"></i>Deactivate Store';
        }

        statusModal.show();
    }
    // Check for alternative store status modal (clients/index.ejs style)
    else {
        const modal = new bootstrap.Modal(document.getElementById('storeStatusModal'));
        const actionColor = newStatus ? 'success' : 'warning';
        const actionIcon = newStatus ? 'play' : 'pause';

        // Update modal content
        document.getElementById('storeStatusModalStoreName').textContent = storeName;
        document.getElementById('storeStatusModalMessage').innerHTML = newStatus
            ? `Are you sure you want to <strong>activate</strong> this store? Users will be able to access and manage it.`
            : `Are you sure you want to <strong>deactivate</strong> this store? It will be disabled and users won't be able to access it.`;

        // Update confirm button
        const confirmBtn = document.getElementById('confirmStoreStatusBtn');
        confirmBtn.className = `btn btn-${actionColor}`;
        confirmBtn.innerHTML = `<i class="fas fa-${actionIcon} me-1"></i>${newStatus ? 'Activate' : 'Deactivate'}`;

        // Show modal
        modal.show();

        // Handle confirm button click
        confirmBtn.onclick = function () {
            modal.hide();
            handleStoreStatusToggleConfirm();
        };
    }
}

/**
 * Handle the store status toggle confirmation
 */
function handleStoreStatusToggleConfirm() {
    if (!storeToToggle) return;

    fetch(`/clients/toggle-status/${storeToToggle}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Show success message in toast
                if (data.isActive) {
                    showSuccessToast('Store activated successfully! It is now accessible and operational.', 1500);
                } else {
                    showWarningToast('Store deactivated successfully! It is now disabled and inaccessible.', 1500);
                }

                // Reload page after a short delay
                setTimeout(() => {
                    location.reload();
                }, 1500);
            } else {
                showErrorToast(`Failed to ${toggleAction} store: ` + (data.error || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showErrorToast(`Failed to ${toggleAction} store`);
        });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    initializeStoreManagement();
});

// Export functions for global access
window.toggleStoreStatus = toggleStoreStatus;
