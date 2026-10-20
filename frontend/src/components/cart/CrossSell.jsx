/**
 * CrossSell — exactly three adjacent products, under the bag.
 *
 * The server picks them (`cart/views.py::_cross_sell`): same category first,
 * never something already in the cart, and only `sellable` rows — so this
 * component never offers something that cannot be bought. If the server sends
 * fewer than one, the section does not render at all: an empty "you might also
 * like" rail is worse than no rail.
 *
 * It is a compact row rather than a `ProductCard` grid on purpose. The cart's
 * job is to finish the order; a full card with its own proof row, stock pill and
 * 44px CTA competes with Proceed to Checkout. One thumbnail, one name, one
 * price, one quiet Add.
 */

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddShoppingCartOutlinedIcon from '@mui/icons-material/AddShoppingCartOutlined';
import { Link as RouterLink } from 'react-router-dom';

import { effectivePrice } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { formatMoney } from './CartTotals';

const MAX_ITEMS = 3;

/**
 * @param {object} props
 * @param {Array} props.products Server-chosen products (already sellable).
 * @param {string} [props.title='Pairs well with']
 * @param {Function} [props.onAdded] Called after a successful add, so the page
 *   can re-price the basket.
 */
const CrossSell = ({ products, title = 'Pairs well with', onAdded }) => {
  const { addToCart } = useCart();
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null);

  const items = (Array.isArray(products) ? products : [])
    // §2d: only the server's own `in_stock` boolean. No `stock_quantity` fallback.
    .filter((product) => product && product.in_stock !== false)
    .slice(0, MAX_ITEMS);

  if (items.length === 0) return null;

  const add = async (product) => {
    setBusyId(product.id);
    setMessage(null);
    try {
      const result = await addToCart(product, 1);
      if (result === true) {
        setMessage(`${product.name} added to your bag.`);
        if (onAdded) onAdded();
      } else if (typeof result === 'string') {
        setMessage(result);
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Box component="section" aria-labelledby="cross-sell-heading" sx={{ mt: 5 }}>
      <Typography id="cross-sell-heading" variant="h5" component="h2" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Box sx={{ borderTop: '1px solid var(--lf-rule-gold)', mb: 2.5, pt: 2.5 }}>
        <Grid container spacing={2}>
          {items.map((product) => (
            <Grid key={product.id} size={{ xs: 12, sm: 4 }}>
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{
                  p: 1.5,
                  height: '100%',
                  borderRadius: 'var(--lf-r-card)',
                  border: '1px solid var(--lf-hairline)',
                  backgroundColor: 'var(--lf-surface)',
                }}
              >
                <Box
                  component={RouterLink}
                  to={product.slug ? `/product/${product.slug}` : '/products'}
                  sx={{ flexShrink: 0 }}
                  aria-label={product.name}
                >
                  <Box
                    component="img"
                    src={product.image_main || ''}
                    alt={product.name || ''}
                    data-product="true"
                    loading="lazy"
                    sx={{
                      width: 56,
                      height: 56,
                      objectFit: 'cover',
                      borderRadius: 'var(--lf-r-chip)',
                      backgroundColor: 'var(--lf-surface-sunken)',
                    }}
                  />
                </Box>
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography
                    variant="body2"
                    component={RouterLink}
                    to={product.slug ? `/product/${product.slug}` : '/products'}
                    sx={{
                      fontWeight: 600,
                      color: 'var(--lf-ink)',
                      textDecoration: 'none',
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    {product.name}
                  </Typography>
                  <Typography variant="caption" data-tnum="true" sx={{ color: 'var(--lf-ink-3)' }}>
                    {formatMoney(effectivePrice(product))}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => add(product)}
                  disabled={busyId === product.id}
                  startIcon={
                    busyId === product.id ? (
                      <CircularProgress size={16} />
                    ) : (
                      <AddShoppingCartOutlinedIcon fontSize="small" />
                    )
                  }
                  sx={{ flexShrink: 0 }}
                >
                  Add
                </Button>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Box>
      {/* One live region, so a successful add (or a refusal) is announced. */}
      <Typography
        aria-live="polite"
        variant="caption"
        sx={{ display: 'block', color: 'var(--lf-ink-3)', minHeight: 18 }}
      >
        {message}
      </Typography>
    </Box>
  );
};

export default CrossSell;
