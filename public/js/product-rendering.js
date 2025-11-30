/**
 * Product rendering and management functionality
 */

/**
 * Rounding utility - simplified version for product rendering
 */
const ProductPriceRounding = {
    // Round to 3 decimal places
    toCents: (value) => Math.round(value * 1000) / 1000,

    // Format for display
    format: (value, decimals = 3) => value.toFixed(decimals)
};

/** * Product rendering and management functions for edit page
 */

/**
 * Render filtered products
 */
function renderFilteredProducts(products) {
    try {
        const productsContainer = document.getElementById('productsContainer');
        const noProductsMessage = document.getElementById('noProductsMessage');

        if (products.length === 0) {
            productsContainer.innerHTML = '';
            noProductsMessage.style.display = 'block';
            return;
        }

        noProductsMessage.style.display = 'none';
        productsContainer.innerHTML = '';

        // Create products grid
        const productsGrid = document.createElement('div');
        productsGrid.className = 'row';

        products.forEach((product, index) => {
            const productCard = createProductCard(product, index);
            productsGrid.appendChild(productCard);
        });

        productsContainer.appendChild(productsGrid);

        // Update counters
        if (typeof updateCountryFilterCounters === 'function') {
            updateCountryFilterCounters();
        }

        // Attach event listeners for pricing calculations
        if (typeof attachPricingEventListeners === 'function') {
            attachPricingEventListeners();
        }

        // Update main checkbox state (from product-sync.js)
        if (typeof updateMainCheckboxState === 'function') {
            updateMainCheckboxState();
        }

    } catch (error) {
        const productsContainer = document.getElementById('productsContainer');
        const noProductsMessage = document.getElementById('noProductsMessage');
        if (productsContainer) {
            productsContainer.innerHTML = '<div class="alert alert-danger">Error rendering products. Please try refreshing.</div>';
        }
    }
}

/**
 * Create product card HTML element
 */
function createProductCard(product, index) {
    const productCard = document.createElement('div');
    productCard.className = 'col-12 mb-4';
    productCard.setAttribute('data-country', product.CountryIso);

    const productName = product.Name || product.Description || 'Unknown Product';
    const productCode = product.ProductCode || 'N/A';
    const currencyCode = product.CurrencyCode || 'N/A';
    const countryIso = product.CountryIso || 'N/A';
    const ProductCurrencyCode = product.ProductCurrencyCode || 'N/A';
    const providerCode = product.ProviderCode || 'N/A';
    const productDescription = product.ProductDescription || product.Description || 'No description available';
    const productLogo = product.ProductLogo || null;
    const productOptions = product.ProductOptionsList || [];

    // Validate and fix image URL
    const validImageUrl = validateImageUrl(productLogo);

    // Create enhanced options HTML with pricing details
    let optionsHtml = '';
    if (productOptions && productOptions.length > 0) {
        optionsHtml = createProductOptionsHtml(product, productOptions, index, countryIso, currencyCode);
    }

    // Create the main product card HTML
    productCard.innerHTML = `
        <div class="card border-0 shadow-sm">
            <div class="card-body p-3">
                <!-- Product Selection Checkbox -->
                <div class="form-check mb-3">
                    <input class="form-check-input product-checkbox" type="checkbox" 
                           value="${productCode}" id="product-${index}" 
                           data-product='${JSON.stringify(product).replace(/'/g, "&#39;")}' 
                           onchange="togglePricingConfig(this); updateSelectedCount();">
                    <label class="form-check-label fw-bold text-primary" for="product-${index}">
                        ${productName}
                    </label>
                </div>

                <!-- Product Info Grid -->
                <div class="row g-3 mb-3">
                    <div class="col-12 col-md-6">
                        <div class="d-flex flex-wrap gap-2">
                            <span class="badge bg-secondary"><i class="fas fa-barcode"></i> ${productCode}</span>
                            <span class="badge bg-info"><i class="fas fa-globe"></i> ${countryIso}</span>
                            <span class="badge bg-success"><i class="fas fa-building"></i> ${providerCode}</span>
                            <span class="badge bg-warning text-dark"><i class="fas fa-money-bill"></i> ${currencyCode}</span>
                        </div>
                    </div>
                    <div class="col-12 col-md-6">
                        <div class="d-flex flex-column flex-sm-row align-items-start align-items-sm-center">
                            ${validImageUrl ? createImageElement(validImageUrl, productName, index) : '<span class="text-muted small"><i class="fas fa-image"></i> No image</span>'}
                            <span class="options-count-badge badge bg-primary mt-2 mt-sm-0 ms-sm-2">
                                <i class="fas fa-list"></i> ${productOptions.length} Options
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Product Description -->
                <p class="text-muted small mb-3">${productDescription}</p>

                ${optionsHtml}
            </div>
        </div>
    `;

    return productCard;
}

