/**
 * ============================================================================
 * OrderCard — one order in a list.
 *
 * Fixes carried here from the audit:
 *  - `order.status` is the server's DERIVED status (C-19). It used to read a
 *    column that does not exist, so every card printed the literal 'Pending'.
 *  - The customer-facing reference is `order_number` (`LF000123`), not the
 *    database id. `#17` is not something a customer can quote to support.
 *  - `navigate(order.shipment.tracking_url)` is gone. The tracking URL is an
 *    ABSOLUTE EXTERNAL Blue Dart address; handing it to react-router rendered
 *    the SPA's 404 page. It opens in a new tab, with `noopener`.
 *  - Money comes from the server's string fields through one formatter, so a
 *    DRF decimal never prints as `₹1299.00` here and `₹1,299` there.
 *  - `<Grid item xs>` → v7 `<Grid size={{…}}>`.
 *
 * ALCOVE (ART_DIRECTION.md §3.11, §6.1, §7.3):
 *  - **The three raw `<img>` thumbnails are now `<Alcove surface="thumb">`.**
 *    They are the only niche in the row, and they bring the derivative
 *    pipeline with them: a 72px thumbnail used to download a 2048px master,
 *    three at a time, ten orders to a page.
 *  - **`<Card>` is a `<Box component="article">` with a hairline.** The theme
 *    deleted `MuiCard`'s border because **the niche is the frame** for a
 *    PRODUCT card (§2.6) — but an order row is not a product card, it has no
 *    niche to be framed by, and canvas→paper is 1.115:1, so without an edge
 *    ten orders read as one undifferentiated column. One hairline, no shadow
 *    (§3.11: panels carry none).
 *  - **The status chips use the theme's measured semantic variants** rather
 *    than MUI palette colours, so every pairing is one of §3.4's audited ones
 *    (ok-ink on ok-tint 6.02:1, warn 6.26:1, err 6.70:1).
 *  - The decorative clock and lorry glyphs beside the date and the AWB are
 *    deleted (§2.15's reasoning): they carried nothing the labels do not.
 *
 * This module also exports the small order-state vocabulary shared by the order
 * pages, so the chip treatment and the date format cannot drift between the
 * list, the detail page and the confirmation page.
 * ========================================================================== */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import { Link as RouterLink } from 'react-router-dom';

import Alcove from '../common/Alcove';
import { formatMoney } from '../cart/CartTotals';

/** §3.10 — the `thumb` surface caps the niche at 72px of height. */
const THUMB_NICHE_W = 'calc(72px / var(--lf-arch-ratio))';

/** How many niches a row shows before it counts the rest in words. */
const THUMB_LIMIT = 3;

/**
 * The theme's Chip variant for the derived, human status string (§3.4). Every
 * pair is a measured one; nothing here reaches for a MUI palette colour.
 */
export function statusChipVariant(status) {
  switch (String(status || '').toLowerCase()) {
    case 'delivered':
      return 'statusOk';
    case 'shipped':
    case 'out for delivery':
    case 'processing':
    case 'confirmed':
      return 'statusGold';
    case 'payment failed':
    case 'cancelled':
    case 'expired':
      return 'statusErr';
    case 'returned':
    case 'delivery attempted':
    case 'refunded':
      return 'statusWarn';
    default:
      return 'filled';
  }
}

/** The theme's Chip variant for the raw payment state (§2f's six values). */
export function paymentChipVariant(paymentStatus) {
  switch (String(paymentStatus || '').toUpperCase()) {
    case 'COMPLETED':
      return 'statusOk';
    case 'FAILED':
    case 'CANCELLED':
      return 'statusErr';
    case 'PENDING':
      return 'statusWarn';
    default:
      return 'filled';
  }
}

/** `21 Oct 2026`. Returns null rather than "Invalid Date". */
export function formatOrderDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** The customer-facing reference. Never the bare database id when a number exists. */
export function orderRef(order) {
  return order?.order_number || `#${order?.id}`;
}

/**
 * Opens an external courier tracking page. `tracking_url` is absolute (§2b #25);
 * `navigate()` on it was the bug.
 */
export function openTracking(trackingUrl) {
  if (!trackingUrl) return;
  window.open(trackingUrl, '_blank', 'noopener,noreferrer');
}

