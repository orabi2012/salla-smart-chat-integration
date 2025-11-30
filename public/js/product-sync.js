/**
 * Product selection and synchronization functionality
 */

// Flag to prevent infinite loops when programmatically updating checkboxes
let isUpdatingProgrammatically = false;

/**
 * Toggle pricing configuration
 */
function togglePricingConfig(checkbox) {
    // Skip if this is a programmatic update
    if (isUpdatingProgrammatically) {
        return;
    }

    // Find the product container (col-12) and the card element
    const productContainer = checkbox.closest('.col-12');
    const productCard = productContainer ? productContainer.querySelector('.card') : null;

    if (!productCard || !productContainer) {
        console.log('❌ Could not find product container or card');
        return;
    }

    // Toggle visual styling
    if (checkbox.checked) {
        productCard.classList.add('border-primary');
        productCard.style.boxShadow = '0 0 0 2px rgba(0,123,255,.25)';

        // Only auto-select options if none are currently selected
        const selectedOptions = productContainer.querySelectorAll('.option-checkbox:checked');
        if (selectedOptions.length === 0) {
            console.log('🎯 Product selected - auto-selecting all options (none were selected)');
            // Auto-select all options when product is selected and no options are selected
            const optionCheckboxes = productContainer.querySelectorAll('.option-checkbox');
            isUpdatingProgrammatically = true;
            optionCheckboxes.forEach(optionCheckbox => {
                optionCheckbox.checked = true;
                // Visual state update removed as per user request
            });
            isUpdatingProgrammatically = false;
        }
    } else {
        productCard.classList.remove('border-primary');
        productCard.style.boxShadow = '';

        console.log('🎯 Product deselected - deselecting all options');
        // Deselect all options when product is deselected
        const optionCheckboxes = productContainer.querySelectorAll('.option-checkbox');
        isUpdatingProgrammatically = true;
        optionCheckboxes.forEach(optionCheckbox => {
            optionCheckbox.checked = false;
            // Visual state update removed as per user request
        });
        isUpdatingProgrammatically = false;
    }
}

/**
 * Update main product checkbox state based on its options
 */
function updateMainProductCheckboxState(optionCheckbox) {
    // Find the product card - need to go up from option-card to the main product container
    let productCard = optionCheckbox.closest('.option-card');
    if (!productCard) {
        console.log('❌ Could not find option-card');
        return;
    }

    // Find the parent product container that contains both the product checkbox and options
    productCard = productCard.closest('.col-12');
    if (!productCard) {
        console.log('❌ Could not find product container (.col-12)');
        return;
    }

    const mainProductCheckbox = productCard.querySelector('.product-checkbox');
    const allOptionCheckboxes = productCard.querySelectorAll('.option-checkbox');
    const checkedOptionCheckboxes = productCard.querySelectorAll('.option-checkbox:checked');

    if (!mainProductCheckbox) {
        console.log('❌ Could not find main product checkbox');
        return;
    }

    console.log(`🔄 Updating product checkbox state - Options: ${checkedOptionCheckboxes.length}/${allOptionCheckboxes.length} selected`);

    // Prevent the togglePricingConfig from interfering with our programmatic updates
    isUpdatingProgrammatically = true;

    // Get the actual card element for styling
    const cardElement = productCard.querySelector('.card');

    // Auto-check main product if at least one option is selected
    if (checkedOptionCheckboxes.length > 0) {
        if (!mainProductCheckbox.checked) {
            console.log('✅ Auto-selecting product (at least 1 option selected)');
            mainProductCheckbox.checked = true;
            if (cardElement) {
                cardElement.classList.add('border-primary');
                cardElement.style.boxShadow = '0 0 0 2px rgba(0,123,255,.25)';
            }
        }
    } else {
        // Auto-uncheck main product if no options are selected
        if (mainProductCheckbox.checked) {
            console.log('❌ Auto-deselecting product (no options selected)');
            mainProductCheckbox.checked = false;
            if (cardElement) {
                cardElement.classList.remove('border-primary');
                cardElement.style.boxShadow = '';
            }
        }
    }

    // Reset the flag
    isUpdatingProgrammatically = false;
}

/**
 * Update selected products and options count
 */
