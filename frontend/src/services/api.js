import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If 401, clear token and reload to reset state as guest
      // But only if we have a token, to avoid infinite loops if guest access is also 401 (which shouldn't happen now)
      if (localStorage.getItem('authToken')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

// Product APIs
export const getFeaturedProducts = () => api.get('products/featured/');
export const getProducts = (params) => api.get('products/products/', { params });
export const getProductBySlug = (slug) => api.get(`products/products/${slug}/`);
export const getRelatedProducts = (productId) => api.get(`products/products/${productId}/related/`);
export const getCategories = () => api.get('products/categories/');
export const getSubCategories = (params) => api.get('products/subcategories/', { params });

// Auth APIs
export const loginUser = (credentials) => api.post('token/', credentials);
export const registerUser = (userData) => api.post('auth/register/', userData);

// Order APIs
export const createOrder = (orderData) => api.post('orders/', orderData);

// Review APIs
export const getProductReviews = (productSlug) => api.get(`products/${productSlug}/reviews/`);
export const createProductReview = (productSlug, reviewData) => api.post(`products/${productSlug}/reviews/`, reviewData);

// Wishlist APIs
export const getWishlist = () => api.get('wishlist/');
export const addToWishlist = (productId) => api.post('wishlist/add/', { product_id: productId });
export const removeFromWishlist = (productId) => api.delete(`wishlist/${productId}/remove/`);

export default api;