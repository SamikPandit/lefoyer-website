/**
 * ============================================================================
 * CartLine — one row of the bag. ART_DIRECTION.md §5.4.
 *
 * "Lines 1–7 in one panel with internal hairlines, 88px <Alcove surface='row'>
 *  thumbnails" (§5.4). The row is a cart line, not a product card: one niche,
 * one name, the server's money, one stepper, one Remove.
 *
 * WHAT THE ALCOVE REVAMP CHANGED HERE
 *  - **The raw `<img>` is gone.** It is now <Alcove surface="row">, which is
 *    the only way a product photograph reaches a surface (§2.30, §6.1) and the
 *    only way it gets AVIF/WebP derivatives, a `sizes` string and explicit
 *    width/height (§7.3, A13, P5). The row used to load a 2048px master into
 *    an 88px box.
 *  - **`filter: grayscale(1)` on an unavailable line is DELETED** (§10.13,
 *    §2.11): the light goes out, the niche does not, and the photograph is
 *    never touched. The row's `opacity: 0.72` is deleted for the same reason —
 *    it dimmed the photograph, the price and the Remove button together. The
 *    niche goes unlit via `data-stock`, and the unavailability is carried by
 *    WORDS (§6.4's label plus the server's own reason), never by colour or
 *    dimming alone (A8).
 *  - **The stock line is <StockLabel variant="inline">** — §6.4's single
 *    derivation, so a cart line can no longer disagree with the tile or the
 *    PDP about the same product.
 *  - **The stepper's buttons are 44px**, not MUI's 36px small (A6).
 *
 * WHAT DID NOT CHANGE, DELIBERATELY
 *  - **Money.** `unit_price` / `line_total` are the server's own figures,
 *    printed verbatim. `<PriceBlock>` derives a price from a PRODUCT, which is
 *    exactly the defect this file was written to kill (the list price on the
 *    card, the charged price in the basket), so the line total still goes
 *    through `formatMoney`. It uses the `price` typography variant, which is
 *    the same register and the same `tnum` <PriceBlock> renders.
 *  - **Availability is the server's answer** (IMPL_SPEC §2d): `in_stock` and
 *    `max_quantity` come down with the line and nothing here recomputes them
 *    from `stock_quantity`. The line's answer is fed INTO §6.4's derivation so
 *    the wording is shared, not duplicated.
 *  - Per-row pending state, the ceiling mirror and the server's verbatim
 *    refusal message.
 * ========================================================================== */

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { Link as RouterLink } from 'react-router-dom';

import Alcove from '../common/Alcove';
import StockLabel from '../product/StockLabel';
import { stockState } from '../../utils/stock';
import { formatMoney } from './CartTotals';

/**
 * The server refuses more than this per line (`cart/views.py::MAX_LINE_QUANTITY`,
 * verified = 20). Mirrored here so the stepper stops before the request does; the
 * server remains the authority and its message is shown verbatim if it refuses.
 */
export const MAX_LINE_QUANTITY = 20;

const REASON_COPY = {
  OUT_OF_STOCK: 'Out of stock',
  INSUFFICIENT_STOCK: 'Not enough stock left',
  COMING_SOON: 'Coming soon — not on sale yet',
  UNAVAILABLE: 'No longer available',
  NOT_FOUND: 'No longer available',
};

/**
 * §3.10 — the `row` surface caps the niche at 88px of HEIGHT, and `.lf-alcove`
 * divides that by the LOCKED ratio to get its inline size. Naming the width
 * here keeps the flex item from depending on a percentage that resolves
 * against itself; the ratio is still read from the token, never retyped.
 */
const ROW_NICHE_W = 'calc(88px / var(--lf-arch-ratio))';

/**
 * @param {object} props
 * @param {object} props.line `{product, quantity, unitPrice, lineTotal, inStock, maxQuantity}`
 * @param {boolean} [props.pending] A mutation for this row is in flight.
 * @param {string} [props.reason] Server reason code when the line is unsellable.
 * @param {number} [props.available] Units the server says are left.
 * @param {Function} props.onQuantityChange `(productId, nextQuantity) => Promise<true|string>`
 * @param {Function} props.onRemove `(productId) => Promise<true|string>`
 * @param {boolean} [props.last] Suppress the bottom hairline.
 */
