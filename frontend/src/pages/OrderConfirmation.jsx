/**
 * ============================================================================
 * OrderConfirmation — the page LF-15 is about, and §2.26 / §5.6 fix.
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
 *
 * ---------------------------------------------------------------------------
 * THE COD ARM (ART_DIRECTION.md §2.26, §5.6) — the defect this adds
 *
 *   This file contained the string "COD" **zero times**, while `Checkout.jsx`
 *   routes a COD order straight to it. `services.create_order` calls
 *   `confirm_order` for COD at creation, so the usual answer is COMPLETED —
 *   but every surface here keyed off the PAYMENT state alone, so:
 *     · the money block was gated on `paymentStatus === 'COMPLETED'`, and any
 *       COD order that had not yet been confirmed (a slow worker, a retry that
 *       switched method, a 503 from the gateway probe) showed an amber
 *       hourglass reading "Confirming your payment", a progress bar and a
 *       3→6→12→24 s poll — with no items, no total and no address;
 *     · and when it WAS confirmed, the total was labelled **"Paid"** on an
 *       order where nothing has been paid yet.
 *
 *   So: the COD arm is decided BEFORE the payment state (§5.6) — `tone: 'ok'`,
 *   `CheckCircleOutline`, **`Order placed`**, body `Pay ₹X to the courier when
 *   it arrives.` **It never polls and never renders `LinearProgress`.**
 *   `showMoney` becomes `COMPLETED || isCOD`, and the `Paid` row relabels to
 *   **`To pay on delivery`**.
 *
 *   PRESENTATION ONLY. Not one line of the payment state machine, the purchase
 *   event gate, the retry path or the cart restore is changed; the COD arm only
 *   decides what the page SAYS about the state the server reported, and stops
 *   re-asking a question that has no pending answer.
 *
 * AND THEN IT IS A BRAND MOMENT, NOT A BANK RECEIPT (§5.6): `md` container,
 * a niche beside every line item — the same arch the product stood in on the
 * shelf — and a hearth band carrying `brand.territoryLine` to close. It is the
 * highest-trust moment in the store and it used to look like a failure screen.
 * ========================================================================== */

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
import Alcove from '../components/common/Alcove';
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
import { useBrand } from '../content/brand';
import { usePolicy } from '../content/policy';

/** 4 polls after the first read: ~3s + 6s + 9s + 12s = 30s, then terminal. */
const POLL_DELAYS_MS = [3000, 6000, 9000, 12000];

const PENDING_STATES = new Set(['PENDING']);

/** §5.6's COD arm covers the two states a cash order can honestly be in. */
const COD_ARM_STATES = new Set(['COMPLETED', 'PENDING']);

/** §3.10 — the `thumb` surface caps the niche at 72px of height. */
const THUMB_NICHE_W = 'calc(72px / var(--lf-arch-ratio))';

/** True when the SERVER says this order is cash on delivery. Never inferred. */
const isCodOrder = (body) => String(body?.payment_method || '').toUpperCase() === 'COD';

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

