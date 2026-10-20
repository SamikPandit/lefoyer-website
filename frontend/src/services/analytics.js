/**
 * The one place the Meta Pixel is spoken to — IMPL_SPEC §2g.
 *
 * `fbq` is initialised exactly once, by the inline snippet in `index.html`.
 * This module never initialises it and never injects the loader; if the snippet
 * was blocked (ad blocker, strict tracking protection, a `<noscript>` client, or
 * SSR/prerender) every function here degrades to a silent no-op. No analytics
 * failure is allowed to break a page, so every call is wrapped.
 *
 * Event map (§2g):
 *   PageView         usePageViewTracking(), on each route change inside the Router
 *   ViewContent      ProductDetail, once per slug after the product loads
 *   AddToCart        CartContext.addToCart, on success only
 *   InitiateCheckout Checkout, when Place Order is pressed
 *   Purchase         OrderConfirmation ONLY, and only when the server says
 *                    payment_status === 'COMPLETED' && purchase_event_pending === true
 *
 * The exactly-once Purchase guarantee is SERVER state (`purchase_tracked_at`),
 * never localStorage, and never a redirect query parameter — a `?code=PAYMENT_SUCCESS`
 * in the URL is attacker-controlled and would let anyone mint conversions.
 * The sessionStorage lock below is an in-flight mutex for a single tab (React 18
 * StrictMode double-invokes effects, and the confirmation page polls), not a
 * source of truth.
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { CURRENCY, effectivePrice } from './api';

const PURCHASE_LOCK_PREFIX = 'lefoyer:purchase-inflight:';

/** Per-tab, per-load guard. Survives a component remount; dies with the tab. */
const firedPurchaseEvents = new Set();

export const isPixelAvailable = () =>
  typeof window !== 'undefined' && typeof window.fbq === 'function';

/**
 * The only call site of `window.fbq` in the app.
 * @param {string} event      a standard Meta event name
 * @param {object} [params]   event parameters
 * @param {object} [options]  `fbq`'s third argument, e.g. `{ eventID }`
 * @returns {boolean} whether the pixel actually received it
 */
export const track = (event, params, options) => {
  if (!event || !isPixelAvailable()) return false;
  try {
    if (options) {
      window.fbq('track', event, params || {}, options);
    } else if (params) {
      window.fbq('track', event, params);
    } else {
      window.fbq('track', event);
    }
    return true;
  } catch {
    return false;
  }
};

export const trackPageView = () => track('PageView');

/* ------------------------------------------------------------------ *
 * PageView
 * ------------------------------------------------------------------ */

/**
 * Fires `PageView` on every client-side route change.
 *
 * Mount this once, INSIDE the Router (it needs `useLocation`).
 *
 * It deliberately does NOT fire for the route the app booted on: the inline
 * snippet in `index.html` already fired a PageView for that document, and firing
 * again here is precisely the double-count C-2 warns about. The first location is
 * therefore seeded as already-tracked.
 *
 * The event is deferred by one animation frame so that a redirect chain
 * (`/` -> `<Navigate>` -> `/login`, or LegacyHashRedirect rewriting a hash URL)
 * reports the destination rather than every intermediate step.
 */
export const usePageViewTracking = () => {
  const location = useLocation();
  const key = `${location.pathname}${location.search}`;
  // Seeded with the boot location => the first run is a no-op.
  const lastTracked = useRef(key);

  useEffect(() => {
    if (lastTracked.current === key) return undefined;

    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      lastTracked.current = key;
      trackPageView();
      return undefined;
    }

    const handle = window.requestAnimationFrame(() => {
      lastTracked.current = key;
      trackPageView();
    });
    return () => window.cancelAnimationFrame(handle);
  }, [key]);
};

/* ------------------------------------------------------------------ *
 * content identifiers
 * ------------------------------------------------------------------ */

/**
 * Meta matches a catalogue by `content_ids`, so this must be the SAME identifier
 * the product feed uses. `sku` is the model's unique business key, so it is
 * preferred; the numeric pk is only a fallback so an event is never silently
 * dropped for want of an id.
 */
const contentIdOf = (source) => {
  if (!source) return null;
  const sku = source.sku ?? source.product_sku ?? source.product?.sku;
  if (sku) return String(sku);
  const id = source.product_id ?? source.product?.id ?? source.id;
  return id == null ? null : String(id);
};

const quantityOf = (line) => {
  const value = Number(line?.quantity ?? 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
};

const money = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
};

/* ------------------------------------------------------------------ *
 * ViewContent
 * ------------------------------------------------------------------ */

/** Call once per slug, after the product has loaded. */
export const trackViewContent = (product) => {
  if (!product) return false;
  const contentId = contentIdOf(product);
  return track('ViewContent', {
    content_type: 'product',
    content_ids: contentId ? [contentId] : [],
    content_name: product.name ?? '',
    value: money(effectivePrice(product)),
    currency: CURRENCY,
  });
};

/* ------------------------------------------------------------------ *
 * AddToCart
 * ------------------------------------------------------------------ */

/**
 * Call from CartContext.addToCart on SUCCESS only — a rejected add (out of stock,
 * "Only N units available") is not an AddToCart and must not be reported as one.
 * `value` is the effective unit price times the quantity added, i.e. what this
 * action actually added to the basket.
 */
