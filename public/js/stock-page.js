// Stock Page JavaScript Functionality

// Store configuration
let storeId = null;
let userId = null;
let pageData = {};

// Initialize tooltips and handle URL messages
document.addEventListener('DOMContentLoaded', function () {
    // Load page data
    try {
        const pageDataElement = document.getElementById('page-data');
        if (pageDataElement) {
            pageData = JSON.parse(pageDataElement.textContent);
            storeId = pageData.storeId;
            userId = pageData.userId;
        }
    } catch (error) {
        console.error('Error parsing page data:', error);
    }

    // Fallback: Extract store ID from URL if not available in page data
    if (!storeId) {
        const pathParts = window.location.pathname.split('/');
        const stockIndex = pathParts.indexOf('stock');
        if (stockIndex > 0) {
            storeId = pathParts[stockIndex - 1];
        }
    }

    // Initialize Bootstrap tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Handle success and error messages from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const successMessage = urlParams.get('success');
    const errorMessage = urlParams.get('error');

    if (successMessage) {
        let message = '';

        switch (successMessage) {
            case 'vouchers_synced_successfully':
                message = '✅ Vouchers have been successfully generated and synced to Salla! Stock levels have been updated.';
                break;
            default:
                message = successMessage.replace(/_/g, ' ');
        }

        // Show success alert
        const alertHtml = `
            <div class="alert alert-success alert-dismissible fade show" role="alert">
                <i class="fas fa-check-circle me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;

        // Insert at the top of the main content
        const mainContent = document.querySelector('.container-fluid .row .col-12');
        if (mainContent) {
            mainContent.insertAdjacentHTML('afterbegin', alertHtml);
        }

        // Auto-hide after 8 seconds
        setTimeout(() => {
            const alert = document.querySelector('.alert-success');
            if (alert) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, 8000);

        // Clean URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
    }

    if (errorMessage) {
        let message = '';

        switch (errorMessage) {
            case 'navigation_failed':
                message = '⚠️ There was an issue navigating to the stock page, but voucher processing may have completed.';
                break;
            default:
                message = errorMessage.replace(/_/g, ' ');
        }

        // Show error alert
        const alertHtml = `
            <div class="alert alert-warning alert-dismissible fade show" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;

        const mainContent = document.querySelector('.container-fluid .row .col-12');
        if (mainContent) {
            mainContent.insertAdjacentHTML('afterbegin', alertHtml);
        }

        // Clean URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
    }

    // Auto-select products that need restocking on page load
    const productCheckboxes = document.querySelectorAll('input[data-option-id]');
    productCheckboxes.forEach(checkbox => {
        const qtyNeeded = parseInt(checkbox.dataset.qtyNeeded) || 0;
        // Auto-select if quantity needed > 0
        if (qtyNeeded > 0) {
            checkbox.checked = true;
        }
    });

    // Update button state after auto-selection
    updateCreateButtonState();

    // Update select-all checkbox state
    const selectAllCheckbox = document.getElementById('select-all');
    const checkedProductCheckboxes = document.querySelectorAll('input[data-option-id]:checked');
    const totalProductCheckboxes = document.querySelectorAll('input[data-option-id]');

    if (checkedProductCheckboxes.length > 0 && checkedProductCheckboxes.length === totalProductCheckboxes.length) {
        selectAllCheckbox.checked = true;
    }

    // Auto-refresh all stock when page loads (but only once per session or after a delay)
    if (totalProductCheckboxes.length > 0) {
        // Check if auto-refresh was recently performed
        const lastAutoRefresh = sessionStorage.getItem('lastAutoRefresh');
        const now = Date.now();
        const autoRefreshCooldown = 5 * 60 * 1000; // 5 minutes cooldown

        // Only auto-refresh if:
        // 1. Never refreshed before in this session, OR
        // 2. Last refresh was more than 5 minutes ago, OR  
        // 3. URL indicates this is a fresh navigation (not a reload from stock refresh)
        const shouldAutoRefresh = !lastAutoRefresh ||
            (now - parseInt(lastAutoRefresh)) > autoRefreshCooldown ||
            !document.referrer.includes('/stock/');

        if (shouldAutoRefresh) {
            // Mark that we're about to do an auto-refresh
            sessionStorage.setItem('lastAutoRefresh', now.toString());

            // Add a small delay to ensure page is fully loaded
            setTimeout(() => {
                console.log('Auto-refreshing stock levels on page load...');
                refreshAllStock(true); // Pass true to indicate automatic refresh
            }, 1000);
        } else {
            console.log('Skipping auto-refresh (recently performed or page reload detected)');
            // Hide the auto-refresh indicator since we're not refreshing
            const indicator = document.getElementById('auto-refresh-indicator');
            if (indicator) {
                indicator.style.display = 'none';
            }
        }
    } else {
        // Hide the auto-refresh indicator if there are no products
        const indicator = document.getElementById('auto-refresh-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
});

// Save all stock levels to database
async function saveAllStockLevels() {
    const saveButton = document.querySelector('button[onclick="saveAllStockLevels()"]');
    const originalText = saveButton.innerHTML;

    try {
        // Disable button and show loading state
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        // Collect all stock level inputs
        const stockLevels = [];
        const stockInputs = document.querySelectorAll('input[id^="stock-level-"]');

        stockInputs.forEach(input => {
            const optionId = input.id.replace('stock-level-', '');
            const stockLevel = parseInt(input.value) || 0;

            // Validate before adding
            if (isNaN(stockLevel) || stockLevel < 0) {
                throw new Error(`Invalid stock level for option ${optionId}: must be 0 or higher`);
            }

            stockLevels.push({
                optionId: optionId,
                stockLevel: stockLevel
            });
        });

        if (stockLevels.length === 0) {
            showToast('No stock levels to save', 'warning');
            return;
        }

        // Send update request
        const response = await fetch(`/clients/stock/${storeId}/save-levels`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ stockLevels })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showToast('Stock levels saved successfully!', 'success');

            // Update UI to reflect saved state
            stockInputs.forEach(input => {
                input.setAttribute('data-original-value', input.value);
                input.classList.remove('is-invalid');
            });
        } else {
            throw new Error(result.message || 'Failed to save stock levels');
        }

    } catch (error) {
        console.error('Error saving stock levels:', error);
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        // Restore button state
        saveButton.disabled = false;
        saveButton.innerHTML = originalText;
    }
}

