/**
 * Client edit page JavaScript functionality
 * Handles balance refresh and other edit page specific operations
 */

/**
 * Refresh balance function for the edit page
 */
async function refreshBalance() {
    const refreshBtn = event.target;
    setButtonLoading(refreshBtn, true);

    const storeData = getStoreData();
    if (!storeData) {
        alert('Store data not available');
        setButtonLoading(refreshBtn, false);
        return;
    }

    try {
        const { response, result } = await apiCall(`/salla-stores/${storeData.id}/test-ubiqfy-auth`, {
            method: 'POST'
        });

        if (response.ok && result.success) {
            const balanceField = document.getElementById('ubiqfy_plafond');
            const plafondValue = result.data && result.data.plafond !== undefined ? result.data.plafond : null;

            if (plafondValue !== undefined && plafondValue !== null) {
                const balanceInCents = parseInt(plafondValue);
                balanceField.value = balanceInCents;
                alert(`✅ Balance Updated Successfully!\n\nNew Balance: ${balanceInCents}¢`);

                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                alert('⚠️ Balance information not available in the response.');
            }
        } else {
            alert('❌ Failed to refresh balance: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        alert('❌ Network error occurred while refreshing balance');
        console.error('Balance refresh error:', error);
    } finally {
        setButtonLoading(refreshBtn, false);
    }
}

// Export functions for global access
window.refreshBalance = refreshBalance;
