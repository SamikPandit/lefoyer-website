/**
 * ============================================================================
 * OrderDetail — one order, in full.
 *
 * WHAT WAS BROKEN (C-19, C-20, C-24 and the tracking bug)
 *  - It read `order.status`, which **does not exist** on the model, so the
 *    status chip printed the literal fallback 'Pending' for every order ever
 *    placed. The serializer now derives `status` server-side and this page
 *    consumes it.
 *  - Eleven `order.shipping_*` reads rendered blank, because the old
 *    `fields='__all__'` serializer emitted `first_name`/`city`/… without the
 *    prefix. The serializer now sends both shapes; this page reads the flat
 *    aliases with the nested block as a fallback.
 *  - `const shipping = 0; // Add shipping logic if needed` and a client-side
 *    `subtotal` recomputed from the lines are both gone: every figure is the
 *    server's stored money (§2b #25), printed verbatim with no arithmetic.
 *  - `order.discount` was an INTEGER PERCENT printed as `-₹{discount}` — so a
 *    10% coupon displayed as "−₹10". It is now the rupee `discount_amount`.
 *  - `navigate(order.shipment.tracking_url)` handed an absolute external Blue
 *    Dart URL to react-router, which rendered the SPA's 404. It opens in a new
 *    tab (`openTracking`).
 *
 * ALCOVE (ART_DIRECTION.md §3.11, §5.9, §6.1, §7.3) — PRESENTATION ONLY:
 *  - **The 4-column `<Table>` is now a line list**, each row a niche + the
 *    name + `₹price × qty` + the line total. The table needed a horizontal
 *    scroller at 320px to show four columns of an itemisation that is really
 *    one fact per line, and its 48px raw `<img>` loaded a 2048px master. The
 *    list is the same shape the cart and the confirmation use, so an order
 *    looks like the thing it is at every width.
 *  - Panels carry no shadow and no `--lf-e-edge` inset highlight (§3.11), and
 *    the legacy `--lf-surface*` aliases are gone from this file.
 *  - The UTILITY archetype (§5.9): `h3` as the `h1`, left aligned,
 *    `py: var(--lf-sect)`. §5.9's table names its siblings — Orders, Cart,
 *    Confirmation — and this page is the same kind reached from the same menu,
 *    so it takes the same archetype rather than a sixth heading size.
 *  - The status chips take the theme's measured semantic variants (§3.4).
 *
 * Nothing about the payment state machine, the retry dialog or the cart
 * restore is touched.
 * ========================================================================== */

import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import SeoHead from '../components/common/SeoHead';
import SupportLink from '../components/common/SupportLink';
import ErrorState from '../components/common/ErrorState';
import Alcove from '../components/common/Alcove';
import { formatMoney } from '../components/cart/CartTotals';
import OrderTimeline from '../components/order/OrderTimeline';
import PaymentCompletionDialog from '../components/order/PaymentCompletionDialog';
import {
  formatOrderDate,
  openTracking,
  orderRef,
  paymentChipVariant,
  statusChipVariant,
} from '../components/order/OrderCard';
import { useCart } from '../context/CartContext';
import { getApiErrorMessage, getOrder, restoreCartFromOrder } from '../services/api';
import { usePolicy } from '../content/policy';

/** §3.10 — the `thumb` surface caps the niche at 72px of height. */
const THUMB_NICHE_W = 'calc(72px / var(--lf-arch-ratio))';

const Panel = ({ title, children, sx, ...rest }) => (
  <Box
    // `sx` is MERGED, not spread after: `{...rest}` carrying an `sx` would
    // replace the whole style object and silently drop the panel chrome.
    // §3.11: a panel is not a floating thing, so it carries no elevation.
    sx={{
      p: { xs: 2, md: 3 },
      borderRadius: 'var(--lf-r-panel)',
      border: '1px solid var(--lf-hairline)',
      backgroundColor: 'var(--lf-paper)',
      ...sx,
    }}
    {...rest}
  >
    {title && (
      <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
    )}
    {children}
  </Box>
);

