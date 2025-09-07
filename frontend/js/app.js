// Main application module
class App {
    constructor() {
        this.baseURL = 'https://ecommerce-backend.onrender.com';
        this.currentFilters = {};
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadCategories();
        this.loadProducts();
        
        // Update navigation bar based on auth state
        if (window.authManager && window.authManager.isAuthenticated()) {
            window.authManager.showUserMenu();
        } else {
            window.authManager.showAuthButtons();
        }
    }

    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        const clearSearchBtn = document.getElementById('clearSearch');
        const toggleFiltersBtn = document.getElementById('toggleFilters');
        const applyFiltersBtn = document.getElementById('applyFilters');
        const clearFiltersBtn = document.getElementById('clearFilters');
        const filtersPanel = document.getElementById('filtersPanel');
        const filterCaret = document.getElementById('filterCaret');
        
        let searchTimeout;
        let filtersVisible = false;

        // Toggle filters panel
        toggleFiltersBtn?.addEventListener('click', () => {
            filtersVisible = !filtersVisible;
            filtersPanel.classList.toggle('hidden', !filtersVisible);
            filterCaret.className = `fas fa-chevron-${filtersVisible ? 'up' : 'down'} ml-2 text-sm`;
        });

        // Clear search
        clearSearchBtn?.addEventListener('click', () => {
            searchInput.value = '';
            this.currentFilters.search = '';
            this.loadProducts({ ...this.currentFilters, search: '' });
        });

        // Apply filters
        applyFiltersBtn?.addEventListener('click', () => this.applyFilters());
        
        // Clear all filters
        clearFiltersBtn?.addEventListener('click', () => {
            document.getElementById('categoryFilter').value = '';
            document.getElementById('minPrice').value = '';
            document.getElementById('maxPrice').value = '';
            this.currentFilters = { search: this.currentFilters.search };
            this.loadProducts(this.currentFilters);
        });

        // Dynamic search as you type with debounce
        searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const searchTerm = e.target.value.trim();
            
            searchTimeout = setTimeout(() => {
                this.currentFilters.search = searchTerm;
                this.loadProducts({ ...this.currentFilters });
            }, 300);
        });
        
        // Support Enter key for search
        searchInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimeout);
                this.currentFilters.search = e.target.value.trim();
                this.loadProducts({ ...this.currentFilters });
            }
        });
    }

    async loadCategories() {
        try {
            const response = await fetch(`${this.baseURL}/categories`);
            if (response.ok) {
                const categories = await response.json();
                this.populateCategories(categories);
            }
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    }

    populateCategories(categories) {
        const categoryFilter = document.getElementById('categoryFilter');
        
        // Clear existing options except "All Categories"
        categoryFilter.innerHTML = '<option value="">All Categories</option>';
        
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });
    }

    async loadProducts(filters = {}) {
        this.showLoading(true);
        
        try {
            const queryParams = new URLSearchParams();
            
            if (filters.search) queryParams.append('search', filters.search);
            if (filters.category) queryParams.append('category', filters.category);
            if (filters.min_price) queryParams.append('min_price', filters.min_price);
            if (filters.max_price) queryParams.append('max_price', filters.max_price);
            
            const response = await fetch(`${this.baseURL}/items?${queryParams}`);
            
            if (response.ok) {
                const products = await response.json();
                this.renderProducts(products);
            } else {
                throw new Error('Failed to load products');
            }
        } catch (error) {
            console.error('Error loading products:', error);
            this.showError('Failed to load products. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    applyFilters() {
        const filters = {
            search: this.currentFilters.search || '',
            category: document.getElementById('categoryFilter').value || '',
            min_price: document.getElementById('minPrice').value || '',
            max_price: document.getElementById('maxPrice').value || ''
        };

        // Remove empty filters (except search)
        Object.keys(filters).forEach(key => {
            if (key !== 'search' && !filters[key]) {
                delete filters[key];
            }
        });

        this.currentFilters = filters;
        this.loadProducts(filters);
    }

    renderProducts(products) {
        const productsGrid = document.getElementById('productsGrid');
        
        if (products.length === 0) {
            productsGrid.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i class="fas fa-search text-4xl text-gray-400 mb-4"></i>
                    <p class="text-xl text-gray-600">No products found</p>
                    <p class="text-gray-500">Try adjusting your filters</p>
                </div>
            `;
            return;
        }

        const productsHTML = products.map(product => `
            <div class="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 border border-gray-200 hover:border-primary">
                <img src="${product.image_url || 'https://via.placeholder.com/300x200'}" 
                     alt="${product.name}" 
                     class="w-full h-48 object-cover">
                <div class="p-4">
                    <h3 class="text-lg font-semibold mb-2 text-gray-800">${product.name}</h3>
                    <p class="text-gray-600 text-sm mb-3 line-clamp-2">${product.description || 'No description available'}</p>
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-2xl font-bold text-primary">$${product.price.toFixed(2)}</span>
                        <span class="text-sm text-gray-600 bg-secondary px-2 py-1 rounded border border-primary">${product.category}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-gray-500">
                            <i class="fas fa-box text-primary"></i> ${product.stock_quantity} in stock
                        </span>
                        <button onclick="window.cartManager.addToCart(${product.id})" 
                                class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-orange-500 transition shadow-md ${product.stock_quantity === 0 ? 'opacity-50 cursor-not-allowed' : ''}"
                                ${product.stock_quantity === 0 ? 'disabled' : ''}>
                            <i class="fas fa-cart-plus"></i> Add to Cart
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        productsGrid.innerHTML = productsHTML;
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        const productsGrid = document.getElementById('productsGrid');
        
        if (show) {
            loading.classList.remove('hidden');
            productsGrid.classList.add('opacity-50');
        } else {
            loading.classList.add('hidden');
            productsGrid.classList.remove('opacity-50');
        }
    }

    showError(message) {
        const productsGrid = document.getElementById('productsGrid');
        productsGrid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
                <p class="text-xl text-red-600">${message}</p>
            </div>
        `;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
