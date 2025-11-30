// Purchase Order Management
class PurchaseOrderManager {
    constructor() {
        // Load page data from JSON
        this.initializePageData();

        this.currentPurchaseId = this.orderId || null;
        this.purchaseItems = [];
        this.storeId = this.storeId || sessionStorage.getItem('storeId') || '00000000-0000-0000-0000-000000000000';
        this.userId = this.userId || '00000000-0000-0000-0000-000000000000';
        this.availableProducts = [];
        this.preSelectedProducts = [];

        // Check if loading existing order or pre-selected products
        if (this.existingOrder) {
            this.loadExistingOrder(this.existingOrder);
        } else {
            // Check if coming from stock page with pre-selected products
            this.loadPreSelectedProducts();
        }

        this.initializeEventListeners();
        this.loadAvailableProducts();
    }

    initializePageData() {
        try {
            const pageDataElement = document.getElementById('page-data');
            if (pageDataElement) {
                const pageData = JSON.parse(pageDataElement.textContent);

                // Set instance variables
                this.storeId = pageData.storeId;
                this.userId = pageData.userId;
                this.orderId = pageData.orderId;
                this.existingOrder = pageData.existingOrder;

                // Set global variables for compatibility
                window.storeId = pageData.storeId;
                window.userId = pageData.userId;
                window.orderId = pageData.orderId;
                window.existingOrder = pageData.existingOrder;
            } else {
                console.error('Page data element not found');
            }
        } catch (error) {
            console.error('Error parsing page data:', error);
        }
    }

    loadExistingOrder(orderData) {
        this.currentPurchaseId = orderData.id;
        this.orderStatus = orderData.status;

        // Check if order is editable
        this.isEditable = this.isOrderEditable(orderData.status);

        // Load existing purchase items
        if (orderData.items && orderData.items.length > 0) {
            this.purchaseItems = orderData.items.map(item => ({
                id: item.id,
                product_type_code: item.product_type_code,
                product_code: item.product_code,
                provider_code: item.provider_code,
                product_option_code: item.product_option_code,
                product_name: item.product_name,
                product_option_name: item.product_option_name || '',
                quantity_ordered: item.quantity_ordered,
                unit_face_value: item.unit_face_value,
                unit_wholesale_price: item.unit_wholesale_price || 0,
                external_id: item.external_id || null,
                total_wholesale_cost: (item.unit_wholesale_price || 0) * item.quantity_ordered
            }));

            // Update UI
            this.renderPurchaseItems();
            this.updateOrderSummary();
        }

        // Update page title
        const titleElement = document.querySelector('h2');
        if (titleElement) {
            titleElement.textContent = `${this.isEditable ? 'Edit' : 'View'} Purchase Order #${orderData.purchase_order_number}`;
        }

        // Show order details with protection notice
        let protectionNotice = '';
        if (!this.isEditable) {
            protectionNotice = `
                <div class="alert alert-warning mt-2 mb-0">
                    <i class="fas fa-lock me-2"></i>
                    <strong>Read-Only:</strong> This order cannot be modified due to its current status.
                </div>
            `;
        }

        const orderDetailsHtml = `
            <div class="alert alert-info">
                <strong>Purchase Order:</strong> ${orderData.purchase_order_number}<br>
                <strong>Status:</strong> <span class="badge ${this.getStatusBadgeClass(orderData.status)}">${orderData.status}</span><br>
                <strong>Created:</strong> ${new Date(orderData.created_at).toLocaleDateString()}<br>
                <strong>Total Cost:</strong> $${parseFloat(orderData.total_wholesale_cost || 0).toFixed(2)}
                ${protectionNotice}
            </div>
        `;

        const orderSummaryCard = document.querySelector('.order-summary-card');
        if (orderSummaryCard) {
            orderSummaryCard.insertAdjacentHTML('afterbegin', orderDetailsHtml);
        }

        // Disable form elements if not editable
        if (!this.isEditable) {
            this.disableFormElements();
        }
    }

    isOrderEditable(status) {
        // Orders can only be edited in DRAFT or PENDING status
        return ['DRAFT', 'PENDING'].includes(status?.toUpperCase());
    }

