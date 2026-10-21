/**
 * CartTotals — the ONE money block shared by `/cart` and `/checkout`, plus the
 * helpers that read `GET /api/cart/summary/` (IMPL_SPEC §2b #15).
 *
 * WHY THE MONEY LIVES HERE AND NOWHERE ELSE
 * The old pages each did their own arithmetic: `Cart.jsx` summed `item.price`
 * (the LIST price) while the backend charges `discount_price`, `Checkout.jsx`
 * printed "Shipping: Free" against a deleted `CartSummary.jsx` that hard-coded
 * `estimatedShipping = 50`, and the coupon field reported a discount it had
 * never confirmed. Three numbers, none of them the one the customer was charged.
 *
 * Now there is exactly one source: `cart/summary/`, which prices the basket with
 * `orders.services.price_basket` — the same function `create_order()` uses, which
 * calls the same `coupons.services.evaluate_coupon` that `coupons/validate/`
 * uses. The number shown is the number charged *by construction*.
 *
 * THE SUMMARY CONTRACT, as verified in `backend/cart/views.py::summary`:
 *   {
 *     cart_id, currency: 'INR',
 *     items: [{ id, product, quantity, added_at,
 *               in_stock, max_quantity, unit_price, line_total }],
 *     item_count, total_quantity, sellable_item_count,
 *     unavailable_items: [{ item_id, product_id, name, reason, available, requested }],
 *     subtotal, discount_amount, discount_type, shipping_amount, total,
 *     coupon: { code, applied, valid, discount_type, discount_value,
 *               discount_amount, message }                       // accepted
 *           | { code, applied: false, valid: false, reason, message, … }  // refused
 *           | null,
 *     free_shipping: { threshold, remaining, qualified },
 *     policy: {…} | null, delivery: {…} | null,
 *     cross_sell: [Product]
 *   }
 * Every money value is a 2dp STRING, deliberately (`orders/serializers.py::money`
 * explains why a float is unacceptable for a payment total). `toAmount()` is the
 * only place that turns one into a number.
 *
 * `cart/summary/` is `IsAuthenticated`. `/cart` is a public route, so a guest
 * cart is priced client-side from `effectivePrice()` — which is `discount_price
 * ?? price`, i.e. the same unit price the server charges — and the page says
 * plainly that the final total is confirmed at checkout. It never shows a list
 * price as if it were payable.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import { getCartSummary } from '../../services/api';
import {
  freeShippingNudge,
  freeShippingProgress,
  usePolicy,
} from '../../content/policy';

/* ------------------------------------------------------------------ *
 * money
 * ------------------------------------------------------------------ */

/**
 * Rupees, grouped the Indian way (`₹1,29,900`), from either a number or the
 * backend's 2dp string. Paise are printed only when they are non-zero: dropping
 * a real `.50` would understate what is charged, and printing `.00` on every
 * line is noise the design system explicitly removes.
 *
 * @param {string|number|null|undefined} value
 * @param {object} [options]
 * @param {string} [options.fallback='—'] Returned when `value` is not a number.
 * @param {boolean} [options.alwaysDecimals=false]
 */
export function formatMoney(value, { fallback = '—', alwaysDecimals = false } = {}) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return fallback;
  const hasPaise = alwaysDecimals || Math.round(amount * 100) % 100 !== 0;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: hasPaise ? 2 : 0,
      maximumFractionDigits: hasPaise ? 2 : 0,
    }).format(amount);
  } catch {
    return `₹${hasPaise ? amount.toFixed(2) : Math.round(amount)}`;
  }
}

/** A money string/number as a number. Never NaN. */
export function toAmount(value, fallback = 0) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : fallback;
}

/** `null` when the server did not send the field at all — distinct from zero. */
export function toAmountOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

/* ------------------------------------------------------------------ *
 * summary normalisation
 * ------------------------------------------------------------------ */

