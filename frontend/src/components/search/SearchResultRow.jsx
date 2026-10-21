/**
 * ============================================================================
 * <SearchResultRow> — one product inside the search overlay's listbox.
 * ART_DIRECTION.md §5.10, §7.3, §7.4, §6.3, §6.4.
 *
 * The niche · name (with the matched substrings in a real `<mark>`) · size ·
 * price · stock words. THE SAME <Alcove> as the 490px hero, at 72px.
 *
 * WHAT THIS FILE NO LONGER DOES, AND WHY EACH DELETION MATTERS:
 *
 *   · IT NO LONGER WRITES AN `<img>`. It carried a raw `<Box component="img"
 *     src={product.image_main}>` that loaded a 1.18–6.12 MB master into a
 *     48px box. `<ProductImage>` (inside `<Alcove>`) is the only `<img>`
 *     emitter on the site now (§7.3): `<picture>`, AVIF → WebP → JPEG,
 *     srcset, `sizes: 72px`, explicit width/height, a composed alt.
 *
 *   · IT NO LONGER RENDERS THE PRODUCT'S FIRST LETTER as placeholder artwork.
 *     That is §7.5 rule 2 — the same defect that shipped on the category
 *     tiles, where a tile with no image printed its own name as art and then
 *     printed it again as the label. A product with no photograph gets an
 *     empty lit shelf and keeps its accessible name.
 *
 *   · IT NO LONGER CARRIES ITS OWN `deriveStock` AND `formatMoney`. Those
 *     were written here with their own `TODO(wp-10/utils)` saying to delete
 *     them the day `utils/stock.js` and `<PriceBlock>` landed. They have
 *     landed. Two derivations of "is this buyable" is how a shop ends up
 *     telling a customer two different things on two surfaces.
 *
 * A11Y
 * The row is the `role="option"` of the overlay's `role="listbox"`. Arrow keys
 * move `aria-activedescendant` on the input and never move DOM focus, so
 * typing keeps working; that is why this row is `tabIndex={-1}` and is driven
 * by the `active` prop rather than by `:focus`.
 * ========================================================================== */

import { Box, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import Alcove from '../common/Alcove';
import PriceBlock from '../product/PriceBlock';
import StockLabel from '../product/StockLabel';
import { stockState } from '../../utils/stock';
import { productPath } from '../product/productPresentation';

/** The PDP route, re-exported from the ONE implementation: a card and a
 *  search row must not be able to disagree about where a product lives. */
export { productPath };

/* ------------------------------------------------------------------ *
 * Matched-substring highlighting — a real <mark> element, so a match is
 * announced as emphasis instead of being an invisible colour change.
 * ------------------------------------------------------------------ */

/** Case/diacritic-insensitive fold, so "serum" matches "Sérum". */
const fold = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Split `text` into `[{text, match}]` segments for every query token it
 * contains. Overlapping ranges are merged so a token pair never produces
 * nested `<mark>`s.
 * @param {string} text
 * @param {string} query
 * @returns {Array<{text:string, match:boolean}>}
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
        <span key={`t-${index}`}>{segment.text}</span>
      )
    )}
  </>
);

/**
 * @param {object} props
 * @param {object} props.product The product object from `searchProducts()`.
 * @param {string} [props.query] The current query, for `<mark>` highlighting.
 * @param {boolean} [props.active=false] Is this the `aria-activedescendant` row.
 * @param {string} props.id DOM id, referenced by `aria-activedescendant`.
 * @param {Function} [props.onSelect] Called before navigation (closes the overlay).
 * @param {Function} [props.onMouseEnter] Keeps the pointer and keyboard in sync.
 * @returns {JSX.Element|null}
 */
const SearchResultRow = ({ product, query = '', active = false, id, onSelect, onMouseEnter }) => {
  if (!product) return null;

  /* THE single derivation (§6.4). The same expression the card, the PDP and
     the cart line read, so the same product cannot be "In stock" here and
     "Back soon" one tap later. */
  const stock = stockState(product);
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
      className="lf-ring-inset lf-press"
      data-press="row"
      /* <Alcove> reads this from an ancestor exactly as it does on a card:
         the light goes out on an unbuyable product without this file knowing
         anything about gradients. */
      data-stock={stock.state}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--lf-4)',
        px: { xs: 'var(--lf-3)', sm: 'var(--lf-4)' },
        py: 'var(--lf-2)',
        minHeight: 64,
        textDecoration: 'none',
        color: 'var(--lf-ink)',
        borderRadius: 'var(--lf-r-field)',
        backgroundColor: active ? 'var(--lf-mat)' : 'transparent',
        transition: 'background-color var(--lf-dur-2) var(--lf-ease)',
        '@media (hover: hover)': {
          '&:hover': { backgroundColor: 'var(--lf-mat)' },
        },
      }}
    >
      {/* The niche, at 72px. The alt is composed by <ProductImage>, and the
          row already names the product, so nothing is announced twice. */}
      <Alcove
        product={product}
        surface="thumb"
        alt=""
        style={{ flex: 'none', marginInline: 0 }}
      />

      <Box sx={{ minWidth: 0, flex: 1 }}>
        {/* No `display` in sx: `.lf-clamp-1` sets `-webkit-box` itself and an
            emotion class would outrank it, silently killing the clamp. */}
        <Typography
          variant="h5"
          component="span"
          className="lf-clamp-1"
          sx={{ color: 'var(--lf-ink)' }}
        >
          <HighlightedName name={product.name} query={query} />
        </Typography>
        <Typography
          variant="caption"
          component="span"
          className="lf-clamp-1"
          sx={{ color: 'var(--lf-ink-3)' }}
        >
          {[categoryName, product.size].filter(Boolean).join(' · ')}
        </Typography>
      </Box>

      <Box
        sx={{
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 'var(--lf-1)',
        }}
      >
        <PriceBlock product={product} size="md" sellable={stock.sellable} />
        {/* §5.10 — an out-of-stock row is never hidden (that filter is
            dropped) and never silent: it says so, in words, and names the
            thing the product page will offer. */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 'var(--lf-2)' }}>
          <StockLabel stock={stock} variant="inline" />
          {stock.notifiable ? (
            <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
              · Notify me
            </Typography>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
};

export default SearchResultRow;