/**
 * Create product options HTML
 */
function createProductOptionsHtml(product, productOptions, index, countryIso, currencyCode) {
    let optionsHtml = `
        <div class="mt-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <strong class="text-success">
                    <i class="fas fa-list"></i> Product Options (${productOptions.length})
                </strong>
                <button class="btn btn-sm btn-outline-primary" type="button" 
                        data-bs-toggle="collapse" 
                        data-bs-target="#options-${index}" 
                        aria-expanded="false">
                    <i class="fas fa-eye"></i> View Options & Pricing
                </button>
            </div>
            <div class="collapse" id="options-${index}">
                <div class="card card-body p-2" style="max-height: 400px; overflow-y: auto;">
    `;

    productOptions.forEach((option, optionIndex) => {
        optionsHtml += createOptionHtml(product, option, optionIndex, countryIso);
    });

    optionsHtml += `
                </div>
            </div>
        </div>
    `;

    return optionsHtml;
}

/**
 * Create individual option HTML
 */
function createOptionHtml(product, option, optionIndex, countryIso) {
    const baseName = option.Name || option.Description || `Option ${optionIndex + 1}`;
    const optionName = `${baseName} (${countryIso})`;
    const optionCode = option.ProductOptionCode || 'N/A';
    const optionSku = option.EanSkuUpc || 'N/A';

    // Get original price in USD from MinMaxRangeValue
    let originalPriceUSD = 0;
    let faceValue = 'N/A';
    if (option.MinMaxRangeValue) {
        originalPriceUSD = option.MinMaxRangeValue.MinValue || option.MinMaxRangeValue.MaxValue || 0;
    }

    // Get face value from MinMaxFaceRangeValue
    if (option.MinMaxFaceRangeValue) {
        faceValue = option.MinMaxFaceRangeValue.MinFaceValue || option.MinMaxFaceRangeValue.MaxFaceValue || 'N/A';
        if (faceValue !== 'N/A') {
            faceValue = parseFloat(faceValue);
        }
    }

    // Calculate store currency price
    const conversionRate = parseFloat(window.storeData?.currency_conversion_rate) || 3.75;
    const storeCurrencyCode = window.storeData?.salla_currency || 'SAR';

    // Calculate wholesale price from MinWholesaleValue if available, otherwise calculate from MinValue and discount
    let wholesalePriceUSD = 0;
    if (option.MinMaxRangeValue && option.MinMaxRangeValue.MinWholesaleValue) {
        wholesalePriceUSD = option.MinMaxRangeValue.MinWholesaleValue;
    } else {
        // Calculate: MinValue - (MinValue × Discount)
        const discount = parseFloat(product.Discount || 0);
        wholesalePriceUSD = originalPriceUSD - (originalPriceUSD * discount);
    }

    const storeCurrencyPrice = wholesalePriceUSD * conversionRate;
    const retailPriceInStoreCurrency = originalPriceUSD * conversionRate;

    // Get initial markup percentage from product discount (discount * 100)
    const initialMarkupPercentage = parseFloat(product.Discount || 0) * 100;

    // Ensure calculated values are valid numbers and rounded
    const validStoreCurrencyPrice = isNaN(storeCurrencyPrice) ? 0 : storeCurrencyPrice;
    const validRetailPriceInStoreCurrency = isNaN(retailPriceInStoreCurrency) ? 0 : retailPriceInStoreCurrency;
    const validInitialMarkupPercentage = isNaN(initialMarkupPercentage) ? 0 : initialMarkupPercentage;

    // Check if option exists in database
    const storedOption = (window.storedOptionsData && window.storedOptionsData[optionCode]) ? window.storedOptionsData[optionCode] : null;
    let displayCustomPrice, displayMarkupPercentage, existsInDb = false, optionCardClass = '';

    if (storedOption) {
        // Use database values with rounding
        displayCustomPrice = (storedOption.customPrice !== null && storedOption.customPrice !== undefined)
            ? parseFloat(storedOption.customPrice)
            : validRetailPriceInStoreCurrency; // Use retail price as default, not wholesale
        displayMarkupPercentage = (storedOption.markupPercentage !== null && storedOption.markupPercentage !== undefined)
            ? parseFloat(storedOption.markupPercentage)
            : validInitialMarkupPercentage;

        displayCustomPrice = isNaN(displayCustomPrice) ? validRetailPriceInStoreCurrency : displayCustomPrice;
        displayMarkupPercentage = isNaN(displayMarkupPercentage) ? validInitialMarkupPercentage : displayMarkupPercentage;

        existsInDb = true;
        optionCardClass = 'exists-in-db';
    } else {
        // For new options, start with retail price as base (which includes the discount markup)
        displayCustomPrice = validRetailPriceInStoreCurrency; // This is retail price in store currency
        displayMarkupPercentage = validInitialMarkupPercentage; // Use the discount percentage as initial markup
    }

    return `
        <div class="border rounded p-2 mb-2 bg-white shadow-sm option-card ${optionCardClass}" data-option-code="${optionCode}" style="height: auto; min-height: auto;">
            ${existsInDb ? '<div class="position-absolute top-0 end-0 p-1" style="z-index: 20;"><span class="badge exists-in-db-badge small"><i class="fas fa-database me-1"></i>Exists in DB</span></div>' : ''}
            
            <!-- Mobile-Optimized Option Header -->
            <div class="row mb-2">
                <div class="col-12">
                    <!-- Responsive header: stacks on small screens -->
                    <div class="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between mb-2">
                        <div class="d-flex align-items-center mb-2 mb-sm-0 w-100 w-sm-auto">
                            <div class="form-check form-switch me-3">
                                <input class="form-check-input option-checkbox" type="checkbox" 
                                       role="switch" id="option-${optionCode}" 
                                       data-option-code="${optionCode}"
                                       onchange="updateMainProductCheckboxState(this); updateSelectedCount();">
                                <label class="form-check-label fw-medium text-success small" for="option-${optionCode}">
                                    Include
                                </label>
                            </div>
                            <h6 class="text-primary mb-0 fw-bold me-2 flex-grow-1">${optionName}</h6>
                        </div>
                        <small class="text-muted align-self-end align-self-sm-center">
                            <i class="fas fa-code me-1"></i><span class="fw-medium">${optionCode}</span>
                        </small>
                    </div>
                    <!-- Badges row -->
                    <div class="d-flex flex-wrap gap-2">
                        <span class="badge bg-info small">
                            <i class="fas fa-barcode me-1"></i>${optionSku}
                        </span>
                        <span class="badge bg-secondary small">
                            <i class="fas fa-coins me-1"></i>Face: ${faceValue} ${product.ProductCurrencyCode || 'BRL'}
                        </span>
                    </div>
                </div>
            </div>
            
            <!-- Mobile-Optimized Pricing Section -->
            <div class="pricing-section">
                <h6 class="text-success mb-2 d-flex align-items-center">
                    <i class="fas fa-dollar-sign me-2"></i>Pricing Details
                </h6>
                
                <!-- Responsive Pricing Controls -->
                <div class="pricing-controls-container p-3 bg-light rounded mb-2">
                    <div class="row g-3">
                        <!-- Custom Price - Full width on mobile -->
                        <div class="col-12 col-md-4">
                            <label class="form-label small fw-bold text-dark mb-2">
                                <i class="fas fa-edit me-1 text-primary"></i>Custom Price (${storeCurrencyCode})
                            </label>
                            <div class="input-group input-group-sm shadow-sm">
                                <span class="input-group-text bg-white">
                                    <i class="fas fa-coins text-success"></i>
                                </span>
                                <input type="number" 
                                       class="form-control custom-price-input ${existsInDb ? 'border-success' : ''}" 
                                       placeholder="${displayCustomPrice.toFixed(2)}" 
                                       value="${displayCustomPrice.toFixed(2)}"
                                       step="0.01" 
                                       data-original-price="${originalPriceUSD}"
                                       data-original-discount="${product.Discount || 0}"
                                       data-store-price="${storeCurrencyPrice}"
                                       data-retail-price="${validRetailPriceInStoreCurrency}">
                            </div>
                        </div>
                        
                        <!-- Markup -->
                        <div class="col-12 col-md-3">
                            <label class="form-label small fw-bold text-dark mb-2">
                                <i class="fas fa-percentage me-1 text-warning"></i>Markup (%)
                            </label>
                            <div class="input-group input-group-sm shadow-sm">
                                <input type="number" 
                                       class="form-control markup-input ${existsInDb ? 'border-success' : ''}" 
                                       placeholder="${displayMarkupPercentage}" 
                                       value="${displayMarkupPercentage}"
                                       step="0.1" 
                                       min="0" 
                                       max="1000">
                                <span class="input-group-text bg-white">
                                    <i class="fas fa-percent text-warning"></i>
                                </span>
                            </div>
                        </div>
                        
                        <!-- Final Sale Price -->
                        <div class="col-12 col-md-5">
                            <label class="form-label small fw-bold text-dark mb-2">
                                <i class="fas fa-calculator me-1 text-success"></i>Final Price
                            </label>
                            <div class="d-flex align-items-center">
                                <span class="d-inline-block text-center px-3 py-2 bg-white rounded border border-success shadow-sm w-100" style="max-width: 200px;">
                                    <strong class="text-success final-price-display">${displayCustomPrice.toFixed(2)} ${storeCurrencyCode}</strong>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Mobile-Optimized Pricing Breakdown -->
                <div class="pricing-info-display p-2 bg-light rounded border">
                    <div class="row g-2">
                        <div class="col-12 col-sm-6">
                            <div class="d-flex align-items-center justify-content-between">
                                <strong class="text-success me-2">Wholesale:</strong>
                                <div class="d-flex gap-1">
                                    <span class="badge bg-light text-dark border">${wholesalePriceUSD.toFixed(4)} USD</span>
                                    <span class="badge bg-success">${storeCurrencyPrice.toFixed(2)} ${storeCurrencyCode}</span>
                                </div>
                            </div>
                        </div>
                        <div class="col-12 col-sm-6">
                            <div class="d-flex align-items-center justify-content-between">
                                <strong class="text-secondary me-2">Retail:</strong>
                                <div class="d-flex gap-1">
                                    <span class="badge bg-light text-dark border">${originalPriceUSD.toFixed(4)} USD</span>
                                    <span class="badge bg-secondary">${validRetailPriceInStoreCurrency.toFixed(2)} ${storeCurrencyCode}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Status Footer -->
            <div class="row mt-2 pt-2 border-top">
                <div class="col-12 text-end">
                    ${existsInDb ?
            '<small class="text-success fw-bold"><i class="fas fa-check-circle me-1"></i>Saved in Database</small>' :
            '<small class="text-muted"></small>'
        }
                </div>
            </div>
        </div>
    `;

    return optionCard;
}

