// Cart management module
class CartManager {
    constructor() {
        this.cart = { cart_items: [] };
    }

    init() {
        console.log('CartManager initializing...');
        this.setupEventListeners();
        this.loadCart();
        this.addGlobalStyles();
        
        // Set up a direct event listener on document for cart buttons
        document.addEventListener('click', (e) => {
            console.log('Document click detected:', e.target);
            console.log('Target classes:', e.target.className);
            console.log('Checking for quantity buttons...');
            // Handle remove buttons
            if (e.target.closest('.remove-item')) {
                console.log('Remove button clicked via document listener');
                e.preventDefault();
                e.stopPropagation();
                
                const button = e.target.closest('.remove-item');
                const itemElement = button.closest('[data-item-id]');
                
                if (itemElement) {
                    const itemId = itemElement.dataset.itemId;
                    console.log('Removing item ID:', itemId);
                    console.log('Item element dataset:', itemElement.dataset);
                    console.log('Current cart items:', this.cart);
                    
                    // Show loading state
                    button.disabled = true;
                    const originalHtml = button.innerHTML;
                    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    
                    // Reload cart first to ensure we have the latest state
                    this.loadCart().then(() => {
                        return this.removeFromCart(itemId);
                    }).then(() => {
                        console.log('Item removed successfully');
                        // Force reload the cart after successful removal
                        this.loadCart();
                    }).catch(error => {
                        console.error('Error removing item:', error);
                        button.innerHTML = originalHtml;
                        button.disabled = false;
                        
                        // Always reload cart on error to refresh the state
                        console.log('Error detected, reloading cart...');
                        this.loadCart();
                    });
                }
            }
            
            // Handle quantity decrease and increase buttons
            else if (e.target.closest('.decrease-quantity') || e.target.closest('.increase-quantity')) {
                console.log('Quantity button clicked via document listener');
                console.log('Decrease button found:', e.target.closest('.decrease-quantity'));
                console.log('Increase button found:', e.target.closest('.increase-quantity'));
                e.preventDefault();
                e.stopPropagation();
                
                const button = e.target.closest('.decrease-quantity, .increase-quantity');
                const itemElement = button.closest('[data-item-id]');
                
                if (itemElement) {
                    const itemId = itemElement.dataset.itemId;
                    const quantityElement = itemElement.querySelector('.quantity');
                    const currentQty = parseInt(quantityElement.textContent);
                    
                    console.log('Updating quantity for item ID:', itemId, 'Current qty:', currentQty);
                    
                    // Show loading state
                    button.disabled = true;
                    const originalText = button.textContent;
                    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    
                    let newQuantity;
                    if (button.classList.contains('decrease-quantity')) {
                        if (currentQty > 1) {
                            newQuantity = currentQty - 1;
                            console.log('Decreasing quantity to:', newQuantity);
                            this.updateCartItem(itemId, newQuantity).then(() => {
                                this.loadCart();
                            }).catch(error => {
                                console.error('Error decreasing quantity:', error);
                            }).finally(() => {
                                button.disabled = false;
                                button.textContent = originalText;
                            });
                        } else {
                            console.log('Quantity is 1, removing item instead');
                            this.removeFromCart(itemId).then(() => {
                                this.loadCart();
                            }).catch(error => {
                                console.error('Error removing item:', error);
                            }).finally(() => {
                                button.disabled = false;
                                button.textContent = originalText;
                            });
                        }
                    } else if (button.classList.contains('increase-quantity')) {
                        newQuantity = currentQty + 1;
                        console.log('Increasing quantity to:', newQuantity);
                        this.updateCartItem(itemId, newQuantity).then(() => {
                            this.loadCart();
                        }).catch(error => {
                            console.error('Error increasing quantity:', error);
                        }).finally(() => {
                            button.disabled = false;
                            button.textContent = originalText;
                        });
                    }
                }
            }
        });
    }
    