const KeyValue = ({ label, value, tone }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.4 }}>
    <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)' }}>
      {label}
    </Typography>
    <Typography
      variant="body2"
      sx={{ color: tone || 'var(--lf-ink)', textAlign: 'right', wordBreak: 'break-word' }}
    >
      {value}
    </Typography>
  </Box>
);

/**
 * One ordered line. The order's own `product_name` / `product_sku` /
 * `product_image` snapshots win over the live product, so a renamed or
 * re-SKU'd product never rewrites what the customer bought; the name beside
 * the niche is the row's link, so the photograph takes `alt=""` (§7.3).
 */
const OrderLine = ({ item, last }) => {
  const lineProduct = {
    ...(item.product || {}),
    name: item.product_name || item.product?.name || '',
    image_main: item.product?.image_main || item.product_image || null,
  };
  const href = item.product_slug ? `/product/${item.product_slug}` : null;

  return (
    <Box
      component="li"
      sx={{
        listStyle: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        py: 2,
        minWidth: 0,
        borderBottom: last ? 'none' : '1px solid var(--lf-hairline)',
      }}
    >
      <Box sx={{ flex: 'none', width: THUMB_NICHE_W }}>
        <Alcove product={lineProduct} surface="thumb" alt="" />
      </Box>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        {href ? (
          <Typography
            variant="h6"
            component={RouterLink}
            to={href}
            sx={{
              color: 'var(--lf-ink)',
              textDecoration: 'none',
              display: 'block',
              '@media (hover:hover)': { '&:hover': { textDecoration: 'underline' } },
            }}
          >
            {lineProduct.name}
          </Typography>
        ) : (
          <Typography variant="h6" component="p" sx={{ color: 'var(--lf-ink)' }}>
            {lineProduct.name}
          </Typography>
        )}
        <Typography
          variant="caption"
          component="p"
          data-tnum="true"
          sx={{ color: 'var(--lf-ink-3)' }}
        >
          {formatMoney(item.price)} × {item.quantity}
          {item.product_sku ? ` · ${item.product_sku}` : ''}
        </Typography>
      </Box>

      <Typography
        variant="price"
        component="p"
        data-tnum="true"
        sx={{ color: 'var(--lf-ink)', whiteSpace: 'nowrap' }}
      >
        {formatMoney(item.line_total)}
      </Typography>
    </Box>
  );
};

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refresh: refreshCart } = useCart();
  const { copy } = usePolicy();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOrder(id);
      setOrder(data);
      setError(null);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /* `?action=payment` is how the list and the timeline deep-link into the retry
     flow. It only OPENS a dialog — it can never change what the order says. */
  useEffect(() => {
    if (order && searchParams.get('action') === 'payment') setPaymentDialogOpen(true);
  }, [order, searchParams]);

  const handleRestoreCart = async () => {
    setRestoring(true);
    setNotice(null);
    try {
      const result = await restoreCartFromOrder(id);
      await refreshCart();
      const skipped = Array.isArray(result?.skipped) ? result.skipped : [];
      if (skipped.length > 0) {
        setNotice(
          `Your bag is back, except: ${skipped
            .map((entry) => entry.name || `product ${entry.product_id}`)
            .join(', ')} — no longer available.`
        );
      }
      navigate('/cart');
    } catch (requestError) {
      setNotice(getApiErrorMessage(requestError, 'We could not restore your bag.'));
    } finally {
      setRestoring(false);
    }
  };

  if (loading && !order) {
    return (
      <Container maxWidth="lg" sx={{ py: 'var(--lf-sect)' }}>
        <SeoHead title="Your order" noindex />
        <Stack spacing={2} alignItems="center">
          <CircularProgress size={28} thickness={3.6} />
          <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)' }}>
            Loading your order…
          </Typography>
        </Stack>
      </Container>
    );
  }

  if (error || !order) {
    return (
      <Container maxWidth="sm" sx={{ py: 'var(--lf-sect)' }}>
        <SeoHead title="Your order" noindex />
        <ErrorState
          variant="page"
          headingComponent="h1"
          title={error?.isNotFound ? 'We could not find that order' : 'We could not load that order'}
          error={error}
          onRetry={error?.isNotFound ? null : load}
          secondaryLabel="Go to my orders"
          secondaryTo="/orders"
        />
      </Container>
    );
  }

  const paymentStatus = String(order.payment_status || '').toUpperCase();
  const address = order.shipping_address || {};
  const line = (flat, nested) => order[flat] || address[nested] || '';
  const items = Array.isArray(order.items) ? order.items : [];
  const awaitingPayment = ['PENDING', 'FAILED'].includes(paymentStatus);
  const canRetry = order.can_retry === true || (order.can_retry === undefined && awaitingPayment);
  const shipment = order.shipment;
  const isCOD = String(order.payment_method || '').toUpperCase() === 'COD';

  return (
    <Container maxWidth="lg" sx={{ py: 'var(--lf-sect)' }}>
      <SeoHead title={`Order ${orderRef(order)}`} noindex description="Your order details." />

      <Button
        component={RouterLink}
        to="/orders"
        variant="text"
        startIcon={<ArrowBackIcon fontSize="small" />}
        sx={{ mb: 2 }}
      >
        All my orders
      </Button>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ md: 'flex-start' }}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h3" component="h1" data-tnum="true">
            Order {orderRef(order)}
          </Typography>
          {formatOrderDate(order.created_at) && (
            <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)', mt: 0.5 }}>
              Placed on {formatOrderDate(order.created_at)}
            </Typography>
          )}
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
            <Chip
              label={order.status || 'Awaiting payment'}
              variant={statusChipVariant(order.status)}
            />
            <Chip
              label={paymentStatus || 'PENDING'}
              variant={paymentChipVariant(paymentStatus)}
            />
            <Chip label={isCOD ? 'Cash on delivery' : 'Paid online'} variant="outlined" />
          </Stack>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          {canRetry && (
            <Button startIcon={<ReplayIcon />} onClick={() => setPaymentDialogOpen(true)}>
              Complete payment
            </Button>
          )}
          {shipment?.tracking_url && (
            <Button
              variant="outlined"
              startIcon={<LocalShippingOutlinedIcon />}
              onClick={() => openTracking(shipment.tracking_url)}
            >
              Track shipment
            </Button>
          )}
        </Stack>
      </Stack>

      {notice && (
        <Alert severity="info" sx={{ mb: 3 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {order.needs_manual_review && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>We are checking this order by hand</AlertTitle>
          Your payment went through, but something about the stock for this order needs a human
          look. We will contact you — there is nothing you need to do.{' '}
          <SupportLink variant="inline" orderNumber={order.order_number} topic="order" label="Contact support" />
        </Alert>
      )}

      <Panel sx={{ mb: 3 }} title="Order status">
        <OrderTimeline
          order={order}
          onRetryPayment={canRetry ? () => setPaymentDialogOpen(true) : undefined}
          onRestoreCart={awaitingPayment ? handleRestoreCart : undefined}
        />
        {awaitingPayment && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              onClick={handleRestoreCart}
              disabled={restoring}
              startIcon={restoring ? <CircularProgress size={16} thickness={3.6} /> : null}
            >
              Restore my cart
            </Button>
            <SupportLink variant="button" orderNumber={order.order_number} topic="order" />
          </Stack>
        )}
      </Panel>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Panel title="Items">
            {/* One fact per line, with the niche the product stood in on the
                shelf. No horizontal scroller at 320px, and every photograph
                comes through <ProductImage>'s derivatives (§7.3). */}
            <Box component="ul" sx={{ m: 0, p: 0 }}>
              {items.map((item, index) => (
                <OrderLine key={item.id} item={item} last={index === items.length - 1} />
              ))}
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Every figure is the server's stored money, printed with no
                arithmetic — the same numbers the confirmation email prints. */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Box sx={{ width: { xs: '100%', sm: 320 } }}>
                <KeyValue label="Subtotal" value={formatMoney(order.subtotal)} />
                {Number(order.discount_amount) > 0 && (
                  <KeyValue
                    label={order.coupon_code ? `Discount (${order.coupon_code})` : 'Discount'}
                    value={`−${formatMoney(order.discount_amount)}`}
                    tone="var(--lf-ok-ink)"
                  />
                )}
                <KeyValue
                  label="Shipping"
                  value={
                    Number(order.shipping_amount) === 0
                      ? 'Free'
                      : formatMoney(order.shipping_amount, { fallback: copy.shippingAmountLabel })
                  }
                />
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  {/* §5.6's wording, kept consistent here: on a cash order
                      nothing has been paid yet, so it is not called "Paid". */}
                  <Typography variant="h6">{isCOD ? 'To pay on delivery' : 'Total'}</Typography>
                  <Typography variant="price" component="p" data-tnum="true">
                    {formatMoney(order.total)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            <Panel title="Delivery address">
              <Typography variant="body2">
                {line('shipping_first_name', 'first_name')} {line('shipping_last_name', 'last_name')}
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
                {line('shipping_address', 'address')}
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
                {[line('shipping_city', 'city'), line('shipping_state', 'state')]
                  .filter(Boolean)
                  .join(', ')}
                {line('shipping_pincode', 'pincode') ? ` — ${line('shipping_pincode', 'pincode')}` : ''}
              </Typography>
              <Divider sx={{ my: 1.5 }} />
              {line('shipping_phone', 'phone') && (
                <KeyValue label="Phone" value={line('shipping_phone', 'phone')} />
              )}
              {line('shipping_email', 'email') && (
                <KeyValue label="Email" value={line('shipping_email', 'email')} />
              )}
            </Panel>

            <Panel title="Payment">
              <KeyValue label="Method" value={isCOD ? 'Cash on delivery' : 'Online (PhonePe)'} />
              <KeyValue label="State" value={paymentStatus || 'PENDING'} />
              {order.payment_reference && (
                <KeyValue label="Reference" value={order.payment_reference} />
              )}
              {order.payment_failure_reason && (
                <KeyValue
                  label="Last failure"
                  value={order.payment_failure_reason}
                  tone="var(--lf-err-ink)"
                />
              )}
            </Panel>

            {shipment && (
              <Panel title="Shipment">
                {shipment.awb_number && <KeyValue label="AWB" value={shipment.awb_number} />}
                <KeyValue label="Status" value={shipment.status_display || shipment.status} />
                {shipment.expected_delivery_date && (
                  <KeyValue label="Expected" value={shipment.expected_delivery_date} />
                )}
                {shipment.tracking_url && (
                  <Button
                    variant="outlined"
                    fullWidth
                    sx={{ mt: 1.5 }}
                    startIcon={<LocalShippingOutlinedIcon />}
                    onClick={() => openTracking(shipment.tracking_url)}
                  >
                    Track with the courier
                  </Button>
                )}
              </Panel>
            )}

            <Panel title="Need help?">
              <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)', mb: 1.5 }}>
                {copy.returnsLine}
              </Typography>
              <Stack spacing={1}>
                <SupportLink variant="button" orderNumber={order.order_number} topic="order" />
                <Button variant="text" component={RouterLink} to="/shipping-returns">
                  Delivery &amp; returns policy
                </Button>
              </Stack>
            </Panel>
          </Stack>
        </Grid>
      </Grid>

      <PaymentCompletionDialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        order={order}
        onSuccess={load}
      />
    </Container>
  );
};

export default OrderDetail;
