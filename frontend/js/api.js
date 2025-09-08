class ApiClient {
    constructor() {
        // Use production API URL or fallback to localhost for development
        this.baseURL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:8000' 
            : window.location.origin + '/api';
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        console.log(`API Request: ${options.method || 'GET'} ${url}`);
        
        const headers = {
            'Content-Type': 'application/json',
            ...window.authManager?.getAuthHeaders(),
            ...options.headers
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                credentials: 'include',  // Important for session cookies
                body: options.body
            });

            console.log(`API Response (${response.status}):`, response);

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                    console.error('API Error Response:', errorData);
                    console.error('Error detail array:', errorData.detail);
                } catch (e) {
                    errorData = { detail: await response.text() };
                    console.error('API Error (non-JSON):', errorData);
                }
                let errorMessage;
                if (Array.isArray(errorData.detail)) {
                    errorMessage = errorData.detail.map(e => e.msg || e.message || e).join(', ');
                } else if (typeof errorData.detail === 'string') {
                    errorMessage = errorData.detail;
                } else {
                    errorMessage = `Request failed with status ${response.status}`;
                }
                
                const error = new Error(errorMessage);
                error.status = response.status;
                error.data = errorData;
                throw error;
            }

            // For DELETE requests that return 204 No Content
            if (response.status === 204) {
                console.log('204 No Content response received');
                return null;
            }

            const data = await response.json().catch(error => {
                console.error('Failed to parse JSON response:', error);
                throw new Error('Failed to parse server response');
            });
            
            console.log('API Response Data:', data);
            return data;
            
        } catch (error) {
            console.error('API Request Failed:', {
                url,
                method: options.method || 'GET',
                error: error.message,
                stack: error.stack
            });
            
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                throw new Error('Unable to connect to the server. Please check your internet connection.');
            }
            
            throw error;
        }
    }

    // Cart endpoints
    async getCart() {
        return this.request('/cart');
    }

    async addToCart(itemId, quantity = 1) {
        return this.request('/cart/items', {
            method: 'POST',
            body: JSON.stringify({ item_id: parseInt(itemId), quantity })
        });
    }

    async updateCartItem(itemId, quantity) {
        return this.request(`/cart/items/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify({ quantity: parseInt(quantity) })
        });
    }

    async removeFromCart(itemId) {
        return this.request(`/cart/items/${itemId}`, {
            method: 'DELETE'
        });
    }

    async clearCart() {
        return this.request('/cart/items/clear', {
            method: 'DELETE'
        });
    }

    // Product endpoints
    async getProducts(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/items?${query}`);
    }

    async getProduct(itemId) {
        return this.request(`/items/${itemId}`);
    }
}

// Initialize API client
window.apiClient = new ApiClient();
