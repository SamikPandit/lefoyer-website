import {
    mockProducts,
    mockCategories,
    mockSubCategories,
    mockReviews,
    mockUser,
    mockTestimonials
  } from '../data/mockData';
  
  // Simulate API delay
  const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Products API
  export const getProducts = async (params = {}) => {
    await delay();
    
    let filteredProducts = [...mockProducts];
    
    // Filter by category
    if (params.category && params.category.length > 0) {
      filteredProducts = filteredProducts.filter(p => 
        params.category.includes(p.category.id)
      );
    }
    
    // Filter by sub_category
    if (params.sub_category && params.sub_category.length > 0) {
      filteredProducts = filteredProducts.filter(p => 
        params.sub_category.includes(p.sub_category.id)
      );
    }
    
    // Filter by suitable_for
    if (params.suitable_for && params.suitable_for.length > 0) {
      filteredProducts = filteredProducts.filter(p => 
        params.suitable_for.some(type => p.suitable_for.includes(type))
      );
    }
    
    // Filter by price range
    if (params.min_price) {
      filteredProducts = filteredProducts.filter(p => p.price >= params.min_price);
    }
    if (params.max_price) {
      filteredProducts = filteredProducts.filter(p => p.price <= params.max_price);
    }
    
    // Filter by featured
    if (params.is_featured) {
      filteredProducts = filteredProducts.filter(p => p.is_featured);
    }
    
    // Sorting
    if (params.ordering) {
      if (params.ordering === 'price') {
        filteredProducts.sort((a, b) => a.price - b.price);
      } else if (params.ordering === '-price') {
        filteredProducts.sort((a, b) => b.price - a.price);
      } else if (params.ordering === '-created_at') {
        // Newest first (mock)
        filteredProducts.reverse();
      } else if (params.ordering === '-rating') {
        filteredProducts.sort((a, b) => b.rating - a.rating);
      }
    }
    
    // Pagination
    const page = params.page || 1;
    const pageSize = 10;
    const startIndex = (page - 1) * pageSize;
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + pageSize);
    
    return {
      data: {
        count: filteredProducts.length,
        next: page * pageSize < filteredProducts.length ? `?page=${page + 1}` : null,
        previous: page > 1 ? `?page=${page - 1}` : null,
        results: paginatedProducts
      }
    };
  };
  
  export const getProductBySlug = async (slug) => {
    await delay();
    const product = mockProducts.find(p => p.slug === slug);
    if (!product) {
      throw new Error('Product not found');
    }
    return { data: product };
  };
  
  export const getRelatedProducts = async (productId) => {
    await delay();
    const product = mockProducts.find(p => p.id === productId);
    if (!product) return { data: [] };
    
    // Get products from same category
    const related = mockProducts
      .filter(p => p.id !== productId && p.category.id === product.category.id)
      .slice(0, 4);
    
    return { data: related };
  };
  
  // Categories API
  export const getCategories = async () => {
    await delay(200);
    return {
      data: {
        count: mockCategories.length,
        results: mockCategories
      }
    };
  };
  
  export const getSubCategories = async () => {
    await delay(200);
    return {
      data: {
        count: mockSubCategories.length,
        results: mockSubCategories
      }
    };
  };
  
  // Reviews API
  export const getProductReviews = async (productSlug) => {
    await delay();
    const product = mockProducts.find(p => p.slug === productSlug);
    if (!product) return { data: { results: [] } };
    
    const reviews = mockReviews[product.id] || [];
    return {
      data: {
        count: reviews.length,
        results: reviews
      }
    };
  };
  
  export const createProductReview = async (productSlug, reviewData) => {
    await delay();
    const product = mockProducts.find(p => p.slug === productSlug);
    if (!product) throw new Error('Product not found');
    
    const newReview = {
      id: Date.now(),
      ...reviewData,
      user: mockUser,
      created_at: new Date().toISOString()
    };
    
    if (!mockReviews[product.id]) {
      mockReviews[product.id] = [];
    }
    mockReviews[product.id].unshift(newReview);
    
    return { data: newReview };
  };
  
  // Auth API
  export const loginUser = async (credentials) => {
    await delay();
    
    // Accept any username/password for demo
    if (credentials.username && credentials.password) {
      const token = 'mock-jwt-token-' + Date.now();
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(mockUser));
      return {
        data: {
          access: token,
          refresh: 'mock-refresh-token',
          user: mockUser
        }
      };
    }
    
    throw new Error('Invalid credentials');
  };
  
  export const registerUser = async (userData) => {
    await delay();
    
    // Mock successful registration
    const newUser = {
      ...mockUser,
      username: userData.username,
      email: userData.email,
      phone_number: userData.phone_number
    };
    
    return { data: newUser };
  };
  
  export const getCurrentUser = async () => {
    await delay(200);
    const user = localStorage.getItem('user');
    if (user) {
      return { data: JSON.parse(user) };
    }
    throw new Error('Not authenticated');
  };
  
  // Wishlist API (using localStorage)
  export const getWishlist = async () => {
    await delay(200);
    const wishlist = JSON.parse(localStorage.getItem('wishlist') || '{"products": []}');
    
    // Populate product details
    wishlist.products = wishlist.products.map(productId => 
      mockProducts.find(p => p.id === productId)
    ).filter(Boolean);
    
    return { data: wishlist };
  };
  
  export const addToWishlist = async (productId) => {
    await delay(300);
    const wishlist = JSON.parse(localStorage.getItem('wishlist') || '{"products": []}');
    
    if (!wishlist.products.includes(productId)) {
      wishlist.products.push(productId);
    }
    
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    
    // Return populated wishlist
    const populatedWishlist = {
      products: wishlist.products.map(id => mockProducts.find(p => p.id === id)).filter(Boolean)
    };
    
    return { data: populatedWishlist };
  };
  
  export const removeFromWishlist = async (productId) => {
    await delay(300);
    const wishlist = JSON.parse(localStorage.getItem('wishlist') || '{"products": []}');
    
    wishlist.products = wishlist.products.filter(id => id !== productId);
    
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    
    // Return populated wishlist
    const populatedWishlist = {
      products: wishlist.products.map(id => mockProducts.find(p => p.id === id)).filter(Boolean)
    };
    
    return { data: populatedWishlist };
  };
  
  // Orders API
  export const createOrder = async (orderData) => {
    await delay(500);
    
    const order = {
      id: Date.now(),
      ...orderData,
      status: 'pending',
      created_at: new Date().toISOString(),
      total: orderData.total || 0
    };
    
    // Save to localStorage
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    orders.unshift(order);
    localStorage.setItem('orders', JSON.stringify(orders));
    
    return { data: order };
  };
  
  export const getOrders = async () => {
    await delay(300);
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    return { data: { results: orders } };
  };
  
  // Coupon API
  export const applyCoupon = async (code) => {
    await delay(300);
    
    // Mock coupons
    const coupons = {
      'WELCOME10': { discount: 10, type: 'percentage' },
      'SAVE20': { discount: 20, type: 'percentage' },
      'FLAT100': { discount: 100, type: 'fixed' }
    };
    
    const coupon = coupons[code.toUpperCase()];
    if (coupon) {
      return { data: coupon };
    }
    
    throw new Error('Invalid coupon code');
  };
  
  export default {
    getProducts,
    getProductBySlug,
    getRelatedProducts,
    getCategories,
    getSubCategories,
    getProductReviews,
    createProductReview,
    loginUser,
    registerUser,
    getCurrentUser,
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    createOrder,
    getOrders,
    applyCoupon
  };