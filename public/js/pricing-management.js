/**
 * Pricing management functionality for product options
 */

// Global variables for pricing management
let storedOptionsData = {};
let debounceTimers = {};
let isLoadingExistingData = false; // Flag to prevent database updates during data loading

/**
 * Rounding utility functions
 */
const PriceRounding = {
    // Round to 3 decimal places
    toCents: (value) => Math.round(value * 1000) / 1000,

    // Round to nearest 0.05 (nickel rounding)
    toNickel: (value) => Math.round(value * 20) / 20,

    // Round to nearest 0.25 (quarter rounding)
    toQuarter: (value) => Math.round(value * 4) / 4,

    // Round to nearest whole number
    toWhole: (value) => Math.round(value),

    // Round up to 3 decimal places (always round up)
    ceilToCents: (value) => Math.ceil(value * 1000) / 1000,

    // Round down to 3 decimal places (always round down)
    floorToCents: (value) => Math.floor(value * 1000) / 1000,

    // Smart rounding - rounds to sensible increments based on value
    smart: (value) => {
        if (value < 1) return PriceRounding.toCents(value);
        if (value < 10) return PriceRounding.toNickel(value);
        if (value < 100) return PriceRounding.toQuarter(value);
        return PriceRounding.toWhole(value);
    },

    // Format for display with 3 decimal places
    format: (value, currency = 'SAR') => {
        return value + ` ${currency}`;
    },

    // Format pricing breakdown for display
    formatBreakdown: (retailUSD, wholesaleUSD, retailStore, wholesaleStore, conversionRate, storeCurrency = 'SAR') => {
        return {
            retail: {
                usd: `${retailUSD} USD`,
                store: `${retailStore} ${storeCurrency}`
            },
            wholesale: {
                usd: `${wholesaleUSD} USD`,
                store: `${wholesaleStore} ${storeCurrency}`
            },
            conversion: `1 USD = ${conversionRate} ${storeCurrency}`
        };
    }
};

/**
 * Update pricing information display for better user visibility
 */
function updatePricingInfoDisplay(optionCard, originalRetailPrice, wholesalePriceUSD, conversionRate) {
    // Check if pricing info display exists, if not create it
    let pricingInfo = optionCard.querySelector('.pricing-info-display');
    if (!pricingInfo) {
        // Create pricing info display element
        const pricingSection = optionCard.querySelector('.pricing-section');
        if (pricingSection) {
            pricingInfo = document.createElement('div');
            pricingInfo.className = 'pricing-info-display mt-2 p-2 bg-light rounded border';
            pricingSection.appendChild(pricingInfo);
        }
    }

    if (pricingInfo) {
        const storeCurrency = window.storeData?.salla_currency || 'SAR';
        const retailStorePrice = originalRetailPrice * conversionRate;
        const wholesaleStorePrice = wholesalePriceUSD * conversionRate;

        pricingInfo.innerHTML = `
            <div class="d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center">
                    <strong class="text-success me-2">Wholesale</strong>
                    <span class="d-inline-block text-center px-1 py-0 bg-white rounded border text-muted me-1" style="font-size: 0.8rem;">
                        <strong class="text-muted">${wholesalePriceUSD}</strong>
                        <small class="text-muted ms-1">USD</small>
                    </span>
                    <span class="d-inline-block text-center px-1 py-0 bg-white rounded border border-success" style="font-size: 0.8rem;">
                        <strong class="text-success">${wholesaleStorePrice}</strong>
                        <small class="text-muted ms-1">${storeCurrency}</small>
                    </span>
                </div>
                <div class="d-flex align-items-center">
                    <strong class="text-secondary me-2">Retail</strong>
                    <span class="d-inline-block text-center px-1 py-0 bg-white rounded border text-muted me-1" style="font-size: 0.8rem;">
                        <strong class="text-muted">${originalRetailPrice}</strong>
                        <small class="text-muted ms-1">USD</small>
                    </span>
                    <span class="d-inline-block text-center px-1 py-0 bg-white rounded border border-success" style="font-size: 0.8rem;">
                        <strong class="text-success">${retailStorePrice}</strong>
                        <small class="text-muted ms-1">${storeCurrency}</small>
                    </span>
                </div>
            </div>
        `;
    }
}

