import { useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * LegacyHashRedirect — the "#/" router -> BrowserRouter escape hatch.
 *
 * Every verification, password-reset, order and tracking link the backend has
 * ever emailed is hash-based. The live, verified senders are:
 *
 *   accounts/email_service.py:80   {SITE_URL}/#/verify-email/{token}
 *   accounts/serializers.py:56     {SITE_URL}/#/reset-password/{uid}/{token}/   <- trailing slash
 *   accounts/email_service.py:124  {SITE_URL}/#/products
 *   accounts/email_service.py:257  {SITE_URL}/#/orders/{order.id}
 *   accounts/email_service.py:306  {SITE_URL}/#/orders/{order.id}
 *
 * plus every bookmark a customer ever made (#/cart, #/wishlist, #/faq, ...).
 * So the rewrite is deliberately GENERIC: any hash of the shape "#/<path>" is
 * translated to "/<path>", which is exactly what the old hash router meant by
 * it. A whitelist would silently drop the bookmarks and every other
 * "#/<anything-else>" link, and an unknown path now reaches <NotFound>
 * exactly as it did before.
 *
 * A bare fragment ("#", "#top", "#reviews") is NOT a legacy route and is left
 * untouched, so in-page anchors keep working.
 */

const MAX_HASH_LENGTH = 2048;

/**
 * Translate a legacy hash into a clean path.
 *
 * @param {string} hash         window.location.hash ("#/orders/12?x=1")
 * @param {string} outerSearch  window.location.search ("?utm_source=email")
 * @returns {string|null}       "/orders/12?utm_source=email&x=1", or null when
 *                              the hash is not a legacy route.
 */
export function legacyHashToPath(hash, outerSearch = '') {
  if (typeof hash !== 'string') return null;
  // Only "#/..." was ever a hash route. "#", "#top" are page anchors.
  if (!hash.startsWith('#/')) return null;
  if (hash.length > MAX_HASH_LENGTH) return null;

  let raw = hash.slice(1);

  // Drop a nested fragment ("#/products#top") — the path is all we can use.
  const fragmentAt = raw.indexOf('#');
  if (fragmentAt !== -1) raw = raw.slice(0, fragmentAt);

  const queryAt = raw.indexOf('?');
  let pathname = queryAt === -1 ? raw : raw.slice(0, queryAt);
  const hashSearch = queryAt === -1 ? '' : raw.slice(queryAt + 1);

  // --- Open-redirect guard -------------------------------------------------
  // "#//evil.example" and "#/\evil.example" both resolve to a protocol-relative
  // off-origin URL once they become a path. Normalise backslashes and collapse
  // every run of slashes so the result can only ever be same-origin.
  pathname = pathname.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  if (!pathname.startsWith('/')) return null;

  // accounts/serializers.py really does emit a trailing slash on reset links.
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, '');

  // --- Query strings -------------------------------------------------------
  // Keep both: the document query carries the campaign/UTM params, the hash
  // query carries the old route's params. The hash wins on a key collision.
  const outer = outerSearch && outerSearch !== '?'
    ? outerSearch.replace(/^\?/, '')
    : '';

  let search = '';
  if (!outer) {
    // Pass through verbatim — no re-encoding, so tokens survive untouched.
    search = hashSearch ? `?${hashSearch}` : '';
  } else if (!hashSearch) {
    search = `?${outer}`;
  } else {
    const params = new URLSearchParams(outer);
    new URLSearchParams(hashSearch).forEach((value, key) => params.set(key, value));
    search = `?${params.toString()}`;
  }

  return `${pathname}${search}`;
}

/**
 * Rewrite the address bar before React mounts, so an emailed link never paints
 * the homepage first. Called from main.jsx ahead of createRoot().render().
 *
 * @returns {string|null} the path it rewrote to, or null if nothing to do.
 */
export function applyLegacyHashRedirect() {
  if (typeof window === 'undefined' || !window.location) return null;

  const target = legacyHashToPath(window.location.hash, window.location.search);
  if (!target) return null;

  try {
    // replaceState, never pushState: Back must return to wherever the customer
    // actually came from, not to the hash URL we just rewrote.
    window.history.replaceState(null, '', target);
  } catch {
    // Some embedded webviews throw on replaceState. A hard assign still gets
    // the customer to the right page; it just costs one extra load.
    window.location.replace(target);
  }
  return target;
}

/**
 * In-router guard. Covers the cases applyLegacyHashRedirect() cannot:
 *  - a stray in-app `href="#/..."` anchor (a hash-only change fires
 *    `hashchange`, never `popstate`, so React Router does not see it)
 *  - a Back/Forward step onto a legacy entry
 *  - the pre-render rewrite having been blocked by the browser
 */
export default function LegacyHashRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useLayoutEffect(() => {
    const target = legacyHashToPath(location.hash, location.search);
    // Once we navigate, location.hash is empty, so this cannot loop.
    if (target) navigate(target, { replace: true });
  }, [location.hash, location.search, navigate]);

  useEffect(() => {
    const onHashChange = () => {
      const target = legacyHashToPath(window.location.hash, window.location.search);
      if (target) navigate(target, { replace: true });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [navigate]);

  return null;
}
