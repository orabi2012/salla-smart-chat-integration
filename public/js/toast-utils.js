/**
 * Toast notification utilities
 * Reusable functions for showing toast notifications
 */

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of toast (success, error, warning, info)
 * @param {number} duration - Auto-hide duration in milliseconds (0 = no auto-hide)
 */
function showToast(message, type = 'info', duration = 5000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        console.warn('Toast container not found. Make sure to include toast-container in your HTML.');
        return;
    }

    const toast = document.createElement('div');
    toast.className = 'toast align-items-center text-white border-0';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');

    // Set auto-hide if duration is specified
    if (duration > 0) {
        toast.setAttribute('data-bs-autohide', 'true');
        toast.setAttribute('data-bs-delay', duration.toString());
    } else {
        toast.setAttribute('data-bs-autohide', 'false');
    }

    // Set background color based on type
    let bgClass = 'bg-primary';
    let icon = 'fas fa-info-circle';
    let textClass = 'text-white';
    let closeClass = 'btn-close-white';

    switch (type) {
        case 'success':
            bgClass = 'bg-success';
            icon = 'fas fa-check-circle';
            break;
        case 'error':
        case 'danger':
            bgClass = 'bg-danger';
            icon = 'fas fa-exclamation-circle';
            break;
        case 'warning':
            bgClass = 'bg-warning';
            icon = 'fas fa-exclamation-triangle';
            textClass = 'text-dark';
            closeClass = '';
            break;
        case 'info':
            bgClass = 'bg-info';
            icon = 'fas fa-info-circle';
            break;
    }

    toast.classList.add(bgClass);

    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body ${textClass}">
                <i class="${icon} me-2"></i>
                ${message}
            </div>
            <button type="button" class="btn-close ${closeClass} me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    toastContainer.appendChild(toast);
    const toastBootstrap = new bootstrap.Toast(toast);
    toastBootstrap.show();

    // Remove toast element after it's hidden
    toast.addEventListener('hidden.bs.toast', function () {
        toast.remove();
    });

    return toastBootstrap;
}

/**
 * Show a success toast
 * @param {string} message - The success message to display
 * @param {number} duration - Auto-hide duration in milliseconds
 */
function showSuccessToast(message, duration = 5000) {
    return showToast(message, 'success', duration);
}

/**
 * Show an error toast
 * @param {string} message - The error message to display
 * @param {number} duration - Auto-hide duration in milliseconds (0 = no auto-hide)
 */
function showErrorToast(message, duration = 0) {
    return showToast(message, 'error', duration);
}

/**
 * Show a warning toast
 * @param {string} message - The warning message to display
 * @param {number} duration - Auto-hide duration in milliseconds
 */
function showWarningToast(message, duration = 7000) {
    return showToast(message, 'warning', duration);
}

/**
 * Show an info toast
 * @param {string} message - The info message to display
 * @param {number} duration - Auto-hide duration in milliseconds
 */
function showInfoToast(message, duration = 5000) {
    return showToast(message, 'info', duration);
}