function updateSelectedCount() {
    const checkedProductBoxes = document.querySelectorAll('.product-checkbox:checked');
    const checkedOptionBoxes = document.querySelectorAll('.option-checkbox:checked');
    const productCount = checkedProductBoxes.length;
    const optionCount = checkedOptionBoxes.length;

    const badge = document.getElementById('selectedCountBadge');
    const syncBtn = document.getElementById('syncToSallaBtn');

    console.log(`Selected products: ${productCount}, Selected options: ${optionCount}`);

    if (badge) {
        // Update the individual counter spans
        const productCountSpan = badge.querySelector('.fas.fa-box').nextElementSibling;
        const optionCountSpan = badge.querySelector('.fas.fa-list').nextElementSibling;

        if (productCountSpan) productCountSpan.textContent = productCount;
        if (optionCountSpan) optionCountSpan.textContent = optionCount;

        badge.title = `${productCount} Products, ${optionCount} Options selected for sync`;

        // Add visual feedback based on selection state
        if (optionCount > 0) {
            badge.classList.remove('bg-white', 'text-primary');
            badge.classList.add('bg-success', 'text-white');
        } else {
            badge.classList.remove('bg-success', 'text-white');
            badge.classList.add('bg-white', 'text-primary');
        }
    }

    if (syncBtn) {
        syncBtn.disabled = optionCount === 0; // Enable only if at least one option is selected
        if (optionCount > 0) {
            syncBtn.classList.remove('btn-outline-primary');
            syncBtn.classList.add('btn-primary');
        } else {
            syncBtn.classList.remove('btn-primary');
            syncBtn.classList.add('btn-outline-primary');
        }
    }

    // Update main checkbox state
    updateMainCheckboxState();
}/**
 * Select all products
 */
function selectAllProducts() {
    const checkboxes = document.querySelectorAll('.product-checkbox');
    console.log(`Total product checkboxes found: ${checkboxes.length}`);

    let selectedCount = 0;
    checkboxes.forEach(checkbox => {
        if (!checkbox.checked) {
            checkbox.checked = true;
            togglePricingConfig(checkbox);
            selectedCount++;
        }
    });

    console.log(`Selected ${selectedCount} product checkboxes`);
    updateSelectedCount();
}

/**
 * Deselect all products
 */
function deselectAllProducts() {
    const checkboxes = document.querySelectorAll('.product-checkbox');
    console.log(`Total product checkboxes found: ${checkboxes.length}`);

    let deselectedCount = 0;
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            checkbox.checked = false;
            togglePricingConfig(checkbox);
            deselectedCount++;
        }
    });

    console.log(`Deselected ${deselectedCount} product checkboxes`);
    updateSelectedCount();
}

/**
 * Toggle all products based on checkbox state
 */
function toggleAllProducts() {
    const mainCheckbox = document.getElementById('selectAllProductsCheckbox');
    const checkboxes = document.querySelectorAll('.product-checkbox');

    console.log(`Toggle all products - Main checkbox checked: ${mainCheckbox.checked}`);
    console.log(`Total product checkboxes found: ${checkboxes.length}`);

    let changeCount = 0;
    checkboxes.forEach(checkbox => {
        if (checkbox.checked !== mainCheckbox.checked) {
            checkbox.checked = mainCheckbox.checked;
            togglePricingConfig(checkbox);
            changeCount++;
        }
    });

    const action = mainCheckbox.checked ? 'Selected' : 'Deselected';
    console.log(`${action} ${changeCount} product checkboxes`);
    updateSelectedCount();
    updateMainCheckboxState();
}

/**
 * Update the state of the main "Select All" checkbox based on individual product selections
 */
function updateMainCheckboxState() {
    const mainCheckbox = document.getElementById('selectAllProductsCheckbox');
    if (!mainCheckbox) return;

    const checkboxes = document.querySelectorAll('.product-checkbox');
    const checkedBoxes = document.querySelectorAll('.product-checkbox:checked');

    if (checkedBoxes.length === 0) {
        // No products selected
        mainCheckbox.checked = false;
        mainCheckbox.indeterminate = false;
    } else if (checkedBoxes.length === checkboxes.length) {
        // All products selected
        mainCheckbox.checked = true;
        mainCheckbox.indeterminate = false;
    } else {
        // Some products selected
        mainCheckbox.checked = false;
        mainCheckbox.indeterminate = true;
    }
}

/**
 * Save selected products to database
 */
