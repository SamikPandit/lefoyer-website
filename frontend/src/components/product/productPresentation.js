/**
 * productPresentation.js — the ONE derivation of availability, price, rating and
 * benefit copy for every product surface in WP-10.
 *
 * WHY THIS FILE EXISTS
 * DESIGN_SYSTEM §7 ("StockPill") is explicit: the availability expression used to live
 * in `ProductCard.jsx` and `ProductDetail.jsx` **with different fallbacks**, which is
 * exactly how a tile and a PDP end up disagreeing about the same SKU. The same was true
 * of the low-stock threshold (`<= 5` in one place on the PDP, `<= 10` three rows below
 * it) and of the price (`₹{price}` on the card, `₹{discount_price}` on the PDP).
 *
 * The design system asks for `utils/stock.js` + a `PriceBlock` component. Wave 1 shipped
 * neither and WP-10 owns exactly `pages/Product*.jsx`, `pages/Wishlist.jsx` and
 * `components/product/**`, so the shared derivation lives here, inside this package's
 * own directory. If a later change is allowed to add `src/utils/stock.js`, move
 * `stockState` + `priceView` there verbatim and re-point the five importers.
 *
 * THE RULES ENCODED HERE, ALL FROM THE SPEC
 *  - IMPL_SPEC §2d: availability is read from `in_stock` and `available_quantity` ONLY.
 *    Nothing in this package may recompute it from `stock_quantity`, and the old
 *    `in_stock !== undefined ? … : stock_quantity > 0` fallbacks are gone. The
 *    `stock_quantity` field is not even served any more (products/serializers.py's
 *    explicit field list omits it), so a fallback to it is a fallback to `undefined`.
 *  - IMPL_SPEC §2d: ONE `LOW_STOCK_THRESHOLD`.
 *  - IMPL_SPEC §2e: ratings come from `review_summary` and nothing else. `average` is
 *    `null` at `count === 0` — never `0` — and a zero-star row must never render.
 *  - DESIGN_SYSTEM §9 #13: no `₹undefined` / `₹NaN` / `₹0`. An unpriced product renders
 *    "Price on request" and the CTA degrades to "View details".
 *  - DESIGN_SYSTEM §6.8 #4: a disabled/unbuyable state never advertises a discount, so
 *    `priceView(product).showSavings` is false when the product is not sellable.
 */

import { effectivePrice as apiEffectivePrice } from '../../services/api';
import { LOW_STOCK_THRESHOLD, STOCK, schemaAvailability, stockState } from '../../utils/stock';

/* --------------------------------------------------------------------------
 * ART_DIRECTION.md §6.4 — the availability derivation MOVED OUT of this file.
 *
 * The docstring above anticipated this: "If a later change is allowed to add
 * `src/utils/stock.js`, move `stockState` + `priceView` there verbatim and
 * re-point the five importers." §6.4 is that change, and it is now the single
 * derivation for the card, the PDP, the search row and the cart line.
 *
 * `stockState`, `LOW_STOCK_THRESHOLD` and `schemaAvailability` are re-exported
 * here, unchanged, so the surfaces that already import them from this module —
 * `pages/ProductDetail.jsx` — keep compiling against ONE implementation rather
 * than gaining a second. New call sites import from `utils/stock` directly.
 *
 * `priceView` and the money formatter stay here: `ProductListing` and
 * `ProductFilter` already import `formatRupees` from this module, and §6.3's
 * <PriceBlock> re-exports them from the component so "PriceBlock's formatter"
 * (§6.8) has one honest address. One implementation, two export points.
 * -------------------------------------------------------------------------- */
export { LOW_STOCK_THRESHOLD, STOCK, schemaAvailability, stockState };

/** The listing's own page size. `count / PAGE_SIZE` is the real page count (LF-09). */
export const PRODUCT_PAGE_SIZE = 24;

/* -------------------------------------------------------------------------- *
 * money
 * -------------------------------------------------------------------------- */

const RUPEE_FORMAT = (() => {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    });
  } catch {
    return null;
  }
})();

/**
 * `1299` -> `₹1,299`; `129900` -> `₹1,29,900` (Indian grouping, DESIGN_SYSTEM §7).
 * Returns `null` for anything that is not a usable amount, so a caller is forced to
 * decide what to show instead of printing `₹NaN`.
 * @param {unknown} value
 * @returns {string|null}
 */
export function formatRupees(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const rounded = Math.round(amount);
  if (RUPEE_FORMAT) return RUPEE_FORMAT.format(rounded);
  return `₹${rounded.toLocaleString('en-IN')}`;
}

/**
 * The unit price the customer is actually charged.
 * Prefers the server's own `effective_price` (products/serializers.py computes it from
 * the model) and falls back to api.js's `effectivePrice()` so one helper covers the card
 * payload, the detail payload and a wishlist's nested product.
 * @param {object} product
 * @returns {number}
 */
export function unitPrice(product) {
  const served = Number(product?.effective_price);
  if (Number.isFinite(served) && served > 0) return served;
  return apiEffectivePrice(product);
}

/**
 * Everything a price row needs, derived once.
 * @param {object} product
 * @param {{sellable?: boolean}} [options] Pass the sellable flag to suppress the
 *   discount treatment on an unbuyable product (DESIGN_SYSTEM §6.8 rule 4).
 * @returns {{amount:number, priceLabel:string|null, compareLabel:string|null,
 *            savingsPercent:number|null, showSavings:boolean, hasPrice:boolean}}
 */
