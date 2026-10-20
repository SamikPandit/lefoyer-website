/**
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
 * This module also exports the small order-state vocabulary shared by the order
 * pages, so the chip colours and the date format cannot drift between the list,
 * the detail page and the confirmation page.
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PaymentOutlinedIcon from '@mui/icons-material/PaymentOutlined';
import { Link as RouterLink } from 'react-router-dom';

import { formatMoney } from '../cart/CartTotals';

/** MUI chip colour for the derived, human status string. */
export function statusChipColor(status) {
  switch (String(status || '').toLowerCase()) {
    case 'delivered':
      return 'success';
    case 'shipped':
    case 'out for delivery':
      return 'info';
    case 'processing':
    case 'confirmed':
      return 'primary';
    case 'payment failed':
    case 'cancelled':
    case 'expired':
      return 'error';
    case 'returned':
    case 'delivery attempted':
    case 'refunded':
      return 'warning';
    default:
      return 'default';
  }
}

/** MUI chip colour for the raw payment state (§2f's six values). */
export function paymentChipColor(paymentStatus) {
  switch (String(paymentStatus || '').toUpperCase()) {
    case 'COMPLETED':
      return 'success';
    case 'FAILED':
    case 'CANCELLED':
      return 'error';
    case 'PENDING':
      return 'warning';
    case 'EXPIRED':
    case 'REFUNDED':
      return 'default';
    default:
      return 'default';
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

const OrderCard = ({ order }) => {
  if (!order) return null;

  const items = Array.isArray(order.items) ? order.items : [];
  const firstThree = items.slice(0, 3);
  const remaining = Math.max(0, items.length - 3);
  const placedOn = formatOrderDate(order.created_at);
  const awaitingPayment = ['PENDING', 'FAILED'].includes(
    String(order.payment_status || '').toUpperCase()
  );
  const canRetry = order.can_retry === true || (order.can_retry === undefined && awaitingPayment);

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
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
                  color={statusChipColor(order.status)}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  icon={<PaymentOutlinedIcon />}
                  label={order.payment_status || 'PENDING'}
                  color={paymentChipColor(order.payment_status)}
                />
              </Stack>

              <Stack
                direction="row"
                spacing={2.5}
                flexWrap="wrap"
                useFlexGap
                sx={{ color: 'var(--lf-ink-3)' }}
              >
                {placedOn && (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <AccessTimeIcon fontSize="small" />
                    <Typography variant="body2">{placedOn}</Typography>
                  </Stack>
                )}
                <Typography variant="body2" data-tnum="true" sx={{ color: 'var(--lf-ink)', fontWeight: 600 }}>
                  {formatMoney(order.total)}
                </Typography>
                {order.shipment?.awb_number && (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <LocalShippingOutlinedIcon fontSize="small" />
                    <Typography variant="body2">AWB {order.shipment.awb_number}</Typography>
                  </Stack>
                )}
              </Stack>

              {firstThree.length > 0 && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 0.5 }}>
                  {firstThree.map((item) => (
                    <Box
                      key={item.id}
                      component="img"
                      src={item.product_image || ''}
                      alt={item.product_name || ''}
                      data-product="true"
                      loading="lazy"
                      sx={{
                        width: 56,
                        height: 56,
                        objectFit: 'cover',
                        borderRadius: 'var(--lf-r-chip)',
                        border: '1px solid var(--lf-hairline)',
                        backgroundColor: 'var(--lf-surface-sunken)',
                      }}
                    />
                  ))}
                  {remaining > 0 && (
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 'var(--lf-r-chip)',
                        border: '1px solid var(--lf-hairline)',
                        backgroundColor: 'var(--lf-surface-sunken)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        +{remaining}
                      </Typography>
                    </Box>
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
      </CardContent>
    </Card>
  );
};

export default OrderCard;
