/**
 * User form validation and password utilities
 * Handles form validation, password strength checking, and password visibility toggle
 */

/**
 * Toggle password visibility
 * @param {string} inputId - The ID of the password input field
 * @param {string} iconId - The ID of the toggle icon
 */
function togglePassword(inputId = 'password', iconId = 'passwordToggleIcon') {
    const passwordInput = document.getElementById(inputId);
    const toggleIcon = document.getElementById(iconId);

    if (!passwordInput || !toggleIcon) return;

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.className = 'fas fa-eye-slash';
    } else {
        passwordInput.type = 'password';
        toggleIcon.className = 'fas fa-eye';
    }
}

/**
 * Validate password strength
 * @param {string} password - The password to validate
 * @returns {object} Object containing validation results
 */
function validatePasswordStrength(password) {
    return {
        length: password.length >= 6,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password)
    };
}

/**
 * Check if password meets all requirements
 * @param {string} password - The password to check
 * @returns {boolean} True if password meets all requirements
 */
function isPasswordValid(password) {
    const requirements = validatePasswordStrength(password);
    return Object.values(requirements).every(req => req);
}

/**
 * Show password validation error
 * @param {string} message - The error message to display
 */
function showPasswordError(message) {
    alert(message);
}

/**
 * Update password input visual feedback
 * @param {HTMLElement} passwordInput - The password input element
 * @param {boolean} isValid - Whether the password is valid
 * @param {boolean} allowEmpty - Whether empty password is allowed
 */
function updatePasswordFeedback(passwordInput, isValid, allowEmpty = false) {
    if (passwordInput.value.trim() === '' && allowEmpty) {
        passwordInput.classList.remove('is-valid', 'is-invalid');
    } else if (isValid) {
        passwordInput.classList.remove('is-invalid');
        passwordInput.classList.add('is-valid');
    } else {
        passwordInput.classList.remove('is-valid');
        passwordInput.classList.add('is-invalid');
    }
}

/**
 * Initialize password strength indicator for an input
 * @param {string} inputId - The ID of the password input
 * @param {boolean} allowEmpty - Whether empty password is allowed (for edit forms)
 */
function initializePasswordStrengthIndicator(inputId, allowEmpty = false) {
    const passwordInput = document.getElementById(inputId);
    if (!passwordInput) return;

    passwordInput.addEventListener('input', function () {
        const password = this.value;

        if (password.trim() !== '' || !allowEmpty) {
            const isValid = isPasswordValid(password);
            updatePasswordFeedback(this, isValid, allowEmpty);
        } else {
            updatePasswordFeedback(this, true, allowEmpty);
        }
    });
}

/**
 * Validate user form on submit (for add user)
 * @param {Event} e - The form submit event
 * @param {string} usernameId - The ID of the username input
 * @param {string} passwordId - The ID of the password input
 * @returns {boolean} True if validation passes
 */
function validateUserForm(e, usernameId = 'username', passwordId = 'password') {
    const username = document.getElementById(usernameId).value;
    const password = document.getElementById(passwordId).value;

    if (username.length < 3) {
        e.preventDefault();
        showPasswordError('Username must be at least 3 characters long.');
        return false;
    }

    if (password.length < 6) {
        e.preventDefault();
        showPasswordError('Password must be at least 6 characters long.');
        return false;
    }

    const requirements = validatePasswordStrength(password);

    if (!requirements.uppercase) {
        e.preventDefault();
        showPasswordError('Password must contain at least one uppercase letter.');
        return false;
    }

    if (!requirements.lowercase) {
        e.preventDefault();
        showPasswordError('Password must contain at least one lowercase letter.');
        return false;
    }

    if (!requirements.number) {
        e.preventDefault();
        showPasswordError('Password must contain at least one number.');
        return false;
    }

    return true;
}

/**
 * Validate edit user form on submit (password is optional)
 * @param {Event} e - The form submit event
 * @param {string} usernameId - The ID of the username input
 * @param {string} passwordId - The ID of the password input
 * @returns {boolean} True if validation passes
 */
function validateEditUserForm(e, usernameId = 'username', passwordId = 'password') {
    const username = document.getElementById(usernameId).value;
    const password = document.getElementById(passwordId).value;

    if (username.length < 3) {
        e.preventDefault();
        showPasswordError('Username must be at least 3 characters long.');
        return false;
    }

    // Only validate password if it's provided (not empty)
    if (password && password.trim() !== '') {
        if (password.length < 6) {
            e.preventDefault();
            showPasswordError('Password must be at least 6 characters long if provided.');
            return false;
        }

        const requirements = validatePasswordStrength(password);

        if (!requirements.uppercase) {
            e.preventDefault();
            showPasswordError('Password must contain at least one uppercase letter.');
            return false;
        }

        if (!requirements.lowercase) {
            e.preventDefault();
            showPasswordError('Password must contain at least one lowercase letter.');
            return false;
        }

        if (!requirements.number) {
            e.preventDefault();
            showPasswordError('Password must contain at least one number.');
            return false;
        }
    }

    return true;
}

/**
 * Initialize add user form
 */
function initializeAddUserForm() {
    const form = document.getElementById('addUserForm');
    if (!form) return;

    // Initialize password strength indicator
    initializePasswordStrengthIndicator('password', false);

    // Add form validation
    form.addEventListener('submit', function (e) {
        validateUserForm(e);
    });
}

/**
 * Initialize edit user form
 */
function initializeEditUserForm() {
    const form = document.getElementById('editUserForm');
    if (!form) return;

    // Initialize password strength indicator (allow empty)
    initializePasswordStrengthIndicator('password', true);

    // Add form validation
    form.addEventListener('submit', function (e) {
        validateEditUserForm(e);
    });
}

// Export functions for global access
window.togglePassword = togglePassword;
window.validateUserForm = validateUserForm;
window.validateEditUserForm = validateEditUserForm;
