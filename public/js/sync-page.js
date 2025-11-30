/**
 * Sync page JavaScript functionality
 * Handles product fetching and synchronization with Salla
 */

// Global variables (will be initialized by the template)
let storeId, conversionRate, sallaCurrency, ubiqfyCurrency;

// Initialize the page
document.addEventListener('DOMContentLoaded', function () {
    // Initialize store data if available
    if (window.storeData) {
        initializeStoreData(window.storeData);
    }

    // Initialize option checkbox visual states
    initializeOptionCheckboxStates();

    console.log('Sync page loaded, store data:', window.storeData);
});

/**
 * Initialize store data from server-side variables
 */
function initializeStoreData(storeData) {
    const oldConversionRate = window.storeData?.currency_conversion_rate;

    window.storeData = storeData;
    storeId = storeData.id;
    conversionRate = storeData.currency_conversion_rate;
    sallaCurrency = storeData.salla_currency;
    ubiqfyCurrency = storeData.ubiqfy_currency;

    // If conversion rate changed, recalculate markups for existing options
    if (oldConversionRate && oldConversionRate !== conversionRate) {
        console.log(`💱 Currency rate changed from ${oldConversionRate} to ${conversionRate}`);
        if (typeof recalculateAllMarkupsForCurrencyChange === 'function') {
            recalculateAllMarkupsForCurrencyChange();
        }
    }
}

/**
 * Initialize visual states for all option checkboxes
 */
function initializeOptionCheckboxStates() {
    // Wait a bit for the DOM to be fully loaded
    setTimeout(() => {
        updateSelectedCountWrapper();
    }, 100);
}

/**
 * Filter products based on search input
 */
function filterProducts() {
    const searchTerm = document.getElementById('productSearch')?.value.toLowerCase() || '';
    const productCards = document.querySelectorAll('.col-12.mb-4');

    let visibleCount = 0;
    productCards.forEach(card => {
        const productName = card.querySelector('.card-title')?.textContent.toLowerCase() || '';
        const productCode = card.querySelector('.text-muted')?.textContent.toLowerCase() || '';
        const countryBadge = card.querySelector('.badge.bg-secondary')?.textContent.toLowerCase() || '';

        // Also search in option codes and option names within each product
        const optionElements = card.querySelectorAll('.option-card');
        let optionMatches = false;
        optionElements.forEach(optionCard => {
            const optionName = optionCard.querySelector('h6.text-primary')?.textContent.toLowerCase() || '';
            // Find the small element containing the option code
            const optionCodeSmall = optionCard.querySelector('small.text-muted');
            const optionCode = optionCodeSmall?.textContent.toLowerCase() || '';

            if (optionName.includes(searchTerm) || optionCode.includes(searchTerm)) {
                optionMatches = true;
            }
        });

        const isVisible = productName.includes(searchTerm) ||
            productCode.includes(searchTerm) ||
            countryBadge.includes(searchTerm) ||
            optionMatches;

        card.style.display = isVisible ? 'block' : 'none';
        if (isVisible) visibleCount++;
    });

    // Update filtered product count
    const filteredCountElement = document.getElementById('filteredProductCount');
    if (filteredCountElement) {
        filteredCountElement.textContent = visibleCount;
    }
}

/**
 * Toggle country filter visibility
 */
function toggleCountryFilter() {
    const filterSection = document.getElementById('countryFilterSection');
    if (filterSection) {
        filterSection.style.display = filterSection.style.display === 'none' ? 'block' : 'none';
    }
}

/**
 * Select all countries in filter
 */