export const trackAddToCart = (product, quantity = 1) => {
  if (!product) return false;
  const contentId = contentIdOf(product);
  const qty = quantityOf({ quantity });
  return track('AddToCart', {
    content_type: 'product',
    content_ids: contentId ? [contentId] : [],
    content_name: product.name ?? '',
    value: money(effectivePrice(product) * qty),
    currency: CURRENCY,
  });
};

/* ------------------------------------------------------------------ *
 * InitiateCheckout
 * ------------------------------------------------------------------ */

/**
 * Call from Checkout when Place Order is pressed, BEFORE the network call, so an
 * abandoned or failed order still counts as an initiated checkout.
 *
 * @param {object}  input
 * @param {Array}   input.items  cart lines (flattened product + quantity, or {product, quantity})
 * @param {number} [input.value] cart subtotal; computed from the lines when omitted
 */
export const trackInitiateCheckout = ({ items = [], value } = {}) => {
  const lines = Array.isArray(items) ? items : [];
  const numItems = lines.reduce((total, line) => total + quantityOf(line), 0);
  const computed = lines.reduce(
    (total, line) => total + effectivePrice(line.product ?? line) * quantityOf(line),
    0
  );
  return track('InitiateCheckout', {
    num_items: numItems,
    value: money(value ?? computed),
    currency: CURRENCY,
    content_type: 'product',
    content_ids: lines.map((line) => contentIdOf(line.product ?? line)).filter(Boolean),
  });
};

/* ------------------------------------------------------------------ *
 * Purchase — the only event with an exactly-once requirement
 * ------------------------------------------------------------------ */

export const purchaseEventId = (orderId) => `order-${orderId}`;

const lockKey = (eventId) => `${PURCHASE_LOCK_PREFIX}${eventId}`;

/** @returns {boolean} true if this caller won the lock. */
const acquirePurchaseLock = (eventId) => {
  if (firedPurchaseEvents.has(eventId)) return false;
  try {
    if (sessionStorage.getItem(lockKey(eventId))) return false;
    sessionStorage.setItem(lockKey(eventId), String(Date.now()));
  } catch {
    /* sessionStorage unavailable — the in-memory Set is still a correct per-load guard */
  }
  firedPurchaseEvents.add(eventId);
  return true;
};

/**
 * Releases the in-flight lock. Call this only when `markPurchaseTracked()` failed
 * with something other than a 409, so a genuine retry is still possible; the
 * server flag remains the source of truth either way.
 */
export const releasePurchaseLock = (orderId) => {
  const eventId = purchaseEventId(orderId);
  firedPurchaseEvents.delete(eventId);
  try {
    sessionStorage.removeItem(lockKey(eventId));
  } catch {
    /* nothing to do */
  }
};

/**
 * Fires `Purchase` for a server-verified, not-yet-tracked order.
 *
 * Pass the body of `GET /api/orders/<id>/payment-status/` verbatim. The gate is
 * the server's own two fields and nothing else:
 *     payment_status === 'COMPLETED' && purchase_event_pending === true
 * so nothing fires for PENDING, FAILED, CANCELLED or EXPIRED, nothing fires on a
 * refresh, a second tab, a back-navigation or a shared link, and nothing can be
 * triggered by a crafted URL.
 *
 * `eventID = 'order-<id>'` lets Meta de-duplicate this against a future
 * server-side Conversions API call for the same order.
 *
 * @param {object} paymentStatus the PaymentStatus payload (§2b #19)
 * @returns {boolean} true when the gate passed and this call owned the event — the
 *   caller MUST then `POST mark-purchase-tracked/`. It returns true even when the
 *   pixel itself is blocked, because the server flag still has to be closed out;
 *   otherwise the page would re-attempt on every poll forever.
 */
export const trackPurchase = (paymentStatus) => {
  if (!paymentStatus) return false;
  if (paymentStatus.payment_status !== 'COMPLETED') return false;
  if (paymentStatus.purchase_event_pending !== true) return false;

  const orderId = paymentStatus.order_id ?? paymentStatus.id;
  if (orderId === undefined || orderId === null) return false;

  const eventId = purchaseEventId(orderId);
  if (!acquirePurchaseLock(eventId)) return false;

  const lines = Array.isArray(paymentStatus.items) ? paymentStatus.items : [];

  track(
    'Purchase',
    {
      value: money(paymentStatus.total),
      currency: paymentStatus.currency || CURRENCY,
      content_type: 'product',
      content_ids: lines.map((line) => contentIdOf(line)).filter(Boolean),
      contents: lines.map((line) => ({
        id: contentIdOf(line) ?? '',
        quantity: quantityOf(line),
        item_price: money(line.price ?? line.unit_price ?? line.item_price),
      })),
      num_items: lines.reduce((total, line) => total + quantityOf(line), 0),
    },
    { eventID: eventId }
  );

  return true;
};

// Named exports only, deliberately: there is no default export. A namespace
// object would invite `analytics.usePageViewTracking()`, which the react-hooks
// lint rule cannot verify and which reads like a plain function call.
