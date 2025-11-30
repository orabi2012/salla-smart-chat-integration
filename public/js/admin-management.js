/**
 * Admin management JavaScript functionality
 * Handles admin-specific user and store management operations
 */

/**
 * Toggle user status from admin panel
 * @param {string} userId - The user ID to toggle
 * @param {boolean} activate - Whether to activate or deactivate
 */
function toggleUser(userId, activate) {
    const action = activate ? 'activate' : 'deactivate';
    if (confirm(`Are you sure you want to ${action} this user?`)) {
        fetch(`/admin/users/${userId}/toggle-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    location.reload();
                } else {
                    alert(`Failed to ${action} user: ` + (data.error || 'Unknown error'));
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert(`Failed to ${action} user`);
            });
    }
}

/**
 * Toggle store status from admin panel
 * @param {string} storeId - The store ID to toggle
 * @param {boolean} activate - Whether to activate or deactivate
 */
function toggleStore(storeId, activate) {
    const action = activate ? 'activate' : 'deactivate';
    if (confirm(`Are you sure you want to ${action} this store?`)) {
        fetch(`/admin/stores/${storeId}/toggle-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    location.reload();
                } else {
                    alert(`Failed to ${action} store: ` + (data.error || 'Unknown error'));
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert(`Failed to ${action} store`);
            });
    }
}

// Export functions for global access
window.toggleUser = toggleUser;
window.toggleStore = toggleStore;
