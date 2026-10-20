/**
 * OrderConfirmation — the page LF-15 is about.
 *
 * WHAT WAS WRONG (C-23, all verified in the old file)
 *   `setPaymentStatus(status || 'success')` defaulted an unverified,
 *   CLIENT-SUPPLIED value to success, and the PhonePe branch believed the `code`
 *   query parameter: anyone could open
 *   `/order-confirmation?code=PAYMENT_SUCCESS` and be told their order had
 *   succeeded. It also called `api.get('/orders/')` and then `orders.find(…)`,
 *   which throws a `TypeError` because the list is paginated.
 *
 * WHAT IT DOES NOW
 *   The page is driven **entirely** by `GET /api/orders/<id>/payment-status/`
 *   with the id taken from the ROUTE PARAM (§2b #19). There is no `code`
 *   branch, no `status` prop, no query parameter that can change what is shown.
 *   `?ref=` is forwarded only as a hint about which attempt to look up; the
 *   server ignores it unless it belongs to this order, and the answer comes from
 *   the gateway either way.
 *
 *   While the server says PENDING the page polls — 4 further reads over about
 *   30 seconds — and says "confirming", never "success". When the budget is
 *   spent it becomes an honest terminal state: we will email you, here is your
 *   order number, here is support.
 *
 *   The cart is cleared only after a server-verified COMPLETED, and the Meta
 *   `Purchase` event fires once and only once, gated on the server's own
 *   `purchase_event_pending` flag and closed out with
 *   `POST mark-purchase-tracked/` (§2g). A refresh, a second tab or a shared
 *   link fires nothing, because the server says it is no longer pending.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ReplayIcon from '@mui/icons-material/Replay';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import SeoHead from '../components/common/SeoHead';
import SupportLink from '../components/common/SupportLink';
import ErrorState from '../components/common/ErrorState';
import { formatMoney } from '../components/cart/CartTotals';
import { useCart } from '../context/CartContext';
import {
  purchaseEventId,
  releasePurchaseLock,
  trackPurchase,
} from '../services/analytics';
import {
  getApiErrorMessage,
  getPaymentStatus,
  listOrders,
  markPurchaseTracked,
  restoreCartFromOrder,
  retryPayment,
} from '../services/api';
import { usePolicy } from '../content/policy';

/** 4 polls after the first read: ~3s + 6s + 9s + 12s = 30s, then terminal. */
const POLL_DELAYS_MS = [3000, 6000, 9000, 12000];

const PENDING_STATES = new Set(['PENDING']);

/* The six states of §2f, as the customer sees them. `message` is NOT written
   here when the server sent one: the backend's `STATE_MESSAGES` already carry
   the order number and the exact words the spec settled on, and two copies of
   the same sentence in two languages is how they drift apart. */
const STATE_PRESENTATION = {
  COMPLETED: {
    tone: 'ok',
    Icon: CheckCircleOutlineIcon,
    title: 'Order placed',
    fallback: 'Thank you — your payment is confirmed.',
  },
  PENDING: {
    tone: 'warn',
    Icon: HourglassEmptyIcon,
    title: 'Confirming your payment',
    fallback: 'We are waiting for your bank to confirm this payment.',
  },
  FAILED: {
    tone: 'err',
    Icon: ErrorOutlineIcon,
    title: 'Payment failed',
    fallback:
      'Your payment did not go through — you have not been charged, and your bag is still here.',
  },
  CANCELLED: {
    tone: 'err',
    Icon: ErrorOutlineIcon,
    title: 'Payment cancelled',
    fallback: 'This payment was cancelled. Nothing has been charged.',
  },
  EXPIRED: {
    tone: 'warn',
    Icon: HelpOutlineIcon,
    title: 'We could not confirm this payment',
    fallback:
      'If you were charged we will refund it automatically. Quote your order number to support.',
  },
  REFUNDED: {
    tone: 'warn',
    Icon: HelpOutlineIcon,
    title: 'This order has been refunded',
    fallback: 'The amount has been returned to your original payment method.',
  },
};

const TONE_COLOR = {
  ok: 'var(--lf-ok-ink)',
  warn: 'var(--lf-warn-ink)',
  err: 'var(--lf-err-ink)',
};

const TONE_TINT = {
  ok: 'var(--lf-ok-tint)',
  warn: 'var(--lf-warn-tint)',
  err: 'var(--lf-err-tint)',
};

