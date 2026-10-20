/**
 * SearchResultRow — one product inside the search overlay's listbox.
 *
 * Thumbnail · name (with the matched substrings in a real <mark>) · size · price ·
 * stock words. One row, 1:1 mat, no hover-only information (DESIGN_SYSTEM §9.5).
 *
 * A11Y
 * The row is the `role="option"` of the overlay's `role="listbox"`. Arrow keys move
 * `aria-activedescendant` on the input and never move DOM focus, so typing keeps
 * working; that is why this row is rendered with `tabIndex={-1}` and is driven by
 * the `active` prop rather than `:focus`.
 *
 * WHY THE PRICE AND STOCK HELPERS LIVE HERE
 * DESIGN_SYSTEM §7 puts them in `utils/stock.js` + a shared `PriceBlock`/`StockPill`,
 * and §10 step 3 builds those before any page consumes them — but neither file exists
 * in the repo yet and WP-08 owns no `utils/` file, so importing them would not build.
 * They are therefore implemented here from the §7 derivation verbatim and exported, so
 * that `pages/Search.jsx` consumes the same expression rather than a second copy.
 * TODO(wp-10/utils): when `utils/stock.js` and `PriceBlock` land, delete
 * `deriveStock`/`formatMoney` below and re-point the two importers in this package.
 */

