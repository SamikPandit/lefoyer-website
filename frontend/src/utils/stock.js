/**
 * ============================================================================
 * utils/stock.js — ART_DIRECTION.md §6.4. ONE derivation of availability.
 *
 * "The expression currently lives in `ProductCard.jsx` AND `ProductDetail.jsx`
 *  with DIFFERENT fallbacks, which is exactly how a tile and a PDP end up
 *  disagreeing." — §6.4
 *
 * One export, consumed by the card, the PDP, the search row and the cart line.
 * `components/product/productPresentation.js` re-exports it so the surfaces
 * that already import `stockState` from there keep one implementation, not two.
 *
 * THE RULE (§6.4), with IMPLEMENTATION_SPEC §2d's frontend contract honoured:
 *
 *     in_stock === false                           → 'out'
 *     (available_quantity ?? stock_quantity) <= 0  → 'out'
 *                                           <= 5   → 'low'
 *     otherwise                                    → 'in'
 *     coming_soon overrides everything             → 'coming_soon'
 *
 * Two notes on the reading of that table, both reported in the return value:
 *
 *  1. §6.4 writes the fourth state as `'soon'`; every other binding surface —
 *     <Alcove>'s `data-stock` contract (§6.1), index.css §6, `ProductDetail`'s
 *     `stock.state === 'coming_soon'` — spells it `coming_soon`. A token the
 *     CSS and the component contract already agree on wins over one word in a
 *     code block, so the value is `coming_soon` and `STOCK.SOON` is its name.
 *
 *  2. IMPLEMENTATION_SPEC §2d (still binding) says **no component may recompute
 *     availability from `stock_quantity`** — and `products/serializers.py`'s
 *     explicit field list does not even serve it, so the `?? stock_quantity`
 *     arm is a defensive fallback that production never takes. It is therefore
 *     implemented as §6.4 writes it, but `in_stock` is the AUTHORITY for 'out'
 *     and a quantity that was never served reads as "unknown", not as zero.
 *     Reading an absent quantity as 0 — which the code this replaces did —
 *     would mark the entire catalogue out of stock the day the field moves.
 *
 * FOUR STATES, EACH WITH ITS OWN WORDS AND A DOT, never colour alone (A8).
 * `label` is the sentence-case line (PDP, cart, search). `ledgeLabel` is the
 * card's full-width status ledge (§6.2 item 2) — 12px/600/+0.14em uppercase.
 * ========================================================================== */

/** IMPL_SPEC §2d: "Low-stock copy uses ONE shared constant." */
export const LOW_STOCK_THRESHOLD = 5;

/** The four `data-stock` values. <Alcove> and index.css §6 read these. */
export const STOCK = Object.freeze({
  IN: 'in',
  LOW: 'low',
  OUT: 'out',
  SOON: 'coming_soon',
});

/**
 * The first served, finite quantity — or `null` when the payload carries none.
 * `null` means "unknown", which is NOT the same as 0 (see note 2 above).
 * @param {object} product
 * @returns {number|null}
 */
function servedQuantity(product) {
  const candidates = [product?.available_quantity, product?.stock_quantity];
  for (const raw of candidates) {
    if (raw === null || raw === undefined || raw === '') continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return Math.trunc(value);
  }
  return null;
}

/**
 * @typedef {object} StockState
 * @property {'in'|'low'|'out'|'coming_soon'} state The `data-stock` value.
 * @property {string}  label        Sentence case: "In stock", "Only 3 left".
 * @property {string}  ledgeLabel   Uppercase, for the card's status ledge.
 * @property {string}  dotColor     A `var(--lf-*)` token. Non-text.
 * @property {string}  textColor    A `var(--lf-*)` token. AA on canvas/paper.
 * @property {boolean} sellable     `in_stock === true` and not coming soon.
 * @property {boolean} notifiable   Render <NotifyMe> in the CTA slot (§6.6).
 * @property {boolean} lit          Whether the niche keeps its hearth light.
 * @property {number}  maxQty       Order ceiling. 0 when nothing is reservable.
 * @property {string|null} reason   The adjacent reason an unbuyable CTA needs
 *                                  (§6.6 / §10.12). `null` when buyable.
 */

/**
 * THE single availability derivation for every surface on the site.
 * @param {object} product The API payload (card, detail or cart-line shape).
 * @returns {StockState}
 */
export function stockState(product) {
  const comingSoon = product?.coming_soon === true;
  const qty = servedQuantity(product);

  /* `coming_soon` overrides everything (§6.4). A product you cannot buy YET is
     not a product the shop is hiding: the niche stays LIT and the card stays a
     working link (§6.2). */
  if (comingSoon) {
    return {
      state: STOCK.SOON,
      label: 'Coming soon',
      ledgeLabel: 'COMING SOON',
      dotColor: 'var(--lf-gold-edge)',
      textColor: 'var(--lf-gold-ink)',
      sellable: false,
      notifiable: true,
      lit: true,
      maxQty: 0,
      reason: 'Not on sale yet — we’ll email you at launch',
    };
  }

  /* §2d: `in_stock === true` is the whole sellability test. A served quantity
     of 0 is the second, equivalent signal (the serializer zeroes it out for a
     manually disabled product), never the only one. */
  const outOfStock = product?.in_stock === false || (qty !== null && qty <= 0);

  if (outOfStock) {
    return {
      state: STOCK.OUT,
      label: 'Out of stock',
      /* §6.2 item 2: the out-of-stock ledge reads BACK SOON in --lf-warn-ink
         (6.24:1), and it sits ABOVE the name so the words land before the eye
         reaches the gold button (§2.18's misread-as-promotion mitigation). */
      ledgeLabel: 'BACK SOON',
      dotColor: 'var(--lf-warn-ink)',
      textColor: 'var(--lf-warn-ink)',
      sellable: false,
      notifiable: true,
      lit: false,
      maxQty: 0,
      reason: 'Out of stock — we’ll email you when it’s back',
    };
  }

  if (qty !== null && qty <= LOW_STOCK_THRESHOLD) {
    return {
      state: STOCK.LOW,
      label: qty === 1 ? 'Only 1 left' : `Only ${qty} left`,
      ledgeLabel: qty === 1 ? 'ONLY 1 LEFT' : `ONLY ${qty} LEFT`,
      dotColor: 'var(--lf-warn-ink)',
      textColor: 'var(--lf-warn-ink)',
      sellable: true,
      notifiable: false,
      lit: true,
      maxQty: qty,
      reason: null,
    };
  }

  return {
    state: STOCK.IN,
    label: 'In stock',
    ledgeLabel: 'IN STOCK',
    dotColor: 'var(--lf-ok)',
    textColor: 'var(--lf-ok-ink)',
    sellable: true,
    notifiable: false,
    lit: true,
    /* An unknown quantity still sells: the server enforces the ceiling in
       `cart/add` and again in `confirm_order` (§2d, "the cart is not a
       promise"). A stepper reads this as "no client-side ceiling known". */
    maxQty: qty === null ? 0 : qty,
    reason: null,
  };
}

/**
 * schema.org availability derived from the SAME state the badge renders (LF-07).
 * @param {object} product
 * @returns {string}
 */
export function schemaAvailability(product) {
  const stock = stockState(product);
  if (stock.state === STOCK.SOON) return 'https://schema.org/PreOrder';
  return stock.sellable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
}

export default stockState;