/**
 * Load stored options data from database
 */
async function loadStoredOptionsData() {
    try {
        const storeId = window.storeData?.id;
        if (!storeId) {
            window.storedOptionsData = {};
            return;
        }

        const { response, result } = await apiCall(`/salla-stores/${storeId}/stored-options`);

        if (response.ok) {
            storedOptionsData = result.data || {};
            window.storedOptionsData = storedOptionsData;
        } else {
            window.storedOptionsData = {};
        }
    } catch (error) {
        window.storedOptionsData = {};
    }
}

/**
 * Initialize option pricing with stored data
 */
function initializeOptionPricing(optionCard, optionCode) {
    const storedOption = storedOptionsData[optionCode];
    const customPriceInput = optionCard.querySelector('.custom-price-input');
    const markupInput = optionCard.querySelector('.markup-input');

    if (!storedOption) {
        return;
    }

    // Values are already set during HTML generation, just add the option ID
    optionCard.setAttribute('data-option-id', storedOption.id);

    // Set status to indicate this option is ready
    const syncStatus = optionCard.querySelector('.sync-status small');
    if (syncStatus) {
        syncStatus.innerHTML = '<i class="fas fa-sync text-success"></i> Ready';
    }

    // Update final price display to ensure it matches
    updateFinalPrice(customPriceInput);

    // Always show the pricing breakdown on initialization
    const originalRetailPrice = parseFloat(customPriceInput.getAttribute('data-original-price')) || 0;
    const originalDiscount = parseFloat(customPriceInput.getAttribute('data-original-discount')) || 0;
    const wholesalePriceUSD = originalRetailPrice - (originalRetailPrice * originalDiscount);
    const conversionRate = window.storeData?.currency_conversion_rate || 3.75;

    updatePricingInfoDisplay(optionCard, originalRetailPrice, wholesalePriceUSD, conversionRate);
}

/**
 * Initialize pricing for all option cards on the page
 */
function initializeAllOptionPricing() {
    document.querySelectorAll('.option-card').forEach(optionCard => {
        const optionCode = optionCard.getAttribute('data-option-code');
        if (optionCode) {
            initializeOptionPricing(optionCard, optionCode);
        }
    });
}

/**
 * Recalculate markup for all options when currency rate changes
 */
function recalculateAllMarkupsForCurrencyChange() {
    console.log('🔄 Recalculating markup for all options due to currency rate change...');

    document.querySelectorAll('.option-card').forEach(optionCard => {
        const customPriceInput = optionCard.querySelector('.custom-price-input');
        const markupInput = optionCard.querySelector('.markup-input');

        if (customPriceInput && markupInput) {
            // Get current values
            const customPrice = parseFloat(customPriceInput.value) || 0;

            // Get original pricing data
            const originalRetailPrice = parseFloat(customPriceInput.getAttribute('data-original-price')) || 0;
            const originalDiscount = parseFloat(customPriceInput.getAttribute('data-original-discount')) || 0;

            // Calculate wholesale price with new conversion rate
            const wholesalePriceUSD = originalRetailPrice - (originalRetailPrice * originalDiscount);
            const conversionRate = window.storeData?.currency_conversion_rate || 3.75;
            const wholesalePriceStore = wholesalePriceUSD * conversionRate;

            // Recalculate markup based on fixed custom price
            if (wholesalePriceStore > 0) {
                const difference = customPrice - wholesalePriceStore;
                const newMarkupPercentage = (difference / wholesalePriceStore) * 100;

                // Update markup input
                markupInput.value = newMarkupPercentage.toFixed(2);

                // Update visual indicators
                updateFinalPriceWithBinding(customPriceInput, true);

                console.log(`✅ Updated markup for option: Custom=${customPrice}, Wholesale=${wholesalePriceStore.toFixed(2)}, Markup=${newMarkupPercentage.toFixed(2)}%`);
            }
        }
    });
}

