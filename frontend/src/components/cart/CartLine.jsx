/**
 * CartLine — one row of the bag.
 *
 * Replaces the deleted `cart/CartItem.jsx`. What changed, and why:
 *
 *  - **Price.** `item.price` (the LIST price) is gone. The row prints
 *    `unit_price` / `line_total` as the server computed them, so the line can
 *    never disagree with the amount charged.
 *  - **`Size: {item.size}`** is gone. There is no `size` field on `Product`;
 *    every row printed the literal "Size:" followed by nothing.
 *  - **Availability is the server's answer** (§2d): `in_stock` and
 *    `max_quantity` come down with the line. Nothing here recomputes
 *    availability from `stock_quantity`.
 *  - **A row that can no longer be sold is disabled, not silent.** The stepper
 *    and the price go quiet, the row says why, and Remove is the only live
 *    control — because the alternative is discovering it at Place Order.
 *  - **Per-row pending state.** Quantity changes are network calls; the row
 *    shows its own spinner and disables its own controls rather than freezing
 *    the whole page.
 */

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RemoveIcon from '@mui/icons-material/Remove';
import { Link as RouterLink } from 'react-router-dom';

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
  const unavailableNote = !inStock
    ? REASON_COPY[reason] || REASON_COPY.UNAVAILABLE
    : reason === 'INSUFFICIENT_STOCK'
      ? `Only ${available ?? ceiling} left — reduce the quantity`
      : null;

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
        opacity: inStock ? 1 : 0.72,
        position: 'relative',
      }}
      aria-busy={working || undefined}
    >
      <Box
        component={RouterLink}
        to={product.slug ? `/product/${product.slug}` : '/products'}
        sx={{ flexShrink: 0, display: 'block', borderRadius: 'var(--lf-r-field)' }}
        aria-label={product.name}
      >
        <Box
          component="img"
          src={product.image_main || ''}
          alt={product.name || ''}
          data-product="true"
          loading="lazy"
          sx={{
            width: { xs: 72, sm: 88 },
            height: { xs: 72, sm: 88 },
            objectFit: 'cover',
            borderRadius: 'var(--lf-r-field)',
            backgroundColor: 'var(--lf-surface-sunken)',
            filter: inStock ? 'none' : 'grayscale(1)',
          }}
        />
      </Box>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 0.5, sm: 2 }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'baseline' }}
        >
          <Typography
            variant="subtitle1"
            component={RouterLink}
            to={product.slug ? `/product/${product.slug}` : '/products'}
            sx={{
              fontWeight: 600,
              color: 'var(--lf-ink)',
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {product.name}
          </Typography>
          <Typography
            variant="price"
            data-tnum="true"
            sx={{ color: 'var(--lf-ink)', whiteSpace: 'nowrap' }}
          >
            {formatMoney(lineTotal)}
          </Typography>
        </Stack>

        <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)', display: 'block', mt: 0.25 }}>
          {formatMoney(unitPrice)} each
          {product.sku ? ` · ${product.sku}` : ''}
        </Typography>

        {unavailableNote && (
          <Typography
            variant="caption"
            sx={{ color: 'var(--lf-warn-ink)', display: 'block', mt: 0.5, fontWeight: 600 }}
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
                border: '1px solid var(--lf-border-strong)',
                borderRadius: 'var(--lf-r-field)',
                backgroundColor: 'var(--lf-surface)',
              }}
            >
              <IconButton
                size="small"
                onClick={() => step(-1)}
                disabled={working}
                aria-label={quantity === 1 ? `Remove ${product.name}` : `Decrease quantity of ${product.name}`}
              >
                <RemoveIcon fontSize="small" />
              </IconButton>
              <Box sx={{ minWidth: 40, textAlign: 'center', position: 'relative' }}>
                {working ? (
                  <CircularProgress size={16} aria-label="Updating" />
                ) : (
                  <Typography component="span" data-tnum="true" sx={{ fontWeight: 600 }}>
                    {quantity}
                  </Typography>
                )}
              </Box>
              <IconButton
                size="small"
                onClick={() => step(1)}
                disabled={working || quantity >= ceiling}
                aria-label={`Increase quantity of ${product.name}`}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
              Quantity {quantity}
            </Typography>
          )}

          <Button
            variant="destructive"
            size="small"
            startIcon={working ? <CircularProgress size={16} /> : <DeleteOutlineIcon fontSize="small" />}
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
