/**
 * Checkout — rewritten (IMPL_SPEC §3 WP-11, §2f, §2g, DESIGN_SYSTEM §8).
 *
 * The five defects this replaces, each verified in the old file:
 *
 *  1. **LF-14 — `await clearCart()` on BOTH branches, before the gateway.**
 *     The backend no longer deletes the cart at order creation (§2f), so the
 *     client emptying it meant an abandoned PhonePe page left the shopper with
 *     nothing to come back to and nothing to rebuild. Both calls are gone. The
 *     cart is cleared exactly once, server-side, inside `confirm_order()`.
 *  2. **`navigate('/cart')` in the render body.** A navigation during render
 *     races the success navigation. It is now a `<Navigate>` ELEMENT, guarded by
 *     a "we are leaving on purpose" ref so it cannot fire while we are handing
 *     off to the gateway or to the confirmation page.
 *  3. **LF-16 — the placebo coupon.** `handleApplyCoupon` reported success
 *     unconditionally and never changed the total; the developer's abandoned
 *     reasoning shipped in the comments. It now calls `coupons/validate/` and
 *     the discount is rendered only from a confirmed response, in BOTH the
 *     review block and the order summary, off the same server-priced figures.
 *  4. **No `submitting` state.** Two clicks created two orders. There is now a
 *     `placing` state AND one `Idempotency-Key` per checkout session, so even a
 *     double-submit that beats the disable returns the same order (§2b #18).
 *  5. **An unreachable `paymentMethod === 'card'` arm.** The RadioGroup only
 *     ever offered `upi` and `cod`. Deleted.
 *
 * Layout follows DESIGN_SYSTEM §8: one page, three numbered sections, all
 * mounted, so nothing typed is ever lost and the total is never hidden behind a
 * step. The 3-step `Stepper` is gone.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Navigate, Link as RouterLink, useNavigate } from 'react-router-dom';

import SeoHead from '../components/common/SeoHead';
import SupportLink from '../components/common/SupportLink';
import {
  isValidPincode,
  getRememberedPincode,
  rememberPincode,
} from '../components/common/PincodeCheck';
import CartTotals, {
  CouponField,
  formatMoney,
  useCartSummary,
} from '../components/cart/CartTotals';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { trackInitiateCheckout } from '../services/analytics';
import {
  checkServiceability,
  createOrder,
  getApiErrorMessage,
  initiatePayment,
  listOrders,
  retryPayment,
  validateCoupon,
} from '../services/api';
import { usePolicy } from '../content/policy';

/* ------------------------------------------------------------------ *
 * validation — the same formats `orders/serializers.py` enforces, so a
 * rejection happens under the field rather than after Place Order.
 * ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[6-9]\d{9}$/;

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const FIELDS = [
  { name: 'first_name', label: 'First name', autoComplete: 'given-name', width: 6 },
  { name: 'last_name', label: 'Last name', autoComplete: 'family-name', width: 6 },
  { name: 'email', label: 'Email', autoComplete: 'email', type: 'email', width: 6 },
  { name: 'phone', label: 'Mobile number', autoComplete: 'tel', type: 'tel', width: 6 },
  { name: 'address', label: 'Address', autoComplete: 'address-line1', width: 12 },
  { name: 'city', label: 'City', autoComplete: 'address-level2', width: 4 },
  { name: 'state', label: 'State', autoComplete: 'address-level1', width: 4 },
  { name: 'pincode', label: 'Pincode', autoComplete: 'postal-code', width: 4 },
];

function validateField(name, value) {
  const trimmed = String(value ?? '').trim();
  switch (name) {
    case 'first_name':
      return trimmed ? null : 'Enter your first name.';
    case 'last_name':
      return trimmed ? null : 'Enter your last name.';
    case 'email':
      if (!trimmed) return 'Enter your email address.';
      return EMAIL_RE.test(trimmed) ? null : 'Enter a valid email address, e.g. you@example.com.';
    case 'phone': {
      if (!trimmed) return 'Enter your 10-digit mobile number.';
      const digits = digitsOnly(trimmed).slice(-10);
      return PHONE_RE.test(digits)
        ? null
        : 'Enter a 10-digit Indian mobile number starting 6, 7, 8 or 9.';
    }
    case 'address':
      if (!trimmed) return 'Enter your address.';
      return trimmed.length >= 6 ? null : 'Enter the full address, including the house or flat number.';
    case 'city':
      if (!trimmed) return 'Enter your city.';
      return trimmed.length >= 2 ? null : 'Enter your city.';
    case 'state':
      if (!trimmed) return 'Enter your state.';
      return trimmed.length >= 2 ? null : 'Enter your state.';
    case 'pincode':
      if (!trimmed) return 'Enter your 6-digit pincode.';
      return isValidPincode(trimmed) ? null : 'Enter a 6-digit Indian pincode.';
    default:
      return null;
  }
}

function validateAll(values) {
  const errors = {};
  FIELDS.forEach(({ name }) => {
    const error = validateField(name, values[name]);
    if (error) errors[name] = error;
  });
  return errors;
}

/** One key per checkout session (§2b #18). Reused across retries on purpose. */
function newIdempotencyKey() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `lf-${crypto.randomUUID()}`;
    }
  } catch {
    /* fall through */
  }
  return `lf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

const SectionHeading = ({ index, title, id, children }) => (
  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
    <Box
      aria-hidden="true"
      sx={{
        width: 28,
        height: 28,
        flexShrink: 0,
        borderRadius: 'var(--lf-r-pill)',
        backgroundColor: 'var(--lf-gold-tint)',
        color: 'var(--lf-gold-ink)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: '0.875rem',
      }}
    >
      {index}
    </Box>
    <Typography id={id} variant="h5" component="h2" sx={{ flexGrow: 1 }}>
      {title}
    </Typography>
    {children}
  </Stack>
);

const Panel = ({ children, sx, ...rest }) => (
  <Box
    sx={{
      p: { xs: 2, md: 3 },
      borderRadius: 'var(--lf-r-panel)',
      border: '1px solid var(--lf-hairline)',
      backgroundColor: 'var(--lf-surface)',
      boxShadow: 'var(--lf-e-edge), var(--lf-e1)',
      ...sx,
    }}
    {...rest}
  >
    {children}
  </Box>
);

const Checkout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, initialised } = useCart();
  const { copy } = usePolicy();

  const [values, setValues] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [touched, setTouched] = useState({});
  const [paymentMethod, setPaymentMethod] = useState('PREPAID');

  const [appliedCode, setAppliedCode] = useState(null);
  const [couponError, setCouponError] = useState(null);
  const [couponReason, setCouponReason] = useState(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const [placing, setPlacing] = useState(false);
  const [formError, setFormError] = useState(null);
  const [outOfStock, setOutOfStock] = useState(null);
  /** An order that exists but whose payment session could not be opened. */
  const [strandedOrder, setStrandedOrder] = useState(null);

  const [serviceability, setServiceability] = useState({
    pincode: null,
    checking: false,
    result: null,
    unavailable: false,
  });

  /* Generated ONCE per mount. Reused for every attempt in this session, which is
     what makes a double-click — or an axios retry — return the same order. */
  const idempotencyKey = useRef(newIdempotencyKey());
  /** True while we are deliberately leaving: stops the empty-cart <Navigate>. */
  const leaving = useRef(false);

  const errors = useMemo(() => validateAll(values), [values]);
  const pincodeValid = isValidPincode(values.pincode);

  const {
    summary,
    loading: summaryLoading,
    pending: summaryPending,
    error: summaryError,
    refresh: refreshSummary,
  } = useCartSummary({
    coupon: appliedCode,
    pincode: pincodeValid ? values.pincode : undefined,
  });

  /* ---------------- prefill ---------------- */
  /* From the account first, then the most recent order, then the remembered
     pincode. Typing a full Indian address on a phone is the single biggest
     friction point in this flow; none of it is data we do not already have. */
  /* Every write here is a FILL, never an overwrite: a field the shopper has
     already typed into is left alone. That makes the effect idempotent, which
     is what lets it survive React 18 StrictMode's double-invoke (and a later
     `refreshUser()`) without either clobbering input or — the other failure
     mode — being skipped by a one-shot ref whose only run was the cancelled
     one. */
  useEffect(() => {
    let cancelled = false;

    const fill = (patch) =>
      setValues((previous) => {
        const next = { ...previous };
        let changed = false;
        Object.entries(patch).forEach(([key, value]) => {
          if (value && !String(next[key] || '').trim()) {
            next[key] = value;
            changed = true;
          }
        });
        return changed ? next : previous;
      });

    fill({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      email: user?.email || '',
      phone: digitsOnly(user?.phone_number || '').slice(-10),
      pincode: getRememberedPincode() || '',
    });

    // `listOrders()` is normalised to `{items,…}` by api.js, and `Order.Meta`
    // orders by `-created_at`, so `items[0]` really is the most recent order.
    // The old page's sibling bug was calling `.find()` straight off a paginated
    // response, which throws.
    listOrders()
      .then(({ items }) => {
        if (cancelled) return;
        const last = Array.isArray(items) && items.length ? items[0] : null;
        if (!last) return;
        fill({
          first_name: last.shipping_first_name || last.first_name || '',
          last_name: last.shipping_last_name || last.last_name || '',
          email: last.shipping_email || last.email || '',
          phone: digitsOnly(last.shipping_phone || last.phone || '').slice(-10),
          address: last.shipping_address || last.address || '',
          city: last.shipping_city || last.city || '',
          state: last.shipping_state || last.state || '',
          pincode: last.shipping_pincode || last.pincode || '',
        });
      })
      .catch(() => {
        /* A missing or unreadable order history is not an error worth showing here. */
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  /* ---------------- serviceability ---------------- */
  /* A real check on a valid pincode. `serviceable:false` blocks the order
     outright; `cod_available !== true` removes COD rather than promising it,
     because COD is a per-pincode answer and never a sitewide claim. A 503 (Blue
     Dart down, credentials absent) must NOT block the order — losing the sale
     because a courier API is unreachable is the worse failure. */
  useEffect(() => {
    if (!pincodeValid) {
      setServiceability({ pincode: null, checking: false, result: null, unavailable: false });
      return undefined;
    }
    const pincode = values.pincode;
    let cancelled = false;
    const handle = setTimeout(() => {
      setServiceability((previous) => ({ ...previous, checking: true, pincode }));
      checkServiceability(pincode)
        .then((data) => {
          if (cancelled) return;
          rememberPincode(pincode);
          setServiceability({
            pincode,
            checking: false,
            unavailable: false,
            result: {
              serviceable: data?.serviceable === true,
              cod_available:
                typeof data?.cod_available === 'boolean' ? data.cod_available : null,
              expected_delivery_date: data?.expected_delivery_date || null,
              transit_days: typeof data?.transit_days === 'number' ? data.transit_days : null,
            },
          });
        })
        .catch(() => {
          if (cancelled) return;
          // Unknown, not unserviceable.
          setServiceability({ pincode, checking: false, result: null, unavailable: true });
        });
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [pincodeValid, values.pincode]);

  const codAvailable = serviceability.result ? serviceability.result.cod_available === true : null;
  const notServiceable = Boolean(serviceability.result && !serviceability.result.serviceable);

  /* COD cannot stay selected once we know it is not offered here. */
  useEffect(() => {
    if (paymentMethod === 'COD' && serviceability.result && codAvailable !== true) {
      setPaymentMethod('PREPAID');
    }
  }, [paymentMethod, serviceability.result, codAvailable]);

  /* ---------------- coupon ---------------- */
  useEffect(() => {
    const block = summary?.coupon;
    if (!block) return;
    if (block.valid === false && appliedCode) {
      setAppliedCode(null);
      setCouponError(block.message || 'That code is no longer valid.');
      setCouponReason(block.reason || null);
    }
  }, [summary, appliedCode]);

  const handleApplyCoupon = useCallback(
    async (code) => {
      setApplyingCoupon(true);
      setCouponError(null);
      setCouponReason(null);
      try {
        const result = await validateCoupon({ code, subtotal: summary ? summary.subtotal : 0 });
        if (result && result.valid) {
          setAppliedCode(result.code || code);
        } else {
          setCouponError((result && result.message) || 'That code could not be applied.');
          setCouponReason((result && result.reason) || null);
        }
      } catch (error) {
        setCouponError(getApiErrorMessage(error, 'We could not check that code just now.'));
      } finally {
        setApplyingCoupon(false);
      }
    },
    [summary]
  );

  const handleChange = (name) => (event) => {
    const raw = event.target.value;
    const value =
      name === 'pincode'
        ? digitsOnly(raw).slice(0, 6)
        : name === 'phone'
          ? digitsOnly(raw).slice(0, 10)
          : raw;
    setValues((previous) => ({ ...previous, [name]: value }));
  };

  const handleBlur = (name) => () => setTouched((previous) => ({ ...previous, [name]: true }));

  /* ---------------- place order ---------------- */

  const goToConfirmation = (orderId) => {
    leaving.current = true;
    navigate(`/order-confirmation/${orderId}`, { replace: true });
  };

  const openGateway = (redirectUrl) => {
    leaving.current = true;
    // A full document navigation, deliberately: the gateway is a third-party
    // origin and this is a hand-off, not an in-app route.
    window.location.assign(redirectUrl);
  };

  const handlePlaceOrder = async () => {
    if (placing) return;

    setTouched(Object.fromEntries(FIELDS.map(({ name }) => [name, true])));
    if (Object.keys(errors).length > 0) {
      setFormError('Check the highlighted fields and try again.');
      return;
    }
    if (notServiceable) {
      setFormError(
        `We do not deliver to ${values.pincode} yet. Try another pincode or contact support.`
      );
      return;
    }

    setFormError(null);
    setOutOfStock(null);
    setStrandedOrder(null);
    setPlacing(true);

    // §2g: InitiateCheckout fires BEFORE the network call, so an abandoned or
    // failed order still counts as an initiated checkout.
    trackInitiateCheckout({
      items: (summary?.lines || []).map((line) => ({
        ...line.product,
        quantity: line.quantity,
      })),
      value: summary?.subtotal,
    });

    const payload = {
      shipping_info: {
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        email: values.email.trim(),
        phone: digitsOnly(values.phone).slice(-10),
        address: values.address.trim(),
        city: values.city.trim(),
        state: values.state.trim(),
        pincode: values.pincode.trim(),
      },
      payment_method: paymentMethod,
      ...(appliedCode ? { coupon_code: appliedCode } : {}),
    };

    try {
      const order = await createOrder(payload, idempotencyKey.current);
      const orderId = order?.id ?? order?.order_id;

      // NOTE: no clearCart() — on either branch. LF-14. The cart is emptied
      // exactly once, server-side, inside confirm_order().

      if (paymentMethod === 'COD') {
        goToConfirmation(orderId);
        return;
      }

      const redirectUrl = order?.payment?.redirect_url;
      if (redirectUrl) {
        openGateway(redirectUrl);
        return;
      }

      // The order exists but came back without a gateway session. One explicit
      // retry, then an honest recovery block — never a silent dead end.
      try {
        const payment = await initiatePayment(orderId, { payment_method: 'PREPAID' });
        if (payment?.redirect_url) {
          openGateway(payment.redirect_url);
          return;
        }
        setStrandedOrder({
          id: orderId,
          order_number: order?.order_number,
          message: payment?.message,
        });
      } catch (paymentError) {
        setStrandedOrder({
          id: orderId,
          order_number: order?.order_number,
          message: getApiErrorMessage(
            paymentError,
            'We could not open the payment page just now.'
          ),
        });
      }
    } catch (error) {
      const data = error?.response?.data || {};

      if (data.error === 'OUT_OF_STOCK' && Array.isArray(data.items)) {
        setOutOfStock(data.items);
        setFormError(null);
      } else if (data.order_id || data.id) {
        // `POST /orders/` answered non-2xx AFTER creating the order (e.g. the
        // gateway was unreachable). The order is real; say so and offer a retry
        // rather than letting the shopper place a second one.
        setStrandedOrder({
          id: data.order_id || data.id,
          order_number: data.order_number,
          message: getApiErrorMessage(error, 'We could not start the payment.'),
        });
      } else {
        setFormError(getApiErrorMessage(error, 'We could not place your order.'));
      }
      refreshSummary();
    } finally {
      setPlacing(false);
    }
  };

  const handleRetryStranded = async () => {
    if (!strandedOrder) return;
    setPlacing(true);
    try {
      const result = await retryPayment(strandedOrder.id, { payment_method: 'PREPAID' });
      if (result?.redirect_url) {
        openGateway(result.redirect_url);
        return;
      }
      if (result?.payment_status === 'COMPLETED') {
        goToConfirmation(strandedOrder.id);
        return;
      }
      setStrandedOrder((previous) => ({
        ...previous,
        message: 'The payment page is still unavailable. Please try again in a minute.',
      }));
    } catch (error) {
      setStrandedOrder((previous) => ({
        ...previous,
        message: getApiErrorMessage(error, 'The payment page is still unavailable.'),
      }));
    } finally {
      setPlacing(false);
    }
  };

  /* ---------------- guards ---------------- */
  /* An ELEMENT, not a `navigate()` call in the render body. The old version
     navigated during render, which raced the success navigation: the cart went
     empty the moment the order was placed, so the page could bounce to /cart
     while the confirmation navigation was still in flight. */
  if (initialised && cart.items.length === 0 && !leaving.current && !strandedOrder) {
    return <Navigate to="/cart" replace />;
  }

  const lines = summary ? summary.lines : [];
  const blocked =
    notServiceable || lines.length === 0 || lines.some((line) => !line.inStock);
  const disableSubmit = placing || blocked || summaryLoading || Boolean(strandedOrder);

  const couponCode =
    summary?.coupon && summary.coupon.applied && summary.coupon.valid
      ? summary.coupon.code
      : null;

  return (
    <Box sx={{ backgroundColor: 'var(--lf-canvas)', py: { xs: 4, md: 6 } }}>
      <SeoHead title="Checkout" noindex description="Complete your order." />
      <Container maxWidth="lg">
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 3, gap: 2 }}
        >
          <Typography variant="h3" component="h1">
            Checkout
          </Typography>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <LockOutlinedIcon fontSize="small" sx={{ color: 'var(--lf-ink-3)' }} />
            <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
              Payments handled by PhonePe
            </Typography>
          </Stack>
        </Stack>

        {summaryError && (
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            action={
              <Button size="small" variant="outlined" onClick={refreshSummary}>
                Retry
              </Button>
            }
          >
            <AlertTitle>We could not price your bag</AlertTitle>
            {getApiErrorMessage(summaryError, 'Please try again before placing the order.')}
          </Alert>
        )}

        {strandedOrder && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <AlertTitle>
              Order {strandedOrder.order_number || `#${strandedOrder.id}`} was created — payment
              is not done yet
            </AlertTitle>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              {strandedOrder.message ||
                'We could not open the payment page.'}{' '}
              You have not been charged, and your bag is still here. Do not place a
              second order — finish this one.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button size="small" onClick={handleRetryStranded} disabled={placing}>
                {placing ? 'Working…' : 'Retry payment'}
              </Button>
              <Button
                size="small"
                variant="outlined"
                component={RouterLink}
                to={`/orders/${strandedOrder.id}`}
              >
                View order
              </Button>
              <SupportLink
                variant="button"
                size="small"
                orderNumber={strandedOrder.order_number}
                topic="payment"
              />
            </Stack>
          </Alert>
        )}

        {outOfStock && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <AlertTitle>Some items are no longer available</AlertTitle>
            <Box component="ul" sx={{ pl: 2.5, mb: 1 }}>
              {outOfStock.map((item) => (
                <li key={item.product_id}>
                  <Typography variant="body2" component="span">
                    {item.name || item.product} — {item.available > 0
                      ? `only ${item.available} left`
                      : 'out of stock'}
                  </Typography>
                </li>
              ))}
            </Box>
            <Button size="small" variant="outlined" component={RouterLink} to="/cart">
              Edit your bag
            </Button>
          </Alert>
        )}

        {formError && (
          <Alert severity="error" sx={{ mb: 3 }} role="alert">
            {formError}
          </Alert>
        )}

        <Grid container spacing={{ xs: 3, md: 4 }}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={3}>
              {/* ---------------- 1. address ---------------- */}
              <Panel component="section" aria-labelledby="checkout-address">
                <SectionHeading index={1} id="checkout-address" title="Delivery address" />
                <Box component="form" noValidate autoComplete="on">
                  <Grid container spacing={2}>
                    {FIELDS.map((field) => (
                      <Grid key={field.name} size={{ xs: 12, sm: field.width }}>
                        <TextField
                          label={field.label}
                          name={field.name}
                          type={field.type || 'text'}
                          value={values[field.name]}
                          onChange={handleChange(field.name)}
                          onBlur={handleBlur(field.name)}
                          autoComplete={field.autoComplete}
                          error={Boolean(touched[field.name] && errors[field.name])}
                          helperText={(touched[field.name] && errors[field.name]) || ' '}
                          inputProps={
                            field.name === 'pincode'
                              ? { inputMode: 'numeric', maxLength: 6 }
                              : field.name === 'phone'
                                ? { inputMode: 'tel', maxLength: 10 }
                                : undefined
                          }
                        />
                      </Grid>
                    ))}
                  </Grid>

                  {/* The delivery answer for this exact pincode. */}
                  <Box sx={{ mt: 1 }} aria-live="polite">
                    {serviceability.checking && (
                      <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
                        Checking delivery to {serviceability.pincode}…
                      </Typography>
                    )}
                    {!serviceability.checking && serviceability.result?.serviceable && (
                      <Typography variant="caption" sx={{ color: 'var(--lf-ok-ink)' }}>
                        Delivers to {serviceability.pincode}
                        {serviceability.result.expected_delivery_date
                          ? ` · expected by ${serviceability.result.expected_delivery_date}`
                          : serviceability.result.transit_days
                            ? ` · about ${serviceability.result.transit_days} days`
                            : ` · ${copy.deliveryWindow}`}
                        {' · '}
                        {copy.codLabelFor(serviceability.result.cod_available)}
                      </Typography>
                    )}
                    {!serviceability.checking && notServiceable && (
                      <Typography variant="caption" sx={{ color: 'var(--lf-err-ink)', fontWeight: 600 }}>
                        We do not deliver to {serviceability.pincode} yet. Try another pincode, or{' '}
                        <SupportLink variant="inline" topic="delivery" label="ask us about it" />.
                      </Typography>
                    )}
                    {!serviceability.checking && serviceability.unavailable && (
                      <Typography variant="caption" sx={{ color: 'var(--lf-warn-ink)' }}>
                        We could not check delivery for {serviceability.pincode} right now — you can
                        still place your order. {copy.deliveryDetail}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Panel>

              {/* ---------------- 2. payment ---------------- */}
              <Panel component="section" aria-labelledby="checkout-payment">
                <SectionHeading index={2} id="checkout-payment" title="Payment method" />
                <FormControl component="fieldset" sx={{ width: '100%' }}>
                  <FormLabel
                    component="legend"
                    sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--lf-ink)', mb: 1 }}
                  >
                    How would you like to pay?
                  </FormLabel>
                  <RadioGroup
                    name="payment_method"
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                  >
                    <FormControlLabel
                      value="PREPAID"
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            Pay now — UPI, card or net banking
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
                            You will be taken to PhonePe to complete the payment, then brought
                            straight back here.
                          </Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      value="COD"
                      disabled={codAvailable !== true}
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            Cash on delivery
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
                            {codAvailable === true
                              ? 'Pay the courier when your order arrives.'
                              : serviceability.result
                                ? 'Not available for this pincode.'
                                : 'Enter your pincode above and we will check whether it is available.'}
                          </Typography>
                        </Box>
                      }
                    />
                  </RadioGroup>
                </FormControl>
              </Panel>

              {/* ---------------- 3. review ---------------- */}
              <Panel component="section" aria-labelledby="checkout-review">
                <SectionHeading index={3} id="checkout-review" title="Review and place your order" />

                <Typography variant="overline" sx={{ color: 'var(--lf-ink-3)' }}>
                  Delivering to
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {values.first_name} {values.last_name}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
                  {[values.address, values.city, values.state, values.pincode]
                    .filter(Boolean)
                    .join(', ')}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
                  {digitsOnly(values.phone) && `+91 ${digitsOnly(values.phone)}`}
                  {values.email ? ` · ${values.email}` : ''}
                </Typography>

                <Divider sx={{ my: 2.5 }} />

                <Stack spacing={1.25}>
                  {lines.map((line) => (
                    <Box
                      key={line.cartItemId ?? line.productId}
                      sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}
                    >
                      <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
                        {line.product.name} × {line.quantity}
                        {!line.inStock && (
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{ color: 'var(--lf-warn-ink)', ml: 1, fontWeight: 600 }}
                          >
                            no longer available
                          </Typography>
                        )}
                      </Typography>
                      <Typography variant="body2" data-tnum="true" sx={{ whiteSpace: 'nowrap' }}>
                        {formatMoney(line.lineTotal)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>

                <Divider sx={{ my: 2 }} />

                {/* The same server-priced figures as the summary panel. */}
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)' }}>
                      Subtotal
                    </Typography>
                    <Typography variant="body2" data-tnum="true">
                      {formatMoney(summary?.subtotal)}
                    </Typography>
                  </Box>
                  {Number(summary?.discountAmount) > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: 'var(--lf-ok-ink)' }}>
                        Discount{couponCode ? ` (${couponCode})` : ''}
                      </Typography>
                      <Typography
                        variant="body2"
                        data-tnum="true"
                        sx={{ color: 'var(--lf-ok-ink)' }}
                      >
                        −{formatMoney(summary.discountAmount)}
                      </Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)' }}>
                      Shipping
                    </Typography>
                    <Typography variant="body2" data-tnum="true">
                      {summary?.shippingAmount === 0
                        ? 'Free'
                        : formatMoney(summary?.shippingAmount, { fallback: copy.shippingAmountLabel })}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6">Total payable</Typography>
                    <Typography variant="price" data-tnum="true" sx={{ fontWeight: 700 }}>
                      {formatMoney(summary?.total)}
                    </Typography>
                  </Box>
                </Stack>

                <Button
                  size="large"
                  fullWidth
                  sx={{ mt: 3 }}
                  onClick={handlePlaceOrder}
                  disabled={disableSubmit}
                  startIcon={placing ? <CircularProgress size={18} /> : null}
                >
                  {placing
                    ? 'Placing your order…'
                    : !summary
                      ? 'Place order'
                      : paymentMethod === 'COD'
                        ? `Place order · ${formatMoney(summary.total)}`
                        : `Pay ${formatMoney(summary.total)}`}
                </Button>

                <Typography
                  variant="caption"
                  sx={{ display: 'block', mt: 1.5, color: 'var(--lf-ink-3)' }}
                >
                  By placing this order you accept our{' '}
                  <Link component={RouterLink} to="/terms">
                    terms
                  </Link>{' '}
                  and{' '}
                  <Link component={RouterLink} to="/shipping-returns">
                    {copy.returnsWindow.toLowerCase()}
                  </Link>
                  .
                </Typography>
              </Panel>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ position: { md: 'sticky' }, top: { md: 'calc(var(--lf-nav-h) + 24px)' } }}>
              <CartTotals
                summary={summary}
                pending={summaryPending}
                loading={summaryLoading}
                footer={
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 'var(--lf-r-field)',
                      backgroundColor: 'var(--lf-surface-sunken)',
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'var(--lf-ink-2)', display: 'block' }}>
                      {copy.shippingLabel} · {copy.deliveryWindow}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--lf-ink-2)', display: 'block' }}>
                      {copy.returnsLine}
                    </Typography>
                  </Box>
                }
              >
                <Stack spacing={2}>
                  <CouponField
                    appliedCode={appliedCode}
                    discountAmount={summary?.discountAmount || 0}
                    onApply={handleApplyCoupon}
                    onRemove={() => {
                      setAppliedCode(null);
                      setCouponError(null);
                      setCouponReason(null);
                    }}
                    applying={applyingCoupon}
                    error={couponError}
                    reason={couponReason}
                  />
                  <Button variant="outlined" fullWidth component={RouterLink} to="/cart">
                    Edit your bag
                  </Button>
                </Stack>
              </CartTotals>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Checkout;