/**
 * Handle blur events for input fields
 * Performs final formatting and triggers database updates
 */
function handleInputBlur(event) {
    // Call the pricing update with formatting enabled
    updateFinalPriceWithBinding(event.target, true);
}

/**
 * Attach event listeners for pricing calculations
 */
function attachPricingEventListeners() {
    const inputs = document.querySelectorAll('.custom-price-input, .markup-input');

    inputs.forEach(input => {
        input.removeEventListener('input', updateFinalPriceWithBinding);
        input.removeEventListener('blur', handleInputBlur);

        // Use input event for real-time calculations (without modifying input value)
        input.addEventListener('input', function () {
            updateFinalPriceWithBinding(this, false); // false = don't format input value
        });

        // Use blur event for final formatting and saving
        input.addEventListener('blur', handleInputBlur);
    });
}

/**
 * Calculate and display final price
 */
function updateFinalPrice(input) {
    const optionCard = input.closest('.option-card');
    const customPriceInput = optionCard.querySelector('.custom-price-input');
    const markupInput = optionCard.querySelector('.markup-input');
    const finalPriceDisplay = optionCard.querySelector('.final-price-display');

    let customPrice = parseFloat(customPriceInput.value) || 0;
    let markupPercent = parseFloat(markupInput.value) || 0;

    // Round the values to avoid floating point issues
    customPrice = PriceRounding.toCents(customPrice);
    markupPercent = PriceRounding.toCents(markupPercent);

    // Final price is simply the custom price (already rounded)
    const finalPrice = customPrice;

    const storeCurrencyCode = window.storeData?.salla_currency || 'SAR';
    finalPriceDisplay.textContent = `${finalPrice.toFixed(2)} ${storeCurrencyCode}`;

    // Update the color based on markup - handle negative values
    if (markupPercent < 0) {
        finalPriceDisplay.classList.remove('text-success', 'text-warning');
        finalPriceDisplay.classList.add('text-danger');
        markupInput.classList.remove('border-success', 'border-warning');
        markupInput.classList.add('border-danger');
        markupInput.style.backgroundColor = '#fff5f5';
    } else if (markupPercent > 0) {
        finalPriceDisplay.classList.remove('text-success', 'text-danger');
        finalPriceDisplay.classList.add('text-warning');
        markupInput.classList.remove('border-success', 'border-danger');
        markupInput.classList.add('border-warning');
        markupInput.style.backgroundColor = '';
    } else {
        finalPriceDisplay.classList.remove('text-warning', 'text-danger');
        finalPriceDisplay.classList.add('text-success');
        markupInput.classList.remove('border-warning', 'border-danger');
        markupInput.classList.add('border-success');
        markupInput.style.backgroundColor = '';
    }
}

/**
 * Enhanced updateFinalPrice with API calls for two-way binding
 * @param {HTMLElement} input - The input element that triggered the change
 * @param {boolean} formatInput - Whether to format the input value (should be false during typing, true on blur)
 */