function selectAllCountries() {
    const checkboxes = document.querySelectorAll('#countryCheckboxes input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    applyCountryFilter();
}

/**
 * Deselect all countries in filter
 */
function deselectAllCountries() {
    const checkboxes = document.querySelectorAll('#countryCheckboxes input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    applyCountryFilter();
}

/**
 * Apply country filter
 */
function applyCountryFilter() {
    const selectedCountries = Array.from(document.querySelectorAll('#countryCheckboxes input[type="checkbox"]:checked'))
        .map(cb => cb.value.toLowerCase());

    const productCards = document.querySelectorAll('.col-12.mb-4');
    let visibleCount = 0;

    productCards.forEach((card, index) => {
        // Try to get country from data-country attribute first (most reliable)
        let country = card.getAttribute('data-country');

        // If no data-country attribute, try to find it in the country badge (bg-info)
        if (!country) {
            const countryBadge = card.querySelector('.badge.bg-info');
            if (countryBadge) {
                // Extract country from badge text (remove the icon)
                const badgeText = countryBadge.textContent;
                country = badgeText.replace(/\s*\S+\s*/, '').trim();
            }
        }

        // Convert to lowercase for comparison
        country = country ? country.toLowerCase() : '';

        // Show product only if its country is in the selected countries list
        // If no countries are selected, hide all products
        const isVisible = selectedCountries.length > 0 && selectedCountries.includes(country);
        card.style.display = isVisible ? 'block' : 'none';

        if (isVisible) {
            visibleCount++;
        }
    });

    // Update counts
    document.getElementById('filteredCountryCount').textContent = selectedCountries.length;
    document.getElementById('filteredProductCount').textContent = visibleCount;
}

/**
 * Test Ubiqfy authentication
 */
async function testUbiqfyAuth() {
    const btn = event.target;
    setButtonLoading(btn, true);

    // Ensure storeId is available
    if (!storeId && window.storeData) {
        initializeStoreData(window.storeData);
    }

    if (!storeId) {
        showToast('❌ Error: Store ID not available. Please refresh the page and try again.', 'error');
        setButtonLoading(btn, false);
        return;
    }

    try {
        const { response, result } = await apiCall(`/salla-stores/${storeId}/test-ubiqfy-auth`, {
            method: 'POST'
        });

        if (response.ok && result.success) {
            let message = `<strong>✅ Ubiqfy Authentication Successful!</strong><br>`;
            if (result.data && result.data.token) {
                message += `<i class="fas fa-key"></i> Token received<br>`;
                message += `<i class="fas fa-coins"></i> Plafond: ${result.data.plafond || 'N/A'}<br>`;
            }
            message += `<small>${result.message || result.data.message || 'Connection verified'}</small>`;
            showToast(message, 'success');
        } else {
            const errorMsg = result.message || result.error || 'Unknown error';
            showToast(`<strong>❌ Ubiqfy Authentication Failed</strong><br><small>${errorMsg}</small>`, 'error');
        }
    } catch (error) {
        showToast('<strong>❌ Network Error</strong><br><small>Could not connect to Ubiqfy API. Please check your credentials and try again.</small>', 'error');
        console.error('Ubiqfy test error:', error);
    } finally {
        setButtonLoading(btn, false);
    }
}

/**
 * Fetch Ubiqfy products
 */
async function fetchUbiqfyProducts() {
    const btn = event.target;
    setButtonLoading(btn, true);

    // Ensure storeId is available
    if (!storeId && window.storeData) {
        initializeStoreData(window.storeData);
    }

    if (!storeId) {
        alert('❌ Error: Store ID not available. Please refresh the page and try again.');
        setButtonLoading(btn, false);
        return;
    }

    try {
        const { response, result } = await apiCall(`/salla-stores/${storeId}/fetch-ubiqfy-products`, {
            method: 'POST'
        });

        if (response.ok && result.success) {
            console.log('🎯 DEBUG: Raw product data received:', result.data);

            // Check for image URLs in the raw data
            if (result.data.products && result.data.products.length > 0) {
                console.log('📷 DEBUG: Image analysis of first 3 products:');
                result.data.products.slice(0, 3).forEach((product, index) => {
                    console.log(`Product ${index + 1}:`, {
                        ProductCode: product.ProductCode,
                        ProductLogo: product.ProductLogo,
                        hasLogo: !!product.ProductLogo,
                        logoType: typeof product.ProductLogo
                    });
                });
            }

            const filteringResult = displayProductsOnScreen(result.data);

            // Get proper counts from actual data, not metadata
            const actualProductCount = result.data.products ? result.data.products.length : 0;
            const metadataCount = result.data.metadata ? result.data.metadata.productCount : 0;
            const productTypeCode = result.data.metadata ? result.data.metadata.productTypeCode : 'Unknown';

            // Use actual count as "Original" (what we received from API)
            const originalProductCount = actualProductCount;

            let alertContent = `
                <div class="text-center mb-3">
                    <i class="fas fa-check-circle text-success fa-2x mb-2"></i>
                    <h5 class="text-success mb-0">Products Loaded Successfully!</h5>
                </div>
                <div class="row g-2 text-start">
                    <div class="col-12">
                        <span class="badge bg-primary me-2">📦</span>
                        <strong>Product Type:</strong> ${productTypeCode}
                    </div>
                    <div class="col-12">
                        <span class="badge bg-info me-2">🔢</span>
                        <strong>Received:</strong> ${originalProductCount} products
                    </div>`;

            if (filteringResult) {
                const availableCount = filteringResult.availableCount || 0;
                const originalOptionsCount = filteringResult.originalOptionsCount || 0;
                const availableOptionsCount = filteringResult.availableOptionsCount || 0;
                const newProductsCount = filteringResult.newProductsCount || 0;
                const existingProductsCount = filteringResult.existingProductsCount || 0;

                alertContent += `
                    <div class="col-12">
                        <span class="badge bg-success me-2">✅</span>
                        <strong>Available:</strong> ${availableCount} products
                    </div>
                    <div class="col-12">
                        <span class="badge bg-info me-2">⚙️</span>
                        <strong>Product Options:</strong> ${availableOptionsCount} available of ${originalOptionsCount} total
                    </div>`;

                // Show new vs existing breakdown if we have the data
                if (newProductsCount > 0 || existingProductsCount > 0) {
                    alertContent += `
                    <div class="col-12">
                        <span class="badge bg-primary me-2">🆕</span>
                        <strong>New Products:</strong> ${newProductsCount}
                    </div>
                    <div class="col-12">
                        <span class="badge bg-secondary me-2">📋</span>
                        <strong>Previously Synced:</strong> ${existingProductsCount}
                    </div>`;
                }

                if (filteringResult.filteredOutCount && filteringResult.filteredOutCount > 0) {
                    alertContent += `
                    <div class="col-12">
                        <span class="badge bg-warning me-2">🚫</span>
                        <strong>Hidden Products:</strong> ${filteringResult.filteredOutCount} with price ranges
                    </div>`;
                }
                if (filteringResult.filteredOptionsCount && filteringResult.filteredOptionsCount > 0) {
                    alertContent += `
                    <div class="col-12">
                        <span class="badge bg-secondary me-2">🔧</span>
                        <strong>Hidden Options:</strong> ${filteringResult.filteredOptionsCount} price range options
                    </div>`;
                }
            }

            alertContent += `</div>`;

            // Show modern alert for longer duration (10 seconds) since it has detailed info
            showAlert(alertContent, 'success', 10000);
        } else {
            const errorMsg = result.message || result.error || 'Unknown error';
            showAlert(`<i class="fas fa-exclamation-triangle me-2"></i>Failed to fetch products: ${errorMsg}`, 'error');
        }
    } catch (error) {
        showAlert(`<i class="fas fa-wifi me-2"></i>Network Error: Could not fetch products from Ubiqfy API. Please check your connection and try again.`, 'error');
        console.error('Ubiqfy products fetch error:', error);
    } finally {
        setButtonLoading(btn, false);
    }
}

/**
 * Filter products to only include fixed-price options (not price ranges)
 * For each product, filters out options where MinValue !== MaxValue
 * Only removes entire products if ALL options have price ranges
 */
function filterFixedPriceProducts(products) {
    return products.map(product => {
        // If no options, return product as-is
        if (!product.ProductOptionsList || product.ProductOptionsList.length === 0) {
            console.log(`ℹ️ Product ${product.ProductCode} has no options - keeping as-is`);
            return product;
        }

        // Filter options within the product
        const originalOptionsCount = product.ProductOptionsList.length;
        const filteredOptions = product.ProductOptionsList.filter(option => {
            if (!option.MinMaxRangeValue) {
                console.log(`⚠️ Option ${option.Code || 'unknown'} has no MinMaxRangeValue - keeping`);
                return true; // Keep options without price range data
            }

            const minValue = option.MinMaxRangeValue.MinValue || 0;
            const maxValue = option.MinMaxRangeValue.MaxValue || 0;
            const isFixedPrice = minValue === maxValue;

            if (!isFixedPrice) {
                console.log(`❌ Filtering out option ${option.Code || 'unknown'} from product ${product.ProductCode}: price range (${minValue} - ${maxValue})`);
            } else {
                console.log(`✅ Keeping option ${option.Code || 'unknown'} from product ${product.ProductCode}: fixed price (${minValue})`);
            }

            return isFixedPrice;
        });

        // Create new product object with filtered options
        const filteredProduct = { ...product };
        filteredProduct.ProductOptionsList = filteredOptions;

        const removedOptionsCount = originalOptionsCount - filteredOptions.length;
        if (removedOptionsCount > 0) {
            console.log(`� Product ${product.ProductCode}: removed ${removedOptionsCount}/${originalOptionsCount} price range options`);
        }

        return filteredProduct;
    }).filter(product => {
        // Remove products that have no options left after filtering
        const hasValidOptions = product.ProductOptionsList && product.ProductOptionsList.length > 0;
        if (!hasValidOptions) {
            console.log(`🚫 Removing product ${product.ProductCode} - no fixed-price options available`);
        }
        return hasValidOptions || !product.ProductOptionsList; // Keep products without options list
    });
}

/**
 * Display products on screen
 */
async function displayProductsOnScreen(data) {
    const productsCard = document.getElementById('productsCard');
    const productsContainer = document.getElementById('productsContainer');
    const noProductsMessage = document.getElementById('noProductsMessage');
    const productTypeLabel = document.getElementById('productTypeLabel');
    const productCountLabel = document.getElementById('productCountLabel');
    const countryFilterSection = document.getElementById('countryFilterSection');

    // Show the products card
    productsCard.style.display = 'block';

    if (data.products && data.products.length > 0) {
        // Hide no products message and show container
        noProductsMessage.style.display = 'none';
        productsContainer.style.display = 'block';

        // Update labels
        const productCount = data.metadata ? data.metadata.productCount : data.products.length;
        const productTypeCode = data.metadata ? data.metadata.productTypeCode : 'Products';

        productTypeLabel.textContent = productTypeCode;
        productCountLabel.textContent = productCount;

        // Clear existing products
        productsContainer.innerHTML = '';

        // Filter out products with price range options (MinValue !== MaxValue)
        const originalProductCount = data.products.length;
        let totalFilteredOptionsCount = 0;

        // Count original options for statistics
        const originalOptionsCount = data.products.reduce((total, product) => {
            return total + (product.ProductOptionsList ? product.ProductOptionsList.length : 0);
        }, 0);

        const filteredProducts = filterFixedPriceProducts(data.products);

        // Count remaining options for statistics
        const remainingOptionsCount = filteredProducts.reduce((total, product) => {
            return total + (product.ProductOptionsList ? product.ProductOptionsList.length : 0);
        }, 0);

        totalFilteredOptionsCount = originalOptionsCount - remainingOptionsCount;
        const filteredProductCount = originalProductCount - filteredProducts.length;

        console.log(`📋 Filtering results: ${filteredProducts.length}/${originalProductCount} products, ${remainingOptionsCount}/${originalOptionsCount} options`);

        // Collect all unique countries from filtered products
        const countries = new Set();
        console.log('🌍 Collecting countries from filtered products...');
        filteredProducts.forEach((product, index) => {
            // Use CountryIso which is the correct field name
            if (product.CountryIso) {
                console.log(`Product ${index}: CountryIso = "${product.CountryIso}"`);
                countries.add(product.CountryIso);
            } else {
                console.log(`Product ${index}: No CountryIso found`, product);
            }
        });

        console.log('Unique countries found:', Array.from(countries));

        // Populate country filter if there are any countries
        if (countries.size > 0) {
            populateCountryFilter(Array.from(countries));
        }

        // Render filtered products using the existing function
        if (typeof renderFilteredProducts === 'function') {
            renderFilteredProducts(filteredProducts);
        } else {
            console.error('renderFilteredProducts function not available');
        }

        // Update count label with filtered count
        productCountLabel.textContent = filteredProducts.length;

        // Initialize option states
        initializeOptionCheckboxStates();

        // Load and mark existing synced products and collect statistics
        const existingStats = await loadAndMarkExistingProducts();

        // Count new vs existing products after marking
        let newProductsCount = 0;
        let existingProductsCount = 0;

        filteredProducts.forEach(product => {
            if (product.ProductOptionsList && product.ProductOptionsList.length > 0) {
                // For products with options, check each option
                let hasExistingOptions = false;
                product.ProductOptionsList.forEach(option => {
                    const optionCard = document.querySelector(`[data-option-code="${option.ProductOptionCode}"]`);
                    if (optionCard && (optionCard.classList.contains('synced-product') || optionCard.classList.contains('stored-option'))) {
                        hasExistingOptions = true;
                    }
                });
                if (hasExistingOptions) {
                    existingProductsCount++;
                } else {
                    newProductsCount++;
                }
            } else {
                // For products without options, check the product card
                const productCard = document.querySelector(`[data-product-code="${product.ProductCode}"]`);
                if (productCard && productCard.classList.contains('synced-product')) {
                    existingProductsCount++;
                } else {
                    newProductsCount++;
                }
            }
        });

        // Return detailed filtering statistics including new/existing counts
        return {
            originalProductCount: originalProductCount,
            originalOptionsCount: originalOptionsCount,
            availableCount: filteredProducts.length,
            availableOptionsCount: remainingOptionsCount,
            filteredOutCount: filteredProductCount,
            filteredOptionsCount: totalFilteredOptionsCount,
            newProductsCount: newProductsCount,
            existingProductsCount: existingProductsCount
        };
    } else {
        // Show no products message
        noProductsMessage.style.display = 'block';
        productsContainer.style.display = 'none';
        countryFilterSection.style.display = 'none';

        return null;
    }
}

/**
 * Populate country filter checkboxes
 */
function populateCountryFilter(countries) {
    console.log('🏳️ Populating country filter with countries:', countries);

    const countryCheckboxes = document.getElementById('countryCheckboxes');
    countryCheckboxes.innerHTML = '';

    countries.sort().forEach(country => {
        console.log(`Creating checkbox for country: "${country}"`);

        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'form-check form-check-inline';

        const checkbox = document.createElement('input');
        checkbox.className = 'form-check-input';
        checkbox.type = 'checkbox';
        checkbox.id = `country-${country}`;
        checkbox.value = country;
        checkbox.checked = true;
        checkbox.onchange = applyCountryFilter;

        const label = document.createElement('label');
        label.className = 'form-check-label';
        label.htmlFor = `country-${country}`;
        label.textContent = country;

        checkboxDiv.appendChild(checkbox);
        checkboxDiv.appendChild(label);
        countryCheckboxes.appendChild(checkboxDiv);
    });

    // Show country filter section
    document.getElementById('countryFilterSection').style.display = 'block';

    // Update initial counts
    document.getElementById('filteredCountryCount').textContent = countries.length;
    // Count actual products initially (all should be visible)
    setTimeout(() => {
        const visibleProducts = document.querySelectorAll('.col-12.mb-4:not([style*="display: none"])').length;
        document.getElementById('filteredProductCount').textContent = visibleProducts;
        console.log(`Initial visible products: ${visibleProducts}`);
    }, 100);
}

/**
 * Toggle all products selection
 */
function toggleAllProducts() {
    const masterCheckbox = document.getElementById('selectAllProductsCheckbox');
    const productCheckboxes = document.querySelectorAll('.product-checkbox');

    // Use the toggleAllProducts function from product-sync.js if available
    if (typeof window.toggleAllProducts === 'function') {
        window.toggleAllProducts();
    } else {
        productCheckboxes.forEach(checkbox => {
            checkbox.checked = masterCheckbox.checked;
            // Trigger the change event to update pricing
            checkbox.dispatchEvent(new Event('change'));
        });
        updateSelectedCountWrapper();
    }
}

/**
 * Update selected count badge
 */
function updateSelectedCountWrapper() {
    // Use the main updateSelectedCount function from product-sync.js if available
    if (typeof updateSelectedCount === 'function') {
        updateSelectedCount();
        return;
    }

    // Fallback implementation if main function is not available
    const checkedProductBoxes = document.querySelectorAll('.product-checkbox:checked');
    const checkedOptionBoxes = document.querySelectorAll('.option-checkbox:checked');
    const productCount = checkedProductBoxes.length;
    const optionCount = checkedOptionBoxes.length;

    const badge = document.getElementById('selectedCountBadge');
    const syncBtn = document.getElementById('syncToSallaBtn');

    if (badge) {
        const productSpan = badge.querySelector('span:first-child');
        const optionSpan = badge.querySelector('span:last-child');

        if (productSpan) productSpan.textContent = productCount;
        if (optionSpan) optionSpan.textContent = optionCount;
    }

    if (syncBtn) {
        if (optionCount > 0) {
            syncBtn.disabled = false;
            syncBtn.classList.remove('btn-secondary');
            syncBtn.classList.add('btn-primary');
        } else {
            syncBtn.disabled = true;
            syncBtn.classList.remove('btn-primary');
            syncBtn.classList.add('btn-secondary');
        }
    }
}

/**
 * Update country filter counters
 * Called by product-rendering.js after rendering products
 */
function updateCountryFilterCounters() {
    const selectedCountries = document.querySelectorAll('#countryCheckboxes input[type="checkbox"]:checked').length;
    const visibleProducts = document.querySelectorAll('.col-12.mb-4:not([style*="display: none"])').length;

    const filteredCountryCount = document.getElementById('filteredCountryCount');
    const filteredProductCount = document.getElementById('filteredProductCount');

    if (filteredCountryCount) {
        filteredCountryCount.textContent = selectedCountries;
    }
    if (filteredProductCount) {
        filteredProductCount.textContent = visibleProducts;
    }
}

/**
 * Load existing synced products and mark them visually
 */
async function loadAndMarkExistingProducts() {
    if (!storeId) {
        console.log('Store ID not available, skipping existing products check');
        return;
    }

    try {
        console.log('🔍 Loading existing synced products and stored options...');

        // Load both synced products and stored options
        const [syncedResponse, storedOptionsResponse] = await Promise.all([
            apiCall(`/salla-stores/${storeId}/synced-products`),
            apiCall(`/salla-stores/${storeId}/stored-options`)
        ]);

        const syncedProducts = [];
        const storedOptionsMap = {};

        // Process synced products response
        if (syncedResponse.response.ok && syncedResponse.result.success) {
            syncedProducts.push(...(syncedResponse.result.data.products || []));
            console.log('Synced products:', syncedProducts);
        }

        // Process stored options response - this comes as an object map
        if (storedOptionsResponse.response.ok && storedOptionsResponse.result.success) {
            Object.assign(storedOptionsMap, storedOptionsResponse.result.data || {});
            console.log('Stored options map:', storedOptionsMap);
        }

        console.log(`Found ${syncedProducts.length} synced products and ${Object.keys(storedOptionsMap).length} stored options`);

        // Mark synced products first (higher priority)
        syncedProducts.forEach(product => {
            markProductAsSynced(product.productCode, product.optionCode);
        });

        // Load stored options (only select the specific options that are in DB)
        Object.entries(storedOptionsMap).forEach(([optionCode, optionData]) => {
            // Set flag to prevent database updates during loading
            if (typeof window !== 'undefined') {
                window.isLoadingExistingData = true;
            }

            // Only select the specific option checkbox, not the product
            selectStoredOption(optionCode);

            // Load the custom pricing from database
            loadCustomPriceForOption(optionCode, optionData);
        });

        // Clear the loading flag after a short delay to allow all operations to complete
        setTimeout(() => {
            if (typeof window !== 'undefined') {
                window.isLoadingExistingData = false;
            }
        }, 2000);

        // Update counters after marking
        setTimeout(() => {
            if (typeof updateSelectedCount === 'function') {
                updateSelectedCount();
            }
        }, 100);

    } catch (error) {
        console.error('Error loading existing products:', error);
    }
}

/**
 * Mark a product as already synced to Salla
 */
function markProductAsSynced(productCode, optionCode = null) {
    let checkbox;
    if (optionCode) {
        // Find specific option checkbox by data-option-code
        checkbox = document.querySelector(`.option-checkbox[data-option-code="${optionCode}"]`);
    } else {
        // Find product checkbox by value
        checkbox = document.querySelector(`.product-checkbox[value="${productCode}"]`);
    }

    if (checkbox) {
        const card = checkbox.closest('.col-12, .card');
        if (card) {
            // Add synced styling classes
            card.classList.add('product-synced', 'newly-marked');
            card.classList.remove('product-stored'); // Remove stored class if present

            // Add synced badge
            addSyncedBadgeToCard(card);

            // Auto-select the checkbox
            checkbox.checked = true;

            // Trigger change event to update UI
            checkbox.dispatchEvent(new Event('change'));

            // Remove animation class after animation completes
            setTimeout(() => {
                card.classList.remove('newly-marked');
            }, 600);
        }
    } else {
        console.log(`⚠️ Checkbox not found for productCode: ${productCode}, optionCode: ${optionCode}`);
    }
}

/**
 * Select a specific option that exists in the database
 * Only selects the option checkbox, doesn't add badges or mark the product card
 */
function selectStoredOption(optionCode) {
    // Find the specific option checkbox by data-option-code
    const optionCheckbox = document.querySelector(`.option-checkbox[data-option-code="${optionCode}"]`);

    if (optionCheckbox) {
        // Auto-select the option checkbox
        optionCheckbox.checked = true;

        // Trigger change event to update UI and counters
        optionCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

        console.log(`✅ Selected stored option: ${optionCode}`);
    } else {
        console.log(`⚠️ Option checkbox not found for stored option: ${optionCode}`);
    }
}

/**
 * Add synced badge to card
 */
function addSyncedBadgeToCard(card) {
    // Remove any existing status badges first
    const existingBadges = card.querySelectorAll('.status-badge');
    existingBadges.forEach(badge => badge.remove());

    // Add new synced badge
    const badge = document.createElement('span');
    badge.className = 'badge bg-success status-badge position-absolute';
    badge.style.cssText = 'top: 10px; right: 10px; z-index: 10;';
    badge.innerHTML = '<i class="fas fa-check-circle"></i> Synced to Salla';

    const cardBody = card.querySelector('.card-body') || card;
    cardBody.style.position = 'relative';
    cardBody.appendChild(badge);
}

/**
 * Load custom price for an option from database and populate the UI
 */
function loadCustomPriceForOption(optionCode, optionData) {
    console.log(`💰 Loading custom price for option: ${optionCode}`, optionData);

    // Find the option checkbox by data-option-code attribute
    const optionCheckbox = document.querySelector(`.option-checkbox[data-option-code="${optionCode}"]`);
    if (!optionCheckbox) {
        console.log(`⚠️ Option checkbox not found for: ${optionCode}`);
        return;
    }

    // Find the option card container (the card that contains this checkbox)
    const optionCard = optionCheckbox.closest('.option-card');
    if (!optionCard) {
        console.log(`⚠️ Option card not found for: ${optionCode}`);
        return;
    }

    // Set the option ID from database for future updates
    if (optionData.id) {
        optionCard.setAttribute('data-option-id', optionData.id);
        console.log(`🔗 Set option ID for ${optionCode}: ${optionData.id}`);
    }

    // Find and populate the custom price input
    const customPriceInput = optionCard.querySelector('.custom-price-input');
    if (customPriceInput && optionData.customPrice !== null && optionData.customPrice !== undefined) {
        const customPrice = parseFloat(optionData.customPrice);
        if (!isNaN(customPrice)) {
            customPriceInput.value = customPrice.toFixed(2);
            console.log(`✅ Set custom price for ${optionCode}: ${customPrice}`);
        }
    }

    // Find and populate the markup input
    const markupInput = optionCard.querySelector('.markup-input');
    if (markupInput && optionData.markupPercentage !== null && optionData.markupPercentage !== undefined) {
        // Instead of using stored markup, recalculate based on current custom price and conversion rate
        const customPriceInput = optionCard.querySelector('.custom-price-input');
        if (customPriceInput && optionData.customPrice !== null && optionData.customPrice !== undefined) {
            const customPrice = parseFloat(optionData.customPrice);

            // Get original pricing data
            const originalRetailPrice = parseFloat(customPriceInput.getAttribute('data-original-price')) || 0;
            const originalDiscount = parseFloat(customPriceInput.getAttribute('data-original-discount')) || 0;

            // Calculate wholesale price with current conversion rate
            const wholesalePriceUSD = originalRetailPrice - (originalRetailPrice * originalDiscount);
            const currentConversionRate = window.storeData?.currency_conversion_rate || 3.75;
            const wholesalePriceStore = wholesalePriceUSD * currentConversionRate;

            // Recalculate markup based on current custom price
            if (wholesalePriceStore > 0 && !isNaN(customPrice)) {
                const difference = customPrice - wholesalePriceStore;
                const recalculatedMarkup = (difference / wholesalePriceStore) * 100;
                markupInput.value = recalculatedMarkup.toFixed(2);
                console.log(`✅ Recalculated markup for ${optionCode}: ${recalculatedMarkup.toFixed(2)}% (was ${optionData.markupPercentage}%)`);
            } else {
                // Fallback to stored value if calculation fails
                const markupPercentage = parseFloat(optionData.markupPercentage);
                if (!isNaN(markupPercentage)) {
                    markupInput.value = markupPercentage.toFixed(2);
                    console.log(`✅ Used stored markup for ${optionCode}: ${markupPercentage}%`);
                }
            }
        } else {
            // Fallback to stored value if no custom price found
            const markupPercentage = parseFloat(optionData.markupPercentage);
            if (!isNaN(markupPercentage)) {
                markupInput.value = markupPercentage.toFixed(2);
                console.log(`✅ Used stored markup for ${optionCode}: ${markupPercentage}%`);
            }
        }
    }

    // Find and update the final price display
    const finalPriceDisplay = optionCard.querySelector('.final-price-display');
    if (finalPriceDisplay && optionData.customPrice !== null && optionData.customPrice !== undefined) {
        const customPrice = parseFloat(optionData.customPrice);
        if (!isNaN(customPrice)) {
            finalPriceDisplay.textContent = `${customPrice.toFixed(2)} ${sallaCurrency || 'SAR'}`;
            console.log(`✅ Set final price display for ${optionCode}: ${customPrice}`);
        }
    }

    // Update visual indicators and ensure consistency
    const priceInput = optionCard.querySelector('.custom-price-input');
    if (priceInput && typeof updateFinalPriceWithBinding === 'function') {
        updateFinalPriceWithBinding(priceInput, true);
    }

    // Visual updates are handled by the existing pricing system
    console.log(`✅ Loaded custom price data for existing option: ${optionCode}`);
}