import { Box, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import { effectivePrice } from '../../services/api';

/* ------------------------------------------------------------------ *
 * Money — §7 PriceBlock: en-IN grouping, no decimals. A DRF decimal
 * string ("1299.00") must never reach the DOM as `₹1299.00`, and a
 * missing price must never render `₹undefined` / `₹NaN` / `₹0` (§9.13).
 * ------------------------------------------------------------------ */
const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** Formatted sell price, or `null` when there is no price to show. */
export function formatMoney(product) {
  const value = effectivePrice(product);
  return Number.isFinite(value) && value > 0 ? INR.format(value) : null;
}

/* ------------------------------------------------------------------ *
 * Stock — §7 StockPill, one derivation, four states, always rendered,
 * never colour alone (every state carries its own words).
 * ------------------------------------------------------------------ */
export function deriveStock(product) {
  if (!product) return { state: 'out', label: 'Unavailable' };
  if (product.coming_soon) return { state: 'soon', label: 'Coming soon' };
  if (product.in_stock === false) return { state: 'out', label: 'Out of stock' };

  const raw = product.available_quantity ?? product.stock_quantity;
  const quantity = Number(raw);
  if (!Number.isFinite(quantity)) {
    // Unknown is not a sales claim: say nothing more than "In stock" can be proven.
    return product.in_stock === true
      ? { state: 'in', label: 'In stock' }
      : { state: 'out', label: 'Out of stock' };
  }
  if (quantity <= 0) return { state: 'out', label: 'Out of stock' };
  if (quantity <= 5) return { state: 'low', label: `Only ${quantity} left` };
  return { state: 'in', label: 'In stock' };
}

const STOCK_TONE = {
  in: { dot: 'var(--lf-ok)', ink: 'var(--lf-ok-ink)' },
  low: { dot: 'var(--lf-gold-edge)', ink: 'var(--lf-warn-ink)' },
  out: { dot: 'var(--lf-ink-4)', ink: 'var(--lf-ink-3)' },
  soon: { dot: 'var(--lf-gold-edge)', ink: 'var(--lf-gold-ink)' },
};

/* ------------------------------------------------------------------ *
 * Matched-substring highlighting — a real <mark> element (§6.6), so it
 * is announced as emphasis instead of being an invisible colour change.
 * ------------------------------------------------------------------ */

/** Case/diacritic-insensitive fold, so "serum" matches "Sérum". */
const fold = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Split `text` into `[{text, match}]` segments for every query token it contains.
 * Overlapping ranges are merged so a token pair never produces nested <mark>s.
 */
export function highlightSegments(text, query) {
  const source = String(text || '');
  const tokens = Array.from(new Set(fold(query).split(/\s+/).filter((t) => t.length >= 2)));
  if (!source || tokens.length === 0) return [{ text: source, match: false }];

  const folded = fold(source);
  const ranges = [];
  tokens.forEach((token) => {
    let from = folded.indexOf(token);
    while (from !== -1) {
      ranges.push([from, from + token.length]);
      from = folded.indexOf(token, from + token.length);
    }
  });
  if (ranges.length === 0) return [{ text: source, match: false }];

  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [ranges[0]];
  ranges.slice(1).forEach(([start, end]) => {
    const last = merged[merged.length - 1];
    if (start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  });

  const segments = [];
  let cursor = 0;
  merged.forEach(([start, end]) => {
    if (start > cursor) segments.push({ text: source.slice(cursor, start), match: false });
    segments.push({ text: source.slice(start, end), match: true });
    cursor = end;
  });
  if (cursor < source.length) segments.push({ text: source.slice(cursor), match: false });
  return segments;
}

const HighlightedName = ({ name, query }) => (
  <>
    {highlightSegments(name, query).map((segment, index) =>
      segment.match ? (
        // eslint-disable-next-line react/no-array-index-key
        <Box
          key={`m-${index}`}
          component="mark"
          sx={{
            backgroundColor: 'var(--lf-gold-tint)',
            color: 'var(--lf-ink)',
            borderRadius: '2px',
            padding: 0,
          }}
        >
          {segment.text}
        </Box>
      ) : (
        // eslint-disable-next-line react/no-array-index-key
        <span key={`t-${index}`}>{segment.text}</span>
      )
    )}
  </>
);

/** The route a product row navigates to. App.jsx declares `/product/:slug`. */
export const productPath = (product) => `/product/${product?.slug ?? ''}`;

/**
 * @param {object} props
 * @param {object} props.product The product object from `searchProducts()`.
 * @param {string} [props.query] The current query, for <mark> highlighting.
 * @param {boolean} [props.active=false] Is this the `aria-activedescendant` row.
 * @param {string} props.id DOM id, referenced by `aria-activedescendant`.
 * @param {Function} [props.onSelect] Called before navigation (closes the overlay).
 * @param {Function} [props.onMouseEnter] Keeps the pointer and keyboard in sync.
 */
const SearchResultRow = ({ product, query = '', active = false, id, onSelect, onMouseEnter }) => {
  if (!product) return null;

  const stock = deriveStock(product);
  const tone = STOCK_TONE[stock.state] || STOCK_TONE.out;
  const price = formatMoney(product);
  const categoryName =
    typeof product.category === 'object' ? product.category?.name : product.category;

  return (
    <Box
      component={RouterLink}
      to={productPath(product)}
      id={id}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      className="lf-ring-inset"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: { xs: 1.5, sm: 2 },
        py: 1.25,
        minHeight: 64,
        textDecoration: 'none',
        color: 'var(--lf-ink)',
        borderRadius: 'var(--lf-r-field)',
        backgroundColor: active ? 'var(--lf-surface-sunken)' : 'transparent',
        transition: 'background-color var(--lf-dur-2) var(--lf-ease)',
        '@media (hover: hover)': {
          '&:hover': { backgroundColor: 'var(--lf-surface-sunken)' },
        },
        '&:active': { transform: 'scale(0.992)' },
      }}
    >
      <Box
        sx={{
          flex: '0 0 auto',
          width: 48,
          height: 48,
          borderRadius: 'var(--lf-r-chip)',
          overflow: 'hidden',
          backgroundColor: 'var(--lf-surface-sunken)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {product.image_main ? (
          <Box
            component="img"
            src={product.image_main}
            alt=""
            loading="lazy"
            decoding="async"
            width={48}
            height={48}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <Typography variant="badge" sx={{ color: 'var(--lf-ink-4)' }} aria-hidden="true">
            {String(product.name || '?').slice(0, 1).toUpperCase()}
          </Typography>
        )}
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="subtitle2"
          className="lf-clamp-1"
          sx={{ color: 'var(--lf-ink)' }}
        >
          <HighlightedName name={product.name} query={query} />
        </Typography>
        <Typography
          variant="caption"
          sx={{ display: 'block', color: 'var(--lf-ink-3)' }}
          className="lf-clamp-1"
        >
          {[categoryName, product.size].filter(Boolean).join(' · ')}
        </Typography>
      </Box>

      <Box sx={{ flex: '0 0 auto', textAlign: 'right' }}>
        <Typography variant="price" sx={{ display: 'block', color: 'var(--lf-ink)' }}>
          {price || 'Price on request'}
        </Typography>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            mt: 0.25,
          }}
        >
          <Box
            aria-hidden="true"
            sx={{
              width: 6,
              height: 6,
              borderRadius: 'var(--lf-r-pill)',
              backgroundColor: tone.dot,
            }}
          />
          <Typography variant="caption" sx={{ color: tone.ink }}>
            {stock.label}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default SearchResultRow;
