/**
 * The single HTTP surface for the storefront — IMPL_SPEC §2a.
 *
 * Three cross-cutting behaviours are implemented here once, so that no component
 * ever has to think about them again:
 *
 *   1. LIST NORMALISATION. Every `list*` / `get*s` helper resolves to
 *      `{ items, count, next, previous }`. It unwraps `res.data.results ?? res.data`
 *      internally, so a consumer never touches `.data.results` and never has to
 *      care whether an endpoint happens to be paginated today (C-18: the taxonomy
 *      endpoints ARE paginated and only looked unpaginated because the seed data
 *      is smaller than PAGE_SIZE). Every single-object helper resolves to the object.
 *
 *   2. PARAM SERIALISATION. `paramsSerializer: { indexes: null }` makes
 *      `{ category: ['skincare', 'haircare'] }` serialise as
 *      `category=skincare&category=haircare` rather than `category[]=…`, which is
 *      the only form django-filter's `BaseInFilter` / `MultipleChoiceFilter` reads.
 *
 *   3. 401 HANDLING. One refresh attempt, concurrent 401s queued behind it, the
 *      original request replayed on success. Only when the refresh itself fails do
 *      we clear storage and dispatch `lefoyer:auth-expired` for AuthContext to pick
 *      up. This module NEVER touches `window.location`: a hard navigation throws
 *      away React state, loses the page the shopper was on, and under BrowserRouter
 *      would additionally cost a full document load. Routing is the router's job.
 *
 * A 401 from `POST token/` is a failed *login*, not an expired session, so it is
 * passed straight through and never triggers the logout path. (§2b #28 changes the
 * backend to answer 400/403 there for exactly this reason; the guard stays anyway,
 * because the client must not depend on that fix having shipped.)
 */

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/';

/** Dispatched on `window` when a session could not be refreshed. AuthContext listens. */
export const AUTH_EXPIRED_EVENT = 'lefoyer:auth-expired';

/** localStorage keys this module owns. Cleared together, per §2a. */
export const AUTH_STORAGE_KEYS = ['authToken', 'refreshToken', 'user', 'cart'];

export const CURRENCY = 'INR';

/* ------------------------------------------------------------------ *
 * storage helpers — every access is guarded. Safari private mode and a
 * blocked-cookies profile both throw on localStorage access, and a thrown
 * request interceptor takes down every call on the page.
 * ------------------------------------------------------------------ */

const readStorage = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* non-fatal: the session simply will not survive a reload */
  }
};

const dropStorage = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* non-fatal */
  }
};

/** Clears the four keys §2a names. Exported so AuthContext.logout() shares one definition. */
export const clearAuthStorage = () => {
  AUTH_STORAGE_KEYS.forEach(dropStorage);
};

export const getStoredAccessToken = () => readStorage('authToken');
export const getStoredRefreshToken = () => readStorage('refreshToken');

/** Persists the pair returned by `POST token/`. Used by AuthContext.login(). */
export const storeTokens = ({ access, refresh }) => {
  if (access) writeStorage('authToken', access);
  if (refresh) writeStorage('refreshToken', refresh);
};

/* ------------------------------------------------------------------ *
 * the instance
 * ------------------------------------------------------------------ */

const api = axios.create({
  baseURL: API_URL,
  // §2a: array filters must serialise as repeated keys, not `key[]=`.
  paramsSerializer: { indexes: null },
});

/**
 * A second instance with NO interceptors, used only for `token/refresh/`.
 * Refreshing through `api` would re-enter the 401 handler and recurse.
 */
const authlessClient = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = getStoredAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ------------------------------------------------------------------ *
 * error decoration — §2a: UI must be able to tell "we are retrying" and
 * "we cannot reach the server" apart from "there is nothing to show".
 * ------------------------------------------------------------------ */

const decorateError = (error) => {
  const status = error?.response?.status ?? null;
  error.status = status;
  error.isNetwork = !error.response && error.code !== 'ERR_CANCELED' && !axios.isCancel?.(error);
  error.isCanceled = Boolean(axios.isCancel?.(error)) || error.code === 'ERR_CANCELED';
  error.isThrottled = status === 429;
  error.isNotFound = status === 404;
  error.isServerError = typeof status === 'number' && status >= 500;
  if (error.isThrottled) {
    const header = error.response?.headers?.['retry-after'];
    const body = error.response?.data?.retry_after;
    const seconds = Number(body ?? header);
    error.retryAfter = Number.isFinite(seconds) ? seconds : null;
  }
  return error;
};