function updateFinalPriceWithBinding(input, formatInput = false) {
    const optionCard = input.closest('.option-card');
    const customPriceInput = optionCard.querySelector('.custom-price-input');
    const markupInput = optionCard.querySelector('.markup-input');
    const finalPriceDisplay = optionCard.querySelector('.final-price-display');
    const optionId = optionCard.getAttribute('data-option-id');

    let customPrice = parseFloat(customPriceInput.value) || 0;
    let markupPercent = parseFloat(markupInput.value) || 0;

    // Get the original prices from data attributes
    const originalRetailPrice = parseFloat(customPriceInput.getAttribute('data-original-price')) || 0; // MinValue in USD
    const originalDiscount = parseFloat(customPriceInput.getAttribute('data-original-discount')) || 0; // Discount as decimal

    // Calculate wholesale price: RetailPrice - (RetailPrice × Discount)
    const wholesalePriceUSD = originalRetailPrice - (originalRetailPrice * originalDiscount);

    // Convert to store currency
    const conversionRate = window.storeData?.currency_conversion_rate || 3.75;
    const wholesalePriceStore = wholesalePriceUSD * conversionRate;
    const retailPriceStore = originalRetailPrice * conversionRate;

    // Create comprehensive pricing breakdown for logging
    const retailStorePrice = originalRetailPrice * conversionRate;
    const pricingBreakdown = PriceRounding.formatBreakdown(
        originalRetailPrice, wholesalePriceUSD,
        retailStorePrice, wholesalePriceStore,
        conversionRate, window.storeData?.salla_currency || 'SAR'
    );

    // Update the pricing info display for user visibility
    updatePricingInfoDisplay(optionCard, originalRetailPrice, wholesalePriceUSD, conversionRate);

    // Two-way binding logic
    if (input.classList.contains('custom-price-input')) {
        // User changed custom price -> calculate new markup percentage based on wholesale price
        if (wholesalePriceStore > 0) {
            // Only format the input value when not actively typing
            if (formatInput) {
                customPrice = PriceRounding.toCents(customPrice);
                customPriceInput.value = customPrice.toFixed(2);
            }

            // Markup % = ((Custom Price - Wholesale Price) / Wholesale Price) × 100
            const difference = customPrice - wholesalePriceStore;
            const newMarkupPercentage = (difference / wholesalePriceStore) * 100;
            markupPercent = newMarkupPercentage; // Allow negative markup
            markupInput.value = markupPercent.toFixed(2);
        }
    } else if (input.classList.contains('markup-input')) {
        // User changed markup percentage -> calculate new custom price based on wholesale price
        // Only format when not actively typing
        if (formatInput) {
            markupInput.value = markupPercent.toFixed(2);
        }

        // Custom Price = Wholesale Price + (Wholesale Price × Markup% / 100)
        const markupAmount = wholesalePriceStore * markupPercent / 100;
        customPrice = wholesalePriceStore + markupAmount;
        customPriceInput.value = customPrice.toFixed(2);
    }

    // Final price is simply the custom price (already rounded)
    const finalPrice = customPrice;
    const storeCurrencyCode = window.storeData?.salla_currency || 'SAR';
    finalPriceDisplay.textContent = `${finalPrice.toFixed(2)} ${storeCurrencyCode}`;

    // Auto-select option when custom price is set
    autoSelectOptionOnPriceSet(optionCard, customPrice);

    // Update color based on markup - allow negative markup with red color
    if (markupPercent < 0) {
        // Negative markup - show in red (loss)
        finalPriceDisplay.classList.remove('text-success', 'text-warning');
        finalPriceDisplay.classList.add('text-danger');
        markupInput.classList.remove('border-success', 'border-warning');
        markupInput.classList.add('border-danger');

        // Add visual indicator for negative markup
        markupInput.style.backgroundColor = '#fff5f5';
    } else if (markupPercent > 0) {
        // Positive markup - show in warning color
        finalPriceDisplay.classList.remove('text-success', 'text-danger');
        finalPriceDisplay.classList.add('text-warning');
        markupInput.classList.remove('border-success', 'border-danger');
        markupInput.classList.add('border-warning');

        // Reset background color
        markupInput.style.backgroundColor = '';
    } else {
        // Zero markup - show in success color
        finalPriceDisplay.classList.remove('text-warning', 'text-danger');
        finalPriceDisplay.classList.add('text-success');
        markupInput.classList.remove('border-warning', 'border-danger');
        markupInput.classList.add('border-success');

        // Reset background color
        markupInput.style.backgroundColor = '';
    }

    // Debounced API call for database update
    const optionCode = optionCard.getAttribute('data-option-code');
    if (optionCode) {
        const debounceKey = (optionId || optionCode) + '_' + input.className;

        // Clear existing timer
        if (debounceTimers[debounceKey]) {
            clearTimeout(debounceTimers[debounceKey]);
        }

        // Set new timer - but only if we're not loading existing data
        debounceTimers[debounceKey] = setTimeout(async () => {
            if (!isLoadingExistingData && !window.isLoadingExistingData) {
                await updateOptionInDatabase(input, optionId, customPrice, markupPercent);
            }
        }, 1000); // 1 second debounce
    }
}