    disableFormElements() {
        // Disable all form inputs
        const formElements = document.querySelectorAll('input, select, button, textarea');
        formElements.forEach(element => {
            if (element.type !== 'button' || element.classList.contains('btn-primary')) {
                element.disabled = true;
            }
        });

        // Hide add product form
        const addProductForm = document.getElementById('add-product-form');
        if (addProductForm) {
            addProductForm.style.display = 'none';
        }

        // Show read-only message where add form was
        const formContainer = addProductForm?.parentElement;
        if (formContainer) {
            const readOnlyMessage = document.createElement('div');
            readOnlyMessage.className = 'alert alert-info text-center';
            readOnlyMessage.innerHTML = `
                <i class="fas fa-eye fa-2x mb-2"></i>
                <h5>Viewing Purchase Order</h5>
                <p class="mb-0">This order is in <strong>${this.orderStatus}</strong> status and cannot be modified.</p>
            `;
            formContainer.appendChild(readOnlyMessage);
        }

        // Remove action buttons from purchase items
        document.querySelectorAll('.remove-item-btn').forEach(btn => {
            btn.style.display = 'none';
        });

        // Update any submit buttons to show "Back to Orders"
        const submitBtns = document.querySelectorAll('button[type="submit"], .btn-success');
        submitBtns.forEach(btn => {
            if (btn.textContent.includes('Save') || btn.textContent.includes('Update')) {
                btn.textContent = 'Back to Orders';
                btn.className = 'btn btn-secondary';
                btn.onclick = () => {
                    window.location.href = `/store/${this.storeId}/purchase-orders`;
                };
            }
        });
    }

    getStatusBadgeClass(status) {
        const statusClasses = {
            'DRAFT': 'bg-secondary',
            'PENDING': 'bg-warning',
            'PROCESSING': 'bg-info',
            'COMPLETED': 'bg-success',
            'PARTIAL SUCCESS': 'bg-warning',
            'PARTIALLY_COMPLETED': 'bg-warning',
            'FAILED': 'bg-danger',
            'CANCELLED': 'bg-dark'
        };
        return statusClasses[status] || 'bg-secondary';
    }

    loadPreSelectedProducts() {
        const selectedProductsData = sessionStorage.getItem('selectedProducts');
        const fromStockPage = sessionStorage.getItem('fromStockPage');

        if (selectedProductsData && fromStockPage === 'true') {
            try {
                this.preSelectedProducts = JSON.parse(selectedProductsData);

                // Show notification about pre-selected products
                this.showAlert(`${this.preSelectedProducts.length} products pre-selected from stock management`, 'info');

                // Clear session storage to avoid re-loading
                sessionStorage.removeItem('selectedProducts');
                sessionStorage.removeItem('fromStockPage');
            } catch (error) {
                this.preSelectedProducts = [];
            }
        }
    }

