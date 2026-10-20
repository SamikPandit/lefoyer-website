/**
 * Cart state — IMPL_SPEC §3 WP-07.
 *
 * Contract this provider exposes:
 *   { cart, loading, initialised, error, pendingItemIds, mergeSkipped,
 *     addToCart, removeFromCart, updateQuantity, clearCart, refresh,
 *     dismissMergeNotice }
 *
 * `cart` is `{ id, items, count, total }`, where each item is the product object
 * flattened with `{ quantity, cartItemId, unitPrice, lineTotal }`.
 *
 * MONEY WARNING. `cart.total` here is a *badge-grade* figure, computed from
 * `effectivePrice()` so it at least matches what the backend charges (the old
 * code summed `item.price`, the list price, while the server charges
 * `discount_price` — the displayed total could differ from the amount taken).
 * It still knows nothing about coupons, shipping or the free-shipping threshold.
 * Anything that shows the customer a payable amount must use
 * `getCartSummary()` (§2b #15), which computes it server-side.
 *
 * Every mutation resolves to `true` on success, or to the **server's own message
 * string** on failure — so `cart/views.py`'s "Only 3 units available" reaches the
 * shopper verbatim instead of being flattened into `false`.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  addToCartApi,
  clearCartApi,
  effectivePrice,
  getApiErrorMessage,
  getCart,
  mergeCart,
  removeCartItemApi,
  updateCartItemApi,
} from '../services/api';
import { trackAddToCart } from '../services/analytics';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};

const EMPTY_CART = Object.freeze({ id: null, items: [], count: 0, total: 0 });

/**
 * Accepts either the backend shape (`items: [{id, product, quantity}]`) or the
 * guest shape kept in localStorage (`items: [{...product, quantity}]`) and
 * produces one normalised cart. `cartItemId` is null for guest lines, which is
 * exactly right: a guest line has no server identity.
 */
const normaliseCart = (data) => {
  const rawItems = Array.isArray(data?.items) ? data.items : [];

  const items = rawItems
    .map((line) => {
      const isServerLine = Boolean(line && line.product);
      const product = isServerLine ? line.product : line;
      if (!product || product.id === undefined || product.id === null) return null;

      const quantity = Math.max(1, Math.trunc(Number(line.quantity ?? 1)) || 1);
      const unitPrice = effectivePrice(product);

      return {
        ...product,
        quantity,
        cartItemId: isServerLine ? line.id : line.cartItemId ?? null,
        unitPrice,
        lineTotal: unitPrice * quantity,
      };
    })
    .filter(Boolean);

  return {
    id: data?.id ?? null,
    items,
    count: items.reduce((total, item) => total + item.quantity, 0),
    total: items.reduce((total, item) => total + item.lineTotal, 0),
  };
};

const readGuestCart = () => {
  try {
    const raw = localStorage.getItem('cart');
    return raw ? normaliseCart(JSON.parse(raw)) : { ...EMPTY_CART };
  } catch {
    return { ...EMPTY_CART };
  }
};

const writeGuestCart = (cart) => {
  try {
    localStorage.setItem('cart', JSON.stringify({ items: cart.items }));
  } catch {
    /* non-fatal: the guest cart simply will not survive a reload */
  }
};

const dropGuestCart = () => {
  try {
    localStorage.removeItem('cart');
  } catch {
    /* non-fatal */
  }
};