const CartLine = ({
  line,
  pending = false,
  reason,
  available,
  onQuantityChange,
  onRemove,
  last = false,
}) => {
  const [rowError, setRowError] = useState(null);
  const [busy, setBusy] = useState(false);

  const { product, quantity, unitPrice, lineTotal, inStock } = line;
  const working = pending || busy;
  const ceiling = Math.min(
    MAX_LINE_QUANTITY,
    line.maxQuantity && line.maxQuantity > 0 ? line.maxQuantity : MAX_LINE_QUANTITY
  );

  /* ONE derivation (§6.4), given the authority IMPL_SPEC §2d names: the
     summary's per-line `in_stock`. Passing it in means the cart line borrows
     the wording and the dot colour instead of inventing a second vocabulary —
     which is how a tile and a basket ended up disagreeing before. */
  const stock = stockState({ ...product, in_stock: inStock });

  const unavailableNote = !inStock
    ? REASON_COPY[reason] || REASON_COPY.UNAVAILABLE
    : reason === 'INSUFFICIENT_STOCK'
      ? `Only ${available ?? ceiling} left — reduce the quantity`
      : null;

  const productHref = product.slug ? `/product/${product.slug}` : '/products';

  const run = async (action) => {
    setBusy(true);
    setRowError(null);
    try {
      const result = await action();
      // CartContext resolves to `true`, or to the backend's own sentence
      // ("Only 3 units available") — which is shown rather than flattened.
      if (result !== true && typeof result === 'string') setRowError(result);
    } finally {
      setBusy(false);
    }
  };

  const step = (delta) => {
    const next = quantity + delta;
    if (next < 1) {
      run(() => onRemove(product.id));
      return;
    }
    if (next > ceiling) {
      setRowError(`You can order up to ${ceiling} of this item.`);
      return;
    }
    run(() => onQuantityChange(product.id, next));
  };

  return (
    <Box
      component="li"
      sx={{
        listStyle: 'none',
        display: 'flex',
        gap: { xs: 1.5, sm: 2 },
        py: 2.5,
        borderBottom: last ? 'none' : '1px solid var(--lf-hairline)',
        position: 'relative',
      }}
      aria-busy={working || undefined}
    >
      {/* The niche. `stock` lights or unlights the WALL (§2.11); the
          photograph renders at full strength in every state. The name beside
          it is the row's accessible link, so the image itself takes `alt=""`
          rather than naming the product a second time (§7.3). */}
      <Box
        component={RouterLink}
        to={productHref}
        aria-label={product.name}
        sx={{ flex: 'none', display: 'block', width: ROW_NICHE_W }}
      >
        <Alcove product={product} surface="row" stock={stock.state} alt="" />
      </Box>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 0.5, sm: 2 }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'baseline' }}
        >
          <Typography
            variant="h5"
            component={RouterLink}
            to={productHref}
            sx={{
              color: 'var(--lf-ink)',
              textDecoration: 'none',
              '@media (hover:hover)': { '&:hover': { textDecoration: 'underline' } },
            }}
          >
            {product.name}
          </Typography>
          {/* The server's line total, in <PriceBlock>'s own register. */}
          <Typography
            variant="price"
            component="p"
            data-tnum="true"
            sx={{ color: 'var(--lf-ink)', whiteSpace: 'nowrap' }}
          >
            {formatMoney(lineTotal)}
          </Typography>
        </Stack>

        <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)', display: 'block', mt: 0.25 }}>
          {formatMoney(unitPrice)} each
          {product.size ? ` · ${product.size}` : ''}
          {product.sku ? ` · ${product.sku}` : ''}
        </Typography>

        {/* §6.4 — rendered ALWAYS, including in stock: words and a dot. */}
        <StockLabel stock={stock} variant="inline" sx={{ mt: 0.5 }} />

        {unavailableNote && (
          <Typography
            variant="caption"
            sx={{ color: 'var(--lf-warn-ink)', display: 'block', mt: 0.25, fontWeight: 600 }}
          >
            {unavailableNote}
          </Typography>
        )}

        {rowError && (
          <Typography
            role="alert"
            variant="caption"
            sx={{ color: 'var(--lf-err-ink)', display: 'block', mt: 0.5, fontWeight: 600 }}
          >
            {rowError}
          </Typography>
        )}

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
          sx={{ mt: 1.5 }}
        >
          {inStock ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                border: '1px solid var(--lf-border-field)',
                borderRadius: 'var(--lf-r-field)',
                backgroundColor: 'var(--lf-paper)',
              }}
            >
              {/* A6: a 44px floor on every target, including these two. */}
              <IconButton
                onClick={() => step(-1)}
                disabled={working}
                sx={{ width: 44, height: 44 }}
                aria-label={quantity === 1 ? `Remove ${product.name}` : `Decrease quantity of ${product.name}`}
              >
                <RemoveIcon fontSize="small" />
              </IconButton>
              <Box sx={{ minWidth: 40, textAlign: 'center', position: 'relative' }}>
                {working ? (
                  <CircularProgress size={16} thickness={3.6} aria-label="Updating" />
                ) : (
                  <Typography component="span" data-tnum="true" sx={{ fontWeight: 600 }}>
                    {quantity}
                  </Typography>
                )}
              </Box>
              <IconButton
                onClick={() => step(1)}
                disabled={working || quantity >= ceiling}
                sx={{ width: 44, height: 44 }}
                aria-label={`Increase quantity of ${product.name}`}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }} data-tnum="true">
              Quantity {quantity}
            </Typography>
          )}

          <Button
            variant="destructive"
            startIcon={working ? <CircularProgress size={16} thickness={3.6} /> : null}
            onClick={() => run(() => onRemove(product.id))}
            disabled={working}
          >
            Remove
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};

export default CartLine;
