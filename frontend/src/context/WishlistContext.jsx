import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const WishlistContext = createContext(null);

export const WishlistProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [wishlist, setWishlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWishlist = async () => {
    if (!token) {
      setWishlist(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await api.get('wishlist/');
      setWishlist(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch wishlist:', err);
      setError('Failed to load wishlist.');
      setWishlist(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlist();
  }, [token]); // Refetch wishlist when token changes (login/logout)

  const addToWishlist = async (productId) => {
    if (!token) {
      setError('Please log in to add items to your wishlist.');
      return;
    }
    try {
      const response = await api.post('wishlist/add/', { product_id: productId });
      setWishlist(response.data);
      setError(null);
      return true;
    } catch (err) {
      console.error('Failed to add to wishlist:', err);
      setError('Failed to add item to wishlist.');
      return false;
    }
  };

  const removeFromWishlist = async (productId) => {
    if (!token) return;
    try {
      const response = await api.delete(`wishlist/remove/${productId}/`);
      setWishlist(response.data);
      setError(null);
      return true;
    } catch (err) {
      console.error('Failed to remove from wishlist:', err);
      setError('Failed to remove item from wishlist.');
      return false;
    }
  };

  const wishlistContextValue = {
    wishlist,
    loading,
    error,
    fetchWishlist,
    addToWishlist,
    removeFromWishlist,
  };

  return (
    <WishlistContext.Provider value={wishlistContextValue}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  return useContext(WishlistContext);
};