    addGlobalStyles() {
        // Add styles for loading states and animations
        if (!document.getElementById('cart-styles')) {
            const style = document.createElement('style');
            style.id = 'cart-styles';
            style.textContent = `
                @keyframes checkmark {
                    0% { transform: scale(0); opacity: 0; }
                    50% { transform: scale(1.2); }
                    100% { transform: scale(1); opacity: 1; }
                }
                .cart-success-animation {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) scale(0);
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    width: 100px;
                    height: 100px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    pointer-events: none;
                    animation: checkmark 0.5s ease-out forwards;
                }
                .cart-success-animation i {
                    font-size: 48px;
                    color: #4CAF50;
                }
                .cart-loading {
                    position: relative;
                    pointer-events: none;
                }
                .cart-loading::after {
                    content: '';
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 20px;
                    height: 20px;
                    margin: -10px 0 0 -10px;
                    border: 2px solid #fff;
                    border-top-color: transparent;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    showSuccessAnimation() {
        const existing = document.getElementById('success-animation');
        if (existing) existing.remove();
        
        const successDiv = document.createElement('div');
        successDiv.id = 'success-animation';
        successDiv.className = 'cart-success-animation';
        successDiv.innerHTML = '<i class="fas fa-check-circle"></i>';
        document.body.appendChild(successDiv);
        
        // Remove after animation
        setTimeout(() => {
            successDiv.style.opacity = '0';
            setTimeout(() => successDiv.remove(), 300);
        }, 1000);
    }

    // Restart cart feature - clears cart and resets UI
    async restartCartFeature() {
        try {
            // Clear the cart on the server
            await this.clearCart();
            
            // Reset local state
            this.cart = { cart_items: [] };
            
            // Update UI
            this.updateCartUI();
            this.renderCartItems();
            
            // Show success message
            this.showNotification('Cart has been reset', 'success');
            
            return true;
        } catch (error) {
            console.error('Error restarting cart feature:', error);
            this.showNotification('Failed to reset cart', 'error');
            return false;
        }
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        const cartBtn = document.getElementById('cartBtn');
        const closeCartModal = document.getElementById('closeCartModal');
        const cartModal = document.getElementById('cartModal');
        const clearCartBtn = document.getElementById('clearCartBtn');

        console.log('Cart elements:', { cartBtn, closeCartModal, cartModal, clearCartBtn });
        
        // Test if cartModal exists and is accessible
        if (cartModal) {
            console.log('Cart modal found, setting up event listeners');
        } else {
            console.error('Cart modal not found! Cannot set up event listeners');
            return;
        }

        // Cart modal toggle
        if (cartBtn) {
            cartBtn.addEventListener('click', () => {
                console.log('Cart button clicked');
                this.showCartModal();
            });
        }
        
        if (closeCartModal) {
            closeCartModal.addEventListener('click', () => {
                console.log('Close cart button clicked');
                this.hideCartModal();
            });
        }
        
        // Clear cart button
        if (clearCartBtn) {
            clearCartBtn.addEventListener('click', async (e) => {
                console.log('Clear cart button clicked');
                e.preventDefault();
                const confirmed = confirm('Are you sure you want to clear your cart? This action cannot be undone.');
                if (confirmed) {
                    const success = await this.restartCartFeature();
                    if (success) {
                        this.hideCartModal();
                    }
                }
            });
        }
        
        // Handle cart item actions using event delegation
        if (cartModal) {
            console.log('Setting up cart modal event listener');
            cartModal.addEventListener('click', async (e) => {
                console.log('Click detected in cart modal', e.target);
                console.log('Target classes:', e.target.className);
                console.log('Closest remove-item:', e.target.closest('.remove-item'));
                // Handle quantity decrease
                if (e.target.closest('.decrease-quantity') || e.target.closest('.increase-quantity')) {
                    e.preventDefault();
                    const button = e.target.closest('.decrease-quantity, .increase-quantity');
                    const itemElement = button.closest('[data-item-id]');
                    const itemId = itemElement.dataset.itemId;
                    const quantityElement = itemElement.querySelector('.quantity');
                    let currentQty = parseInt(quantityElement.textContent);
                    
                    if (button.classList.contains('decrease-quantity')) {
                        if (currentQty > 1) {
                            await this.updateCartItem(itemId, currentQty - 1);
                        } else {
                            await this.removeFromCart(itemId);
                        }
                    } else if (button.classList.contains('increase-quantity')) {
                        await this.updateCartItem(itemId, currentQty + 1);
                    }
                    
                    // Refresh cart to ensure UI is up to date
                    await this.loadCart();
                }
                // Handle quantity increase
                else if (e.target.closest('.increase-quantity')) {
                    const itemElement = e.target.closest('[data-item-id]');
                    const itemId = itemElement.dataset.itemId;
                    const quantityElement = itemElement.querySelector('.quantity');
                    const currentQty = parseInt(quantityElement.textContent);
                    this.updateCartItem(itemId, currentQty + 1);
                }
                // Handle remove item
                else if (e.target.closest('.remove-item')) {
                    console.log('Remove button clicked');
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const button = e.target.closest('.remove-item');
                    const itemElement = button.closest('[data-item-id]');
                    
                    if (!itemElement) {
                        console.error('Could not find item element');
                        return;
                    }
                    
                    const itemId = itemElement.dataset.itemId;
                    console.log('Removing item ID:', itemId);
                    
                    // Disable button and show loading state
                    button.disabled = true;
                    const originalHtml = button.innerHTML;
                    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    
                    // Handle the remove operation
                    (async () => {
                        try {
                            await this.removeFromCart(itemId);
                            console.log('Successfully removed item');
                        } catch (error) {
                            console.error('Error in remove handler:', error);
                            button.innerHTML = originalHtml;
                            button.disabled = false;
                        }
                    })();
                }
            });
        }
    }

    async addToCart(itemId, quantity = 1) {
        try {
            if (!window.authManager?.isAuthenticated()) {
                window.location.href = '/auth.html';
                return false;
            }

            await window.apiClient.addToCart(itemId, quantity);
            
            // Reload the cart to get the latest state
            await this.loadCart();
            this.showNotification('Item added to cart!', 'success');
            this.showSuccessAnimation();
            return true;
        } catch (error) {
            console.error('Error adding to cart:', error);
            this.showNotification(error.message || 'Failed to add item to cart', 'error');
            throw error;
        }
    }

    async loadCart() {
        try {
            if (!window.authManager?.isAuthenticated()) {
                this.cart = { cart_items: [] };
                this.updateCartUI();
                return;
            }

            const data = await window.apiClient.getCart();
            
            // Ensure cart has the expected structure
            this.cart = {
                id: data.id,
                user_id: data.user_id,
                cart_items: data.items || [],
                total_items: data.total_items || 0,
                total_price: data.total_price || 0,
                created_at: data.created_at,
                updated_at: data.updated_at
            };
            
            // Clear any test data if in development
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                const hasTestData = this.cart.cart_items.some(item => 
                    item.item?.name?.includes('Test') || 
                    item.item?.name?.toLowerCase().includes('test') ||
                    item.name?.includes('Test') ||
                    item.name?.toLowerCase().includes('test')
                );
                
                if (hasTestData) {
                    console.log('Clearing test data from cart...');
                    await this.clearCart();
                    this.cart = { cart_items: [] };
                }
            }
            
            this.updateCartUI();
            // If cart modal is open, make sure to render items
            const cartModal = document.getElementById('cartModal');
            if (cartModal && !cartModal.classList.contains('hidden')) {
                this.renderCartItems();
            }
        } catch (error) {
            console.error('Error loading cart:', error);
            this.showNotification('Failed to load cart. Please try again.', 'error');
        }
    }

    setupEventListeners() {
        const cartBtn = document.getElementById('cartBtn');
        const closeCartModal = document.getElementById('closeCartModal');
        const cartModal = document.getElementById('cartModal');
        const clearCartBtn = document.getElementById('clearCartBtn');

        if (cartBtn) {
            cartBtn.addEventListener('click', () => {
                cartModal?.classList.remove('hidden');
                this.renderCartItems();
            });
        }

        if (closeCartModal) {
            closeCartModal.addEventListener('click', () => {
                cartModal?.classList.add('hidden');
            });
        }

        if (clearCartBtn) {
            clearCartBtn.addEventListener('click', async () => {
                const confirmed = confirm('Are you sure you want to clear your cart?');
                if (confirmed) {
                    await this.clearCart();
                }
            });
        }

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === cartModal) {
                cartModal.classList.add('hidden');
            }
        });
    }

    async updateCartItem(itemId, quantity) {
        if (!window.authManager?.isAuthenticated()) {
            window.location.href = '/auth.html';
            return;
        }

        try {
            // First, check if the item exists in the current cart
            const cartItem = (this.cart.cart_items || []).find(item => 
                (item.item?.id === parseInt(itemId) || item.item_id === parseInt(itemId))
            );

            if (!cartItem) {
                // If item is not in cart, add it instead of updating
                await this.addToCart(itemId, quantity);
                return;
            }

            await window.apiClient.updateCartItem(itemId, Math.max(1, parseInt(quantity)));
            
            // Reload the cart to ensure we have the latest state
            await this.loadCart();
            this.showNotification('Cart updated!', 'success');
            
        } catch (error) {
            console.error('Error updating cart item:', error);
            this.showNotification(error.message || 'Failed to update cart item', 'error');
            throw error;
        }
    }

    async clearCart() {
        if (!window.authManager?.isAuthenticated()) {
            window.location.href = '/auth.html';
            return false;
        }

        try {
            await window.apiClient.clearCart();

            // Reset local cart state
            this.cart = { cart_items: [] };
                
            // Update UI
            this.updateCartUI();
            this.renderCartItems();
            this.showNotification('Cart cleared successfully', 'success');
            return true;
        } catch (error) {
            console.error('Error clearing cart:', error);
            this.showNotification(error.message || 'Error clearing cart', 'error');
            return false;
        }
    }

    async removeFromCart(itemId) {
        console.log('removeFromCart called with itemId:', itemId);
        console.log('Current cart state before removal:', this.cart);
        
        if (!window.authManager?.isAuthenticated()) {
            console.log('User not authenticated, redirecting to login');
            window.location.href = '/auth.html';
            return false;
        }

        // Show loading state
        const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
        console.log('Found item element:', itemElement);
        
        if (!itemElement) {
            console.error('Could not find item element with ID:', itemId);
            this.showNotification('Item not found in cart', 'error');
            return false;
        }
        
        const removeButton = itemElement.querySelector('.remove-item');
        console.log('Found remove button:', removeButton);
        
        if (removeButton) {
            removeButton.disabled = true;
            const originalHtml = removeButton.innerHTML;
            removeButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            
            try {
                console.log('Calling API to remove item from cart');
                // Make the API call to remove the item
                await window.apiClient.removeFromCart(itemId);
                
                console.log('Item removed from cart via API');
                
                // If successful, animate and remove the item
                if (itemElement) {
                    console.log('Animating item removal');
                    itemElement.style.transition = 'all 0.3s ease';
                    itemElement.style.opacity = '0.5';
                    itemElement.style.height = `${itemElement.offsetHeight}px`;
                    itemElement.offsetHeight; // Trigger reflow
                    itemElement.style.height = '0';
                    itemElement.style.padding = '0';
                    itemElement.style.margin = '0';
                    itemElement.style.border = 'none';
                    itemElement.style.overflow = 'hidden';
                    
                    // Remove from DOM after animation
                    setTimeout(async () => {
                        try {
                            console.log('Removing item from DOM');
                            itemElement.remove();
                            
                            // Reload cart data to ensure consistency
                            console.log('Reloading cart data');
                            await this.loadCart();
                            
                            // Update UI and show success
                            this.updateCartUI();
                            this.showNotification('Item removed from cart', 'success');
                            console.log('Item removal completed successfully');
                        } catch (error) {
                            console.error('Error during post-removal update:', error);
                            this.showNotification('Error updating cart', 'error');
                        }
                    }, 300);
                } else {
                    // If we couldn't find the element, still try to reload the cart
                    console.log('Item element not found, reloading cart');
                    await this.loadCart();
                    this.updateCartUI();
                }
                
                return true;
            } catch (error) {
                console.error('Error removing item from cart:', error);
                this.showNotification(error.message || 'Failed to remove item from cart', 'error');
                
                // Reset button state
                if (removeButton) {
                    removeButton.innerHTML = originalHtml;
                    removeButton.disabled = false;
                }
                
                // Reset item element state
                if (itemElement) {
                    itemElement.style.opacity = '1';
                    itemElement.style.pointerEvents = 'auto';
                }
                
                return false;
            }
        } else {
            // Fallback if button not found
            try {
                await window.apiClient.removeFromCart(itemId);
                await this.loadCart();
                this.showNotification('Item removed from cart', 'success');
                return true;
            } catch (error) {
                console.error('Error removing item from cart:', error);
                this.showNotification(error.message || 'Failed to remove item from cart', 'error');
                return false;
            }
        }
    }

    async showCartModal() {
        const modal = document.getElementById('cartModal');
        if (modal) {
            // Show loading state
            modal.classList.remove('hidden');
            const cartContent = document.getElementById('cartContent');
            const loadingIndicator = document.getElementById('cartLoading');
            
            if (cartContent) cartContent.classList.add('hidden');
            if (loadingIndicator) loadingIndicator.classList.remove('hidden');
            
            try {
                // Force refresh cart data
                await this.loadCart();
                this.renderCartItems();
            } catch (error) {
                console.error('Error loading cart:', error);
                this.showNotification('Failed to load cart', 'error');
            } finally {
                if (cartContent) cartContent.classList.remove('hidden');
                if (loadingIndicator) loadingIndicator.classList.add('hidden');
            }
        }
    }

    hideCartModal() {
        const modal = document.getElementById('cartModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    renderCartItems() {
        try {
            const cartItemsContainer = document.getElementById('cartItems');
            const cartTotal = document.getElementById('cartTotal');

            if (!cartItemsContainer || !cartTotal) {
                console.error('Cart container elements not found');
                return;
            }

            console.log('Rendering cart items. Cart data:', this.cart);
            
            // Handle different cart response formats
            let items = [];
            if (Array.isArray(this.cart)) {
                items = this.cart; // If cart is directly an array
            } else if (this.cart.items && Array.isArray(this.cart.items)) {
                items = this.cart.items; // If cart has items array
            } else if (this.cart.cart_items && Array.isArray(this.cart.cart_items)) {
                items = this.cart.cart_items; // If cart has cart_items array
            }
            
            console.log('Processed cart items:', items);
            
            if (items.length === 0) {
                cartItemsContainer.innerHTML = '<p class="text-gray-500 text-center py-8">Your cart is empty</p>';
                cartTotal.innerHTML = '';
                return;
            }

            let total = 0;
            const itemsHTML = items.map(item => {
                // Handle different item structures
                const itemData = item.item || item;
                // Use the correct item ID - prioritize item_id from the cart item, then itemData.id
                const itemId = item.item_id || itemData.id || 'unknown';
                
                console.log('Item structure debug:', {
                    item: item,
                    itemData: itemData,
                    item_item_id: item.item_id,
                    itemData_id: itemData.id,
                    finalItemId: itemId
                });
                const quantity = parseInt(item.quantity || 1);
                const price = parseFloat(itemData.price || item.price || 0);
                const itemTotal = price * quantity;
                total += itemTotal;
                
                console.log('Rendering item:', { 
                    itemId, 
                    name: itemData.name || 'Unnamed Product',
                    quantity, 
                    price, 
                    itemTotal,
                    itemData // Log full item data for debugging
                });

                return `
                    <div class="cart-item flex items-center justify-between border-b border-primary pb-4 mb-4" data-item-id="${itemId}">
                        <div class="flex items-center space-x-4">
                            <img src="${itemData.image_url || itemData.image || 'https://via.placeholder.com/60'}" 
                                 alt="${itemData.name || 'Product'}" 
                                 class="w-16 h-16 object-cover rounded border border-primary">
                            <div>
                                <h4 class="font-semibold text-gray-800">${itemData.name || 'Unnamed Product'}</h4>
                                <p class="text-primary font-medium">$${price.toFixed(2)}</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button class="decrease-quantity bg-secondary border border-primary px-2 py-1 rounded hover:bg-primary hover:text-white transition">-</button>
                            <span class="quantity px-3 font-medium">${quantity}</span>
                            <button class="increase-quantity bg-secondary border border-primary px-2 py-1 rounded hover:bg-primary hover:text-white transition">+</button>
                            <button class="remove-item bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 ml-2 transition">
                                <i class="fas fa-trash"></i> Remove
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            cartItemsContainer.innerHTML = itemsHTML;
            cartTotal.innerHTML = `
                <div class="text-right">
                    <p class="text-lg font-semibold">Total: $${total.toFixed(2)}</p>
                    <p class="text-sm text-gray-500">${items.length} ${items.length === 1 ? 'item' : 'items'} in cart</p>
                </div>
            `;
            
        } catch (error) {
            console.error('Error rendering cart items:', error);
            const cartItemsContainer = document.getElementById('cartItems');
            if (cartItemsContainer) {
                cartItemsContainer.innerHTML = '<p class="text-red-500 text-center py-8">Error loading cart. Please try again.</p>';
            }
        }
    }