const EMPTY_SUMMARY = Object.freeze({
  cartId: null,
  lines: [],
  itemCount: 0,
  totalQuantity: 0,
  sellableItemCount: 0,
  unavailable: [],
  subtotal: 0,
  discountAmount: 0,
  discountType: null,
  shippingAmount: null,
  total: 0,
  currency: 'INR',
  coupon: null,
  freeShipping: null,
  delivery: null,
  crossSell: [],
  source: 'empty',
});

/**
 * One in-memory shape for the page, whichever way the money was priced.
 * `source: 'server'` means every figure came from `cart/summary/`.
 */
export function normaliseCartSummary(data) {
  if (!data || typeof data !== 'object') return { ...EMPTY_SUMMARY };

  const rawItems = Array.isArray(data.items) ? data.items : [];
  const lines = rawItems
    .map((item) => {
      const product = item && item.product ? item.product : null;
      if (!product || product.id === undefined || product.id === null) return null;
      const quantity = Math.max(1, Math.trunc(Number(item.quantity ?? 1)) || 1);
      const unitPrice = toAmount(item.unit_price);
      return {
        cartItemId: item.id ?? null,
        product,
        productId: product.id,
        quantity,
        unitPrice,
        lineTotal: toAmount(item.line_total, unitPrice * quantity),
        // §2d: availability is the server's answer, never recomputed here.
        inStock: item.in_stock !== false,
        maxQuantity: toAmountOrNull(item.max_quantity),
      };
    })
    .filter(Boolean);

  const unavailable = Array.isArray(data.unavailable_items) ? data.unavailable_items : [];
  const freeShipping =
    data.free_shipping && typeof data.free_shipping === 'object'
      ? {
          threshold: toAmountOrNull(data.free_shipping.threshold),
          remaining: toAmountOrNull(data.free_shipping.remaining),
          qualified: data.free_shipping.qualified !== false,
        }
      : null;

  return {
    cartId: data.cart_id ?? null,
    lines,
    itemCount: Number(data.item_count ?? lines.length) || lines.length,
    totalQuantity:
      Number(data.total_quantity ?? 0) ||
      lines.reduce((sum, line) => sum + line.quantity, 0),
    sellableItemCount: Number(data.sellable_item_count ?? lines.length),
    unavailable,
    subtotal: toAmount(data.subtotal),
    discountAmount: toAmount(data.discount_amount),
    discountType: data.discount_type ?? null,
    shippingAmount: toAmountOrNull(data.shipping_amount),
    total: toAmount(data.total),
    currency: data.currency || 'INR',
    coupon: data.coupon && typeof data.coupon === 'object' ? data.coupon : null,
    freeShipping,
    delivery: data.delivery && typeof data.delivery === 'object' ? data.delivery : null,
    crossSell: Array.isArray(data.cross_sell) ? data.cross_sell : [],
    source: 'server',
  };
}

/**
 * Prices a GUEST basket from the CartContext lines.
 *
 * `cart.items` are already flattened products carrying `unitPrice`/`lineTotal`
 * computed with `effectivePrice()` (`discount_price ?? price`), so this is the
 * unit price the server would charge. What it cannot know is a coupon (the
 * evaluator is server-side) — so `coupon` stays null and the caller tells the
 * shopper the total is confirmed at checkout.
 */
export function guestCartSummary(cart, policy) {
  const items = Array.isArray(cart?.items) ? cart.items : [];
  const lines = items.map((item) => ({
    cartItemId: item.cartItemId ?? null,
    product: item,
    productId: item.id,
    quantity: item.quantity,
    unitPrice: toAmount(item.unitPrice),
    lineTotal: toAmount(item.lineTotal, toAmount(item.unitPrice) * item.quantity),
    inStock: item.in_stock !== false,
    maxQuantity: toAmountOrNull(item.available_quantity),
  }));

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const threshold = policy?.freeShippingThreshold ?? null;
  const charge = toAmount(policy?.shippingCharge, 0);
  const shippingAmount =
    charge <= 0 || (threshold !== null && subtotal >= threshold) ? 0 : charge;

  return {
    ...EMPTY_SUMMARY,
    lines,
    itemCount: lines.length,
    totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    sellableItemCount: lines.filter((line) => line.inStock).length,
    subtotal,
    shippingAmount,
    total: subtotal + shippingAmount,
    freeShipping:
      threshold === null || charge <= 0
        ? null
        : {
            threshold,
            remaining: Math.max(0, threshold - subtotal),
            qualified: subtotal >= threshold,
          },
    source: 'guest',
  };
}

