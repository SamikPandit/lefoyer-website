/**
 * ============================================================================
 * CrossSell — exactly three adjacent products, under the bag.
 *
 * The server picks them (`cart/views.py::_cross_sell`): same category first,
 * never something already in the cart, and only `sellable` rows — so this
 * component never offers something that cannot be bought. If the server sends
 * fewer than one, the section does not render at all: an empty "you might also
 * like" rail is worse than no rail. It is also what §5.4 and §5.8 pass into
 * `EmptyState`'s `children` slot on an empty bag (§2.28), which is the slot
 * `EmptyState.jsx`'s own docstring was written for and no caller ever used.
 *
 * It is a compact row rather than a `<ProductCard>` grid on purpose. The
 * cart's job is to finish the order; a full card with its own status ledge,
 * eyebrow, review link and 48px CTA competes with Proceed to checkout. One
 * niche, one name, one price, one Add. That is a DENSITY decision, not a
 * second card language (§10.23) — every part of the row is the shared
 * component the rest of the site uses:
 *
 *   · the photograph  → <Alcove surface="thumb">, the one niche (§6.1, §2.30)
 *   · the price       → <PriceBlock>, so it cannot disagree with the PDP (§6.3)
 *   · the Add         → <AddToBag>, with §6.5's frozen width, 400ms minimum
 *                       spinner, 900ms `Added` crossfade and adjacent error
 *   · the gold rule   → `.lf-ledge` (§3.3). The `--lf-rule-gold` hairline it
 *                       replaces composited to 1.30:1 over canvas — an accent
 *                       below the perception floor (§2.3).
 * ========================================================================== */

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

import Alcove from '../common/Alcove';
import AddToBag from '../product/AddToBag';
import PriceBlock from '../product/PriceBlock';
import { productPath } from '../product/productPresentation';

const MAX_ITEMS = 3;

/** §3.10 — the `thumb` surface caps the niche at 72px of height. */
const THUMB_NICHE_W = 'calc(72px / var(--lf-arch-ratio))';

/**
 * @param {object} props
 * @param {Array} props.products Server-chosen products (already sellable).
 * @param {string} [props.title='Pairs well with']
 * @param {Function} [props.onAdded] Called after a successful add, so the page
 *   can re-price the basket.
 */
const CrossSell = ({ products, title = 'Pairs well with', onAdded }) => {
  const [message, setMessage] = useState(null);

  const items = (Array.isArray(products) ? products : [])
    // §2d: only the server's own `in_stock` boolean. No `stock_quantity` fallback.
    .filter((product) => product && product.in_stock !== false)
    .slice(0, MAX_ITEMS);

  if (items.length === 0) return null;

  const handleAdded = (product) => {
    setMessage(`${product.name} added to your bag.`);
    if (onAdded) onAdded();
  };

  return (
    <Box component="section" aria-labelledby="cross-sell-heading" sx={{ mt: 5 }}>
      <Typography id="cross-sell-heading" variant="h5" component="h2" sx={{ mb: 1 }}>
        {title}
      </Typography>

      {/* The lit front edge of a shelf: 2px --lf-gold at 1.96:1, full column
          width, never capped by a call site (§3.3). */}
      <Box className="lf-ledge" aria-hidden="true" />

      <Box
        sx={{
          mt: 2.5,
          display: 'grid',
          minWidth: 0,
          gap: 2,
          gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
          '@media (min-width:680px)': { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        {items.map((product) => (
          <Box
            key={product.id}
            component="article"
            sx={{
              p: 1.5,
              minWidth: 0,
              borderRadius: 'var(--lf-r-card)',
              border: '1px solid var(--lf-hairline)',
              backgroundColor: 'var(--lf-paper)',
            }}
          >
            <Box sx={{ display: 'flex', gap: 1.5, minWidth: 0 }}>
              <Box
                component={RouterLink}
                to={productPath(product)}
                aria-label={product.name}
                sx={{ flex: 'none', display: 'block', width: THUMB_NICHE_W }}
              >
                {/* These are sellable by construction, so the niche is lit. */}
                <Alcove product={product} surface="thumb" alt="" />
              </Box>

              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography
                  variant="body2"
                  component={RouterLink}
                  to={productPath(product)}
                  sx={{
                    fontWeight: 600,
                    color: 'var(--lf-ink)',
                    textDecoration: 'none',
                    display: 'block',
                    '@media (hover:hover)': { '&:hover': { textDecoration: 'underline' } },
                  }}
                  className="lf-clamp-2"
                >
                  {product.name}
                </Typography>
                {product.size && (
                  <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)', display: 'block' }}>
                    {product.size}
                  </Typography>
                )}
                <PriceBlock product={product} size="md" sx={{ mt: 0.5 }} />
              </Box>
            </Box>

            <Box sx={{ mt: 1.5 }}>
              <AddToBag product={product} size="card" onAdded={handleAdded} />
            </Box>
          </Box>
        ))}
      </Box>

      {/* One live region, so a successful add is announced once. A refusal is
          reported by <AddToBag> itself, adjacent to the button that failed. */}
      <Typography
        aria-live="polite"
        variant="caption"
        sx={{ display: 'block', color: 'var(--lf-ink-3)', minHeight: 18, mt: 1 }}
      >
        {message}
      </Typography>
    </Box>
  );
};

export default CrossSell;
