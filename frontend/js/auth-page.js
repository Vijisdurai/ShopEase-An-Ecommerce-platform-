// Authentication page module
class AuthPageManager {
    constructor() {
        this.baseURL = 'http://localhost:8000';
        this.isLoginMode = true;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkExistingAuth();
        this.setLoginMode();
    }

    setupEventListeners() {
        const authForm = document.getElementById('authForm');
        const switchAuthMode = document.getElementById('switchAuthMode');

        authForm.addEventListener('submit', (e) => this.handleAuth(e));
        switchAuthMode.addEventListener('click', () => this.toggleAuthMode());
    }

    checkExistingAuth() {
        const token = localStorage.getItem('token');
        if (token) {
            // User is already logged in, redirect to store
            this.redirectToStore();
        }
    }

    setLoginMode() {
        this.isLoginMode = true;
        this.updateUI();
    }

    setSignupMode() {
        this.isLoginMode = false;
        this.updateUI();
    }

    toggleAuthMode() {
        this.isLoginMode = !this.isLoginMode;
        this.updateUI();
        this.clearMessages();
    }

    updateUI() {
        const authTitle = document.getElementById('authTitle');
        const authSubtext = document.getElementById('authSubtext');
        const switchText = document.getElementById('switchText');
        const submitText = document.getElementById('submitText');
        const usernameField = document.getElementById('usernameField');

        if (this.isLoginMode) {
            authTitle.textContent = 'Sign in to your account';
            authSubtext.textContent = 'Or';
            switchText.textContent = 'create a new account';
            submitText.textContent = 'Sign in';
            usernameField.classList.add('hidden');
        } else {
            authTitle.textContent = 'Create your account';
            authSubtext.textContent = 'Or';
            switchText.textContent = 'sign in to existing account';
            submitText.textContent = 'Sign up';
            usernameField.classList.remove('hidden');
        }
    }

    async handleAuth(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const username = document.getElementById('username').value.trim();

        if (!email || !password) {
            this.showError('Please fill in all required fields');
            return;
        }

        if (!this.isLoginMode && !username) {
            this.showError('Please enter a username');
            return;
        }

        this.setLoading(true);
        this.clearMessages();

        try {
            if (this.isLoginMode) {
                await this.login(email, password);
            } else {
                await this.signup(email, password, username);
            }
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.setLoading(false);
        }
    }

    async login(email, password) {
        try {
            const response = await fetch(`${this.baseURL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.detail || 'Login failed. Please check your credentials.');
            }

            // The backend returns the user object directly in the response
            const user = {
                email: email,  // Use the email from the login form
                username: email.split('@')[0]  // Generate username from email
            };

            // Use the global authManager to handle the login
            if (window.authManager) {
                window.authManager.login(data.access_token, user);
            } else {
                // Fallback in case authManager is not available
                localStorage.setItem('authData', JSON.stringify({
                    token: data.access_token,
                    user: user,
                    expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
                }));
            }
            
            this.showSuccess('Login successful! Redirecting to store...');
            
            // Redirect to store after a short delay
            setTimeout(() => {
                this.redirectToStore();
            }, 1000);
            
        } catch (error) {
            console.error('Login error:', error);
            throw new Error(error.message || 'An error occurred during login');
        }
    }

    async signup(email, password, username) {
        const response = await fetch(`${this.baseURL}/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password, username }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Signup failed');
        }

        this.showSuccess('Account created successfully! Please sign in.');
        this.clearForm();
        
        // Switch to login mode after successful signup
        setTimeout(() => {
            this.setLoginMode();
        }, 2000);
    }

    redirectToStore() {
        window.location.href = '/static/index.html';
    }

    setLoading(loading) {
        const submitBtn = document.getElementById('submitBtn');
        const submitText = document.getElementById('submitText');
        const loadingIcon = document.getElementById('loadingIcon');

        if (loading) {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
            submitText.textContent = 'Please wait...';
            loadingIcon.classList.remove('hidden');
        } else {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            submitText.textContent = this.isLoginMode ? 'Sign in' : 'Sign up';
            loadingIcon.classList.add('hidden');
        }
    }

    showError(message) {
        const errorMessage = document.getElementById('errorMessage');
        const errorText = document.getElementById('errorText');
        const successMessage = document.getElementById('successMessage');

        successMessage.classList.add('hidden');
        errorText.textContent = message;
        errorMessage.classList.remove('hidden');
    }

    showSuccess(message) {
        const successMessage = document.getElementById('successMessage');
        const successText = document.getElementById('successText');
        const errorMessage = document.getElementById('errorMessage');

        errorMessage.classList.add('hidden');
        successText.textContent = message;
        successMessage.classList.remove('hidden');
    }

    clearMessages() {
        const errorMessage = document.getElementById('errorMessage');
        const successMessage = document.getElementById('successMessage');
        
        errorMessage.classList.add('hidden');
        successMessage.classList.add('hidden');
    }

    clearForm() {
        document.getElementById('email').value = '';
        document.getElementById('password').value = '';
        document.getElementById('username').value = '';
    }
}

// Initialize auth page manager
document.addEventListener('DOMContentLoaded', () => {
    new AuthPageManager();
});
