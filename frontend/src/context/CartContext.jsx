import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const CartContext = createContext();

export const useCart = () => {
    return useContext(CartContext);
};

export const CartProvider = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const [cart, setCart] = useState({ items: [], total: 0, count: 0 });

    const calculateTotal = (items) => {
        return items.reduce((total, item) => {
            // Handle both flattened (frontend) and nested (backend-like) structures if necessary,
            // but our state uses flattened.
            const price = item.price || (item.product ? item.product.price : 0);
            return total + (Number(price) * item.quantity);
        }, 0);
    };

    const calculateCount = (items) => {
        return items.reduce((count, item) => count + item.quantity, 0);
    };

    const fetchCart = async () => {
        if (!isAuthenticated) return;
        try {
            const response = await api.get('cart/');
            const cartData = response.data;
            // Map backend response to frontend structure
            // Backend: { items: [{ id, product: {...}, quantity }] }
            // Frontend expects items to be array of { ...product, quantity, cartItemId }
            const mappedItems = cartData.items.map(item => ({
                ...item.product,
                quantity: item.quantity,
                cartItemId: item.id
            }));

            setCart({
                items: mappedItems,
                total: calculateTotal(mappedItems),
                count: calculateCount(mappedItems)
            });
        } catch (error) {
            console.error('Error fetching cart:', error);
        }
    };

    useEffect(() => {
        const initializeCart = async () => {
            if (isAuthenticated) {
                // Check for local items to merge
                try {
                    const localCartStr = localStorage.getItem('cart');
                    if (localCartStr) {
                        const localCart = JSON.parse(localCartStr);
                        if (localCart.items && localCart.items.length > 0) {
                            // Merge items to backend
                            // We use a loop here, but a bulk API would be better in production
                            for (const item of localCart.items) {
                                try {
                                    await api.post('cart/add/', { product_id: item.id, quantity: item.quantity });
                                } catch (e) {
                                    console.error("Failed to sync item", item.name, e);
                                }
                            }
                            // Clear local cart after syncing to avoid double counting or confusion
                            localStorage.removeItem('cart');
                        }
                    }
                } catch (error) {
                    console.error('Error syncing cart:', error);
                }

                // Always fetch the latest backend cart
                await fetchCart();
            } else {
                // Load from local storage for guest
                try {
                    const localCart = localStorage.getItem('cart');
                    if (localCart) {
                        setCart(JSON.parse(localCart));
                    } else {
                        setCart({ items: [], total: 0, count: 0 });
                    }
                } catch (error) {
                    console.error('Error reading local cart:', error);
                }
            }
        };

        initializeCart();
    }, [isAuthenticated]);

    const addToCart = async (product, quantity = 1) => {
        if (isAuthenticated) {
            try {
                await api.post('cart/add/', { product_id: product.id, quantity });
                await fetchCart();
                return true;
            } catch (error) {
                console.error('Error adding to cart:', error);
                return false;
            }
        } else {
            // Local cart logic
            setCart((prevCart) => {
                const existingItemIndex = prevCart.items.findIndex((item) => item.id === product.id);
                let newItems;
                if (existingItemIndex > -1) {
                    newItems = [...prevCart.items];
                    newItems[existingItemIndex].quantity += quantity;
                } else {
                    newItems = [...prevCart.items, { ...product, quantity }];
                }
                const updatedCart = {
                    items: newItems,
                    total: newItems.reduce((total, item) => total + (item.price * item.quantity), 0),
                    count: newItems.reduce((count, item) => count + item.quantity, 0),
                };
                localStorage.setItem('cart', JSON.stringify(updatedCart));
                return updatedCart;
            });
            return true;
        }
    };

    const removeFromCart = async (productId) => {
        if (isAuthenticated) {
            try {
                // Find cart item id
                const item = cart.items.find(item => item.id === productId);
                if (item && item.cartItemId) {
                    await api.delete(`cart/${item.cartItemId}/remove_item/`);
                    await fetchCart();
                }
            } catch (error) {
                console.error('Error removing from cart:', error);
            }
        } else {
            setCart((prevCart) => {
                const newItems = prevCart.items.filter((item) => item.id !== productId);
                const updatedCart = {
                    items: newItems,
                    total: newItems.reduce((total, item) => total + (item.price * item.quantity), 0),
                    count: newItems.reduce((count, item) => count + item.quantity, 0),
                };
                localStorage.setItem('cart', JSON.stringify(updatedCart));
                return updatedCart;
            });
        }
    };

    const updateQuantity = async (productId, newQuantity) => {
        if (newQuantity < 1) return;
        if (isAuthenticated) {
            try {
                const item = cart.items.find(item => item.id === productId);
                if (item && item.cartItemId) {
                    await api.patch(`cart/${item.cartItemId}/update_item/`, { quantity: newQuantity });
                    await fetchCart();
                }
            } catch (error) {
                console.error('Error updating quantity:', error);
            }
        } else {
            setCart((prevCart) => {
                const newItems = prevCart.items.map((item) =>
                    item.id === productId ? { ...item, quantity: newQuantity } : item
                );
                const updatedCart = {
                    items: newItems,
                    total: newItems.reduce((total, item) => total + (item.price * item.quantity), 0),
                    count: newItems.reduce((count, item) => count + item.quantity, 0),
                };
                localStorage.setItem('cart', JSON.stringify(updatedCart));
                return updatedCart;
            });
        }
    };

    const clearCart = async () => {
        if (isAuthenticated) {
            try {
                await api.delete('cart/clear/');
                await fetchCart();
            } catch (error) {
                console.error('Error clearing cart:', error);
            }
        } else {
            const emptyCart = { items: [], total: 0, count: 0 };
            setCart(emptyCart);
            localStorage.setItem('cart', JSON.stringify(emptyCart));
        }
    };

    const value = {
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
    };

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
