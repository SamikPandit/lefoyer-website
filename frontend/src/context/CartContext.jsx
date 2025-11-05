
import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(null);

  const fetchCart = async () => {
    try {
      const response = await api.get('/cart/');
      setCart(response.data);
    } catch (error) {
      console.error('Failed to fetch cart:', error);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const addToCart = async (productId, quantity) => {
    try {
      const response = await api.post('/cart/add/', { product_id: productId, quantity });
      setCart(response.data);
      return true;
    } catch (error) {
      console.error('Failed to add to cart:', error);
      return false;
    }
  };

  const removeFromCart = async (itemId) => {
    try {
      const response = await api.post('/cart/remove/', { item_id: itemId });
      setCart(response.data);
      return true;
    } catch (error) {
      console.error('Failed to remove from cart:', error);
      return false;
    }
  };

  const updateCartItem = async (itemId, quantity) => {
    try {
      const response = await api.post('/cart/update/', { item_id: itemId, quantity });
      setCart(response.data);
      return true;
    } catch (error) {
      console.error('Failed to update cart item:', error);
      return false;
    }
  };

  const cartContextValue = {
    cart,
    addToCart,
    removeFromCart,
    updateCartItem,
    fetchCart,
  };

  return (
    <CartContext.Provider value={cartContextValue}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  return useContext(CartContext);
};
