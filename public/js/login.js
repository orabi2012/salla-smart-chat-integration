// Login form handling with enhanced error management
document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const rememberMeCheckbox = document.getElementById('rememberMe');
    const loginBtn = document.getElementById('login-btn');
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');

    // Clear error messages
    function clearErrors() {
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';

        // Clear field-specific errors
        const fieldErrors = document.querySelectorAll('.field-error');
        fieldErrors.forEach(error => {
            error.style.display = 'none';
            error.textContent = '';
        });

        // Clear error states from inputs
        const inputs = document.querySelectorAll('.form-group input');
        inputs.forEach(input => {
            input.classList.remove('error');
        });
    }

    // Show error message
    function showError(message, field = null) {
        clearErrors();
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';

        // If specific field error, highlight the field
        if (field) {
            const fieldInput = document.getElementById(field);
            if (fieldInput) {
                fieldInput.classList.add('error');
                fieldInput.focus();
            }
        }
    }

    // Show success message
    function showSuccess(message) {
        clearErrors();
        successMessage.textContent = message;
        successMessage.style.display = 'block';
    }

    // Set button loading state
    function setButtonLoading(loading = true) {
        if (loading) {
            loginBtn.classList.add('loading');
            loginBtn.disabled = true;
        } else {
            loginBtn.classList.remove('loading');
            loginBtn.disabled = false;
        }
    }

    // Client-side validation
    function validateForm() {
        clearErrors();
        let isValid = true;

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username) {
            showError('Username is required', 'username');
            return false;
        }

        if (username.length < 3) {
            showError('Username must be at least 3 characters long', 'username');
            return false;
        }

        if (!password) {
            showError('Password is required', 'password');
            return false;
        }

        if (password.length < 4) {
            showError('Password must be at least 4 characters long', 'password');
            return false;
        }

        return true;
    }

    // Handle form submission
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        // Client-side validation
        if (!validateForm()) {
            return;
        }

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        const rememberMe = rememberMeCheckbox.checked;

        setButtonLoading(true);
        clearErrors();

        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password, rememberMe }),
            });

            const data = await response.json();

            if (response.ok) {
                // Success
                showSuccess('Login successful! Redirecting...');

                // Save credentials if remember me is checked
                saveCredentials(username, password, rememberMe);

                // Short delay to show success message
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
            } else {
                // Handle different types of errors
                let errorMsg = data.message || 'Login failed';
                let fieldToFocus = null;

                switch (response.status) {
                    case 400:
                        // Validation error
                        if (data.field === 'validation') {
                            fieldToFocus = 'username';
                        }
                        break;
                    case 401:
                        // Invalid credentials
                        if (data.field === 'credentials') {
                            fieldToFocus = 'username';
                            // Clear password for security
                            passwordInput.value = '';
                        }
                        break;
                    case 500:
                        // Server error
                        errorMsg = 'Server error occurred. Please try again later.';
                        break;
                    default:
                        errorMsg = 'An unexpected error occurred. Please try again.';
                }

                showError(errorMsg, fieldToFocus);
            }
        } catch (error) {
            console.error('Network error:', error);
            showError('Network error occurred. Please check your connection and try again.');
        } finally {
            setButtonLoading(false);
        }
    });

    // Clear errors when user starts typing
    usernameInput.addEventListener('input', function () {
        if (this.classList.contains('error')) {
            clearErrors();
        }
    });

    passwordInput.addEventListener('input', function () {
        if (this.classList.contains('error')) {
            clearErrors();
        }
    });

    // Load saved credentials on page load
    function loadSavedCredentials() {
        const savedUsername = localStorage.getItem('rememberedUsername');
        const savedPassword = localStorage.getItem('rememberedPassword');
        const wasRemembered = localStorage.getItem('rememberMe') === 'true';

        if (wasRemembered && savedUsername) {
            usernameInput.value = savedUsername;
            rememberMeCheckbox.checked = true;

            if (savedPassword) {
                passwordInput.value = savedPassword;
                // Focus on login button since both fields are filled
                loginBtn.focus();
            } else {
                // Focus on password field since username is filled
                passwordInput.focus();
            }
        } else {
            // Focus on username field when page loads
            usernameInput.focus();
        }
    }

    // Save credentials if remember me is checked
    function saveCredentials(username, password, rememberMe) {
        if (rememberMe) {
            localStorage.setItem('rememberedUsername', username);
            localStorage.setItem('rememberedPassword', password);
            localStorage.setItem('rememberMe', 'true');
        } else {
            localStorage.removeItem('rememberedUsername');
            localStorage.removeItem('rememberedPassword');
            localStorage.removeItem('rememberMe');
        }
    }

    // Clear saved credentials if remember me is unchecked
    rememberMeCheckbox.addEventListener('change', function () {
        if (!this.checked) {
            localStorage.removeItem('rememberedUsername');
            localStorage.removeItem('rememberedPassword');
            localStorage.removeItem('rememberMe');
        }
    });

    // Load saved credentials when page loads
    loadSavedCredentials();

    // Check if user was redirected after logout
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('logout') === 'true') {
        // Show a message that they were logged out but don't clear remember me automatically
        showSuccess('You have been logged out successfully.');
        // Remove the logout parameter from URL without reload
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});