/**
 * Turns any axios error into one sentence worth showing a customer.
 * Reads the shapes this backend actually produces, in order of specificity:
 * `{error}` (cart views), `{detail}` (DRF/JWT), `{message}` (coupons/payment),
 * then the first DRF field error.
 */
export const getApiErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (!error) return fallback;
  if (error.isCanceled) return null;
  if (error.isNetwork) return 'We could not reach the server. Check your connection and try again.';
  if (error.isThrottled) {
    return error.retryAfter
      ? `Too many attempts. Please try again in ${error.retryAfter} seconds.`
      : 'Too many attempts. Please wait a moment and try again.';
  }

  const data = error.response?.data;
  if (data == null) return error.message || fallback;
  if (typeof data === 'string') return data.trim() || fallback;

  const direct = data.error ?? data.detail ?? data.message;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  if (Array.isArray(direct) && typeof direct[0] === 'string' && direct[0].trim()) return direct[0].trim();

  for (const value of Object.values(data)) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) return value[0].trim();
  }
  return fallback;
};

/* ------------------------------------------------------------------ *
 * the 401 interceptor
 * ------------------------------------------------------------------ */

/** Strips origin and query so a path test works for both relative and absolute urls. */
const pathOf = (url) =>
  String(url || '')
    .replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '')
    .replace(/[?#].*$/, '');

const isLoginRequest = (url) => /(?:^|\/)token\/?$/.test(pathOf(url));
const isRefreshRequest = (url) => /(?:^|\/)token\/refresh\/?$/.test(pathOf(url));

/** The in-flight refresh. Concurrent 401s await this one promise rather than each firing their own. */
let refreshInFlight = null;

const performRefresh = async () => {
  const refresh = getStoredRefreshToken();
  if (!refresh) throw new Error('No refresh token stored');

  const res = await authlessClient.post('token/refresh/', { refresh });
  const access = res?.data?.access;
  if (!access) throw new Error('token/refresh/ returned no access token');

  // SIMPLE_JWT runs ROTATE_REFRESH_TOKENS=True + BLACKLIST_AFTER_ROTATION=True
  // (§2b settings), so the response carries a NEW refresh token and the old one
  // is blacklisted. Failing to store it would make the very next refresh fail.
  storeTokens({ access, refresh: res.data.refresh });
  return access;
};

const refreshAccessToken = () => {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
};

const notifyAuthExpired = (reason) => {
  clearAuthStorage();
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { reason } }));
    } catch {
      /* CustomEvent unavailable (very old browsers) — storage is cleared either way */
    }
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    decorateError(error);

    const { config, response } = error;
    if (!response || response.status !== 401 || !config) {
      return Promise.reject(error);
    }

    // A failed login, or a refresh that itself 401'd, is not an expired session.
    if (isLoginRequest(config.url)) return Promise.reject(error);
    if (isRefreshRequest(config.url)) return Promise.reject(error);

    // Already replayed once: do not loop.
    if (config.__lefoyerRetried) {
      notifyAuthExpired('retry_failed');
      return Promise.reject(error);
    }

    // Nothing to refresh with. If there was no session at all this is just an
    // anonymous call to a protected endpoint — stay quiet rather than firing a
    // spurious "your session expired" at a guest.
    if (!getStoredRefreshToken()) {
      if (getStoredAccessToken()) notifyAuthExpired('no_refresh_token');
      return Promise.reject(error);
    }

    config.__lefoyerRetried = true;

    try {
      const access = await refreshAccessToken();
      config.headers = { ...(config.headers || {}), Authorization: `Bearer ${access}` };
      return api(config);
    } catch {
      notifyAuthExpired('refresh_failed');
      return Promise.reject(error);
    }
  }
);

/* ------------------------------------------------------------------ *
 * response shaping
 * ------------------------------------------------------------------ */

const EMPTY_LIST = Object.freeze({ items: [], count: 0, next: null, previous: null });