export const CartProvider = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [cart, setCart] = useState({ ...EMPTY_CART });
  const [loading, setLoading] = useState(false);
  const [initialised, setInitialised] = useState(false);
  const [error, setError] = useState(null);
  const [pendingItemIds, setPendingItemIds] = useState([]);
  const [mergeSkipped, setMergeSkipped] = useState([]);

  // The current cart, readable from a callback without making every mutation
  // depend on `cart` (which would rebuild the whole context value on each keypress
  // of a quantity stepper).
  const cartRef = useRef(cart);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const markPending = useCallback((productId, isPending) => {
    setPendingItemIds((previous) => {
      const without = previous.filter((id) => id !== productId);
      return isPending ? [...without, productId] : without;
    });
  }, []);

  const applyServerCart = useCallback((data) => {
    const next = normaliseCart(data);
    setCart(next);
    return next;
  }, []);

  /** Re-reads the authenticated cart. A guest cart is local, so this is a no-op for guests. */
  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(readGuestCart());
      setError(null);
      setInitialised(true);
      return true;
    }
    setLoading(true);
    try {
      const data = await getCart();
      applyServerCart(data);
      setError(null);
      return true;
    } catch (requestError) {
      const message = getApiErrorMessage(requestError, 'We could not load your cart.');
      setError(message);
      return message;
    } finally {
      setLoading(false);
      setInitialised(true);
    }
  }, [isAuthenticated, applyServerCart]);

  /* Initialisation.
     Gated on `authLoading === false`: until AuthContext has settled we do not know
     whether this is a guest or a signed-in shopper, and guessing means either
     calling `cart/` without a token (401) or showing an empty cart to someone who
     has one. `initialised` stays false throughout, so the UI shows a skeleton
     rather than flashing "Your cart is empty". */
  useEffect(() => {
    if (authLoading) return undefined;

    let cancelled = false;

    const initialise = async () => {
      setLoading(true);
      setError(null);

      if (!isAuthenticated) {
        if (!cancelled) {
          setCart(readGuestCart());
          setMergeSkipped([]);
          setLoading(false);
          setInitialised(true);
        }
        return;
      }

      // Sign-in hand-off: push the whole guest cart in ONE request. The old
      // per-item loop fired N sequential requests, swallowed every failure, and
      // then deleted localStorage.cart regardless — so a line rejected for stock
      // was silently lost. Now localStorage is only cleared once the server has
      // confirmed, and whatever it refused comes back in `skipped[]` for the UI
      // to explain.
      const guestCart = readGuestCart();
      if (guestCart.items.length > 0) {
        try {
          const result = await mergeCart(guestCart.items);
          if (cancelled) return;
          dropGuestCart();
          setMergeSkipped(Array.isArray(result?.skipped) ? result.skipped : []);
          if (result?.cart) {
            applyServerCart(result.cart);
            setLoading(false);
            setInitialised(true);
            return;
          }
        } catch (mergeError) {
          if (cancelled) return;
          // The guest cart is NOT cleared: it is still the only copy of those
          // lines, and the merge can be retried on the next sign-in or reload.
          setError(
            getApiErrorMessage(
              mergeError,
              'We could not move the items from your previous session into your cart.'
            )
          );
        }
      } else {
        setMergeSkipped([]);
      }

      try {
        const data = await getCart();
        if (cancelled) return;
        applyServerCart(data);
      } catch (requestError) {
        if (cancelled) return;
        setError(getApiErrorMessage(requestError, 'We could not load your cart.'));
      } finally {
        if (!cancelled) {
          setLoading(false);
          setInitialised(true);
        }
      }
    };

    initialise();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, applyServerCart]);

  /* ---------------- mutations ---------------- *
   * Each resolves to `true`, or to a message string explaining the refusal. */

  const addToCart = useCallback(
    async (product, quantity = 1) => {
      if (!product || product.id === undefined || product.id === null) {
        return 'That product could not be added.';
      }
      const qty = Math.max(1, Math.trunc(Number(quantity)) || 1);

      if (isAuthenticated) {
        markPending(product.id, true);
        try {
          const data = await addToCartApi(product.id, qty);
          applyServerCart(data);
          setError(null);
          trackAddToCart(product, qty);
          return true;
        } catch (requestError) {
          return getApiErrorMessage(requestError, 'We could not add that to your cart.');
        } finally {
          markPending(product.id, false);
        }
      }

      // Guest cart. Availability is the server's answer (§2d) and is re-checked at
      // sign-in by `mergeCart()` and again at order time, so the local copy only
      // has to stop obvious nonsense: never exceed the available quantity the
      // product payload reported.
      const existing = cartRef.current.items.find((item) => item.id === product.id);
      const alreadyIn = existing ? existing.quantity : 0;
      const max = Number(product.available_quantity);
      if (Number.isFinite(max) && max > 0 && alreadyIn + qty > max) {
        return `Only ${max} units available.`;
      }

      const items = existing
        ? cartRef.current.items.map((item) =>
            item.id === product.id ? { ...item, quantity: item.quantity + qty } : item
          )
        : [...cartRef.current.items, { ...product, quantity: qty }];

      const next = normaliseCart({ id: null, items });
      setCart(next);
      writeGuestCart(next);
      setError(null);
      trackAddToCart(product, qty);
      return true;
    },
    [isAuthenticated, markPending, applyServerCart]
  );

  const removeFromCart = useCallback(
    async (productId) => {
      const item = cartRef.current.items.find((candidate) => candidate.id === productId);
      if (!item) return true; // already gone — not an error worth showing

      if (isAuthenticated) {
        if (!item.cartItemId) return 'That item is out of sync — please refresh your cart.';
        markPending(productId, true);
        try {
          const data = await removeCartItemApi(item.cartItemId);
          applyServerCart(data);
          setError(null);
          return true;
        } catch (requestError) {
          return getApiErrorMessage(requestError, 'We could not remove that item.');
        } finally {
          markPending(productId, false);
        }
      }

      const next = normaliseCart({
        id: null,
        items: cartRef.current.items.filter((candidate) => candidate.id !== productId),
      });
      setCart(next);
      writeGuestCart(next);
      return true;
    },
    [isAuthenticated, markPending, applyServerCart]
  );

  const updateQuantity = useCallback(
    async (productId, newQuantity) => {
      const quantity = Math.trunc(Number(newQuantity));
      if (!Number.isFinite(quantity)) return 'That quantity is not valid.';
      if (quantity < 1) return removeFromCart(productId);

      const item = cartRef.current.items.find((candidate) => candidate.id === productId);
      if (!item) return 'That item is no longer in your cart.';

      if (isAuthenticated) {
        if (!item.cartItemId) return 'That item is out of sync — please refresh your cart.';
        markPending(productId, true);
        try {
          const data = await updateCartItemApi(item.cartItemId, quantity);
          applyServerCart(data);
          setError(null);
          return true;
        } catch (requestError) {
          return getApiErrorMessage(requestError, 'We could not change that quantity.');
        } finally {
          markPending(productId, false);
        }
      }

      const max = Number(item.available_quantity);
      if (Number.isFinite(max) && max > 0 && quantity > max) {
        return `Only ${max} units available.`;
      }

      const next = normaliseCart({
        id: null,
        items: cartRef.current.items.map((candidate) =>
          candidate.id === productId ? { ...candidate, quantity } : candidate
        ),
      });
      setCart(next);
      writeGuestCart(next);
      return true;
    },
    [isAuthenticated, markPending, applyServerCart, removeFromCart]
  );

  const clearCart = useCallback(async () => {
    if (isAuthenticated) {
      setLoading(true);
      try {
        const data = await clearCartApi();
        applyServerCart(data);
        setError(null);
        return true;
      } catch (requestError) {
        return getApiErrorMessage(requestError, 'We could not empty your cart.');
      } finally {
        setLoading(false);
      }
    }

    setCart({ ...EMPTY_CART });
    dropGuestCart();
    return true;
  }, [isAuthenticated, applyServerCart]);

  const dismissMergeNotice = useCallback(() => setMergeSkipped([]), []);

  const value = useMemo(
    () => ({
      cart,
      loading,
      initialised,
      error,
      pendingItemIds,
      mergeSkipped,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      refresh,
      dismissMergeNotice,
    }),
    [
      cart,
      loading,
      initialised,
      error,
      pendingItemIds,
      mergeSkipped,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      refresh,
      dismissMergeNotice,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export default CartContext;