const OrderConfirmation = () => {
  const { id: routeId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refresh: refreshCart } = useCart();
  const { copy } = usePolicy();

  /** Only a hint about which gateway attempt to look up. Never a verdict. */
  const providerRef = searchParams.get('ref') || undefined;

  const [orderId, setOrderId] = useState(routeId || null);
  const [resolvingId, setResolvingId] = useState(!routeId);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [polling, setPolling] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [actionBusy, setActionBusy] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const cartClearedFor = useRef(null);

  /* ---------------- which order? ----------------
     The legacy `/order-confirmation` route (no id) still exists: it is in
     customers' history and in already-sent emails. Rather than guess from a
     query parameter, we ask the API for this signed-in user's most recent order
     — their own data, not client input. `listOrders()` is normalised by api.js,
     which is also the fix for the old `orders.find is not a function` crash. */
  useEffect(() => {
    if (routeId) {
      setOrderId(routeId);
      setResolvingId(false);
      return undefined;
    }
    let cancelled = false;
    setResolvingId(true);
    listOrders()
      .then(({ items }) => {
        if (cancelled) return;
        const latest = Array.isArray(items) && items.length ? items[0] : null;
        setOrderId(latest ? latest.id : null);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(requestError);
      })
      .finally(() => {
        if (!cancelled) {
          setResolvingId(false);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  /* ---------------- the one side effect that may fire Purchase ---------------- */
  const handleVerifiedState = useCallback(
    (body) => {
      if (!body || body.payment_status !== 'COMPLETED') return;

      // confirm_order already removed the ordered lines server-side, so this only needs to
      // re-read the cart — never delete it. Clearing here destroyed anything the shopper had
      // added since, every time they revisited a completed order (bookmark, Back, email link).
      if (cartClearedFor.current !== body.order_id) {
        cartClearedFor.current = body.order_id;
        Promise.resolve(refreshCart()).catch(() => {
          /* The order is paid; a failed cart re-read is not the customer's problem. */
        });
      }

      // §2g. The gate is the server's two fields, checked inside trackPurchase:
      // payment_status === 'COMPLETED' && purchase_event_pending === true.
      // It returns true only for the caller that owns the event.
      if (trackPurchase(body)) {
        markPurchaseTracked(body.order_id, purchaseEventId(body.order_id)).catch(
          (trackError) => {
            const code = trackError?.response?.status;
            // 409 = someone already closed the window. That is a success here.
            if (code !== 409) releasePurchaseLock(body.order_id);
          }
        );
      }
    },
    [refreshCart]
  );

  /* ---------------- poll ---------------- */
  useEffect(() => {
    if (!orderId) return undefined;

    let cancelled = false;
    let timer = null;
    let attempt = 0;

    const schedule = () => {
      if (attempt >= POLL_DELAYS_MS.length) {
        setPolling(false);
        setExhausted(true);
        return;
      }
      const delay = POLL_DELAYS_MS[attempt];
      attempt += 1;
      setPolling(true);
      timer = setTimeout(read, delay);
    };

    async function read() {
      try {
        const body = await getPaymentStatus(orderId, providerRef);
        if (cancelled) return;
        setStatus(body);
        setError(null);
        handleVerifiedState(body);
        if (PENDING_STATES.has(body?.payment_status)) schedule();
        else setPolling(false);
      } catch (requestError) {
        if (cancelled) return;
        const data = requestError?.response?.data;
        // 503 is the contract's "gateway unreachable" answer and it carries
        // `payment_status: 'PENDING'`. It is NOT a page error — it is a reason
        // to keep asking within the budget.
        if (requestError?.response?.status === 503 && data?.payment_status) {
          setStatus((previous) => previous || { ...data, order_id: orderId });
          schedule();
        } else {
          setError(requestError);
          setPolling(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    setExhausted(false);
    read();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, providerRef, handleVerifiedState, reloadToken]);

  /* ---------------- recovery actions ---------------- */

  const handleRetryPayment = async () => {
    if (!orderId) return;
    setActionBusy('retry');
    setActionMessage(null);
    try {
      const result = await retryPayment(orderId, { payment_method: 'PREPAID' });
      if (result?.redirect_url) {
        window.location.assign(result.redirect_url);
        return;
      }
      if (result?.payment_status === 'COMPLETED') {
        setReloadToken((token) => token + 1);
        return;
      }
      setActionMessage('We could not open a payment page just now. Please try again shortly.');
    } catch (requestError) {
      const data = requestError?.response?.data;
      if (data?.error === 'OUT_OF_STOCK') {
        setActionMessage(
          'Some items on this order are no longer available, so it cannot be paid for. ' +
            'Restore your cart and we will show you what changed.'
        );
      } else {
        setActionMessage(getApiErrorMessage(requestError, 'We could not retry that payment.'));
      }
    } finally {
      setActionBusy(null);
    }
  };

  const handleRestoreCart = async () => {
    if (!orderId) return;
    setActionBusy('restore');
    setActionMessage(null);
    try {
      const result = await restoreCartFromOrder(orderId);
      await refreshCart();
      const skipped = Array.isArray(result?.skipped) ? result.skipped : [];
      if (skipped.length > 0) {
        setActionMessage(
          `Your bag is back, except: ${skipped
            .map((entry) => entry.name || `product ${entry.product_id}`)
            .join(', ')} — no longer available.`
        );
      }
      navigate('/cart');
    } catch (requestError) {
      setActionMessage(getApiErrorMessage(requestError, 'We could not restore your bag.'));
    } finally {
      setActionBusy(null);
    }
  };

  /* ---------------- render ---------------- */

  if (resolvingId || (loading && !status && !error)) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
        <SeoHead title="Your order" noindex />
        <Stack spacing={2} alignItems="center">
          <CircularProgress size={28} />
          <Typography variant="h5" component="h1">
            Checking your payment
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)', textAlign: 'center' }}>
            We are asking the payment provider directly. This takes a few seconds — please do
            not close this page.
          </Typography>
        </Stack>
      </Container>
    );
  }

  if (!orderId) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
        <SeoHead title="Your order" noindex />
        <ErrorState
          variant="page"
          headingComponent="h1"
          title="We could not identify this order"
          message="Open it from your order history, where every order and its payment state is listed."
          onRetry={null}
          secondaryLabel="Go to my orders"
          secondaryTo="/orders"
        />
      </Container>
    );
  }

  if (error && !status) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
        <SeoHead title="Your order" noindex />
        <ErrorState
          variant="page"
          headingComponent="h1"
          title="We could not check this payment"
          error={error}
          message={
            'Your order is safe and nothing has been lost. Check your order history, or ' +
            'contact us and we will confirm its state for you.'
          }
          onRetry={() => setReloadToken((token) => token + 1)}
          secondaryLabel="Go to my orders"
          secondaryTo="/orders"
        />
      </Container>
    );
  }

  const paymentStatus = status?.payment_status || 'PENDING';
  const isPending = PENDING_STATES.has(paymentStatus);
  const stillPolling = isPending && polling && !exhausted;
  const presentation = STATE_PRESENTATION[paymentStatus] || STATE_PRESENTATION.PENDING;
  const { Icon } = presentation;
  const orderNumber = status?.order_number || `#${orderId}`;
  const nextActions = Array.isArray(status?.next_actions) ? status.next_actions : [];

  // A PENDING order whose polling budget is spent is a TERMINAL screen: it must
  // not keep implying that something is about to happen on this page.
  const headline = stillPolling
    ? 'Confirming your payment'
    : isPending
      ? 'We are still confirming your payment'
      : presentation.title;

  const body = stillPolling
    ? 'We are asking the payment provider directly. Please keep this page open.'
    : isPending
      ? `We have not had a final answer from the payment provider for order ${orderNumber}. ` +
        'We will email you the moment it is confirmed — and if you were charged and it ' +
        'ultimately fails, it is refunded automatically. Nothing further is needed from you.'
      : status?.message || presentation.fallback;

  const items = Array.isArray(status?.items) ? status.items : [];
  const showMoney = paymentStatus === 'COMPLETED' && items.length > 0;

  /* `can_retry` is the server's own property (`Order.can_retry_payment`) and it
     is the ONLY thing consulted here. `next_actions` is deliberately NOT used
     for this: it lists RETRY_PAYMENT for CANCELLED, while
     `services.start_payment_attempt` answers 409 ORDER_CLOSED for a cancelled,
     expired or refunded order. Offering a button that cannot work is how a
     customer ends up believing the fault is theirs. (Reported upstream.) */
  const retryableState = ['PENDING', 'FAILED'].includes(paymentStatus);
  const canRetry =
    status?.can_retry === true || (status?.can_retry === undefined && retryableState);
  const canRestore =
    ['PENDING', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(paymentStatus) &&
    (nextActions.length === 0 || nextActions.includes('RESTORE_CART'));

  return (
    <Box sx={{ backgroundColor: 'var(--lf-canvas)', py: { xs: 4, md: 7 } }}>
      <SeoHead
        title={paymentStatus === 'COMPLETED' ? 'Order confirmed' : 'Your order'}
        noindex
        description="Your order and its payment state."
      />
      <Container maxWidth="sm">
        <Box
          sx={{
            p: { xs: 2.5, md: 4 },
            borderRadius: 'var(--lf-r-panel)',
            border: '1px solid var(--lf-hairline)',
            backgroundColor: 'var(--lf-surface)',
            boxShadow: 'var(--lf-e-edge), var(--lf-e1)',
          }}
        >
          <Stack spacing={2}>
            <Box
              aria-hidden="true"
              sx={{
                width: 56,
                height: 56,
                borderRadius: 'var(--lf-r-pill)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: TONE_TINT[presentation.tone],
                color: TONE_COLOR[presentation.tone],
              }}
            >
              <Icon sx={{ fontSize: 30 }} />
            </Box>

            <Box>
              <Typography variant="h3" component="h1">
                {headline}
              </Typography>
              {/* The order number is shown in EVERY state — it is the only thing
                  a customer can quote to support. */}
              <Typography
                variant="subtitle2"
                data-tnum="true"
                sx={{ color: 'var(--lf-ink-3)', mt: 0.5 }}
              >
                Order {orderNumber}
              </Typography>
            </Box>

            <Typography variant="body1" sx={{ color: 'var(--lf-ink-2)' }} aria-live="polite">
              {body}
            </Typography>

            {stillPolling && (
              <LinearProgress aria-label="Checking the payment status" />
            )}

            {status?.failure_reason && paymentStatus === 'FAILED' && (
              <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
                Reason given by the payment provider: {status.failure_reason}
              </Typography>
            )}

            {showMoney && (
              <Box sx={{ mt: 1 }}>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={1}>
                  {items.map((item) => (
                    <Box
                      key={item.id}
                      sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}
                    >
                      <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
                        {item.product_name} × {item.quantity}
                      </Typography>
                      <Typography variant="body2" data-tnum="true">
                        {formatMoney(item.line_total)}
                      </Typography>
                    </Box>
                  ))}
                  <Divider sx={{ my: 0.5 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)' }}>
                      Subtotal
                    </Typography>
                    <Typography variant="body2" data-tnum="true">
                      {formatMoney(status.subtotal)}
                    </Typography>
                  </Box>
                  {Number(status.discount_amount) > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: 'var(--lf-ok-ink)' }}>
                        Discount
                      </Typography>
                      <Typography variant="body2" data-tnum="true" sx={{ color: 'var(--lf-ok-ink)' }}>
                        −{formatMoney(status.discount_amount)}
                      </Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)' }}>
                      Shipping
                    </Typography>
                    <Typography variant="body2" data-tnum="true">
                      {Number(status.shipping_amount) === 0
                        ? 'Free'
                        : formatMoney(status.shipping_amount)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6">Paid</Typography>
                    <Typography variant="price" data-tnum="true" sx={{ fontWeight: 700 }}>
                      {formatMoney(status.total)}
                    </Typography>
                  </Box>
                </Stack>
                <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)', display: 'block', mt: 2 }}>
                  {copy.deliveryLine}. {copy.returnsLine}
                </Typography>
              </Box>
            )}

            {actionMessage && (
              <Alert severity="info" role="status">
                {actionMessage}
              </Alert>
            )}

            {/* Real actions in every state — §2f's last column. */}
            <Stack spacing={1.25} sx={{ pt: 1 }}>
              {paymentStatus === 'COMPLETED' ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                  <Button component={RouterLink} to={`/orders/${orderId}`} fullWidth>
                    View order
                  </Button>
                  <Button component={RouterLink} to="/products" variant="outlined" fullWidth>
                    Continue shopping
                  </Button>
                </Stack>
              ) : (
                <>
                  {canRetry && (
                    <Button
                      onClick={handleRetryPayment}
                      disabled={actionBusy !== null}
                      startIcon={
                        actionBusy === 'retry' ? <CircularProgress size={18} /> : <ReplayIcon />
                      }
                      fullWidth
                    >
                      {actionBusy === 'retry' ? 'Opening payment…' : 'Retry payment'}
                    </Button>
                  )}
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                    {canRestore && (
                      <Button
                        variant="outlined"
                        onClick={handleRestoreCart}
                        disabled={actionBusy !== null}
                        startIcon={actionBusy === 'restore' ? <CircularProgress size={18} /> : null}
                        fullWidth
                      >
                        Restore my cart
                      </Button>
                    )}
                    <Button component={RouterLink} to={`/orders/${orderId}`} variant="outlined" fullWidth>
                      View order
                    </Button>
                  </Stack>
                  {!canRetry && (
                    <Button component={RouterLink} to="/products" variant="outlined" fullWidth>
                      Start a new order
                    </Button>
                  )}
                </>
              )}

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                sx={{ pt: 0.5 }}
              >
                <SupportLink
                  variant="text"
                  orderNumber={status?.order_number}
                  topic="payment"
                  label="Contact support about this order"
                />
                <Button component={RouterLink} to="/orders" variant="text">
                  All my orders
                </Button>
              </Stack>
            </Stack>

            {isPending && !stillPolling && (
              <Alert severity="info">
                <AlertTitle>Nothing is lost</AlertTitle>
                Your bag has not been emptied, and no stock has been taken. If this payment
                went through, the order confirms itself and you will get the email.
              </Alert>
            )}
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default OrderConfirmation;