async function saveSelectedProductsToDB() {
    const selectedProducts = [];
    const checkboxes = document.querySelectorAll('.product-checkbox:checked');
    const selectedOptionCheckboxes = document.querySelectorAll('.option-checkbox:checked');

    // Validate that we have selected options, not just products
    if (selectedOptionCheckboxes.length === 0) {
        showAlert('Please select at least one product option to save. Use the "Include this option" checkboxes.', 'warning');
        return;
    }

    if (checkboxes.length === 0) {
        showAlert('Please select at least one product to save.', 'warning');
        return;
    }

    console.log(`🔄 Processing ${checkboxes.length} selected products with ${selectedOptionCheckboxes.length} selected options for save`);

    checkboxes.forEach((checkbox, index) => {
        try {
            const productCard = checkbox.closest('.card');
            const productData = JSON.parse(checkbox.getAttribute('data-product'));

            // Process only selected product options with actual pricing from UI
            if (productData.ProductOptionsList && productData.ProductOptionsList.length > 0) {
                const optionCards = productCard.querySelectorAll('.option-card');

                productData.ProductOptionsList.forEach(option => {
                    // Find the corresponding option card in the UI
                    const optionCard = Array.from(optionCards).find(card =>
                        card.getAttribute('data-option-code') === option.ProductOptionCode
                    );

                    // Check if this specific option is selected
                    const optionCheckbox = optionCard?.querySelector('.option-checkbox');
                    if (!optionCheckbox || !optionCheckbox.checked) {
                        console.log(`⏭️ Skipping unselected option: ${option.ProductOptionCode}`);
                        return; // Skip this option if not selected
                    }

                    let customPrice = null;
                    let markupPercentage = (productData.Discount || 0) * 100;

                    if (optionCard) {
                        const customPriceInput = optionCard.querySelector('.custom-price-input');
                        const markupInput = optionCard.querySelector('.markup-input');

                        if (customPriceInput) {
                            customPrice = parseFloat(customPriceInput.value) || 0;
                            console.log(`💾 Save - Option ${option.ProductOptionCode}: Custom Price = ${customPrice}`);
                        }
                        if (markupInput) {
                            markupPercentage = parseFloat(markupInput.value) || markupPercentage;
                            console.log(`💾 Save - Option ${option.ProductOptionCode}: Markup % = ${markupPercentage}`);
                        }
                    } else {
                        console.warn(`⚠️ Save - Option card not found for ${option.ProductOptionCode}`);
                    }

                    selectedProducts.push({
                        productCode: productData.ProductCode,
                        optionCode: option.ProductOptionCode,
                        customPrice: customPrice,
                        markupPercentage: markupPercentage,
                        isActive: true,
                        // Include essential pricing data from Ubiqfy API
                        minValue: option.MinValue || 0,
                        maxValue: option.MaxValue || 0,
                        minFaceValue: option.MinFaceValue || 0,
                        productCurrencyCode: productData.ProductCurrencyCode, // Don't default to USD - use actual value
                        minWholesaleValue: option.MinMaxRangeValue?.MinWholesaleValue || 0,
                        maxWholesaleValue: option.MinMaxRangeValue?.MaxWholesaleValue || 0
                    });
                });
            } else {
                // Product without options - look for general pricing inputs
                let customPrice = null;
                let markupPercentage = (productData.Discount || 0) * 100;

                const customPriceInput = productCard.querySelector('.custom-price-input');
                const markupInput = productCard.querySelector('.markup-input');

                if (customPriceInput) {
                    customPrice = parseFloat(customPriceInput.value) || 0;
                }
                if (markupInput) {
                    markupPercentage = parseFloat(markupInput.value) || markupPercentage;
                }

                selectedProducts.push({
                    productCode: productData.ProductCode,
                    customPrice: customPrice,
                    markupPercentage: markupPercentage,
                    isActive: true
                });
            }
        } catch (error) {
            console.error('Error parsing product data:', error);
        }
    });

    console.log(`Total processed items: ${selectedProducts.length}`);

    if (selectedProducts.length === 0) {
        showAlert('No options were selected for processing. Please select individual options using "Include this option" checkboxes.', 'error');
        return;
    }

    const saveBtn = document.getElementById('saveSelectedProductsBtn');
    const originalText = saveBtn.textContent;

    try {
        setButtonLoading(saveBtn, true);

        const { response, result } = await apiCall(`/salla-stores/${storeId}/bulk-link-products`, {
            method: 'POST',
            body: JSON.stringify({ products: selectedProducts })
        });

        if (response.ok && result.success) {
            showAlert(`✅ Successfully saved ${result.count} products to database!`, 'success');

            // Update UI to show products are saved
            checkboxes.forEach(checkbox => {
                const productCard = checkbox.closest('.col-md-6, .col-lg-4, .col-12');
                if (productCard) {
                    addSavedBadge(productCard);
                }
            });
        } else {
            showAlert(result.message || 'Failed to save products to database', 'error');
        }
    } catch (error) {
        console.error('Error saving products:', error);
        showAlert('Error saving products to database', 'error');
    } finally {
        setButtonLoading(saveBtn, false);
    }
}

