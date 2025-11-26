import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const useCart = () => {
    return useContext(CartContext);
};

export const CartProvider = ({ children }) => {
    const [cart, setCart] = useState(() => {
        try {
            const localCart = localStorage.getItem('cart');
            return localCart ? JSON.parse(localCart) : { items: [], total: 0, count: 0 };
        } catch (error) {
            console.error('Error reading cart from localStorage:', error);
            return { items: [], total: 0, count: 0 };
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('cart', JSON.stringify(cart));
        } catch (error) {
            console.error('Error saving cart to localStorage:', error);
        }
    }, [cart]);

    const calculateTotal = (items) => {
        return items.reduce((total, item) => total + (item.price * item.quantity), 0);
    };

    const calculateCount = (items) => {
        return items.reduce((count, item) => count + item.quantity, 0);
    };

    const addToCart = (product, quantity = 1) => {
        setCart((prevCart) => {
            const existingItemIndex = prevCart.items.findIndex((item) => item.id === product.id);
            let newItems;

            if (existingItemIndex > -1) {
                // Item exists, update quantity
                newItems = [...prevCart.items];
                newItems[existingItemIndex].quantity += quantity;
            } else {
                // New item
                newItems = [...prevCart.items, { ...product, quantity }];
            }

            return {
                items: newItems,
                total: calculateTotal(newItems),
                count: calculateCount(newItems),
            };
        });
        return true; // Success indicator
    };

    const removeFromCart = (productId) => {
        setCart((prevCart) => {
            const newItems = prevCart.items.filter((item) => item.id !== productId);
            return {
                items: newItems,
                total: calculateTotal(newItems),
                count: calculateCount(newItems),
            };
        });
    };

    const updateQuantity = (productId, newQuantity) => {
        if (newQuantity < 1) return;

        setCart((prevCart) => {
            const newItems = prevCart.items.map((item) =>
                item.id === productId ? { ...item, quantity: newQuantity } : item
            );
            return {
                items: newItems,
                total: calculateTotal(newItems),
                count: calculateCount(newItems),
            };
        });
    };

    const clearCart = () => {
        setCart({ items: [], total: 0, count: 0 });
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
