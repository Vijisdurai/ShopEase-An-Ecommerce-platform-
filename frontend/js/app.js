// Main application module
class App {
    constructor() {
        this.baseURL = 'http://localhost:8000';
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
        if (!productsGrid) return;

        // Show loading skeleton while processing
        productsGrid.innerHTML = `
            <div class="col-span-full md:col-span-6 lg:col-span-4 xl:col-span-3" aria-hidden="true">
                <div class="animate-pulse">
                    <div class="bg-gray-200 h-48 rounded-t-lg"></div>
                    <div class="p-4 space-y-2">
                        <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div class="h-3 bg-gray-200 rounded w-1/2"></div>
                        <div class="h-3 bg-gray-200 rounded w-1/4"></div>
                    </div>
                </div>
            </div>
        `.repeat(8);

        // Small delay to show the loading state (UX improvement)
        setTimeout(() => {
            if (!products || products.length === 0) {
                productsGrid.innerHTML = `
                    <div class="col-span-full text-center py-16">
                        <div class="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
                            <i class="fas fa-box-open text-3xl text-gray-400"></i>
                        </div>
                        <h3 class="text-lg font-medium text-gray-900 mb-1">No products found</h3>
                        <p class="text-gray-500 mb-4">Try adjusting your search or filters</p>
                        <button 
                            onclick="this.currentFilters = {}; this.loadProducts();" 
                            class="text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                            Clear all filters
                        </button>
                    </div>
                `;
                return;
            }

            productsGrid.innerHTML = products.map(product => `
                <div class="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 overflow-hidden flex flex-col h-full">
                    <div class="relative pt-[75%] bg-gray-50 overflow-hidden">
                        <img 
                            src="${product.image_url || 'https://via.placeholder.com/400x300?text=No+Image'}" 
                            alt="${product.name}"
                            class="absolute top-0 left-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                            onerror="this.onerror=null; this.src='https://via.placeholder.com/400x300?text=Image+Not+Available'"
                        >
                        ${product.stock_quantity <= 0 ? `
                            <div class="absolute top-3 right-3 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md">
                                Out of Stock
                            </div>` : 
                            `<div class="absolute top-3 right-3 bg-green-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md">
                                In Stock
                            </div>`
                        }
                        <div class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                            <span class="text-white text-sm font-medium">${product.category || 'Uncategorized'}</span>
                        </div>
                    </div>
                    <div class="p-4 flex-grow flex flex-col">
                        <div class="flex-grow">
                            <h3 class="font-semibold text-gray-900 text-lg mb-1 line-clamp-2" title="${product.name}">
                                ${product.name}
                            </h3>
                            <p class="text-gray-500 text-sm mb-3 line-clamp-2">
                                ${product.description || 'No description available'}
                            </p>
                        </div>
                        <div class="mt-auto">
                            <div class="flex items-center justify-between mt-3">
                                <span class="text-xl font-bold text-gray-900">$${product.price.toFixed(2)}</span>
                                <button 
                                    class="flex-1 ml-4 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors ${product.stock_quantity <= 0 ? 'opacity-50 cursor-not-allowed' : ''}"
                                    onclick="event.stopPropagation(); 
                                        if (${product.stock_quantity <= 0}) return;
                                        const btn = this; 
                                        const icon = btn.querySelector('i');
                                        const text = btn.querySelector('span');
                                        const originalText = text.textContent;
                                        const originalClass = icon.className;
                                        
                                        // Show loading state
                                        btn.disabled = true;
                                        icon.className = 'fas fa-spinner fa-spin';
                                        text.textContent = 'Adding...';
                                        
                                        // Call addToCart
                                        window.cartManager.addToCart(${product.id}, 1)
                                            .then(() => {
                                                // Show success state
                                                icon.className = 'fas fa-check';
                                                text.textContent = 'Added!';
                                                btn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
                                                btn.classList.add('bg-green-500', 'hover:bg-green-600');
                                            })
                                            .catch(error => {
                                                console.error('Error adding to cart:', error);
                                                icon.className = 'fas fa-exclamation';
                                                text.textContent = 'Error';
                                                btn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
                                                btn.classList.add('bg-red-500', 'hover:bg-red-600');
                                            })
                                            .finally(() => {
                                                // Revert button state after a delay
                                                setTimeout(() => {
                                                    btn.disabled = ${product.stock_quantity <= 0};
                                                    icon.className = originalClass;
                                                    text.textContent = originalText;
                                                    btn.classList.remove('bg-green-500', 'hover:bg-green-600', 'bg-red-500', 'hover:bg-red-600');
                                                    btn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
                                                }, 1500);
                                            });"
                                    ${product.stock_quantity <= 0 ? 'disabled' : ''}
                                    aria-label="${product.stock_quantity <= 0 ? 'Out of stock' : 'Add to cart'}"
                                    title="${product.stock_quantity <= 0 ? 'Out of stock' : 'Add to cart'}"
                                >
                                    <i class="fas ${product.stock_quantity > 0 ? 'fa-shopping-cart' : 'fa-ban'}"></i>
                                    <span>${product.stock_quantity > 0 ? 'Add to Cart' : 'Out of Stock'}</span>
                                </button>
                            </div>
                            ${product.stock_quantity > 0 && product.stock_quantity <= 5 ? `
                                <div class="mt-2 text-xs text-amber-600">
                                    <i class="fas fa-exclamation-circle mr-1"></i>
                                    Only ${product.stock_quantity} left in stock!
                                </div>` : ''
                            }
                        </div>
                    </div>
                </div>
            `).join('');
        }, 300); // Small delay for better UX
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