/**
 * Validate and fix image URL
 */
function validateImageUrl(url) {
    if (!url) return null;

    // Handle relative URLs
    if (url.startsWith('//')) {
        return 'https:' + url;
    }

    // Handle URLs without protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return 'https://' + url;
    }

    return url;
}

/**
 * Create image element with error handling
 */
function createImageElement(imageUrl, altText, index) {
    return `<img src="${imageUrl}" 
                 alt="${altText}" 
                 class="img-thumbnail product-image" 
                 style="max-width: 60px; max-height: 40px; opacity: 0.8;" 
                 onerror="handleImageError(this, ${index})"
                 onload="handleImageLoad(this, ${index})">`;
}

/**
 * Handle image load error
 */
function handleImageError(imgElement, index) {
    console.warn(`Image failed to load for product ${index}:`, imgElement.src);
    imgElement.style.display = 'none';

    // Add a placeholder icon
    const placeholder = document.createElement('span');
    placeholder.className = 'text-muted small';
    placeholder.innerHTML = '<i class="fas fa-image-slash"></i> Image unavailable';
    imgElement.parentNode.insertBefore(placeholder, imgElement);
}

/**
 * Handle successful image load
 */
function handleImageLoad(imgElement, index) {
    console.log(`Image loaded successfully for product ${index}:`, imgElement.src);
    imgElement.style.opacity = '1';
}