/* ------------------------------------------------------------------ *
 * the hook
 * ------------------------------------------------------------------ */

/**
 * `GET cart/summary/`, with a stale-response guard and an explicit `refresh()`
 * every mutation must call — the money changes the moment a quantity does.
 *
 * @param {object} options
 * @param {string} [options.coupon] An ACCEPTED code to re-price with.
 * @param {string} [options.pincode] 6 digits, for the delivery block.
 * @param {boolean} [options.enabled=true] False for a guest (the endpoint is
 *   `IsAuthenticated`, so calling it would only produce a 401).
 * @returns {{summary: object|null, loading: boolean, pending: boolean,
 *            error: object|null, refresh: Function}}
 */
export function useCartSummary({ coupon, pincode, enabled = true } = {}) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  // Monotonic request id: a slow earlier response must never overwrite a newer one.
  const requestId = useRef(0);
  const aliveRef = useRef(true);
  const hasDataRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (params) => {
      if (!enabled) {
        setLoading(false);
        setPending(false);
        return null;
      }
      const id = requestId.current + 1;
      requestId.current = id;

      if (hasDataRef.current) setPending(true);
      else setLoading(true);

      try {
        const data = await getCartSummary(params);
        if (!aliveRef.current || requestId.current !== id) return null;
        const next = normaliseCartSummary(data);
        hasDataRef.current = true;
        setSummary(next);
        setError(null);
        return next;
      } catch (requestError) {
        if (!aliveRef.current || requestId.current !== id) return null;
        setError(requestError);
        return null;
      } finally {
        if (aliveRef.current && requestId.current === id) {
          setLoading(false);
          setPending(false);
        }
      }
    },
    [enabled]
  );

  const params = useMemo(
    () => ({ coupon: coupon || undefined, pincode: pincode || undefined }),
    [coupon, pincode]
  );

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    load(params);
  }, [enabled, load, params]);

  const refresh = useCallback(() => load(params), [load, params]);

  return { summary, loading, pending, error, refresh };
}

/* ------------------------------------------------------------------ *
 * CouponField
 * ------------------------------------------------------------------ */

/**
 * The coupon control. It renders a discount ONLY from a confirmed server
 * response — never on submit, which is what made the old field a placebo.
 *
 * @param {object} props
 * @param {string|null} props.appliedCode The code the server has accepted.
 * @param {number} props.discountAmount Rupees off, as the server computed it.
 * @param {Function} props.onApply `(code) => Promise<void>`
 * @param {Function} props.onRemove
 * @param {boolean} [props.applying]
 * @param {string|null} [props.error] The server's own message.
 * @param {string|null} [props.reason] The server's machine-readable reason.
 * @param {boolean} [props.disabled]
 * @param {string} [props.disabledHint] Why the field is unavailable.
 */
