/**
 * Edit page JavaScript functionality
 * Handles product management, pricing, and Salla integration
 */

// Global variables (will be initialized by the template)
let storeId, conversionRate, sallaCurrency, ubiqfyCurrency;

// Initialize the page
document.addEventListener('DOMContentLoaded', function () {
    // Initialize auto-save functionality
    initializeAutoSave();

    // Initialize option checkbox visual states
    initializeOptionCheckboxStates();

    console.log('Edit page loaded, store data:', window.storeData);
});

/**
 * Initialize store data from server-side variables
 */
function initializeStoreData(storeData) {
    window.storeData = storeData;
    storeId = storeData.id;
    conversionRate = storeData.currency_conversion_rate;
    sallaCurrency = storeData.salla_currency;
    ubiqfyCurrency = storeData.ubiqfy_currency;
}

/**
 * Initialize visual states for all option checkboxes
 */
function initializeOptionCheckboxStates() {
    // Wait a bit for the DOM to be fully loaded
    setTimeout(() => {
        const optionCheckboxes = document.querySelectorAll('.option-checkbox');
        // Visual state update removed as per user request
        updateSelectedCount();
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
        const productName = card.querySelector('.form-check-label')?.textContent.toLowerCase() || '';
        const productCode = card.querySelector('.badge')?.textContent.toLowerCase() || '';
        const countryBadge = card.querySelector('.badge.bg-info')?.textContent.toLowerCase() || '';

        const matchesSearch = productName.includes(searchTerm) ||
            productCode.includes(searchTerm) ||
            countryBadge.includes(searchTerm);

        if (matchesSearch) {
            card.style.display = 'block';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    // Update no products message
    const noProductsMessage = document.getElementById('noProductsMessage');
    if (visibleCount === 0 && searchTerm) {
        noProductsMessage.style.display = 'block';
        noProductsMessage.innerHTML = `
            <i class="fas fa-search fa-3x mb-3"></i>
            <p>No products found matching "${searchTerm}"</p>
            <button class="btn btn-outline-secondary btn-sm" onclick="clearSearch()">
                <i class="fas fa-times"></i> Clear Search
            </button>
        `;
    } else if (visibleCount === 0) {
        noProductsMessage.style.display = 'block';
    } else {
        noProductsMessage.style.display = 'none';
    }

    console.log(`Filtered products: ${visibleCount} visible`);
}

/**
 * Clear search filter
 */
function clearSearch() {
    const searchInput = document.getElementById('productSearch');
    if (searchInput) {
        searchInput.value = '';
        filterProducts();
        searchInput.focus();
    }
}

/**
 * Show progress bar with animation
 */
function showProgress(text = 'Processing...', percent = 0) {
    const progressSection = document.getElementById('progressSection');
    const progressText = document.getElementById('progressText');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');

    if (progressSection) {
        progressSection.style.display = 'block';
        if (progressText) progressText.textContent = text;
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressPercent) progressPercent.textContent = `${percent}%`;
    }
}

/**
 * Hide progress bar
 */
function hideProgress() {
    const progressSection = document.getElementById('progressSection');
    if (progressSection) {
        setTimeout(() => {
            progressSection.style.display = 'none';
        }, 500);
    }
}

/**
 * Test Ubiqfy authentication
 */
async function testUbiqfyAuth() {
    const btn = event.target;
    setButtonLoading(btn, true);

    try {
        const { response, result } = await apiCall(`/salla-stores/${storeId}/test-ubiqfy-auth`, {
            method: 'POST'
        });

        if (response.ok && result.success) {
            let message = `✅ Ubiqfy Authentication Successful!\n\n`;
            if (result.data && result.data.token) {
                message += `🔑 Token received\n`;
                message += `💰 Plafond: ${result.data.plafond || 'N/A'}\n`;
            }
            message += `✅ ${result.message || result.data.message || 'Connection verified'}`;
            alert(message);
        } else {
            const errorMsg = result.message || result.error || 'Unknown error';
            alert(`❌ Ubiqfy Authentication Failed:\n\n${errorMsg}`);
        }
    } catch (error) {
        alert('❌ Network Error:\n\nCould not connect to Ubiqfy API. Please check your credentials and try again.');
        console.error('Ubiqfy test error:', error);
    } finally {
        setButtonLoading(btn, false);
    }
}

/**
 * Refresh balance from Ubiqfy
 */
async function refreshBalance() {
    const refreshBtn = event.target;
    setButtonLoading(refreshBtn, true);

    try {
        const { response, result } = await apiCall(`/salla-stores/${storeId}/test-ubiqfy-auth`, {
            method: 'POST'
        });

        if (response.ok && result.success) {
            const balanceField = document.getElementById('ubiqfy_plafond');
            const plafondValue = result.data && result.data.plafond !== undefined ? result.data.plafond : null;

            if (plafondValue !== undefined && plafondValue !== null) {
                // Display balance in cents
                const balanceInCents = parseInt(plafondValue);
                balanceField.value = balanceInCents;
                alert(`✅ Balance Updated Successfully!\n\nNew Balance: ${balanceInCents}¢`);

                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                let errorMessage = '⚠️ Balance information not available in the response.';
                if (result.data && result.data.debugInfo) {
                    errorMessage += `\n\nDebug Info:\n- Available fields in response: ${result.data.debugInfo.availableFields.join(', ')}`;
                    errorMessage += `\n- Searched for fields: Plafond, Balance, balance, plafond, Amount, amount, AvailableBalance, CurrentBalance`;
                    if (result.data.debugInfo.balanceFieldFound) {
                        errorMessage += `\n- Balance field found: "${result.data.debugInfo.balanceFieldFound}"`;
                    } else {
                        errorMessage += `\n- No balance field found in any of the expected names`;
                    }
                }
                console.log('Full response:', result);
                alert(errorMessage);
            }
        } else {
            // Handle error response - extract detailed error message
            let errorMessage = 'Unknown error';

            if (result) {
                if (result.message) {
                    errorMessage = result.message;
                } else if (typeof result === 'string') {
                    errorMessage = result;
                } else if (result.error) {
                    errorMessage = result.error;
                }
            }

            console.error('Ubiqfy Auth Error:', {
                status: response.status,
                statusText: response.statusText,
                result: result
            });

            alert(`❌ Failed to refresh balance: ${errorMessage}`);
        }
    } catch (error) {
        alert('❌ Network error occurred while refreshing balance');
        console.error('Balance refresh error:', error);
    } finally {
        setButtonLoading(refreshBtn, false);
    }
}

/**
 * Fetch Ubiqfy products
 */
async function fetchUbiqfyProducts() {
    const btn = event.target;
    setButtonLoading(btn, true);

    try {
        const { response, result } = await apiCall(`/salla-stores/${storeId}/fetch-ubiqfy-products`, {
            method: 'POST'
        });

        if (response.ok && result.success) {
            displayProductsOnScreen(result.data);

            // Get proper counts from actual data, not metadata
            const actualProductCount = result.data.products ? result.data.products.length : 0;
            const productTypeCode = result.data.metadata ? result.data.metadata.productTypeCode : 'Unknown';

            const alertContent = `
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
                        <strong>Found:</strong> ${actualProductCount} products
                    </div>
                </div>`;

            // Show alert for longer duration (8 seconds)
            showAlert(alertContent, 'success', 8000);
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

    // Update header badges
    const productTypeCode = data.metadata ? data.metadata.productTypeCode : 'Unknown';
    const productCount = data.metadata ? data.metadata.productCount : 0;

    productTypeLabel.textContent = `Type: ${productTypeCode}`;
    productCountLabel.textContent = `${productCount} Products`;

    // Handle country filtering
    const distinctCountries = data.metadata ? data.metadata.distinctCountries : [];
    if (distinctCountries && distinctCountries.length > 0) {
        setupCountryFilter(distinctCountries);
        countryFilterSection.style.display = 'block';
    } else {
        countryFilterSection.style.display = 'none';
    }

    // Store all products globally for filtering
    window.allProducts = data.products || [];

    if (data.products && data.products.length > 0) {
        // Hide no products message
        noProductsMessage.style.display = 'none';

        // Load stored options data first, then render products
        await loadStoredOptionsData();

        // Initially show all products
        renderFilteredProducts(window.allProducts);

        // Initialize pricing for all rendered options
        setTimeout(() => {
            initializeAllOptionPricing();
            attachPricingEventListeners();
        }, 100);
    } else {
        // Show no products message
        productsContainer.innerHTML = '';
        noProductsMessage.style.display = 'block';
    }

    // Scroll to products section
    productsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Log full product details to console for debugging
    console.log('Full products data:', data.products);
    console.log('Distinct countries:', distinctCountries);
}

/**
 * Setup country filter
 */
function setupCountryFilter(distinctCountries) {
    const countryCheckboxes = document.getElementById('countryCheckboxes');
    countryCheckboxes.innerHTML = '';

    distinctCountries.forEach(country => {
        const checkbox = document.createElement('div');
        checkbox.className = 'form-check form-check-inline';
        checkbox.innerHTML = `
            <input class="form-check-input country-checkbox" type="checkbox" 
                   id="country-${country}" value="${country}" checked 
                   onchange="applyCountryFilter()">
            <label class="form-check-label" for="country-${country}">
                <span class="badge bg-primary">${country}</span>
            </label>
        `;
        countryCheckboxes.appendChild(checkbox);
    });

    // Update counters
    updateCountryFilterCounters();
}

/**
 * Select all countries
 */
function selectAllCountries() {
    const checkboxes = document.querySelectorAll('.country-checkbox');
    checkboxes.forEach(checkbox => checkbox.checked = true);
    applyCountryFilter();
}

/**
 * Deselect all countries
 */
function deselectAllCountries() {
    const checkboxes = document.querySelectorAll('.country-checkbox');
    checkboxes.forEach(checkbox => checkbox.checked = false);
    applyCountryFilter();
}

/**
 * Apply country filter
 */
function applyCountryFilter() {
    if (!window.allProducts) return;

    const selectedCountries = Array.from(document.querySelectorAll('.country-checkbox:checked'))
        .map(cb => cb.value);

    let filteredProducts;
    if (selectedCountries.length === 0) {
        filteredProducts = [];
    } else {
        filteredProducts = window.allProducts.filter(product =>
            selectedCountries.includes(product.CountryIso)
        );
    }

    renderFilteredProducts(filteredProducts);
    updateCountryFilterCounters();
}

/**
 * Update country filter counters
 */
function updateCountryFilterCounters() {
    const selectedCountries = document.querySelectorAll('.country-checkbox:checked').length;
    const visibleProducts = document.querySelectorAll('.product-checkbox').length;

    document.getElementById('filteredCountryCount').textContent = selectedCountries;
    document.getElementById('filteredProductCount').textContent = visibleProducts;
}

// Product rendering and management functions will continue...
// Note: Due to file size limits, I'll create this as a modular structure