/**
 * Update option in database via API
 */
async function updateOptionInDatabase(input, optionId, customPrice, markupPercent) {
    try {
        const storeId = window.storeData?.id;
        if (!storeId) return;

        const optionCard = input.closest('.option-card');
        const optionCode = optionCard.getAttribute('data-option-code');

        let endpoint, payload;

        // If no optionId exists, create the option first
        if (!optionId || optionId === 'null' || optionId === 'undefined') {
            // Create new option
            endpoint = `/salla-stores/${storeId}/create-option`;
            payload = {
                optionCode: optionCode,
                customPrice: customPrice,
                markupPercentage: markupPercent
            };
        } else {
            // Update existing option
            if (input.classList.contains('custom-price-input')) {
                endpoint = `/salla-stores/${storeId}/update-option-custom-price`;
                payload = { optionId: optionId, customPrice: customPrice };
            } else if (input.classList.contains('markup-input')) {
                endpoint = `/salla-stores/${storeId}/update-option-markup`;
                payload = { optionId: optionId, markupPercentage: markupPercent };
            }
        }

        if (endpoint) {
            const { response, result } = await apiCall(endpoint, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (response.ok && result.success) {
                // Update the option ID if it was newly created
                if (!optionId && result.data && result.data.optionId) {
                    optionCard.setAttribute('data-option-id', result.data.optionId);
                }
            }
        }
    } catch (error) {
        // Error updating option
    }
}

/**
 * Initialize auto-save functionality
 */
function initializeAutoSave() {
    let saveTimeout;
    const formInputs = document.querySelectorAll('input, select, textarea');

    formInputs.forEach(input => {
        input.addEventListener('change', function () {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                // Could implement auto-save to localStorage here
            }, 2000);
        });
    });
}

/**
 * Auto-select option checkbox when custom price is set
 * @param {HTMLElement} optionCard - The option card element
 * @param {number} customPrice - The custom price value
 */
function autoSelectOptionOnPriceSet(optionCard, customPrice) {
    // Only auto-select if custom price is greater than 0
    if (customPrice > 0) {
        const optionCheckbox = optionCard.querySelector('.option-checkbox');

        if (optionCheckbox && !optionCheckbox.checked) {
            console.log('🎯 Auto-selecting option due to custom price set:', customPrice);

            // Set flag to prevent infinite loops and conflicts with other checkbox logic
            const originalValue = window.isUpdatingProgrammatically || false;
            window.isUpdatingProgrammatically = true;

            // Check the option checkbox
            optionCheckbox.checked = true;

            // Update the main product checkbox state if needed
            if (typeof updateMainProductCheckboxState === 'function') {
                updateMainProductCheckboxState(optionCheckbox);
            }

            // Update the selected count badge and sync button
            if (typeof updateSelectedCount === 'function') {
                updateSelectedCount();
            }

            // Visual feedback - briefly highlight the checkbox
            optionCheckbox.style.transform = 'scale(1.1)';
            optionCheckbox.style.transition = 'transform 0.2s';
            setTimeout(() => {
                optionCheckbox.style.transform = '';
                optionCheckbox.style.transition = '';
            }, 200);

            // Show a brief toast notification
            if (typeof showToast === 'function') {
                showToast('Option auto-selected due to custom price', 'info', 2000);
            }

            // Restore the original flag state
            window.isUpdatingProgrammatically = originalValue;
        }
    }
}