/**
 * One order line's niche. The order's own `product_name` / `product_image`
 * snapshots win over the live product, so a renamed product does not rewrite
 * what was bought; the adjacent order reference names the row, so the image
 * itself takes `alt=""` rather than listing three product names in a row
 * nobody reads (§7.3).
 */
const LineThumb = ({ item }) => (
  <Box sx={{ flex: 'none', width: THUMB_NICHE_W }}>
    <Alcove
      product={{
        ...(item.product || {}),
        name: item.product_name || item.product?.name || '',
        image_main: item.product?.image_main || item.product_image || null,
      }}
      surface="thumb"
      alt=""
    />
  </Box>
);

const OrderCard = ({ order }) => {
  if (!order) return null;

  const items = Array.isArray(order.items) ? order.items : [];
  const shown = items.slice(0, THUMB_LIMIT);
  const remaining = Math.max(0, items.length - THUMB_LIMIT);
  const placedOn = formatOrderDate(order.created_at);
  const awaitingPayment = ['PENDING', 'FAILED'].includes(
    String(order.payment_status || '').toUpperCase()
  );
  const canRetry = order.can_retry === true || (order.can_retry === undefined && awaitingPayment);

  return (
    <Box
      component="article"
      sx={{
        mb: 2,
        p: { xs: 2, md: 3 },
        borderRadius: 'var(--lf-r-card)',
        border: '1px solid var(--lf-hairline)',
        backgroundColor: 'var(--lf-paper)',
      }}
    >
      <Grid container spacing={{ xs: 2, md: 3 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h6" component="h3" data-tnum="true">
                Order {orderRef(order)}
              </Typography>
              <Chip
                size="small"
                label={order.status || 'Awaiting payment'}
                variant={statusChipVariant(order.status)}
              />
              <Chip
                size="small"
                label={order.payment_status || 'PENDING'}
                variant={paymentChipVariant(order.payment_status)}
              />
            </Stack>

            <Stack
              direction="row"
              spacing={2.5}
              flexWrap="wrap"
              useFlexGap
              alignItems="baseline"
              sx={{ color: 'var(--lf-ink-3)' }}
            >
              {placedOn && <Typography variant="body2">{placedOn}</Typography>}
              <Typography variant="price" component="span" data-tnum="true" sx={{ color: 'var(--lf-ink)' }}>
                {formatMoney(order.total)}
              </Typography>
              {order.shipment?.awb_number && (
                <Typography variant="body2" data-tnum="true">
                  AWB {order.shipment.awb_number}
                </Typography>
              )}
            </Stack>

            {shown.length > 0 && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 0.5 }}>
                {shown.map((item) => (
                  <LineThumb key={item.id} item={item} />
                ))}
                {remaining > 0 && (
                  <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
                    +{remaining} more
                  </Typography>
                )}
              </Stack>
            )}

            {awaitingPayment && (
              <Typography variant="caption" sx={{ color: 'var(--lf-warn-ink)', fontWeight: 600 }}>
                {String(order.payment_status).toUpperCase() === 'FAILED'
                  ? 'Payment failed — you have not been charged. You can pay for this order again.'
                  : 'Awaiting payment — nothing has been charged yet.'}
              </Typography>
            )}
          </Stack>
        </Grid>

        <Grid
          size={{ xs: 12, md: 4 }}
          sx={{ display: 'flex', alignItems: 'center', justifyContent: { md: 'flex-end' } }}
        >
          <Stack spacing={1.25} sx={{ width: { xs: '100%', md: 180 } }}>
            <Button component={RouterLink} to={`/orders/${order.id}`} fullWidth>
              View details
            </Button>
            {canRetry && (
              <Button
                variant="outlined"
                fullWidth
                component={RouterLink}
                to={`/orders/${order.id}?action=payment`}
              >
                Complete payment
              </Button>
            )}
            {order.shipment?.tracking_url && (
              <Button
                variant="outlined"
                fullWidth
                onClick={() => openTracking(order.shipment.tracking_url)}
                startIcon={<LocalShippingOutlinedIcon />}
              >
                Track order
              </Button>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

export default OrderCard;