export const CouponField = ({
  appliedCode,
  discountAmount = 0,
  onApply,
  onRemove,
  applying = false,
  error = null,
  reason = null,
  disabled = false,
  disabledHint,
}) => {
  const [code, setCode] = useState('');

  const submit = (event) => {
    event.preventDefault();
    const candidate = code.trim();
    if (!candidate || applying) return;
    onApply(candidate);
  };

  if (appliedCode) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
          p: 1.5,
          borderRadius: 'var(--lf-r-field)',
          backgroundColor: 'var(--lf-ok-tint)',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <CheckCircleOutlineIcon fontSize="small" sx={{ color: 'var(--lf-ok-ink)', mt: '2px' }} />
          <Box>
            <Typography variant="subtitle2" sx={{ color: 'var(--lf-ok-ink)' }}>
              {appliedCode} applied
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--lf-ok-ink)', display: 'block' }}>
              {formatMoney(discountAmount)} off this order
            </Typography>
          </Box>
        </Stack>
        <Button
          variant="destructive"
          onClick={() => {
            setCode('');
            onRemove();
          }}
          disabled={applying}
        >
          Remove
        </Button>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={submit} noValidate>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          label="Coupon code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase().trim())}
          placeholder="e.g. WELCOME10"
          disabled={disabled || applying}
          error={Boolean(error)}
          helperText={error || disabledHint || ' '}
          inputProps={{ 'aria-label': 'Coupon code', autoCapitalize: 'characters' }}
          autoComplete="off"
        />
        {/* §2.15's reasoning, applied beyond the card: the tag glyph carried no
            information the label does not. The spinner is the one exception,
            because it reports a state the label cannot. */}
        <Button
          type="submit"
          variant="outlined"
          disabled={disabled || applying || !code.trim()}
          startIcon={applying ? <CircularProgress size={16} /> : null}
          sx={{ mt: '26px', flexShrink: 0 }}
        >
          Apply
        </Button>
      </Stack>
      {reason === 'MIN_ORDER_NOT_MET' && (
        <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)', display: 'block', mt: 0.5 }}>
          Add a little more to your bag and try the code again.
        </Typography>
      )}
    </Box>
  );
};

/* ------------------------------------------------------------------ *
 * the money rows
 * ------------------------------------------------------------------ */

/* §6.3: the summary row is one of <PriceBlock>'s five surfaces, and the `price`
   variant (17px/600, `tnum`) is its register. The old row stacked a raw
   `1.125rem` and a raw `700` on top of that variant — a second price size in a
   system that declares exactly two (§10.20). The variant now carries both. */
const Row = ({ label, value, tone, strong }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'baseline' }}>
    <Typography
      variant={strong ? 'h6' : 'body2'}
      component="span"
      sx={{ color: tone || (strong ? 'var(--lf-ink)' : 'var(--lf-ink-3)') }}
    >
      {label}
    </Typography>
    <Typography
      variant={strong ? 'price' : 'body2'}
      component="span"
      data-tnum="true"
      sx={{
        color: tone || 'var(--lf-ink)',
        ...(strong ? null : { fontWeight: 600 }),
        whiteSpace: 'nowrap',
      }}
    >
      {value}
    </Typography>
  </Box>
);

/**
 * @param {object} props
 * @param {object} props.summary A `normaliseCartSummary` / `guestCartSummary` result.
 * @param {boolean} [props.pending] A re-price is in flight: dim, do not unmount.
 * @param {boolean} [props.loading] Nothing priced yet: skeleton, never a zero total.
 * @param {React.ReactNode} [props.children] The primary action row.
 * @param {React.ReactNode} [props.footer] Reassurance / policy strip.
 * @param {string} [props.title='Order summary']
 * @param {boolean} [props.showItemCount=true]
 */