/**
 * `{ items, count, next, previous }` from any of the three shapes this API
 * produces: a DRF page `{count,next,previous,results}`, a bare array, or an
 * already-wrapped `{count, results}` envelope from a custom action.
 */
const toList = (res) => {
  const data = res?.data;
  if (data == null) return { ...EMPTY_LIST };

  if (Array.isArray(data)) {
    return { items: data, count: data.length, next: null, previous: null };
  }

  const results = data.results ?? data.items;
  if (Array.isArray(results)) {
    return {
      items: results,
      count: typeof data.count === 'number' ? data.count : results.length,
      next: data.next ?? null,
      previous: data.previous ?? null,
    };
  }

  return { ...EMPTY_LIST };
};

const toObject = (res) => (res?.data === undefined ? null : res.data);

/** Drops `undefined`/`null`/`''` keys so axios does not emit `?page=&search=`. */
const cleanParams = (params) => {
  if (!params) return undefined;
  const out = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      const kept = value.filter((v) => v !== undefined && v !== null && v !== '');
      if (kept.length) out[key] = kept;
      return;
    }
    out[key] = value;
  });
  return Object.keys(out).length ? out : undefined;
};

/* ------------------------------------------------------------------ *
 * product contract helper — §2d / pricing
 * ------------------------------------------------------------------ */

/**
 * The price the customer is actually charged for one unit.
 * `discount_price` is nullable on the model; when it is set it is the sell price.
 * Exported so the cart badge, the pixel and the PDP cannot drift apart — the
 * current Cart page prices from `price` while the backend charges `discount_price`.
 */
export const effectivePrice = (product) => {
  if (!product) return 0;
  // `> 0`, not `?? `. This must match `Product.effective_price` and
  // `orders.services.effective_price` exactly: a discount_price of 0 is "no discount", not
  // "free", and treating it as free showed ₹0 in the cart while the server charged full price.
  const discount = Number(product.discount_price);
  const raw = Number.isFinite(discount) && discount > 0 ? discount : product.price;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
};

/* ================================================================== *
 * Catalogue
 * ================================================================== */

/**
 * params: {search, category[], sub_category[], concern[], skin_type[], in_stock,
 *          is_featured, is_bestseller, min_price, max_price, ordering, page, page_size}
 */
export const listProducts = (params, config) =>
  api.get('products/products/', { params: cleanParams(params), ...config }).then(toList);

export const getProduct = (slug, config) =>
  api.get(`products/products/${encodeURIComponent(slug)}/`, config).then(toObject);

export const getRelatedProducts = (slug, params, config) =>
  api
    .get(`products/products/${encodeURIComponent(slug)}/related/`, {
      params: cleanParams(params),
      ...config,
    })
    .then(toList);

/** params: {limit, include_out_of_stock, section} */
export const getFeaturedProducts = (params, config) =>
  api.get('products/products/featured/', { params: cleanParams(params), ...config }).then(toList);

/** params: {limit, include_out_of_stock, section} */
export const getBestsellers = (params, config) =>
  api.get('products/products/bestsellers/', { params: cleanParams(params), ...config }).then(toList);

export const listCategories = (params, config) =>
  api.get('products/categories/', { params: cleanParams(params), ...config }).then(toList);

/** params: {category} — id or slug, repeatable */
export const listSubCategories = (params, config) =>
  api.get('products/subcategories/', { params: cleanParams(params), ...config }).then(toList);

export const listConcerns = (params, config) =>
  api.get('products/concerns/', { params: cleanParams(params), ...config }).then(toList);

export const listSkinTypes = (params, config) =>
  api.get('products/skin-types/', { params: cleanParams(params), ...config }).then(toList);

/** body: {email, consent:true} -> {status:'subscribed'|'already_subscribed'} */
export const notifyMe = (slug, body) =>
  api.post(`products/products/${encodeURIComponent(slug)}/notify-me/`, body).then(toObject);

/* ================================================================== *
 * Search — no separate endpoint; `search` is a filter on the list view.
 * ================================================================== */

export const searchProducts = (q, params, config) =>
  listProducts({ ...params, search: q }, config);

/* ================================================================== *
 * Reviews — replaces the deleted mock review helpers (LF-01/LF-10)
 * ================================================================== */