    initializeEventListeners() {
        // Add product form (check if it exists first)
        const addProductForm = document.getElementById('add-product-form');
        if (addProductForm) {
            addProductForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addProductToOrder();
            });
        }

        // Product selection change (check if it exists first)
        const productSelect = document.getElementById('product-select');
        if (productSelect) {
            productSelect.addEventListener('change', (e) => {
                this.updateProductDetails(e.target.value);
            });
        }

        // Action buttons (check if they exist first)
        const confirmOrderBtn = document.getElementById('confirm-order-btn');
        if (confirmOrderBtn) {
            confirmOrderBtn.addEventListener('click', () => {
                this.confirmOrder();
            });
        }

        const submitOrderBtn = document.getElementById('submit-order-btn');
        if (submitOrderBtn) {
            submitOrderBtn.addEventListener('click', () => {
                this.submitOrder();
            });
        }

        const processOrderBtn = document.getElementById('process-order-btn');
        if (processOrderBtn) {
            processOrderBtn.addEventListener('click', () => {
                this.processOrder();
            });
        }
    }

    async loadAvailableProducts() {
        try {
            // Load synced product options (same data as stock page from salla_store_product_options)
            const response = await fetch(`/salla-stores/${this.storeId}/synced-options`);
            const data = await response.json();

            // Data comes directly from salla_store_product_options table
            this.availableProducts = this.convertSyncedOptionsToProducts(data.data || []);
        } catch (error) {
            this.showAlert('Failed to load available products', 'danger');
        }
    }

    convertSyncedOptionsToProducts(syncedOptions) {
        // Group by product_code to create the product structure expected by populateProductSelector
        const productGroups = {};

        syncedOptions.forEach(option => {
            const productCode = option.product_code;
            if (!productGroups[productCode]) {
                productGroups[productCode] = {
                    product_code: option.product_code,
                    ubiqfyProduct: {
                        name: option.product_name,
                        provider_code: option.provider_code,
                        country_iso: option.country_iso
                    },
                    options: []
                };
            }

            productGroups[productCode].options.push({
                option_code: option.option_code,
                option_name: option.option_name,
                min_face_value: option.min_face_value,
                original_price_usd: option.original_price_usd || option.wholesale_price_usd,
                product_currency_code: option.product_currency_code
            });
        });

        return Object.values(productGroups);
    }

    async createPurchaseOrder() {
        try {
            const response = await fetch(`/voucher-purchases/create/${this.storeId}/${this.userId}`, {
                method: 'POST'
            });

            if (response.ok) {
                const purchase = await response.json();
                this.currentPurchaseId = purchase.id;
                document.getElementById('purchase-order-number').textContent = purchase.purchase_order_number;
                this.showAlert(`Purchase Order ${purchase.purchase_order_number} created`, 'success');
            } else {
                throw new Error('Failed to create purchase order');
            }
        } catch (error) {
            throw error;
        }
    }

    renderPurchaseItems() {
        const tableBody = document.getElementById('items-table-body');

        if (this.purchaseItems.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No items added yet</td></tr>';
            return;
        }

        // Render table rows with conditional editing controls
        tableBody.innerHTML = this.purchaseItems.map((item, index) => {
            const quantityControl = this.isEditable !== false ? `
                <div class="input-group" style="max-width: 120px;">
                    <button class="btn btn-sm btn-outline-secondary" type="button" 
                            onclick="purchaseManager.changeQuantity('${item.id || index}', -1)">-</button>
                    <input type="number" class="form-control form-control-sm text-center" 
                           value="${item.quantity_ordered}" min="1" max="1000"
                           id="qty-${item.id || index}"
                           onchange="purchaseManager.updateItemQuantity('${item.id || index}', this.value)">
                    <button class="btn btn-sm btn-outline-secondary" type="button" 
                            onclick="purchaseManager.changeQuantity('${item.id || index}', 1)">+</button>
                </div>
            ` : `
                <span class="fw-bold">${item.quantity_ordered}</span>
                <input type="hidden" id="qty-${item.id || index}" value="${item.quantity_ordered}">
            `;

            const removeButton = this.isEditable !== false ? `
                <button class="btn btn-sm btn-outline-danger remove-item-btn" 
                        onclick="purchaseManager.removeItem('${item.id || index}')"
                        title="Remove item">×</button>
            ` : `
                <span class="text-muted">-</span>
            `;

            return `
                <tr id="item-row-${item.id || index}">
                    <td>${index + 1}</td>
                    <td>
                        <strong>${item.product_name}</strong><br>
                        <small class="text-muted">${item.product_option_name}</small><br>
                        <small class="text-muted">Code: ${item.product_option_code}</small>
                    </td>
                    <td>${quantityControl}</td>
                    <td>$${item.unit_wholesale_price.toFixed(2)}</td>
                    <td><strong>$${item.total_wholesale_cost.toFixed(2)}</strong></td>
                    <td>${removeButton}</td>
                </tr>
            `;
        }).join('');

        this.updateOrderSummary();
    }

    updatePurchaseDisplay() {
        this.renderPurchaseItems();
    }

    updateOrderSummary() {
        let totalItems = this.purchaseItems.length;
        let totalVouchers = this.purchaseItems.reduce((sum, item) => sum + item.quantity_ordered, 0);
        let totalCost = this.purchaseItems.reduce((sum, item) => sum + item.total_wholesale_cost, 0);

        // Update summary
        document.getElementById('total-items').textContent = totalItems;
        document.getElementById('total-vouchers').textContent = totalVouchers;
        document.getElementById('summary-total-cost').textContent = `$${totalCost.toFixed(2)}`;

        // Enable submit button if there are items (if button exists)
        const submitBtn = document.getElementById('submit-order-btn');
        if (submitBtn) {
            submitBtn.disabled = totalItems === 0;
        }
    }

    async removeItem(itemId) {
        // Check if order is editable
        if (this.isEditable === false) {
            this.showAlert('Cannot modify order in current status', 'warning');
            return;
        }

        // Check if this is a database item (UUID) or a local item (numeric index)
        const isDatabaseItem = itemId.includes('-'); // UUIDs contain dashes

        if (isDatabaseItem && !this.currentPurchaseId) {
            this.showAlert('No purchase order to remove items from', 'warning');
            return;
        }

        try {
            if (isDatabaseItem) {
                // Remove from database
                const response = await fetch(`/voucher-purchases/${this.currentPurchaseId}/items/${itemId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    // Remove from local array
                    this.purchaseItems = this.purchaseItems.filter(item => item.id !== itemId);
                    this.updatePurchaseDisplay();
                    this.showAlert('Item removed from purchase order', 'success');
                } else {
                    const error = await response.text();
                    throw new Error(error || 'Failed to remove item from database');
                }
            } else {
                // Remove local item (using array index)
                const index = parseInt(itemId);
                if (index >= 0 && index < this.purchaseItems.length) {
                    this.purchaseItems.splice(index, 1);
                    this.updatePurchaseDisplay();
                    this.showAlert('Item removed from purchase order', 'success');
                } else {
                    throw new Error('Invalid item index');
                }
            }
        } catch (error) {
            console.error('Remove item error:', error);
            this.showAlert(error.message || 'Failed to remove item', 'danger');
        }
    }

    /**
     * Change item quantity by increment/decrement
     */
    changeQuantity(itemId, change) {
        // Check if order is editable
        if (this.isEditable === false) {
            this.showAlert('Cannot modify order in current status', 'warning');
            return;
        }

        const qtyInput = document.getElementById(`qty-${itemId}`);
        if (qtyInput) {
            const currentQty = parseInt(qtyInput.value) || 1;
            const newQty = Math.max(1, currentQty + change);
            qtyInput.value = newQty;

            // Update local data immediately for instant UI response
            this.updateItemQuantityLocally(itemId, newQty);

            // Queue database update (debounced)
            this.queueDatabaseUpdate(itemId, newQty);
        }
    }

    /**
     * Update item quantity locally for immediate UI response
     */
    updateItemQuantityLocally(itemId, newQuantity) {
        const quantity = Math.max(1, parseInt(newQuantity) || 1);
        const isDatabaseItem = itemId.includes('-'); // UUIDs contain dashes

        // Find and update the item in local array
        const index = isDatabaseItem ?
            this.purchaseItems.findIndex(item => item.id === itemId) :
            parseInt(itemId);

        if (index >= 0 && index < this.purchaseItems.length) {
            this.purchaseItems[index].quantity_ordered = quantity;
            this.purchaseItems[index].total_wholesale_cost =
                this.purchaseItems[index].unit_wholesale_price * quantity;

            // Update the row total immediately
            const totalCell = document.querySelector(`#item-row-${itemId} td:nth-child(5) strong`);
            if (totalCell) {
                totalCell.textContent = `$${this.purchaseItems[index].total_wholesale_cost.toFixed(2)}`;
            }

            // Update order summary immediately
            this.updateOrderSummary();
        }
    }

    /**
     * Queue database update with debouncing to avoid too many API calls
     */
    queueDatabaseUpdate(itemId, newQuantity) {
        // Clear any pending update for this item
        if (this.pendingUpdates && this.pendingUpdates[itemId]) {
            clearTimeout(this.pendingUpdates[itemId]);
        }

        // Initialize pending updates object if not exists
        if (!this.pendingUpdates) {
            this.pendingUpdates = {};
        }

        // Queue the update with a 500ms delay
        this.pendingUpdates[itemId] = setTimeout(() => {
            this.updateItemQuantityInDatabase(itemId, newQuantity);
            delete this.pendingUpdates[itemId];
        }, 500);
    }

    /**
     * Update item quantity in database (called after debounce delay)
     */
    async updateItemQuantityInDatabase(itemId, newQuantity) {
        const quantity = Math.max(1, parseInt(newQuantity) || 1);
        const isDatabaseItem = itemId.includes('-'); // UUIDs contain dashes

        // Only update database items that are already saved
        if (!isDatabaseItem || !this.currentPurchaseId) {
            return;
        }

        try {
            const response = await fetch(`/voucher-purchases/${this.currentPurchaseId}/items/${itemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ quantity_ordered: quantity })
            });

            if (response.ok) {
                // Database updated successfully - no need to update UI since it's already updated
                console.log(`Database updated: item ${itemId} quantity to ${quantity}`);
            } else {
                throw new Error('Failed to update quantity in database');
            }
        } catch (error) {
            console.error('Database update error:', error);
            this.showAlert('Failed to save quantity change to database', 'warning');

            // Optionally reload the item data from database
            // You could implement a retry mechanism here
        }
    }

    /**
     * Handle manual quantity input changes
     */
    async updateItemQuantity(itemId, newQuantity) {
        // Check if order is editable
        if (this.isEditable === false) {
            this.showAlert('Cannot modify order in current status', 'warning');
            return;
        }

        const quantity = Math.max(1, parseInt(newQuantity) || 1);

        // Update locally first for immediate response
        this.updateItemQuantityLocally(itemId, quantity);

        // Queue database update
        this.queueDatabaseUpdate(itemId, quantity);
    }

    async confirmOrder() {
        if (!this.currentPurchaseId) {
            this.showAlert('No purchase order to confirm', 'warning');
            return;
        }

        // Check if order has items
        if (this.purchaseItems.length === 0) {
            this.showAlert('Cannot confirm an empty order', 'warning');
            return;
        }

        try {
            // Show progress modal and start the process
            this.showLoading('Checking balance and confirming order...');
            this.updateProgress(10, 'Preparing order confirmation...', 'Initializing order confirmation process');

            // Step 1: Check balance with cent precision
            this.updateProgress(25, 'Checking account balance...', 'Verifying sufficient funds for purchase');

            const balanceResponse = await fetch(`/voucher-purchases/${this.currentPurchaseId}/check-balance`, {
                method: 'POST'
            });

            if (!balanceResponse.ok) {
                const errorData = await balanceResponse.json().catch(() => null);
                const errorMessage = errorData?.message || 'Failed to check balance - network or API issue';
                throw new Error(errorMessage);
            }

            const balanceResult = await balanceResponse.json();
            console.log('Balance check result:', balanceResult);

            // Check if there was an error in the balance check
            if (balanceResult.error) {
                throw new Error(balanceResult.error);
            }

            this.updateProgress(50, 'Balance verified successfully', 'Account has sufficient funds');

            // Step 2: Verify balance is sufficient
            if (!balanceResult.canProcess || !balanceResult.sufficient) {
                const totalCost = balanceResult.totalCost || 'N/A';
                const balance = balanceResult.balance || 'N/A';
                this.updateProgress(50, 'Insufficient balance detected', `Required: $${totalCost}, Available: $${balance}`, 'error');
                setTimeout(() => {
                    this.hideLoading();
                    this.showAlert(`Insufficient balance! Required: $${totalCost}, Available: $${balance}`, 'danger');
                }, 2000);
                return;
            }

            // Step 3: Perform the transaction based on merchant_voucher_purchase_details
            this.updateProgress(75, 'Processing payment transaction...', 'Confirming order and processing voucher purchases');

            const confirmResponse = await fetch(`/voucher-purchases/${this.currentPurchaseId}/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (confirmResponse.ok) {
                const confirmResult = await confirmResponse.json();

                if (confirmResult.success) {
                    this.updateProgress(100, 'Order confirmed successfully!', 'Vouchers are being processed and will be available shortly', 'success');

                    // Auto-close after showing success for 3 seconds
                    setTimeout(() => {
                        this.hideLoading();
                        this.showAlert('Order confirmed successfully! Vouchers are being processed.', 'success');

                        // Reload the page to show updated status
                        setTimeout(() => {
                            window.location.reload();
                        }, 2000);
                    }, 3000);
                } else {
                    throw new Error(confirmResult.message || 'Failed to confirm order');
                }
            } else {
                const errorData = await confirmResponse.json();
                throw new Error(errorData.message || 'Failed to confirm order');
            }

        } catch (error) {
            console.error('Confirm order error:', error);

            // Provide specific error messages based on error type
            let errorMessage = error.message;
            if (error.message.includes('network') || error.message.includes('ECONNRESET')) {
                errorMessage = 'Unable to connect to Ubiqfy API. Please check your internet connection and try again.';
            } else if (error.message.includes('balance')) {
                errorMessage = 'Unable to verify account balance. Please try again later.';
            }

            this.updateProgress(100, 'Order confirmation failed', `Error: ${errorMessage}`, 'error');

            // Auto-close after showing error for 3 seconds
            setTimeout(() => {
                this.hideLoading();
                this.showAlert(`Failed to confirm order: ${errorMessage}`, 'danger');
            }, 3000);
        }
    }

    async checkBalanceAndUpdatePricing() {
        if (!this.currentPurchaseId) {
            this.showAlert('Please add items to your order first', 'warning');
            return;
        }

        try {
            this.showLoading('Checking balance and updating pricing...');
            this.updateProgress(20, 'Connecting to Ubiqfy API...', 'Checking account balance and order total');

            const response = await fetch(`/voucher-purchases/${this.currentPurchaseId}/check-balance`, {
                method: 'POST'
            });

            this.updateProgress(60, 'Processing balance information...', 'Calculating order totals and fees');

            if (response.ok) {
                const result = await response.json();
                this.updateProgress(90, 'Balance check completed', 'Updating order display with latest information');

                this.displayBalanceInfo(result);

                if (result.canProcess) {
                    document.getElementById('process-order-btn').style.display = 'block';
                    this.updateProgress(100, 'Balance verification successful', 'Ready to process order', 'success');

                    setTimeout(() => {
                        this.hideLoading();
                        this.showAlert('Balance is sufficient. Ready to process!', 'success');
                    }, 1500);
                } else {
                    this.updateProgress(100, 'Insufficient balance detected', result.message || 'Not enough funds to complete order', 'warning');

                    setTimeout(() => {
                        this.hideLoading();
                        this.showAlert(result.message, 'warning');
                    }, 2000);
                }
            } else {
                throw new Error('Failed to check balance');
            }
        } catch (error) {
            this.updateProgress(100, 'Balance check failed', 'Unable to verify account balance', 'error');

            setTimeout(() => {
                this.hideLoading();
                this.showAlert('Failed to check balance', 'danger');
            }, 2000);
        }
    }

    displayBalanceInfo(balanceInfo) {
        document.getElementById('balance-info').style.display = 'block';
        document.getElementById('balance-amount').textContent = `$${balanceInfo.balance.toFixed(2)}`;
        document.getElementById('order-total').textContent = `$${balanceInfo.totalCost.toFixed(2)}`;
        document.getElementById('balance-status').textContent = balanceInfo.sufficient ? '✅ Sufficient' : '❌ Insufficient';

        if (!balanceInfo.sufficient) {
            document.getElementById('balance-status').style.color = '#dc3545';
        }
    }

    async submitOrder() {
        if (!this.currentPurchaseId) {
            this.showAlert('No purchase order to submit', 'warning');
            return;
        }

        try {
            const response = await fetch(`/voucher-purchases/${this.currentPurchaseId}/submit`, {
                method: 'POST'
            });

            if (response.ok) {
                this.showAlert('Purchase order submitted successfully', 'success');
                this.updateOrderStatus('submitted', 25);
            } else {
                throw new Error('Failed to submit order');
            }
        } catch (error) {
            this.showAlert('Failed to submit order', 'danger');
        }
    }

    async processOrder() {
        if (!this.currentPurchaseId) {
            return;
        }

        try {
            this.showLoading('Processing order...');
            this.updateProgress(10, 'Initializing order processing...', 'Preparing to process voucher purchases');
            this.updateOrderStatus('processing', 50);

            this.updateProgress(30, 'Sending process request...', 'Communicating with Ubiqfy API');

            const response = await fetch(`/voucher-purchases/${this.currentPurchaseId}/process`, {
                method: 'POST'
            });

            if (response.ok) {
                this.updateProgress(60, 'Order processing started', 'Monitoring order progress...');
                this.showAlert('Order processing started', 'info');
                this.monitorOrderProgress();
            } else {
                throw new Error('Failed to start processing');
            }
        } catch (error) {
            this.updateProgress(100, 'Failed to process order', 'An error occurred while starting order processing', 'error');

            setTimeout(() => {
                this.hideLoading();
                this.showAlert('Failed to process order', 'danger');
            }, 2000);
        }
    }

    async monitorOrderProgress() {
        const checkStatus = async () => {
            try {
                const response = await fetch(`/voucher-purchases/${this.currentPurchaseId}/status`);
                if (response.ok) {
                    const status = await response.json();
                    this.updateOrderProgress(status);

                    if (['completed', 'failed', 'partially_completed'].includes(status.status.toLowerCase())) {
                        return; // Stop monitoring
                    }
                }
            } catch (error) {
                // Status check failed, continue monitoring
            }

            // Check again in 5 seconds
            setTimeout(checkStatus, 5000);
        };

        checkStatus();
    }

    updateOrderProgress(status) {
        const total = status.totalVouchersOrdered || 1;
        const generated = status.totalVouchersGenerated || 0;
        const failed = status.totalVouchersFailed || 0;
        const progress = Math.round((generated + failed) / total * 100);

        this.updateOrderStatus(`${status.status} (${generated}/${total} generated)`, progress);

        if (status.status.toLowerCase() === 'completed') {
            this.showAlert('Order completed successfully!', 'success');
        } else if (status.status.toLowerCase() === 'failed') {
            this.showAlert('Order processing failed', 'danger');
        }
    }

    updateOrderStatus(statusText, progress) {
        document.getElementById('order-status').style.display = 'block';
        document.getElementById('status-text').textContent = statusText;
        document.getElementById('progress-bar').style.width = `${progress}%`;
        document.getElementById('progress-bar').textContent = `${progress}%`;
    }

    showAlert(message, type) {
        // Create alert element
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Insert at top of container (try multiple selectors)
        let container = document.querySelector('main') ||
            document.querySelector('.container') ||
            document.querySelector('body');

        if (container) {
            container.insertBefore(alertDiv, container.firstChild);
        } else {
            // Fallback: append to body
            document.body.appendChild(alertDiv);
        }

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

    showLoading(message) {
        const modal = new bootstrap.Modal(document.getElementById('progressModal'));
        modal.show();

        // Reset progress state
        this.updateProgress(0, message || 'Processing...', 'Initializing...');
    }

    hideLoading() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('progressModal'));
        if (modal) {
            modal.hide();
        }
    }

    updateProgress(percentage, mainText, detailText, type = 'info') {
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        const progressPercentage = document.getElementById('progress-percentage');
        const progressDetails = document.getElementById('progress-details');

        if (!progressBar || !progressText || !progressPercentage || !progressDetails) {
            console.warn('Progress elements not found');
            return;
        }

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
        if (modalTitle) {
            if (type === 'success') {
                modalTitle.innerHTML = '<i class="fas fa-check-circle me-2 text-success"></i>Order Confirmed Successfully';
            } else if (type === 'error') {
                modalTitle.innerHTML = '<i class="fas fa-exclamation-triangle me-2 text-danger"></i>Error Confirming Order';
            } else {
                modalTitle.innerHTML = '<i class="fas fa-shopping-cart me-2"></i>Confirming Purchase Order';
            }
        }

        // Show/hide footer based on completion
        const footer = document.getElementById('progress-footer');
        if (footer) {
            if (percentage >= 100 || type === 'error') {
                footer.classList.remove('d-none');
            } else {
                footer.classList.add('d-none');
            }
        }
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.purchaseManager = new PurchaseOrderManager();

    // Initialize delete modal functionality
    initializeDeleteModal();
});

// Global variables for delete functionality
let orderToDelete = null;

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
                // Redirect to purchase orders list after short delay
                setTimeout(() => {
                    window.location.href = `/store/${window.storeId}/purchase-orders`;
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
 * @param {string} message - The message to show
 * @param {string} type - The type of notification ('success', 'error', etc.)
 */
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toastId = 'toast-' + Date.now();
    const bgColor = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-info';

    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-white ${bgColor} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHTML);

    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: 5000
    });

    toast.show();

    // Remove toast element after it's hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}