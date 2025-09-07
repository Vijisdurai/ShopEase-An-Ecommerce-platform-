// Cart management module
class CartManager {
    constructor() {
        this.baseURL = 'http://localhost:8000';
        this.cart = { cart_items: [] };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadCart();
    }

    setupEventListeners() {
        const cartBtn = document.getElementById('cartBtn');
        const closeCartModal = document.getElementById('closeCartModal');
        const cartModal = document.getElementById('cartModal');

        // Cart modal toggle
        if (cartBtn) cartBtn.addEventListener('click', () => this.showCartModal());
        if (closeCartModal) closeCartModal.addEventListener('click', () => this.hideCartModal());
        
        // Handle cart item actions using event delegation
        if (cartModal) {
            cartModal.addEventListener('click', (e) => {
                // Handle quantity decrease
                if (e.target.closest('.decrease-quantity')) {
                    const itemId = parseInt(e.target.closest('[data-item-id]').dataset.itemId);
                    const currentQty = parseInt(e.target.closest('.quantity-controls').querySelector('.quantity').textContent);
                    if (currentQty > 1) {
                        this.updateCartItem(itemId, currentQty - 1);
                    } else {
                        this.removeFromCart(itemId);
                    }
                }
                // Handle quantity increase
                else if (e.target.closest('.increase-quantity')) {
                    const itemId = parseInt(e.target.closest('[data-item-id]').dataset.itemId);
                    const currentQty = parseInt(e.target.closest('.quantity-controls').querySelector('.quantity').textContent);
                    this.updateCartItem(itemId, currentQty + 1);
                }
                // Handle remove item
                else if (e.target.closest('.remove-item')) {
                    const itemId = parseInt(e.target.closest('[data-item-id]').dataset.itemId);
                    this.removeFromCart(itemId);
                }
            });
        }
    }

    async loadCart() {
        if (!window.authManager.isAuthenticated()) {
            this.clearCart();
            return;
        }

        try {
            const response = await fetch(`${this.baseURL}/cart`, {
                headers: window.authManager.getAuthHeaders()
            });

            if (response.ok) {
                this.cart = await response.json();
                this.updateCartUI();
            }
        } catch (error) {
            console.error('Failed to load cart:', error);
        }
    }

