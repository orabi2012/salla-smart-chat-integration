/**
 * User management JavaScript functionality
 * Handles user status toggling, modal interactions, and AJAX requests
 */

// Global variables for user management
let userToToggle = null;
let toggleAction = null;

/**
 * Initialize user management functionality
 */
function initializeUserManagement() {
    // Initialize the confirm status toggle button
    const confirmButton = document.getElementById('confirmStatusToggle');
    if (confirmButton) {
        confirmButton.addEventListener('click', handleStatusToggleConfirm);
    }
}

/**
 * Toggle user status - show confirmation modal
 * @param {string} userId - The user ID to toggle
 * @param {string} userName - The user name for display
 * @param {boolean} newStatus - The new status (true = activate, false = deactivate)
 */
function toggleUserStatus(userId, userName, newStatus) {
    userToToggle = userId;
    toggleAction = newStatus ? 'activate' : 'deactivate';

    const statusModal = new bootstrap.Modal(document.getElementById('statusToggleModal'));
    const statusAction = document.getElementById('statusAction');
    const statusUserName = document.getElementById('statusUserName');
    const statusDescription = document.getElementById('statusDescription');
    const confirmButton = document.getElementById('confirmStatusToggle');

    statusUserName.textContent = userName;
    statusAction.textContent = toggleAction;

    if (toggleAction === 'activate') {
        statusDescription.textContent = 'This user will be able to access the system and login.';
        statusDescription.className = 'text-success mb-0';
        confirmButton.className = 'btn btn-success';
        confirmButton.innerHTML = '<i class="fas fa-toggle-on me-1"></i>Activate User';
    } else {
        statusDescription.textContent = 'This user will be unable to access the system or login.';
        statusDescription.className = 'text-warning mb-0';
        confirmButton.className = 'btn btn-warning';
        confirmButton.innerHTML = '<i class="fas fa-toggle-off me-1"></i>Deactivate User';
    }

    statusModal.show();
}

/**
 * Handle the status toggle confirmation
 */
function handleStatusToggleConfirm() {
    if (!userToToggle) return;

    fetch(`/users/toggle-status/${userToToggle}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Show success message in toast
                if (toggleAction === 'activate') {
                    showSuccessToast('User activated successfully! They can now login.', 1500);
                } else {
                    showWarningToast('User deactivated successfully! They can no longer login.', 1500);
                }

                // Reload page after a short delay
                setTimeout(() => {
                    location.reload();
                }, 1500);
            } else {
                showErrorToast(`Failed to ${toggleAction} user: ` + (data.error || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showErrorToast(`Failed to ${toggleAction} user`);
        });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    initializeUserManagement();
});

// Export functions for global access
window.toggleUserStatus = toggleUserStatus;