// Update stock level
async function updateStockLevel(optionId, newLevel) {
    // Validation: ensure value is not empty and is a valid number >= 0
    if (newLevel === '' || newLevel === null || newLevel === undefined) {
        const input = document.getElementById('stock-level-' + optionId);
        input.value = input.defaultValue || 1;
        showToast('Stock level cannot be empty. Please enter a number (0 or higher).', 'warning');
        return;
    }

    const level = parseInt(newLevel);
    if (isNaN(level) || level < 0) {
        const input = document.getElementById('stock-level-' + optionId);
        input.value = input.defaultValue || 1;
        showToast('Stock level must be a number 0 or higher. (0 = no minimum)', 'warning');
        return;
    }

    // Store the current value as the new default
    const input = document.getElementById('stock-level-' + optionId);
    input.defaultValue = level;

    try {
        // Save to database
        const response = await fetch(`/clients/stock/${storeId}/save-levels`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                stockLevels: [{ optionId: optionId, stockLevel: level }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to save stock level');
        }

        // Show appropriate message based on level
        let message = 'Stock level updated to ' + level;
        if (level === 0) {
            message += ' (no minimum threshold)';
        } else {
            message += ' (minimum threshold)';
        }

        showToast(message, 'success');

        // Update the quantity to purchase display
        const sallaStockElement = document.getElementById('salla-stock-' + optionId);
        if (sallaStockElement) {
            const sallaStockText = sallaStockElement.textContent || '0';
            const sallaStock = parseInt(sallaStockText) || 0;
            updateQtyToPurchase(optionId, sallaStock, level);
        }

    } catch (error) {
        console.error('Error saving stock level:', error);
        // Reset to previous value on error
        const input = document.getElementById('stock-level-' + optionId);
        input.value = input.defaultValue || 1;
        showToast('Error saving stock level: ' + error.message, 'warning');
    }
}

// Refresh single stock from Salla
async function refreshSingleStock(optionId, sallaProductId) {
    const button = document.querySelector(`button[onclick="refreshSingleStock('${optionId}', '${sallaProductId}')"]`);
    const originalHtml = button.innerHTML;

    try {
        // Show loading state with progress indication
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        // Show small toast for individual refresh
        showToast(`Refreshing stock for product ${sallaProductId}...`, 'info', 3000);

        const response = await fetch(`/clients/stock/${storeId}/refresh-single`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                optionId: optionId,
                sallaProductId: sallaProductId
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
            // Update the stock display with animation
            const stockElement = document.getElementById('salla-stock-' + optionId);
            if (stockElement && typeof result.stock === 'number') {
                const badgeClass = result.stock > 0 ? 'bg-primary' : 'bg-secondary';

                // Add a brief highlight animation
                stockElement.style.transition = 'all 0.3s ease';
                stockElement.style.transform = 'scale(1.1)';
                stockElement.innerHTML = '<span class="badge ' + badgeClass + '">' + result.stock + '</span>';

                // Reset animation
                setTimeout(() => {
                    stockElement.style.transform = 'scale(1)';
                }, 300);

                updateQtyToPurchase(optionId, result.stock);
            }

            showToast(result.message || `Stock refreshed: ${result.stock}`, 'success');
        } else {
            showToast(result.message || 'Failed to refresh stock', 'warning');
        }

    } catch (error) {
        console.error('Error refreshing stock:', error);
        showToast('Error refreshing stock: ' + error.message, 'warning');
    } finally {
        // Restore button state with small delay for better UX
        setTimeout(() => {
            button.disabled = false;
            button.innerHTML = originalHtml;
        }, 500);
    }
}

// Refresh all stock
async function refreshAllStock(isAutomatic = false) {
    const button = document.querySelector('button[onclick="refreshAllStock()"]');
    const originalHtml = button.innerHTML;

    // Hide auto-refresh indicator when refresh starts
    const indicator = document.getElementById('auto-refresh-indicator');
    if (indicator && isAutomatic) {
        indicator.style.display = 'none';
    }

    // Show progress modal for all refresh operations (both manual and automatic)
    const shouldShowProgress = true; // Always show progress modal

    let stockProgressModal = null;
    if (shouldShowProgress) {
        stockProgressModal = showStockProgressModal();
        updateStockProgress(5, 'Connecting to Salla API...', 'Establishing connection with Salla store');
    }

    try {
        // Show loading state
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';

        // Start progress for all refresh operations
        updateStockProgress(10, 'Preparing stock refresh...', isAutomatic ? 'Auto-refreshing stock levels on page load' : 'Collecting product information');
        await new Promise(resolve => setTimeout(resolve, 300));

        if (shouldShowProgress) {
            updateStockProgress(20, 'Sending refresh request...', 'Requesting latest stock data from Salla');
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        const response = await fetch(`/clients/stock/${storeId}/refresh-all`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (shouldShowProgress) {
            updateStockProgress(40, 'Processing response...', 'Receiving stock data from Salla API');
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (shouldShowProgress) {
            updateStockProgress(60, 'Updating stock levels...', `Processing ${result.updated || 0} product updates`);
            await new Promise(resolve => setTimeout(resolve, 400));
        }

        if (result.success) {
            if (shouldShowProgress) {
                updateStockProgress(80, 'Finalizing updates...', `Successfully updated ${result.updated || 0} products`);
                await new Promise(resolve => setTimeout(resolve, 300));
                updateStockProgress(100, 'Stock refresh completed!', `${result.updated || 0} products updated, ${result.errors || 0} errors`, 'success');
            }

            // Always update UI instantly if we have stock data, regardless of refresh type
            if (result.stockData && Array.isArray(result.stockData)) {
                result.stockData.forEach(item => {
                    const stockElement = document.getElementById('salla-stock-' + item.optionId);
                    if (stockElement) {
                        const badgeClass = item.stock > 0 ? 'bg-primary' : 'bg-secondary';

                        // Add animation for visual feedback
                        stockElement.style.transition = 'all 0.3s ease';
                        stockElement.style.transform = 'scale(1.05)';
                        stockElement.innerHTML = '<span class="badge ' + badgeClass + '">' + item.stock + '</span>';

                        // Reset animation
                        setTimeout(() => {
                            stockElement.style.transform = 'scale(1)';
                        }, 300);

                        updateQtyToPurchase(item.optionId, item.stock);
                    }
                });
            }

            // Always show progress modal completion
            // Show close button and handle modal closure
            setTimeout(() => {
                const stockProgressFooter = document.getElementById('stock-progress-footer');
                const closeStockButton = document.getElementById('close-stock-progress');
                stockProgressFooter.classList.remove('d-none');

                closeStockButton.onclick = () => {
                    // Just close the modal - no need to reload since UI is already updated
                    const modal = bootstrap.Modal.getInstance(document.getElementById('stockProgressModal'));
                    if (modal) {
                        modal.hide();
                    }
                };
            }, 1000);
        } else {
            // Always show progress modal error
            updateStockProgress(0, 'Refresh failed', result.message || 'Failed to refresh stock', 'error');
            setTimeout(() => {
                const stockProgressFooter = document.getElementById('stock-progress-footer');
                stockProgressFooter.classList.remove('d-none');
            }, 1000);
        }

    } catch (error) {
        console.error('Error refreshing all stock:', error);

        // Always show progress modal error
        updateStockProgress(0, 'Error occurred', error.message, 'error');
        setTimeout(() => {
            const stockProgressFooter = document.getElementById('stock-progress-footer');
            stockProgressFooter.classList.remove('d-none');
        }, 1000);
    } finally {
        // Restore button state
        button.disabled = false;
        button.innerHTML = originalHtml;
    }
}

// Select/deselect all products
function selectAllProducts(selectAllCheckbox) {
    const productCheckboxes = document.querySelectorAll('input[data-option-id]');

    productCheckboxes.forEach(checkbox => {
        // Only check products that actually need restocking
        const qtyNeeded = parseInt(checkbox.dataset.qtyNeeded) || 0;
        if (qtyNeeded > 0) {
            checkbox.checked = selectAllCheckbox.checked;
        }
    });

    updateCreateButtonState();
}

// Update the create button state based on selections
function updateCreateButtonState() {
    const selectedCheckboxes = document.querySelectorAll('input[data-option-id]:checked');
    const createButton = document.getElementById('create-purchase-btn');

    if (createButton) {
        if (selectedCheckboxes.length > 0) {
            createButton.classList.remove('btn-outline-success');
            createButton.classList.add('btn-success');
            createButton.innerHTML = `<i class="fas fa-shopping-cart"></i> Create Purchase Order (${selectedCheckboxes.length})`;
        } else {
            createButton.classList.remove('btn-success');
            createButton.classList.add('btn-outline-success');
            createButton.innerHTML = '<i class="fas fa-shopping-cart"></i> Create Purchase Order';
        }
    }
}

// Update quantity to purchase based on current stock vs minimum level
function updateQtyToPurchase(optionId, currentStock, minLevel = null) {
    const stockLevelInput = document.getElementById('stock-level-' + optionId);
    const qtyElement = document.getElementById('qty-to-purchase-' + optionId);
    const checkbox = document.getElementById('select-' + optionId);

    if (!stockLevelInput || !qtyElement) return;

    const minimumLevel = minLevel !== null ? minLevel : parseInt(stockLevelInput.value) || 0;
    const qtyToPurchase = Math.max(0, minimumLevel - currentStock);

    qtyElement.textContent = qtyToPurchase;

    // Update checkbox data attribute for quantity needed
    if (checkbox) {
        checkbox.setAttribute('data-qty-needed', qtyToPurchase);

        // Auto-check/uncheck based on quantity needed
        if (qtyToPurchase > 0) {
            checkbox.checked = true;
        } else {
            checkbox.checked = false;
        }

        // Update button state
        updateCreateButtonState();
    }
}

// Create Purchase Order with selected products
async function createPurchaseOrder() {
    const createButton = document.getElementById('create-purchase-btn');
    const originalHtml = createButton.innerHTML;

    // Get all selected product checkboxes
    const selectedCheckboxes = document.querySelectorAll('input[data-option-id]:checked');

    if (selectedCheckboxes.length === 0) {
        showToast('Please select at least one product to create a purchase order', 'warning');
        return;
    }

    try {
        // Show progress modal
        showProgressModal();
        updateProgress(5, 'Validating selected products...', `Found ${selectedCheckboxes.length} products selected`);

        // Disable the create button
        createButton.disabled = true;
        createButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Order...';

        // Quick validation step
        await new Promise(resolve => setTimeout(resolve, 300));
        updateProgress(15, 'Collecting product data...', 'Extracting product information from selections');

        // Extract product data from selected checkboxes
        const products = Array.from(selectedCheckboxes).map(checkbox => {
            const dataset = checkbox.dataset;
            return {
                product_type_code: pageData.storeProductTypeCode || 'Voucher', // Use store's configured product type
                product_code: dataset.productCode,
                provider_code: dataset.providerCode || 'UBIQFY',
                product_option_code: dataset.optionCode,
                product_name: dataset.actualProductName,
                product_option_name: dataset.optionName,
                unit_face_value: parseFloat(dataset.faceValue) || 0,
                unit_wholesale_price: parseFloat(dataset.wholesalePrice) || 0,
                quantity_needed: parseInt(dataset.qtyNeeded) || 1
            };
        });

        console.log('Creating purchase order with products:', products);

        await new Promise(resolve => setTimeout(resolve, 200));
        updateProgress(25, 'Preparing order request...', 'Formatting product data for submission');

        // Use the user ID from page data
        const currentUserId = userId || '00000000-0000-0000-0000-000000000000';

        await new Promise(resolve => setTimeout(resolve, 100));
        updateProgress(30, 'Connecting to server...', 'Establishing connection with purchase order system');

        // Start the actual API call with progress simulation
        const apiCallPromise = fetch(`/voucher-purchases/create/${storeId}/${currentUserId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ products })
        });

        // Simulate progress during API call
        const progressSteps = [
            { percent: 40, text: 'Sending order data...', detail: 'Transmitting product information to server' },
            { percent: 50, text: 'Validating order data...', detail: 'Server is validating product information' },
            { percent: 60, text: 'Creating purchase order...', detail: 'Server is generating the purchase order' },
            { percent: 70, text: 'Processing items...', detail: 'Adding products to the order' },
            { percent: 80, text: 'Finalizing order...', detail: 'Completing purchase order creation' }
        ];

        let currentStepIndex = 0;
        const progressInterval = setInterval(() => {
            if (currentStepIndex < progressSteps.length) {
                const step = progressSteps[currentStepIndex];
                updateProgress(step.percent, step.text, step.detail);
                currentStepIndex++;
            }
        }, 800); // Update every 800ms

        // Wait for the API call to complete
        const response = await apiCallPromise;
        clearInterval(progressInterval); // Stop the progress simulation

        updateProgress(90, 'Processing response...', 'Server response received, processing results');

        const result = await response.json();

        if (response.ok && result.success) {
            updateProgress(100, 'Purchase order created successfully!', `Order #${result.purchaseOrder.purchase_order_number || result.purchaseOrder.id} has been created`);

            showToast(result.message || `Purchase order created with ${products.length} items!`, 'success');

            // Show success in modal and allow closing
            setTimeout(() => {
                const progressFooter = document.getElementById('progress-footer');
                const closeButton = document.getElementById('close-progress');
                progressFooter.classList.remove('d-none');

                closeButton.onclick = () => {
                    // Redirect to the purchase order page when closing
                    window.location.href = `/store/${storeId}/purchase-order?orderId=${result.purchaseOrder.id}`;
                };
            }, 1000);

        } else {
            throw new Error(result.message || 'Failed to create purchase order');
        }

    } catch (error) {
        console.error('Error creating purchase order:', error);

        // Show error in progress modal
        updateProgress(0, 'Error occurred', error.message, 'error');

        // Show error toast
        showToast(`Error: ${error.message}`, 'error');

        // Show close button for error state
        setTimeout(() => {
            const progressFooter = document.getElementById('progress-footer');
            progressFooter.classList.remove('d-none');
        }, 1000);

    } finally {
        // Restore button state
        createButton.disabled = false;
        createButton.innerHTML = originalHtml;
    }
}

// Show progress modal
function showProgressModal() {
    const modal = new bootstrap.Modal(document.getElementById('progressModal'));
    modal.show();

    // Reset progress state
    updateProgress(0, 'Initializing...', 'Starting purchase order creation process');
}

// Update progress bar and text
function updateProgress(percentage, mainText, detailText, type = 'info') {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const progressPercentage = document.getElementById('progress-percentage');
    const progressDetails = document.getElementById('progress-details');

    // Update progress bar
    progressBar.style.width = percentage + '%';
    progressBar.setAttribute('aria-valuenow', percentage);

    // Update progress bar color based on type
    progressBar.className = 'progress-bar progress-bar-striped';
    if (percentage < 100) {
        progressBar.classList.add('progress-bar-animated');
    }

    switch (type) {
        case 'success':
            progressBar.classList.add('bg-success');
            break;
        case 'error':
            progressBar.classList.add('bg-danger');
            progressBar.classList.remove('progress-bar-animated');
            break;
        case 'warning':
            progressBar.classList.add('bg-warning');
            break;
        default:
            progressBar.classList.add('bg-primary');
    }

    // Update text
    progressText.textContent = mainText;
    progressPercentage.textContent = percentage + '%';
    progressDetails.textContent = detailText;

    // Update modal title icon based on state
    const modalTitle = document.getElementById('progressModalLabel');
    if (type === 'success') {
        modalTitle.innerHTML = '<i class="fas fa-check-circle me-2 text-success"></i>Purchase Order Created';
    } else if (type === 'error') {
        modalTitle.innerHTML = '<i class="fas fa-exclamation-triangle me-2 text-danger"></i>Error Creating Order';
    } else {
        modalTitle.innerHTML = '<i class="fas fa-shopping-cart me-2"></i>Creating Purchase Order';
    }
}

// Show stock progress modal
function showStockProgressModal() {
    const modal = new bootstrap.Modal(document.getElementById('stockProgressModal'));
    modal.show();

    // Reset progress state
    updateStockProgress(0, 'Initializing...', 'Starting stock refresh process');

    return modal;
}

// Update stock progress bar and text
function updateStockProgress(percentage, mainText, detailText, type = 'info') {
    const progressBar = document.getElementById('stock-progress-bar');
    const progressText = document.getElementById('stock-progress-text');
    const progressPercentage = document.getElementById('stock-progress-percentage');
    const progressDetails = document.getElementById('stock-progress-details');

    // Update progress bar
    progressBar.style.width = percentage + '%';
    progressBar.setAttribute('aria-valuenow', percentage);

    // Update progress bar color based on type
    progressBar.className = 'progress-bar progress-bar-striped';
    if (percentage < 100) {
        progressBar.classList.add('progress-bar-animated');
    }

    switch (type) {
        case 'success':
            progressBar.classList.add('bg-success');
            break;
        case 'error':
            progressBar.classList.add('bg-danger');
            progressBar.classList.remove('progress-bar-animated');
            break;
        case 'warning':
            progressBar.classList.add('bg-warning');
            break;
        default:
            progressBar.classList.add('bg-primary');
    }

    // Update text
    progressText.textContent = mainText;
    progressPercentage.textContent = percentage + '%';
    progressDetails.textContent = detailText;

    // Update modal title icon based on state
    const modalTitle = document.getElementById('stockProgressModalLabel');
    if (type === 'success') {
        modalTitle.innerHTML = '<i class="fas fa-check-circle me-2 text-success"></i>Stock Refresh Complete';
    } else if (type === 'error') {
        modalTitle.innerHTML = '<i class="fas fa-exclamation-triangle me-2 text-danger"></i>Stock Refresh Failed';
    } else {
        modalTitle.innerHTML = '<i class="fas fa-sync-alt me-2"></i>Refreshing Stock Levels';
    }
}

// Toast notifications are now handled by common.js