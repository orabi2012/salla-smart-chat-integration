/**
 * Common utility functions shared across pages
 */

// Global store data (will be initialized by page-specific scripts)
window// Initialize logout functionality when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    initializeLogout();
    setupGlobalFetchInterceptor();
});

/**
 * Setup global fetch interceptor to handle 401 responses
 */
function setupGlobalFetchInterceptor() {
    // Store the original fetch function
    const originalFetch = window.fetch;

    // Override the global fetch function
    window.fetch = async function (...args) {
        try {
            const response = await originalFetch.apply(this, args);

            // Check for 401 Unauthorized responses
            if (response.status === 401) {
                console.log('Received 401 Unauthorized, redirecting to login...');
                window.location.href = '/auth/login';
                return response;
            }

            return response;
        } catch (error) {
            // Re-throw the error if it's not related to authentication
            throw error;
        }
    };
} reData = {};

/**
 * Helper function to show alerts (legacy - use showToast for modern UI)
 */
function showAlert(message, type = 'info', duration = 5000) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());

    const alertClass = type === 'success' ? 'alert-success' :
        type === 'error' ? 'alert-danger' :
            type === 'warning' ? 'alert-warning' :
                'alert-info';

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${alertClass} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const container = document.querySelector('.container, .container-fluid');
    if (container) {
        container.insertBefore(alertDiv, container.firstChild);
    }

    // Auto-dismiss after specified duration
    setTimeout(() => {
        if (alertDiv && alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, duration);
}

/**
 * Show confirmation dialog
 */
function showConfirmDialog(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
    return new Promise((resolve) => {
        // Create modal HTML
        const modalId = 'dynamicConfirmModal-' + Date.now();
        const modalHtml = `
            <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-warning text-dark">
                            <h5 class="modal-title" id="${modalId}Label">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                ${title}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            ${message}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${cancelText}</button>
                            <button type="button" class="btn btn-warning" id="${modalId}Confirm">${confirmText}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalElement = document.getElementById(modalId);
        const modal = new bootstrap.Modal(modalElement);

        // Handle confirm button
        document.getElementById(modalId + 'Confirm').addEventListener('click', () => {
            modal.hide();
            resolve(true);
        });

        // Handle cancel/close
        modalElement.addEventListener('hidden.bs.modal', () => {
            modalElement.remove();
            resolve(false);
        });

        // Show modal
        modal.show();
    });
}

/**
 * Modern toast notification function
 */
function showToast(message, type = 'info', duration = 5000) {
    const toastHtml = `
        <div class="toast align-items-center text-white bg-${type === 'success' ? 'success' : type === 'warning' ? 'warning' : type === 'error' ? 'danger' : 'info'} border-0" role="alert" data-bs-autohide="true" data-bs-delay="${duration}">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;

    // Add to page if toast container doesn't exist
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '1200'; // Ensure it's above modals
        document.body.appendChild(container);
    }

    // Add toast
    container.insertAdjacentHTML('beforeend', toastHtml);

    // Show toast
    const toastElement = container.lastElementChild;
    const toast = new bootstrap.Toast(toastElement);
    toast.show();

    // Remove after hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

/**
 * Utility function to make API calls with error handling
 */
async function apiCall(url, options = {}) {
    try {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        const response = await fetch(url, mergedOptions);

        // Handle 401 Unauthorized responses
        if (response.status === 401) {
            // Clear any local auth state and redirect to login
            window.location.href = '/auth/login';
            return { response, result: null, success: false, unauthorized: true };
        }

        const result = await response.json();

        return { response, result, success: response.ok };
    } catch (error) {
        console.error('API call error:', error);
        return { error, success: false };
    }
}

/**
 * Utility function to update button state during async operations
 */
function setButtonLoading(button, loading = true, originalText = null) {
    if (loading) {
        if (!button.hasAttribute('data-original-text')) {
            button.setAttribute('data-original-text', button.innerHTML);
        }
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        button.disabled = true;
    } else {
        const original = originalText || button.getAttribute('data-original-text') || 'Submit';
        button.innerHTML = original;
        button.disabled = false;
        button.removeAttribute('data-original-text');
    }
}

/**
 * Logout function to clear authentication and redirect
 */
async function logout() {
    try {
        const response = await fetch('/auth/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (response.ok) {
            // Redirect to login page
            window.location.href = '/auth/login';
        } else {
            // Fallback - still redirect to login even if logout fails
            window.location.href = '/auth/login';
        }
    } catch (error) {
        console.error('Logout error:', error);
        // Fallback - redirect to login page
        window.location.href = '/auth/login';
    }
}

/**
 * Initialize logout functionality for logout buttons/links
 */
function initializeLogout() {
    // Handle logout links/buttons
    const logoutElements = document.querySelectorAll('a[href="/auth/logout"], button[data-action="logout"]');
    logoutElements.forEach(element => {
        element.addEventListener('click', function (e) {
            e.preventDefault();
            logout();
        });
    });
}

// Initialize logout functionality when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    initializeLogout();
});