/**
 * Sync products to Salla
 */
async function syncProductsToSalla() {
    const syncBtn = document.getElementById('syncToSallaBtn');
    const originalText = syncBtn.innerHTML;

    try {
        setButtonLoading(syncBtn, true);
        syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing to Salla...';

        const { response, result } = await apiCall(`/salla-stores/${storeId}/sync-to-salla`, {
            method: 'POST'
        });

        if (response.ok && result.success) {
            const { categories, products, errors } = result.data;

            let message = `✅ Successfully synced to Salla!<br>`;
            message += `<strong>Categories:</strong> ${categories.length}<br>`;
            message += `<strong>Products:</strong> ${products.length}`;

            if (errors.length > 0) {
                message += `<br><strong>Errors:</strong> ${errors.length}`;
                console.error('Sync errors:', errors);
            }

            showAlert(message, 'success');
        } else {
            showAlert('Error syncing products to Salla', 'error');
        }
    } catch (error) {
        console.error('Error syncing to Salla:', error);
        showAlert('Error syncing products to Salla', 'error');
    } finally {
        setButtonLoading(syncBtn, false);
    }
}

/**
 * Combined function to save and sync products
 */
async function syncSelectedProductsToSalla() {
    const selectedProducts = [];
    const checkboxes = document.querySelectorAll('.product-checkbox:checked');
    const selectedOptionCheckboxes = document.querySelectorAll('.option-checkbox:checked');

    // Validate that we have selected options, not just products
    if (selectedOptionCheckboxes.length === 0) {
        showAlert('Please select at least one product option to sync. Use the "Include this option" checkboxes.', 'warning');
        return;
    }

    if (checkboxes.length === 0) {
        showAlert('Please select at least one product to sync.', 'warning');
        return;
    }

    console.log(`🔄 Processing ${checkboxes.length} selected products with ${selectedOptionCheckboxes.length} selected options for sync`);

    // Check for negative markup before proceeding
    const negativeMarkupOptions = [];

    // Debug: Check image URLs in selected products
    console.log('🖼️  DEBUG: Checking image URLs in selected products...');

    // Collect selected products data with actual pricing from UI
    checkboxes.forEach((checkbox, index) => {
        try {
            const productCard = checkbox.closest('.card');
            const productData = JSON.parse(checkbox.getAttribute('data-product'));

            // Debug: Log image information for this product
            console.log(`📷 Product ${productData.ProductCode}:`, {
                ProductLogo: productData.ProductLogo,
                hasLogo: !!productData.ProductLogo,
                logoLength: productData.ProductLogo?.length,
                Name: productData.Name
            });

            if (productData.ProductOptionsList && productData.ProductOptionsList.length > 0) {
                // Product with options - get pricing from selected option cards only
                const optionCards = productCard.querySelectorAll('.option-card');

                productData.ProductOptionsList.forEach(option => {
                    // Find the corresponding option card in the UI
                    const optionCard = Array.from(optionCards).find(card =>
                        card.getAttribute('data-option-code') === option.ProductOptionCode
                    );

                    // Check if this specific option is selected
                    const optionCheckbox = optionCard?.querySelector('.option-checkbox');
                    if (!optionCheckbox || !optionCheckbox.checked) {
                        console.log(`⏭️ Skipping unselected option: ${option.ProductOptionCode}`);
                        return; // Skip this option if not selected
                    }

                    let customPrice = null;
                    let markupPercentage = 0;

                    if (optionCard) {
                        const customPriceInput = optionCard.querySelector('.custom-price-input');
                        const markupInput = optionCard.querySelector('.markup-input');

                        if (customPriceInput) {
                            customPrice = parseFloat(customPriceInput.value) || 0;
                            console.log(`📊 Option ${option.ProductOptionCode}: Custom Price = ${customPrice}`);
                        }
                        if (markupInput) {
                            markupPercentage = parseFloat(markupInput.value) || 0;
                            console.log(`📊 Option ${option.ProductOptionCode}: Markup % = ${markupPercentage}`);
                        }
                    } else {
                        console.warn(`⚠️ Option card not found for ${option.ProductOptionCode}`);
                    }

                    selectedProducts.push({
                        productCode: productData.ProductCode,
                        productName: productData.Name || productData.ProductCode, // Store readable product name
                        optionCode: option.ProductOptionCode,
                        optionName: option.Name || option.ProductOptionCode, // Use readable name or fallback to code
                        customPrice: customPrice,
                        markupPercentage: markupPercentage,
                        isActive: true,
                        // Include essential pricing data from Ubiqfy API
                        minValue: option.MinValue || 0,
                        maxValue: option.MaxValue || 0,
                        minFaceValue: option.MinFaceValue || 0,
                        productCurrencyCode: option.ProductCurrencyCode, // Don't default to USD - use actual value  
                        minWholesaleValue: option.MinMaxRangeValue?.MinWholesaleValue || 0,
                        maxWholesaleValue: option.MinMaxRangeValue?.MaxWholesaleValue || 0
                    });
                });
            } else {
                // Product without options - look for general pricing inputs
                let customPrice = null;
                let markupPercentage = (productData.Discount || 0) * 100;

                const customPriceInput = productCard.querySelector('.custom-price-input');
                const markupInput = productCard.querySelector('.markup-input');

                if (customPriceInput) {
                    customPrice = parseFloat(customPriceInput.value) || 0;
                }
                if (markupInput) {
                    markupPercentage = parseFloat(markupInput.value) || markupPercentage;
                }

                selectedProducts.push({
                    productCode: productData.ProductCode,
                    customPrice: customPrice,
                    markupPercentage: markupPercentage,
                    isActive: true
                });
            }
        } catch (error) {
            console.error('Error parsing product data:', error);
        }
    });

    console.log(`Total processed items: ${selectedProducts.length}`);

    if (selectedProducts.length === 0) {
        showAlert('No options were selected for processing. Please select individual options using "Include this option" checkboxes.', 'error');
        return;
    }

    // Collect negative markup options from selected products (avoid duplicates)
    const negativeMarkupSet = new Set();
    selectedProducts.forEach(product => {
        if (product.markupPercentage < 0) {
            // Use only option name for clean display
            const displayName = product.optionName || product.productName || product.productCode;
            negativeMarkupSet.add(JSON.stringify({
                name: displayName,
                markup: product.markupPercentage
            }));
        }
    });

    // Convert Set back to array of objects
    const uniqueNegativeOptions = Array.from(negativeMarkupSet).map(item => JSON.parse(item));

    // Check for negative markup before proceeding with sync
    if (uniqueNegativeOptions.length > 0) {
        const negativeList = uniqueNegativeOptions.map(opt => `• ${opt.name}: ${opt.markup.toFixed(2)}%`).join('<br>');
        const confirmed = await showConfirmDialog(
            'Warning: Negative Markup',
            `⚠️ Some products have negative markup (loss):<br><br>${negativeList}<br><br>Do you want to continue?`,
            'Yes, Continue',
            'Cancel'
        );

        if (!confirmed) {
            return; // User cancelled
        }
    }

    const syncBtn = document.getElementById('syncToSallaBtn');
    const originalText = syncBtn.innerHTML;

    try {
        syncBtn.disabled = true;

        // Step 1: Save to database
        syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving to database...';

        const { response: saveResponse, result: saveResult } = await apiCall(`/salla-stores/${storeId}/bulk-link-products`, {
            method: 'POST',
            body: JSON.stringify({ products: selectedProducts })
        });

        if (!saveResponse.ok || !saveResult.success) {
            showAlert(saveResult.message || 'Failed to save products to database', 'error');
            return;
        }

        // Update UI to show products are saved
        checkboxes.forEach(checkbox => {
            const productCard = checkbox.closest('.col-md-6, .col-lg-4, .col-12');
            if (productCard) {
                addSavedBadge(productCard);
            }
        });

        // Step 2: Sync to Salla
        syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing to Salla...';

        const { response: syncResponse, result: syncResult } = await apiCall(`/salla-stores/${storeId}/sync-to-salla`, {
            method: 'POST'
        });

        if (syncResponse.ok && syncResult.success) {
            const { categories, products, errors } = syncResult.data;

            let message = `✅ Successfully saved ${saveResult.count} products and synced to Salla!<br>`;
            message += `<strong>Categories:</strong> ${categories.length}<br>`;
            message += `<strong>Products:</strong> ${products.length}`;

            if (errors.length > 0) {
                message += `<br><strong>Errors:</strong> ${errors.length}`;
                console.error('Sync errors:', errors);
            }

            showAlert(message, 'success');

            // Update UI to show products are synced
            checkboxes.forEach(checkbox => {
                const productCard = checkbox.closest('.col-md-6, .col-lg-4, .col-12');
                if (productCard) {
                    addSyncedBadge(productCard);
                }
            });

            // Uncheck all checkboxes
            checkboxes.forEach(cb => {
                cb.checked = false;
                togglePricingConfig(cb);
            });
            updateSelectedCount();

            // Refresh page after successful sync to show updated sync status
            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } else {
            showAlert(`Products saved to database but failed to sync to Salla: ${syncResult.message || 'Unknown error'}`, 'warning');
        }

    } catch (error) {
        console.error('Error in sync process:', error);
        showAlert('Error during save and sync process', 'error');
    } finally {
        syncBtn.disabled = false;
        syncBtn.innerHTML = originalText;
    }
}

