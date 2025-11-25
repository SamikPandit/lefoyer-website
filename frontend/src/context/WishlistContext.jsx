import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getWishlist,
  addToWishlist as mockAddToWishlist,
  removeFromWishlist as mockRemoveFromWishlist
} from '../services/mockApi';

const WishlistContext = createContext();

export const WishlistProvider = ({ children }) => {
  const [wishlist, setWishlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWishlist = async () => {
    try {
      setLoading(true);
      const response = await getWishlist();
      setWishlist(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch wishlist:', err);
      setError('Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlist();
  }, []);

  const addToWishlist = async (productId) => {
    try {
      const response = await mockAddToWishlist(productId);
      setWishlist(response.data);
      return true;
    } catch (err) {
      console.error('Failed to add to wishlist:', err);
      return false;
    }
  };

  const removeFromWishlist = async (productId) => {
    try {
      const response = await mockRemoveFromWishlist(productId);
      setWishlist(response.data);
      return true;
    } catch (err) {
      console.error('Failed to remove from wishlist:', err);
      return false;
    }
  };

  const value = {
    wishlist,
    loading,
    error,
    addToWishlist,
    removeFromWishlist,
    fetchWishlist
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within WishlistProvider');
  }
  return context;
};