/** §5.6 — the COD arm, decided before the payment state. */
const COD_PRESENTATION = {
  tone: 'ok',
  Icon: CheckCircleOutlineIcon,
  title: 'Order placed',
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

/**
 * One order line, with the niche the product stood in on the shelf (§5.6).
 *
 * `OrderItemSerializer` carries both the live `product` (ProductLineSerializer:
 * `image_main`, `size`, `slug`) and the order's own `product_name` /
 * `product_image` SNAPSHOTS, and the snapshots win — a renamed or re-SKU'd
 * product must not rewrite what the customer actually bought. The merged shape
 * below hands <Alcove> a payload with the snapshot name and whichever image
 * exists; nothing is typed into this component (§10.21), and a line whose
 * product has no image gets an empty lit shelf rather than a broken `src`
 * (§7.5 rule 2).
 */
const OrderLine = ({ item }) => {
  const lineProduct = {
    ...(item.product || {}),
    name: item.product_name || item.product?.name || '',
    image_main: item.product?.image_main || item.product_image || null,
  };
  const href = item.product_slug ? `/product/${item.product_slug}` : null;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
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
        <Typography variant="caption" component="p" sx={{ color: 'var(--lf-ink-3)' }} data-tnum="true">
          {lineProduct.size ? `${lineProduct.size} · ` : ''}
          {formatMoney(item.price)} × {item.quantity}
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

const OrderConfirmation = () => {
  const { id: routeId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refresh: refreshCart } = useCart();
  const { copy } = usePolicy();
  const brand = useBrand();

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
        /* §5.6: a COD order is NEVER polled. There is no gateway answer on its
           way — `create_order` confirms it itself — so re-asking every three
           seconds can only produce the amber hourglass §2.26 is about. */
        if (!isCodOrder(body) && PENDING_STATES.has(body?.payment_status)) schedule();
        else setPolling(false);
      } catch (requestError) {
        if (cancelled) return;
        const data = requestError?.response?.data;
        // 503 is the contract's "gateway unreachable" answer and it carries
        // `payment_status: 'PENDING'`. It is NOT a page error — it is a reason
        // to keep asking within the budget. A COD order has no gateway to be
        // unreachable, so it is not re-asked either.
        if (requestError?.response?.status === 503 && data?.payment_status) {
          setStatus((previous) => previous || { ...data, order_id: orderId });
          if (!isCodOrder(data)) schedule();
          else setPolling(false);
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
      <Container maxWidth="sm" sx={{ py: 'var(--lf-sect-lg)' }}>
        <SeoHead title="Your order" noindex />
        <Stack spacing={2} alignItems="center">
          <CircularProgress size={28} thickness={3.6} />
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
      <Container maxWidth="sm" sx={{ py: 'var(--lf-sect-lg)' }}>
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
      <Container maxWidth="sm" sx={{ py: 'var(--lf-sect-lg)' }}>
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
  const orderNumber = status?.order_number || `#${orderId}`;
  const nextActions = Array.isArray(status?.next_actions) ? status.next_actions : [];

  /* §5.6 — THE COD ARM, decided before the payment state.
     It is narrowed to the two states a cash order can honestly be in: a COD
     order that was CANCELLED or REFUNDED must not read "Order placed", and the
     literal "branch before paymentStatus" would say exactly that. COMPLETED is
     the normal answer (`create_order` confirms COD itself) and PENDING is the
     window before the confirmation lands. */
  const isCOD = isCodOrder(status);
  const codArm = isCOD && COD_ARM_STATES.has(paymentStatus);

  /* A COD order is never pending ON THIS PAGE: there is no answer coming. */
  const isPending = !codArm && PENDING_STATES.has(paymentStatus);
  const stillPolling = isPending && polling && !exhausted;
  const presentation = codArm
    ? COD_PRESENTATION
    : STATE_PRESENTATION[paymentStatus] || STATE_PRESENTATION.PENDING;
  const { Icon } = presentation;

  // A PENDING order whose polling budget is spent is a TERMINAL screen: it must
  // not keep implying that something is about to happen on this page.
  const headline = codArm
    ? COD_PRESENTATION.title
    : stillPolling
      ? 'Confirming your payment'
      : isPending
        ? 'We are still confirming your payment'
        : presentation.title;

  const items = Array.isArray(status?.items) ? status.items : [];
  const totalLabel = formatMoney(status?.total);
  const hasTotal = Number.isFinite(Number(status?.total));

  /* §5.6's sentence, verbatim — but it names an amount, so when the server has
     not sent one the amount is dropped rather than printed as an em dash. */
  const codBody = hasTotal
    ? `Pay ${totalLabel} to the courier when it arrives.`
    : 'Pay the courier when your order arrives.';

  const body = codArm
    ? codBody
    : stillPolling
      ? 'We are asking the payment provider directly. Please keep this page open.'
      : isPending
        ? `We have not had a final answer from the payment provider for order ${orderNumber}. ` +
          'We will email you the moment it is confirmed — and if you were charged and it ' +
          'ultimately fails, it is refunded automatically. Nothing further is needed from you.'
        : status?.message || presentation.fallback;

  /* §5.6: `showMoney` becomes COMPLETED || isCOD. Gating it on the PAYMENT
     state alone is why a cash customer saw no items, no total and no order
     contents at all. */
  const showMoney = (paymentStatus === 'COMPLETED' || isCOD) && items.length > 0;

  /* The one honest label for the bottom line. On a cash order nothing has been
     paid — calling it "Paid" is the kind of thing a customer screenshots. */
  const totalRowLabel = isCOD ? 'To pay on delivery' : 'Paid';

  /* A placed order — paid or cash — gets the forward actions. A cash order is
     NOT offered "Retry payment" (that call switches it to PREPAID and would
     charge online someone who chose to pay the courier) or "Restore my cart"
     (its stock is already taken and its email already sent). */
  const settled = paymentStatus === 'COMPLETED' || codArm;

  /* `can_retry` is the server's own property (`Order.can_retry_payment`) and it
     is the ONLY thing consulted here. `next_actions` is deliberately NOT used
     for this: it lists RETRY_PAYMENT for CANCELLED, while
     `services.start_payment_attempt` answers 409 ORDER_CLOSED for a cancelled,
     expired or refunded order. Offering a button that cannot work is how a
     customer ends up believing the fault is theirs. (Reported upstream.) */
  const retryableState = ['PENDING', 'FAILED'].includes(paymentStatus);
  const canRetry =
    !codArm && (status?.can_retry === true || (status?.can_retry === undefined && retryableState));
  const canRestore =
    !codArm &&
    ['PENDING', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(paymentStatus) &&
    (nextActions.length === 0 || nextActions.includes('RESTORE_CART'));

  return (
    <Box sx={{ backgroundColor: 'var(--lf-canvas)' }}>
      <SeoHead
        title={settled ? 'Order confirmed' : 'Your order'}
        noindex
        description="Your order and its payment state."
      />

      {/* §5.6 — `md`, not `sm`: this is the highest-trust moment in the store
          and it was rendering at the width of a password-reset form. */}
      <Container maxWidth="md" sx={{ pt: 'var(--lf-sect)', pb: 'var(--lf-sect)' }}>
        <Box
          sx={{
            p: { xs: 2.5, md: 4 },
            borderRadius: 'var(--lf-r-panel)',
            border: '1px solid var(--lf-hairline)',
            backgroundColor: 'var(--lf-paper)',
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

            {/* Never on the COD arm (§5.6): a progress bar for an answer that
                is not coming is the whole defect. */}
            {stillPolling && <LinearProgress aria-label="Checking the payment status" />}

            {status?.failure_reason && paymentStatus === 'FAILED' && (
              <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
                Reason given by the payment provider: {status.failure_reason}
              </Typography>
            )}

            {showMoney && (
              <Box sx={{ mt: 1 }}>
                <Divider sx={{ mb: 2.5 }} />

                {/* §5.6 — a niche beside every line: the same arch the product
                    stood in on the shelf, so the order reads as the things you
                    bought rather than as a bank statement. */}
                <Stack spacing={2} component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                  {items.map((item) => (
                    <Box component="li" key={item.id} sx={{ minWidth: 0 }}>
                      <OrderLine item={item} />
                    </Box>
                  ))}
                </Stack>

                <Divider sx={{ my: 2.5 }} />

                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                    <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)' }}>
                      Subtotal
                    </Typography>
                    <Typography variant="body2" data-tnum="true">
                      {formatMoney(status.subtotal)}
                    </Typography>
                  </Box>
                  {Number(status.discount_amount) > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                      <Typography variant="body2" sx={{ color: 'var(--lf-ok-ink)' }}>
                        Discount
                      </Typography>
                      <Typography variant="body2" data-tnum="true" sx={{ color: 'var(--lf-ok-ink)' }}>
                        −{formatMoney(status.discount_amount)}
                      </Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                    <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)' }}>
                      Shipping
                    </Typography>
                    <Typography variant="body2" data-tnum="true">
                      {Number(status.shipping_amount) === 0
                        ? 'Free'
                        : formatMoney(status.shipping_amount)}
                    </Typography>
                  </Box>
                  <Divider sx={{ my: 0.5 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                    <Typography variant="h6">{totalRowLabel}</Typography>
                    <Typography variant="price" component="p" data-tnum="true">
                      {totalLabel}
                    </Typography>
                  </Box>
                </Stack>

                <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)', display: 'block', mt: 2 }}>
                  {copy.deliveryLine}. {copy.returnsLine}
                </Typography>

                {/* TODO(backend): §5.6 also asks for the delivery address and
                    the `expected_delivery_date` checkout computes. Neither is
                    in `orders/views.py::_payment_status_body` — it sends
                    order/payment state, money and items only — so no block is
                    rendered for them. §2.25's rule is binding here: never ship
                    a render condition that can be false for the entire
                    catalogue without anyone noticing, and a conditional
                    address block that can never fire is exactly that. Add
                    `shipping_*` and the shipment's expected date to that
                    response and the block belongs right here. Until then
                    `View order` carries both. */}
              </Box>
            )}

            {actionMessage && (
              <Alert severity="info" role="status">
                {actionMessage}
              </Alert>
            )}

            {/* Real actions in every state — §2f's last column. */}
            <Stack spacing={1.25} sx={{ pt: 1 }}>
              {settled ? (
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
                        actionBusy === 'retry' ? (
                          <CircularProgress size={18} thickness={3.6} />
                        ) : (
                          <ReplayIcon />
                        )
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
                        startIcon={
                          actionBusy === 'restore' ? (
                            <CircularProgress size={18} thickness={3.6} />
                          ) : null
                        }
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

      {/* §5.6 — close on the hearth, once the order is actually placed. The
          sentence is `brand.territoryLine`, never retyped. It is set in Inter
          Tight `h2`, NOT `brandDisplay`: Fraunces has exactly three licensed
          uses — nav wordmark, one home interstitial, footer wordmark — and a
          fourth is a regression against an explicit owner decision (§10.6).
          --lf-ink inside `.lf-hearth-section` is #FBF4E8 at 16.59:1 on
          #1C1411 and 10.52:1 at the glow's brightest point (§3.5). */}
      {settled && (
        <Box component="section" className="lf-hearth-section" sx={{ py: 'var(--lf-sect)' }}>
          <Container maxWidth="md">
            <Typography variant="h2" component="p" sx={{ color: 'var(--lf-ink)', maxWidth: '36ch' }}>
              {brand.territoryLine}
            </Typography>
          </Container>
        </Box>
      )}
    </Box>
  );
};

export default OrderConfirmation;
