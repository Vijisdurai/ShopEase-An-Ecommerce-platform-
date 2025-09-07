// Authentication module for store page
class AuthManager {
    constructor() {
        this.baseURL = 'http://localhost:8000';
        this.authData = this.getAuthData();
        this.currentUser = this.authData?.user || null;
        this.token = this.authData?.token || null;
        this.initialized = false;
        
        // Don't auto-init to prevent race conditions
        // We'll call init() explicitly after DOM is ready
    }

    init() {
        if (this.initialized) return;
        this.setupEventListeners();
        this.initialized = true;
        
        // Update UI based on auth state
        if (this.isAuthenticated(true)) {
            this.showUserMenu();
        } else {
            this.showAuthButtons();
        }
    }

    setupEventListeners() {
        // Handle logout button clicks
        document.addEventListener('click', (e) => {
            if (e.target.closest('#logoutBtn')) {
                e.preventDefault();
                this.logout();
            }
        });
    }

    login(token, user) {
        // Store token with expiration info
        const tokenData = {
            token: token,
            expires: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
            user: user || { email: 'user@example.com' } // Fallback user data
        };
        
        localStorage.setItem('authData', JSON.stringify(tokenData));
        this.authData = tokenData;
        this.currentUser = tokenData.user;
        this.token = token;
        
        // Update UI if on a page with user menu
        if (typeof this.showUserMenu === 'function') {
            this.showUserMenu();
        }
        
        return tokenData;
    }

    showUserMenu() {
        const authButtons = document.getElementById('authButtons');
        const userMenu = document.getElementById('userMenu');
        const usernameElement = document.getElementById('username');
        
        if (authButtons && userMenu && usernameElement) {
            // Update username display
            usernameElement.textContent = this.currentUser?.email?.split('@')[0] || 'User';
            
            // Toggle UI elements
            authButtons.classList.add('hidden');
            userMenu.classList.remove('hidden');
        }
    }
    
    showAuthButtons() {
        const authButtons = document.getElementById('authButtons');
        const userMenu = document.getElementById('userMenu');
        
        if (authButtons && userMenu) {
            authButtons.classList.remove('hidden');
            userMenu.classList.add('hidden');
        }
    }

    logout(skipRedirect = false) {
        // Clear auth data
        localStorage.removeItem('authData');
        this.authData = null;
        this.currentUser = null;
        this.token = null;
        
        // Update UI
        this.showAuthButtons();
        
        // Only redirect if not explicitly told to skip
        if (!skipRedirect && !window.location.pathname.endsWith('auth.html')) {
            // Add a small delay to ensure UI updates before redirect
            setTimeout(() => {
                window.location.href = '/static/auth.html';
            }, 100);
        }
    }

    isAuthenticated(checkOnly = false) {
        // Get auth data from storage
        const authData = this.getAuthData();
        const currentPath = window.location.pathname;
        const isAuthPage = currentPath.endsWith('auth.html');
        
        // Check if we have valid auth data
        const hasValidToken = authData?.token && Date.now() < (authData.expires || 0);
        
        // If just checking auth state, return the result
        if (checkOnly) {
            return hasValidToken;
        }
        
        // Handle unauthenticated users
        if (!hasValidToken) {
            // Only redirect if not already on auth page
            if (!isAuthPage) {
                // Store current URL for post-login redirect
                if (currentPath !== '/static/auth.html') {
                    sessionStorage.setItem('redirectAfterLogin', currentPath);
                }
                window.location.href = '/static/auth.html';
            }
            return false;
        }
        
        // Handle authenticated users on auth page
        if (isAuthPage) {
            const redirectUrl = sessionStorage.getItem('redirectAfterLogin') || '/';
            sessionStorage.removeItem('redirectAfterLogin');
            // Small delay to prevent race conditions
            setTimeout(() => {
                window.location.href = redirectUrl;
            }, 10);
            return true;
        }
        
        // Authenticated and on a regular page
        return true;
    }

    getAuthData() {
        const authDataStr = localStorage.getItem('authData');
        return authDataStr ? JSON.parse(authDataStr) : null;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getAuthHeaders() {
        if (!this.isAuthenticated()) {
            return { 'Content-Type': 'application/json' };
        }
        
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
        };
    }

    showUserMenu() {
        const authButtons = document.getElementById('authButtons');
        const userMenu = document.getElementById('userMenu');
        
        if (authButtons && userMenu) {
            authButtons.classList.add('hidden');
            userMenu.classList.remove('hidden');
            
            const usernameElement = document.getElementById('username');
            if (usernameElement && this.currentUser?.username) {
                usernameElement.textContent = this.currentUser.username;
            }
        }
    }
}

// Initialize auth manager
window.authManager = new AuthManager();