export function priceView(product, options = {}) {
  const amount = unitPrice(product);
  const list = Number(product?.price);
  const priceLabel = formatRupees(amount);
  const hasPrice = priceLabel !== null;

  const hasCompare =
    hasPrice && Number.isFinite(list) && list > amount && formatRupees(list) !== null;
  const savingsPercent = hasCompare ? Math.round((1 - amount / list) * 100) : null;
  const sellable = options.sellable !== false;

  return {
    amount,
    priceLabel,
    compareLabel: hasCompare && sellable ? formatRupees(list) : null,
    savingsPercent,
    // A savings chip is suppressed on an unbuyable product and on a 0% rounding artefact.
    showSavings: Boolean(sellable && savingsPercent && savingsPercent > 0),
    hasPrice,
  };
}

/* -------------------------------------------------------------------------- *
 * ratings — IMPL_SPEC §2e, read-only from review_summary
 * -------------------------------------------------------------------------- */

const EMPTY_DISTRIBUTION = Object.freeze({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });

/**
 * Normalises `product.review_summary` (or a bare `ReviewSummary`) into something a
 * component can render without ever computing an average itself.
 *
 * `hasReviews === false` is the signal to render NO stars at all: not an empty
 * five-star row, not `(0)`, not `0.0` (DESIGN_SYSTEM §9 #13).
 *
 * @param {object} summaryOrProduct A `ReviewSummary`, or a product carrying one.
 * @returns {{count:number, average:number|null, hasReviews:boolean,
 *            averageLabel:string|null, countLabel:string|null,
 *            distribution:object, verifiedCount:number}}
 */
export function reviewView(summaryOrProduct) {
  const summary =
    summaryOrProduct && typeof summaryOrProduct === 'object' && 'review_summary' in summaryOrProduct
      ? summaryOrProduct.review_summary
      : summaryOrProduct;

  const rawCount = Number(summary?.count);
  const count = Number.isFinite(rawCount) && rawCount > 0 ? Math.trunc(rawCount) : 0;
  const rawAverage = Number(summary?.average);
  // §2e: `average` is null when count is 0. If a deployment ever sends 0 with no
  // reviews, it is still treated as "no rating" rather than as a zero-star product.
  const average = count > 0 && Number.isFinite(rawAverage) && rawAverage > 0 ? rawAverage : null;

  const distribution = { ...EMPTY_DISTRIBUTION };
  if (summary?.distribution && typeof summary.distribution === 'object') {
    Object.keys(EMPTY_DISTRIBUTION).forEach((bucket) => {
      const value = Number(summary.distribution[bucket]);
      distribution[bucket] = Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
    });
  }

  const verifiedRaw = Number(summary?.verified_count);

  return {
    count,
    average,
    hasReviews: count > 0 && average !== null,
    averageLabel: average === null ? null : average.toFixed(1),
    countLabel: count === 0 ? null : count === 1 ? '1 review' : `${count} reviews`,
    distribution,
    verifiedCount: Number.isFinite(verifiedRaw) && verifiedRaw > 0 ? Math.trunc(verifiedRaw) : 0,
  };
}

/* -------------------------------------------------------------------------- *
 * product copy
 * -------------------------------------------------------------------------- */

/**
 * `key_benefits` as structured rows.
 *
 * The old PDP did `key_benefits.split(',').slice(0, 4)`, which cut real sentences in
 * half ("Gentle, non-stripping cleanser" became two bullets). `key_benefits` is a
 * `TextField` of prose, so the only separators that are genuinely authored are line
 * breaks and explicit bullet glyphs. Commas are NOT separators here — the same mistake
 * §1 C-11 records for `suitable_for`.
 *
 * @param {string} text
 * @returns {string[]} Zero or more rows. One long row means "render it as a paragraph".
 */
export function benefitRows(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  return text
    .split(/\r?\n|·|•|•|;/)
    .map((row) => row.replace(/^[\s\-–—*]+/, '').trim())
    .filter(Boolean);
}

/**
 * `suitable_for` is ONE free-text line of exactly six authored strings (§1 C-11):
 * "Splitting on `,` yields garbage — map by exact string." So it is rendered whole.
 * @param {object} product
 * @returns {string|null}
 */
export function suitabilityLine(product) {
  const value = product?.suitable_for;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Every image the product actually has, in order. No `slice(0, 4)` (LF-21). */
export function productImages(product) {
  if (!product) return [];
  return [
    product.image_main,
    product.image_2,
    product.image_3,
    product.image_4,
    product.image_5,
    product.image_6,
    product.image_7,
    product.image_8,
    product.image_9,
    product.image_10,
  ].filter((image) => typeof image === 'string' && image.trim());
}

/**
 * A composed alt, per DESIGN_SYSTEM §6.3: `"{name}, {size}"` — never "Product 3".
 * @param {object} product
 * @param {number} [index] 0 for the primary shot; later frames are numbered.
 */
export function productAlt(product, index = 0) {
  const name = (product?.name || 'Product').trim();
  const size = typeof product?.size === 'string' && product.size.trim() ? `, ${product.size.trim()}` : '';
  return index === 0 ? `${name}${size}` : `${name}${size} — view ${index + 1}`;
}

/** The PDP route for a product. One place, so a card and a rail cannot diverge. */
export function productPath(product) {
  return `/product/${product?.slug ?? ''}`;
}
