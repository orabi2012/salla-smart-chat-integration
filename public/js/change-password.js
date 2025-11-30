/**
 * Change password form functionality
 * Handles password change validation and form submission
 */

/**
 * Initialize change password form
 */
function initializeChangePasswordForm() {
    const form = document.getElementById('changePasswordForm');
    if (!form) return;

    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const passwordMismatch = document.getElementById('passwordMismatch');
    const submitBtn = document.getElementById('submitBtn');

    /**
     * Validate passwords match and form is complete
     */
    function validatePasswords() {
        const newPwd = newPassword.value;
        const confirmPwd = confirmPassword.value;

        if (confirmPwd && newPwd !== confirmPwd) {
            confirmPassword.classList.add('is-invalid');
            passwordMismatch.style.display = 'block';
            submitBtn.disabled = true;
        } else {
            confirmPassword.classList.remove('is-invalid');
            passwordMismatch.style.display = 'none';

            // Check if all fields are filled and password is at least 6 characters
            const currentPwd = document.getElementById('currentPassword').value;
            submitBtn.disabled = !(currentPwd && newPwd && confirmPwd && newPwd.length >= 6);
        }
    }

    // Add event listeners for real-time validation
    newPassword.addEventListener('input', validatePasswords);
    confirmPassword.addEventListener('input', validatePasswords);
    document.getElementById('currentPassword').addEventListener('input', validatePasswords);

    // Handle form submission
    form.addEventListener('submit', function (e) {
        const newPwd = newPassword.value;
        const confirmPwd = confirmPassword.value;

        if (newPwd !== confirmPwd) {
            e.preventDefault();
            confirmPassword.classList.add('is-invalid');
            passwordMismatch.style.display = 'block';
            return false;
        }

        if (newPwd.length < 6) {
            e.preventDefault();
            newPassword.classList.add('is-invalid');
            return false;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Changing...';
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    initializeChangePasswordForm();
});