/** params: {ordering, page, page_size} */
export const listProductReviews = (slug, params, config) =>
  api
    .get(`products/products/${encodeURIComponent(slug)}/reviews/`, {
      params: cleanParams(params),
      ...config,
    })
    .then(toList);

/** body: {rating:1..5, title?, comment} — product & user are set server-side. */
export const createProductReview = (slug, body) =>
  api.post(`products/products/${encodeURIComponent(slug)}/reviews/`, body).then(toObject);

export const getReviewSummary = (slug, config) =>
  api.get(`products/products/${encodeURIComponent(slug)}/review-summary/`, config).then(toObject);

/** params: {limit, min_rating} */
export const listTopReviews = (params, config) =>
  api.get('products/reviews/top/', { params: cleanParams(params), ...config }).then(toList);

/* ================================================================== *
 * Cart
 * ================================================================== */

export const getCart = (config) => api.get('cart/', config).then(toObject);

/** params: {pincode?, coupon?} -> CartSummary (server-computed money, per-line stock) */
export const getCartSummary = (params, config) =>
  api.get('cart/summary/', { params: cleanParams(params), ...config }).then(toObject);

export const addToCartApi = (productId, quantity = 1) =>
  api.post('cart/add/', { product_id: productId, quantity }).then(toObject);

export const updateCartItemApi = (itemId, quantity) =>
  api.patch(`cart/${itemId}/update_item/`, { quantity }).then(toObject);

export const removeCartItemApi = (itemId) =>
  api.delete(`cart/${itemId}/remove_item/`).then(toObject);

export const clearCartApi = () => api.delete('cart/clear/').then(toObject);

/**
 * One round trip for the whole guest cart.
 * `items` may be either `[{product_id, quantity}]` or the flattened cart lines the
 * guest cart keeps in localStorage (`[{id, quantity}]`); both are accepted so the
 * caller does not have to reshape its own state.
 * -> {cart, merged[], skipped:[{product_id, name, reason, available}]}
 */
export const mergeCart = (items) =>
  api
    .post('cart/merge/', {
      items: (Array.isArray(items) ? items : []).map((item) => ({
        product_id: item.product_id ?? item.id,
        quantity: Number(item.quantity ?? 1) || 1,
      })),
    })
    .then(toObject);

/** -> {cart, restored[], skipped[]} */
export const restoreCartFromOrder = (orderId) =>
  api.post('cart/restore-from-order/', { order_id: orderId }).then(toObject);

/* ================================================================== *
 * Coupons
 * ================================================================== */

/**
 * -> CouponResult.
 * A rejected coupon is a 400 carrying a FULL structured body
 * (`{valid:false, reason, message, min_order_amount?}`) — that is a result, not a
 * transport failure, so it is resolved rather than thrown. Every other error
 * (throttle, network, 500) still rejects.
 */
export const validateCoupon = ({ code, subtotal }) =>
  api
    .post('coupons/validate/', { code, subtotal })
    .then(toObject)
    .catch((error) => {
      const data = error?.response?.data;
      if (error?.response?.status === 400 && data && typeof data === 'object' && 'valid' in data) {
        return data;
      }
      throw error;
    });

/* ================================================================== *
 * Orders & payment
 * ================================================================== */

/**
 * `idempotencyKey` must be generated ONCE per checkout session and reused across
 * retries, so a double-click cannot mint two orders (§2b #18).
 * -> OrderCreateResult
 */
export const createOrder = (payload, idempotencyKey) =>
  api
    .post('orders/', payload, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined)
    .then(toObject);

export const getOrder = (id, config) => api.get(`orders/${id}/`, config).then(toObject);

export const listOrders = (params, config) =>
  api.get('orders/', { params: cleanParams(params), ...config }).then(toList);

/** -> {redirect_url, merchant_order_id, attempt_id} */
export const initiatePayment = (id, body = { payment_method: 'PREPAID' }) =>
  api.post(`orders/${id}/initiate-payment/`, body).then(toObject);

/**
 * The authoritative payment state. `ref` is the optional provider reference.
 * -> PaymentStatus (incl. `purchase_event_pending`, `can_retry`, `next_actions`)
 */
export const getPaymentStatus = (id, ref, config) =>
  api
    .get(`orders/${id}/payment-status/`, { params: cleanParams({ ref }), ...config })
    .then(toObject);