    async addToCart(itemId, quantity = 1) {
        if (!window.authManager.isAuthenticated()) {
            this.showNotification('Please login to add items to cart', 'error');
            return;
        }

        // Show loading state
        const button = document.querySelector(`button[onclick="window.cartManager.addToCart(${itemId})"]`);
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
        button.disabled = true;

        try {
            const response = await fetch(`${this.baseURL}/cart/items`, {
                method: 'POST',
                headers: window.authManager.getAuthHeaders(),
                body: JSON.stringify({
                    item_id: itemId,
                    quantity: quantity
                })
            });

            if (response.ok) {
                await this.loadCart();
                this.showNotification('Item added to cart!', 'success');
                
                // Animate button success
                button.innerHTML = '<i class="fas fa-check"></i> Added!';
                button.classList.add('bg-green-500');
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.classList.remove('bg-green-500');
                    button.disabled = false;
                }, 1500);
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to add item to cart');
            }
        } catch (error) {
            this.showNotification(error.message, 'error');
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    async updateCartItem(itemId, quantity) {
        if (!window.authManager.isAuthenticated()) {
            return;
        }

        try {
            const response = await fetch(`${this.baseURL}/cart/items/${itemId}`, {
                method: 'PUT',
                headers: window.authManager.getAuthHeaders(),
                body: JSON.stringify({ quantity: quantity })
            });

            if (response.ok) {
                await this.loadCart();
                this.renderCartItems(); // Immediate UI update
                this.showNotification(`Cart updated!`, 'success');
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to update cart item');
            }
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async removeFromCart(itemId) {
        if (!window.authManager.isAuthenticated()) {
            this.showNotification('Please log in to modify your cart', 'error');
            return;
        }

        // Show confirmation
        if (!confirm('Are you sure you want to remove this item from your cart?')) {
            return;
        }

        try {
            const response = await fetch(`${this.baseURL}/cart/items/${itemId}`, {
                method: 'DELETE',
                headers: window.authManager.getAuthHeaders()
            });

            if (response.ok) {
                // Remove the item from local cart immediately for better UX
                this.cart.cart_items = this.cart.cart_items.filter(item => item.item_id !== itemId);
                
                // Update the UI
                const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
                if (itemElement) {
                    // Add removal animation
                    itemElement.style.transition = 'all 0.3s ease';
                    itemElement.style.opacity = '0';
                    itemElement.style.transform = 'translateX(-100%)';
                    
                    // Wait for animation to complete
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
                
                // Reload cart data from server to ensure consistency
                await this.loadCart();
                this.renderCartItems();
                this.updateCartUI();
                
                this.showNotification('Item removed from cart!', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to remove item from cart');
            }
        } catch (error) {
            console.error('Error removing item from cart:', error);
            this.showNotification(error.message || 'An error occurred while removing the item', 'error');
            
            // Try to reload cart to fix any potential inconsistencies
            try {
                await this.loadCart();
                this.renderCartItems();
            } catch (e) {
                console.error('Error reloading cart:', e);
            }
        }
    }

    showCartModal() {
        const modal = document.getElementById('cartModal');
        modal.classList.remove('hidden');
        this.renderCartItems();
    }

    hideCartModal() {
        const modal = document.getElementById('cartModal');
        modal.classList.add('hidden');
    }

    renderCartItems() {
        const cartItemsContainer = document.getElementById('cartItems');
        const cartTotal = document.getElementById('cartTotal');

        if (!this.cart.cart_items || this.cart.cart_items.length === 0) {
            cartItemsContainer.innerHTML = '<p class="text-gray-500 text-center py-8">Your cart is empty</p>';
            cartTotal.innerHTML = '';
            return;
        }

        let total = 0;
        const itemsHTML = this.cart.cart_items.map(cartItem => {
            const itemTotal = cartItem.item.price * cartItem.quantity;
            total += itemTotal;

            return `
                <div class="flex items-center justify-between border-b border-primary pb-4 mb-4" data-item-id="${cartItem.item.id}">
                    <div class="flex items-center space-x-4">
                        <img src="${cartItem.item.image_url || 'https://via.placeholder.com/60'}" 
                             alt="${cartItem.item.name}" 
                             class="w-16 h-16 object-cover rounded border border-primary">
                        <div>
                            <h4 class="font-semibold text-gray-800">${cartItem.item.name}</h4>
                            <p class="text-primary font-medium">$${cartItem.item.price.toFixed(2)}</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button class="decrease-quantity bg-secondary border border-primary px-2 py-1 rounded hover:bg-primary hover:text-white transition">-</button>
                        <span class="quantity px-3 font-medium">${cartItem.quantity}</span>
                        <button class="increase-quantity bg-secondary border border-primary px-2 py-1 rounded hover:bg-primary hover:text-white transition">+</button>
                        <button class="remove-item bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 ml-2 transition">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        cartItemsContainer.innerHTML = itemsHTML;
        cartTotal.innerHTML = `Total: $${total.toFixed(2)}`;
    }

    updateCartUI() {
        const cartCount = document.getElementById('cartCount');
        const totalItems = this.cart.cart_items ? 
            this.cart.cart_items.reduce((sum, item) => sum + item.quantity, 0) : 0;
        cartCount.textContent = totalItems;
    }

    clearCart() {
        this.cart = { cart_items: [] };
        this.updateCartUI();
    }

    showNotification(message, type = 'info') {
        // Create notification element if it doesn't exist
        let notification = document.getElementById('notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'notification';
            notification.className = 'fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full';
            document.body.appendChild(notification);
        }

        // Set notification style based on type
        notification.className = 'fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300';
        
        if (type === 'success') {
            notification.className += ' bg-green-500 text-white';
            notification.innerHTML = `<i class="fas fa-check-circle mr-2"></i>${message}`;
        } else if (type === 'error') {
            notification.className += ' bg-red-500 text-white';
            notification.innerHTML = `<i class="fas fa-exclamation-circle mr-2"></i>${message}`;
        } else {
            notification.className += ' bg-blue-500 text-white';
            notification.innerHTML = `<i class="fas fa-info-circle mr-2"></i>${message}`;
        }

        // Show notification
        notification.style.transform = 'translateX(0)';
        
        // Hide after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
        }, 3000);
    }
}

// Initialize cart manager
window.cartManager = new CartManager();
