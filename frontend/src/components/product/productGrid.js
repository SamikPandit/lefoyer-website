/**
 * ============================================================================
 * productGrid.js — ART_DIRECTION.md §4. THE CATALOGUE'S GEOMETRY.
 *
 * `repeat(auto-fill, minmax(156px, 1fr))` is BANNED (§2.13, §10.5), and the
 * grid is not defined anywhere but this file. One number in a related-products
 * rail caused four of this site's most visible defects at once:
 *
 *   Verified at 1440 on the build this replaces: container 1232 − 80 gutters
 *   = 1152, minus the 264px facet rail and a 32px gap = 856px of results
 *   column. floor((856 + 12) / 168) = 5 tracks. (856 − 48) / 5 = 161.6px cards.
 *   At 161.6px the name's line box holds ~15 characters, so the word being cut
 *   is the word that says what the thing IS — "Glow Game WaterLess…",
 *   "UV Armor Tinted…" — "Add to bag" and "Notify me" both wrap to two lines
 *   inside their own buttons, and the Out-of-stock chip is overlapped by the
 *   wishlist heart on every card. All four are visible in plp-desk.png.
 *
 * Replaced by an explicit, catalogue-aware column schedule with a 288px
 * absolute floor. §4.2's measured widths, re-derived against this template:
 *
 *   | Viewport | Gutter | Container | Content | Cols | Gap | Card | Rows for 6 |
 *   |  320     | 16     | 320       | 288     | 1    | 20  | 288  | 6 × 1      |
 *   |  390     | 16     | 390       | 358     | 1    | 20  | 358  | 6 × 1      |
 *   |  680     | 24     | 680       | 632     | 2    | 24  | 304  | 3 × 2      |
 *   |  768     | 24     | 768       | 720     | 2    | 24  | 348  | 3 × 2      |
 *   | 1024     | 32     | 1024      | 960     | 2    | 24  | 468  | 3 × 2      |
 *   | 1200     | 40     | 1232      | 1152    | 3    | 32  | 362  | 2 × 3      |
 *   | 1440     | 40     | 1296      | 1216    | 3    | 32  | 384  | 2 × 3      |
 *
 *   Absolute floor 288px = --lf-card-min. Narrowest multi-column card 304px.
 *   Against today's 161.6px at 1440 and 157px at 1024.
 *
 * A SHELF IS COMPLETE AT WHATEVER ITS ROW COUNT IS (§2.29). Six products fall
 * into two full rows of three at ≥1200, three of two at 680–1199 and six of
 * one below — NEVER a ragged final row at any breakpoint. That is the property
 * that makes a small catalogue read as curation rather than as scarcity, and
 * it is why the column count is fixed instead of packed by `auto-fill`.
 *
 * The breakpoints are written as raw media queries rather than as theme keys
 * because this object is also consumed by non-MUI callers; 680 is the `shelf`
 * breakpoint and 1200 is `lg` in theme.js §3.13, so they cannot drift.
 * ========================================================================== */

/**
 * THE catalogue grid. Home's shelf, the PLP, the wishlist and every other
 * listing use this exact object — one card language, one grid token, site-wide.
 *
 * `minWidth: 0` is load-bearing: without it the grid refuses to shrink below
 * its content inside a flex parent and the page scrolls horizontally at 320px.
 * `minmax(0, 1fr)` is the same guarantee one level down, for the cards.
 */
export const PRODUCT_GRID_SX = {
  display: 'grid',
  minWidth: 0,
  gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
  gap: 'var(--lf-grid-gap, 20px)',
  '@media (min-width:680px)': {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    '--lf-grid-gap': '24px',
  },
  '@media (min-width:1200px)': {
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    '--lf-grid-gap': '32px',
  },
};

/**
 * The PDP's "The rest of the shelf" row (§5.3) — a horizontal scroll-snap rail
 * of the SAME <ProductCard>, never a second card language (§10.23). It is NOT
 * the catalogue grid and must not be used for a listing: at five products a
 * grid would leave an empty track, which is exactly the ragged row §2.29 bans.
 *
 * 300px tracks sit between the 288px floor and the 304px two-up card, so the
 * card's internal arithmetic (§4.3) holds unchanged. Pair it with `.lf-rail`
 * from index.css, which carries the snap, the gutter padding and the hidden
 * scrollbar.
 */
export const PRODUCT_RAIL_SX = {
  display: 'flex',
  gap: 'var(--lf-grid-gap, 20px)',
  minWidth: 0,
  '& > *': { flex: '0 0 300px', minWidth: 0 },
  '@media (min-width:680px)': { '--lf-grid-gap': '24px' },
  '@media (min-width:1200px)': { '--lf-grid-gap': '32px' },
};

/**
 * How many cards a skeleton should draw so the placeholder occupies the same
 * tracks the real grid will (P5: a skeleton lays out at the real element's
 * final size). Derived from the expected count — never hardcoded to 3 when 2
 * arrive (§7.5 rule 3).
 *
 * @param {number} expected How many products the surface is about to render.
 * @param {number} [columns=3] The widest column count that surface reaches.
 * @returns {number}
 */
export function skeletonCount(expected, columns = 3) {
  const wanted = Number(expected);
  if (!Number.isFinite(wanted) || wanted <= 0) return columns;
  return Math.min(Math.trunc(wanted), columns * 2);
}

export default PRODUCT_GRID_SX;