/** -> {redirect_url, merchant_order_id, attempt_id} | {payment_status:'COMPLETED'} */
export const retryPayment = (id, body = { payment_method: 'PREPAID' }) =>
  api.post(`orders/${id}/retry-payment/`, body).then(toObject);

/** -> {order_id, payment_status:'CANCELLED', stock_restored, coupon_released} */
export const cancelOrder = (id, body = {}) =>
  api.post(`orders/${id}/cancel/`, body).then(toObject);

/**
 * Closes the exactly-once Purchase window server-side (§2g).
 * Rejects with a 409 if it was already marked — the caller should treat 409 as
 * "someone else already tracked it", which is a success for its purposes.
 * -> {purchase_tracked:true, tracked_at}
 */
export const markPurchaseTracked = (id, eventId) =>
  api.post(`orders/${id}/mark-purchase-tracked/`, cleanParams({ event_id: eventId }) || {}).then(toObject);

/* ================================================================== *
 * Shipping
 * ================================================================== */

/** -> {serviceable, cod_available, expected_delivery_date, transit_days, area_code, error} */
export const checkServiceability = (pincode, config) =>
  api.get('shipping/check-serviceability/', { params: { pincode }, ...config }).then(toObject);

/* ================================================================== *
 * Wishlist — paths corrected per C-8. The old `wishlist/add/` matched the
 * DETAIL route with pk='add' (405) and `wishlist/<id>/remove/` matched nothing
 * (404), which is why the heart has never worked.
 * ================================================================== */

export const getWishlist = (config) => api.get('wishlist/', config).then(toObject);

export const addToWishlistApi = (productId) =>
  api.post('wishlist/', { product_id: productId }).then(toObject);

export const removeFromWishlistApi = (productId) =>
  api.delete(`wishlist/${productId}/`).then(toObject);

/* ================================================================== *
 * Auth
 * ================================================================== */

/** body: {username:<email>, password} -> {access, refresh, user} */
export const loginUser = (credentials) => api.post('token/', credentials).then(toObject);

/** -> {access, refresh?}. Normal refreshing is automatic; this is for explicit use. */
export const refreshToken = (refresh) =>
  authlessClient.post('token/refresh/', { refresh }).then(toObject);

/** -> {id,email,first_name,last_name,phone_number,is_email_verified,date_joined} */
export const getMe = (config) => api.get('auth/me/', config).then(toObject);

/** body: {email,password,first_name?,last_name?,phone_number?,terms_accepted,marketing_consent} */
export const registerUser = (body) => api.post('auth/register/', body).then(toObject);

/** -> {detail, code:'verified'|'already_verified'} */
export const verifyEmail = (token) =>
  api.get(`auth/verify-email/${encodeURIComponent(token)}/`).then(toObject);

/** -> {detail, retry_after?} — deliberately identical for every email, known or not. */
export const resendVerification = (email) =>
  api.post('auth/resend-verification/', { email }).then(toObject);

/** -> {detail} — always 200, so it cannot be used to enumerate accounts. */
export const requestPasswordReset = (email) =>
  api.post('auth/password-reset/', { email }).then(toObject);

/** -> {detail} */
export const confirmPasswordReset = (uid, token, newPassword) =>
  api
    .post(
      `auth/password-reset/confirm/${encodeURIComponent(uid)}/${encodeURIComponent(token)}/`,
      { new_password: newPassword }
    )
    .then(toObject);

/* ================================================================== *
 * Content / newsletter / support
 * ================================================================== */

/** body: {email, consent:true, source:'home'|'footer'|'cart'|'oos_notify', utm?} */
export const subscribeNewsletter = (body) =>
  api.post('newsletter/subscribe/', body).then(toObject);

export const getSiteSettings = (config) => api.get('content/site-settings/', config).then(toObject);

export const getPolicy = (config) => api.get('content/policy/', config).then(toObject);

export const listHomeSections = (params, config) =>
  api.get('content/home-sections/', { params: cleanParams(params), ...config }).then(toList);

/** body: {name,email,order_id?,topic,message} -> {detail, ticket_ref} */
export const submitSupportRequest = (body) =>
  api.post('content/support/contact/', body).then(toObject);

export default api;