const CartTotals = ({
  summary,
  pending = false,
  loading = false,
  children,
  footer,
  title = 'Order summary',
  showItemCount = true,
}) => {
  const { copy } = usePolicy();
  const data = summary || EMPTY_SUMMARY;

  /* Before the server has priced the basket there is no total — and `₹0` is a
     NUMBER, not an absence. A skeleton says "not yet"; a zero says "nothing to
     pay", which is the one thing a money panel must never say by accident. */
  if (loading && !summary) {
    return (
      <Box
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 'var(--lf-r-panel)',
          backgroundColor: 'var(--lf-paper)',
          border: '1px solid var(--lf-hairline)',
        }}
        aria-busy="true"
      >
        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          {title}
        </Typography>
        {/* P5 — the skeleton lays out at the real element's final size: three
            money rows and one 52px primary action, which is exactly what
            replaces it. */}
        <Stack spacing={1.5} aria-hidden="true">
          <Skeleton variant="text" width="100%" height={20} />
          <Skeleton variant="text" width="80%" height={20} />
          <Skeleton variant="text" width="60%" height={20} />
          <Skeleton
            variant="rounded"
            width="100%"
            height={52}
            sx={{ mt: 1, borderRadius: 'var(--lf-r-card)' }}
          />
        </Stack>
        <Typography component="p" aria-live="polite" sx={{ position: 'absolute', left: -9999 }}>
          Working out your total
        </Typography>
      </Box>
    );
  }

  // The shipping cell: the server's number when it priced the basket, the
  // policy sentence otherwise. Never the literal word "Free" on faith.
  const shippingCell =
    data.shippingAmount === null
      ? copy.shippingAmountLabel
      : data.shippingAmount === 0
        ? 'Free'
        : formatMoney(data.shippingAmount);

  const serverFreeShip =
    data.freeShipping && data.freeShipping.threshold !== null ? data.freeShipping : null;
  const nudge = serverFreeShip
    ? serverFreeShip.qualified
      ? 'Free delivery unlocked'
      : `Spend ${formatMoney(serverFreeShip.remaining)} more for free delivery`
    : freeShippingNudge(data.subtotal);
  const progress = serverFreeShip
    ? serverFreeShip.threshold > 0
      ? Math.max(0, Math.min(1, data.subtotal / serverFreeShip.threshold))
      : null
    : freeShippingProgress(data.subtotal);

  const couponCode =
    data.coupon && data.coupon.applied && data.coupon.valid ? data.coupon.code : null;

  return (
    <Box
      /* §3.11 — ONE elevation ramp, and a panel is not a floating thing: only
         the nav when scrolled, the hero card, toasts, sheets and popovers
         carry a shadow now. The `--lf-e-edge` inset highlight is deleted. */
      sx={{
        p: { xs: 2, md: 3 },
        borderRadius: 'var(--lf-r-panel)',
        backgroundColor: 'var(--lf-paper)',
        border: '1px solid var(--lf-hairline)',
        opacity: pending ? 0.72 : 1,
        transition: 'opacity var(--lf-dur-2) var(--lf-ease)',
      }}
      aria-busy={pending || undefined}
    >
      <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
        {title}
      </Typography>

      <Stack spacing={1.25}>
        <Row
          label={
            showItemCount
              ? `Subtotal (${data.totalQuantity} item${data.totalQuantity === 1 ? '' : 's'})`
              : 'Subtotal'
          }
          value={formatMoney(data.subtotal)}
        />

        {data.discountAmount > 0 && (
          <Row
            label={couponCode ? `Discount (${couponCode})` : 'Discount'}
            value={`−${formatMoney(data.discountAmount)}`}
            tone="var(--lf-ok-ink)"
          />
        )}

        <Row label="Shipping" value={shippingCell} />

        {nudge && (
          <Box sx={{ pt: 0.5 }}>
            {/* §3.4 — "Free delivery" is a semantic ok, not a brand accent;
                --lf-ok-ink measures 6.13:1 on canvas and 6.46:1 on paper. */}
            <Typography variant="caption" sx={{ color: 'var(--lf-ok-ink)', display: 'block', mb: 0.5 }}>
              {nudge}
            </Typography>
            {progress !== null && (
              <LinearProgress
                variant="determinate"
                value={Math.round(progress * 100)}
                aria-label="Progress towards free delivery"
              />
            )}
          </Box>
        )}

        <Divider sx={{ my: 0.5 }} />

        <Row label="Total" value={formatMoney(data.total)} strong />

        {data.shippingAmount === null && (
          <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
            {`${copy.shippingLabel} · ${copy.deliveryWindow}. Your final total is confirmed at checkout.`}
          </Typography>
        )}
      </Stack>

      {children && <Box sx={{ mt: 2.5 }}>{children}</Box>}
      {footer && <Box sx={{ mt: 2 }}>{footer}</Box>}
      {/* No tax line: nothing in this repo computes tax, and "prices include
          GST" is not a fact the code can support. §4's rule is to claim only
          what is provable. */}
    </Box>
  );
};

export default CartTotals;