    updateCartUI() {
        try {
            const cartCount = document.getElementById('cartCount');
            if (!cartCount) {
                console.warn('Cart count element not found');
                return;
            }
            
            // Calculate total items in cart
            let totalItems = 0;
            if (this.cart && this.cart.items && Array.isArray(this.cart.items)) {
                totalItems = this.cart.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
            } else if (this.cart && this.cart.cart_items && Array.isArray(this.cart.cart_items)) {
                // Fallback for different response format
                totalItems = this.cart.cart_items.reduce((sum, item) => sum + (item.quantity || 1), 0);
            }
            
            // Update the cart count in the UI
            cartCount.textContent = totalItems;
            
            // Also update the cart modal if it's open
            const cartModal = document.getElementById('cartModal');
            if (cartModal && !cartModal.classList.contains('hidden')) {
                this.renderCartItems();
            }
        } catch (error) {
            console.error('Error updating cart UI:', error);
        }
    }


    showNotification(message, type = 'info', duration = 3000) {
        // Create notification container if it doesn't exist
        let notificationContainer = document.getElementById('notification-container');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            notificationContainer.className = 'fixed top-4 right-4 z-50 space-y-2';
            document.body.appendChild(notificationContainer);
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `p-4 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full ${
            type === 'success' ? 'bg-green-500' : 
            type === 'error' ? 'bg-red-500' : 
            'bg-blue-500'
        } text-white flex items-center`;
        
        // Add icon based on type
        let iconClass = 'fa-info-circle';
        if (type === 'success') iconClass = 'fa-check-circle';
        if (type === 'error') iconClass = 'fa-exclamation-circle';
        
        notification.innerHTML = `
            <i class="fas ${iconClass} mr-2"></i>
            <span>${message}</span>
        `;
        
        // Add to container and animate in
        notificationContainer.appendChild(notification);
        setTimeout(() => notification.style.transform = 'translateX(0)', 10);
        
        // Auto-remove after duration
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, duration);
        
        // Also show a centered success animation for cart additions
        if (type === 'success' && message.includes('added to cart')) {
            this.showSuccessAnimation();
        }
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
