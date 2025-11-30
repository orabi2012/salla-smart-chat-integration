/**
 * Navbar specific JavaScript functionality
 * Handles navbar dropdown initialization with special configuration for visibility
 */

/**
 * Initialize navbar dropdowns with enhanced configuration
 */
function initializeNavbarDropdowns() {
    var dropdownElementList = [].slice.call(document.querySelectorAll('.dropdown-toggle'));
    var dropdownList = dropdownElementList.map(function (dropdownToggleEl) {
        return new bootstrap.Dropdown(dropdownToggleEl, {
            boundary: 'viewport',
            popperConfig: {
                modifiers: [
                    {
                        name: 'offset',
                        options: {
                            offset: [0, 4],
                        },
                    },
                    {
                        name: 'preventOverflow',
                        options: {
                            boundary: 'viewport',
                        },
                    },
                ],
                strategy: 'fixed'
            }
        });
    });

    // Additional CSS fix for dropdown visibility
    dropdownElementList.forEach(function (toggle) {
        toggle.addEventListener('show.bs.dropdown', function () {
            const dropdownMenu = this.nextElementSibling;
            if (dropdownMenu) {
                dropdownMenu.style.zIndex = '9999';
                dropdownMenu.style.position = 'absolute';
            }
        });
    });

    return dropdownList;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    initializeNavbarDropdowns();
});