/**
 * Add saved badge to product card
 */
function addSavedBadge(productCard) {
    productCard.classList.add('saved-to-db');

    let badge = productCard.querySelector('.saved-badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'badge bg-success saved-badge position-absolute';
        badge.style.cssText = 'top: 5px; right: 5px; z-index: 1000;';
        badge.textContent = 'Saved';
        productCard.style.position = 'relative';
        productCard.appendChild(badge);
    }
}

/**
 * Add synced badge to product card
 */
function addSyncedBadge(productCard) {
    productCard.classList.add('synced-to-salla');

    let badge = productCard.querySelector('.saved-badge');
    if (badge) {
        badge.textContent = 'Synced';
        badge.classList.remove('bg-success', 'saved-badge');
        badge.classList.add('bg-primary', 'synced-badge');
        badge.style.cssText = 'top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1000;';
    }
}

/**
 * Load and display sync status for products
 */
async function loadSyncStatus() {
    try {
        const { response, result } = await apiCall(`/salla-stores/${storeId}/synced-products`);

        if (response.ok && result.success) {
            const syncedProducts = result.data.products || [];

            // Update UI to show which products are already synced
            syncedProducts.forEach(product => {
                const checkbox = document.querySelector(`input[value="${product.productCode}"]`);
                if (checkbox) {
                    const productCard = checkbox.closest('.col-md-6, .col-lg-4, .col-12');
                    if (productCard) {
                        addSyncedBadge(productCard);
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error loading sync status:', error);
    }
}

/**
 * Test Salla connection
 */
async function testSallaConnection() {
    const testBtn = document.getElementById('testSallaBtn');
    const originalText = testBtn.innerHTML;

    try {
        setButtonLoading(testBtn, true);

        const { response, result } = await apiCall(`/salla-stores/${storeId}/test-salla-connection`, {
            method: 'POST'
        });

        if (response.ok && result.success) {
            const storeInfo = result.data.storeInfo;
            let message = `<strong>✅ Salla Connection Successful!</strong><br>`;
            if (storeInfo) {
                message += `<small><i class="fas fa-store"></i> Store: ${storeInfo.name || 'Unknown'}</small>`;
            }
            showToast(message, 'success');
        } else {
            const error = result.data?.error || result.message || 'Connection failed';
            showToast(`<strong>❌ Salla Connection Failed</strong><br><small>${error}</small>`, 'error');
        }

    } catch (error) {
        console.error('Error testing Salla connection:', error);
        showToast('<strong>❌ Network Error</strong><br><small>Error testing Salla connection</small>', 'error');
    } finally {
        setButtonLoading(testBtn, false);
    }
}
