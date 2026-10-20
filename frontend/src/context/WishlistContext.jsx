/**
 * Wishlist state — IMPL_SPEC §3 WP-07.
 *
 * Three defects fixed here:
 *  1. It fetched on mount unconditionally. `/api/wishlist/` is `IsAuthenticated`,
 *     so every guest load produced a guaranteed 401 — which, with the old api.js
 *     interceptor, hard-navigated the browser to `/login`. It now fetches only
 *     when a session exists, and only once AuthContext has settled.
 *  2. It used the broken paths (C-8: `POST wishlist/add/` hit the detail route
 *     with `pk='add'` → 405; `DELETE wishlist/<id>/remove/` → 404). The corrected
 *     paths live in api.js.
 *  3. Add/remove round-tripped a full GET before the heart changed state. It is
 *     now optimistic with a rollback, so the heart responds immediately and still
 *     ends up agreeing with the server.
 *
 * `wishlist` keeps its `{ id, products: [Product] }` shape — §2b #26 makes the
 * backend serialise nested products rather than bare PKs, which is what the UI
 * has always assumed.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  addToWishlistApi,
  getApiErrorMessage,
  getWishlist,
  removeFromWishlistApi,
} from '../services/api';
import { useAuth } from './AuthContext';

const WishlistContext = createContext(null);

/**
 * `wishlist` is deliberately `null` — not an empty wishlist — until it has been
 * loaded, so a page can tell "nothing saved yet" apart from "not fetched yet"
 * and render a skeleton for the second case rather than an empty state.
 */
const normaliseWishlist = (data) => ({
  id: data?.id ?? null,
  products: Array.isArray(data?.products) ? data.products.filter(Boolean) : [],
});

/** Accepts a product object or a bare id, so neither card nor PDP has to care. */
const idOf = (productOrId) => {
  if (productOrId === null || productOrId === undefined) return null;
  if (typeof productOrId === 'object') return productOrId.id ?? null;
  return productOrId;
};

export const WishlistProvider = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [wishlist, setWishlist] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialised, setInitialised] = useState(false);
  const [error, setError] = useState(null);
  const [pendingProductIds, setPendingProductIds] = useState([]);

  const wishlistRef = useRef(wishlist);
  useEffect(() => {
    wishlistRef.current = wishlist;
  }, [wishlist]);

  const markPending = useCallback((productId, isPending) => {
    setPendingProductIds((previous) => {
      const without = previous.filter((id) => id !== productId);
      return isPending ? [...without, productId] : without;
    });
  }, []);

  const fetchWishlist = useCallback(async () => {
    if (!isAuthenticated) {
      setWishlist(null);
      setError(null);
      setInitialised(true);
      return true;
    }
    setLoading(true);
    try {
      const data = await getWishlist();
      setWishlist(normaliseWishlist(data));
      setError(null);
      return true;
    } catch (requestError) {
      const message = getApiErrorMessage(requestError, 'We could not load your saved items.');
      setError(message);
      return message;
    } finally {
      setLoading(false);
      setInitialised(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setWishlist(null);
      setError(null);
      setPendingProductIds([]);
      setInitialised(true);
      return;
    }
    fetchWishlist();
  }, [authLoading, isAuthenticated, fetchWishlist]);

  const isInWishlist = useCallback(
    (productOrId) => {
      const productId = idOf(productOrId);
      if (productId === null) return false;
      return (wishlist?.products || []).some((product) => product.id === productId);
    },
    [wishlist]
  );

  /**
   * @returns {true | string} `true`, or the server's message on failure.
   * Pass the product object when you have it — the heart then fills in instantly;
   * pass an id and the row appears once the server replies.
   */
  const addToWishlist = useCallback(
    async (productOrId) => {
      const productId = idOf(productOrId);
      if (productId === null) return 'That product could not be saved.';
      if (!isAuthenticated) return 'Please sign in to save items.';

      const snapshot = wishlistRef.current;
      const productObject = typeof productOrId === 'object' ? productOrId : null;

      if (productObject && !(snapshot?.products || []).some((p) => p.id === productId)) {
        setWishlist({
          id: snapshot?.id ?? null,
          products: [...(snapshot?.products || []), productObject],
        });
      }

      markPending(productId, true);
      try {
        const data = await addToWishlistApi(productId);
        setWishlist(normaliseWishlist(data));
        setError(null);
        return true;
      } catch (requestError) {
        setWishlist(snapshot); // roll back the optimistic insert
        return getApiErrorMessage(requestError, 'We could not save that item.');
      } finally {
        markPending(productId, false);
      }
    },
    [isAuthenticated, markPending]
  );

  /** @returns {true | string} */
  const removeFromWishlist = useCallback(
    async (productOrId) => {
      const productId = idOf(productOrId);
      if (productId === null) return 'That product could not be removed.';
      if (!isAuthenticated) return 'Please sign in to manage your saved items.';

      const snapshot = wishlistRef.current;
      setWishlist({
        id: snapshot?.id ?? null,
        products: (snapshot?.products || []).filter((product) => product.id !== productId),
      });

      markPending(productId, true);
      try {
        const data = await removeFromWishlistApi(productId);
        setWishlist(normaliseWishlist(data));
        setError(null);
        return true;
      } catch (requestError) {
        setWishlist(snapshot); // roll back the optimistic removal
        return getApiErrorMessage(requestError, 'We could not remove that item.');
      } finally {
        markPending(productId, false);
      }
    },
    [isAuthenticated, markPending]
  );

  /** Convenience for the card heart: one call, whichever direction it needs to go. */
  const toggleWishlist = useCallback(
    (productOrId) =>
      isInWishlist(productOrId) ? removeFromWishlist(productOrId) : addToWishlist(productOrId),
    [isInWishlist, addToWishlist, removeFromWishlist]
  );

  const value = useMemo(
    () => ({
      wishlist,
      products: wishlist?.products || [],
      loading,
      initialised,
      error,
      pendingProductIds,
      count: wishlist?.products?.length || 0,
      isInWishlist,
      addToWishlist,
      removeFromWishlist,
      toggleWishlist,
      fetchWishlist,
      refresh: fetchWishlist,
    }),
    [
      wishlist,
      loading,
      initialised,
      error,
      pendingProductIds,
      isInWishlist,
      addToWishlist,
      removeFromWishlist,
      toggleWishlist,
      fetchWishlist,
    ]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within WishlistProvider');
  }
  return context;
};

export default WishlistContext;
