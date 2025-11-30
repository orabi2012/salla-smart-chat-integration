/**
 * Bootstrap initialization utilities
 * Common Bootstrap component initialization that's used across multiple pages
 */

/**
 * Initialize Bootstrap tooltips
 */
function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    return tooltipList;
}

/**
 * Initialize Bootstrap dropdowns
 * Excludes navbar dropdowns to avoid conflicts with navbar.js
 */
function initializeDropdowns() {
    // Select dropdown toggles that are NOT in the navbar
    var dropdownElementList = [].slice.call(document.querySelectorAll('.dropdown-toggle:not(.navbar .dropdown-toggle)'));
    var dropdownList = dropdownElementList.map(function (dropdownToggleEl) {
        return new bootstrap.Dropdown(dropdownToggleEl);
    });

    return dropdownList;
}

/**
 * Initialize all Bootstrap components
 */
function initializeBootstrapComponents() {
    initializeTooltips();
    initializeDropdowns();
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    initializeBootstrapComponents();
});
