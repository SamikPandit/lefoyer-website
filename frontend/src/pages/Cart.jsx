/**
 * Cart — rewritten on `GET /api/cart/summary/` (IMPL_SPEC §3 WP-11, §2b #15).
 *
 * The page it replaces had six defects, each verified in the old file:
 *   1. It priced every line from `item.price` — the LIST price — while the
 *      backend charges `discount_price`. The total shown could be higher than
 *      the amount taken, which is the one direction a store must never err in.
 *   2. `cart.items.length === 0` was tested on the FIRST render, before the cart
 *      had loaded, so every visit flashed "Your Cart is Empty".
 *   3. There was no error state at all: a failed cart call rendered the empty
 *      state, i.e. "you have nothing" instead of "we could not load it".
 *   4. `Size: {item.size}` printed a label for a field that does not exist.
 *   5. "Shipping: Free" was hard-coded, contradicting four other files (LF-12).
 *   6. "Secure Checkout - SSL Encrypted" — a caption asserting the baseline.
 *
 * Money comes from the server and nowhere else; see `cart/CartTotals.jsx`.
 *
 * ALCOVE (ART_DIRECTION.md §5.4, §5.9): the UTILITY archetype — `h3`
 * rendered as the `h1`, left aligned, `py: var(--lf-sect)` — with lines 1–7 in
 * ONE panel with internal hairlines, 88px `<Alcove surface="row">` thumbnails
 * and the summary sticky from `md` up. The free-delivery line is read from
 * `policy.js`, never typed. **The empty state passes `<CrossSell />` as
 * `children`** (§2.28): `EmptyState.jsx:214` exists solely for this and its own
 * docstring uses the empty cart as THE example, yet no caller had ever used it,
 * so six routes rendered a 64px beige circle and stopped.
 *
 * Panels carry NO shadow (§3.11: one elevation ramp, and a panel is not a
 * floating thing), and `--lf-e-edge` — the inset highlight that propped up the
 * deleted card frame — is gone from every one of them.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import { Link as RouterLink } from 'react-router-dom';

import SeoHead from '../components/common/SeoHead';
import EmptyState, { useProductShelf } from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import SupportLink from '../components/common/SupportLink';
import PincodeCheck, { getRememberedPincode } from '../components/common/PincodeCheck';
import CartLine from '../components/cart/CartLine';
import CartTotals, {
  CouponField,
  guestCartSummary,
  useCartSummary,
} from '../components/cart/CartTotals';
import CrossSell from '../components/cart/CrossSell';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { getApiErrorMessage, validateCoupon } from '../services/api';
import { usePolicy } from '../content/policy';
import { useBrand } from '../content/brand';

const SKELETON_ROWS = 3;

/** §3.10 — the `row` surface caps the niche at 88px of height. */
const ROW_NICHE_W = 'calc(88px / var(--lf-arch-ratio))';

/* P5 / CLS ≤ 0.05: the placeholder is the ARCH, at the real row's size, so the
   first paint and the loaded paint are the same shape. A rounded rectangle
   where a niche is about to appear is a layout shift with extra steps. */
const CartSkeleton = () => (
  <Grid container spacing={{ xs: 3, md: 4 }}>
    <Grid size={{ xs: 12, md: 8 }}>
      <Box
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 'var(--lf-r-panel)',
          border: '1px solid var(--lf-hairline)',
          backgroundColor: 'var(--lf-paper)',
        }}
      >
        {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
          <Stack
            key={index}
            direction="row"
            spacing={2}
            sx={{
              py: 2.5,
              borderBottom: index === SKELETON_ROWS - 1 ? 'none' : '1px solid var(--lf-hairline)',
            }}
          >
            <Box
              className="lf-skel lf-skel--alcove lf-skel--media"
              sx={{ flex: 'none', width: ROW_NICHE_W }}
            />
            <Box sx={{ flexGrow: 1 }}>
              <Skeleton variant="text" width="55%" height={22} />
              <Skeleton variant="text" width="28%" height={16} />
              <Skeleton variant="rounded" width={132} height={44} sx={{ mt: 1.5 }} />
            </Box>
          </Stack>
        ))}
      </Box>
    </Grid>
    <Grid size={{ xs: 12, md: 4 }}>
      <Box
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 'var(--lf-r-panel)',
          border: '1px solid var(--lf-hairline)',
          backgroundColor: 'var(--lf-paper)',
        }}
      >
        <Skeleton variant="text" width="50%" height={28} />
        <Skeleton variant="text" width="100%" height={20} sx={{ mt: 2 }} />
        <Skeleton variant="text" width="100%" height={20} />
        <Skeleton variant="text" width="100%" height={20} />
        <Skeleton variant="rounded" width="100%" height={52} sx={{ mt: 3 }} />
      </Box>
    </Grid>
    <Grid size={12}>
      <Typography component="p" sx={{ position: 'absolute', left: -9999 }} aria-live="polite">
        Loading your bag
      </Typography>
    </Grid>
  </Grid>
);

/** The one reassurance strip. Every number comes from policy.js (LF-12). */
const ReassuranceStrip = () => {
  const { copy } = usePolicy();
  const brand = useBrand();
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 'var(--lf-r-field)',
        backgroundColor: 'var(--lf-mat)',
      }}
    >
      <Stack spacing={0.75}>
        <Typography variant="caption" sx={{ color: 'var(--lf-ink-2)' }}>
          {copy.shippingLabel} · {copy.deliveryWindow}
        </Typography>
        <Typography variant="caption" sx={{ color: 'var(--lf-ink-2)' }}>
          <Link component={RouterLink} to="/shipping-returns">
            {copy.returnsWindow}
          </Link>{' '}
          · {copy.refundLine}
        </Typography>
        <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
          Questions?{' '}
          <Link component={RouterLink} to={brand.support.faqPath}>
            Read the FAQ
          </Link>{' '}
          or <SupportLink variant="inline" topic="order" label="contact support" />
        </Typography>
      </Stack>
    </Box>
  );
};

const Cart = () => {
  const { isAuthenticated } = useAuth();
  const {
    cart,
    initialised,
    error: cartError,
    pendingItemIds,
    mergeSkipped,
    dismissMergeNotice,
    updateQuantity,
    removeFromCart,
    refresh: refreshCart,
  } = useCart();
  const { policy, copy } = usePolicy();

  /** The code the SERVER has accepted. Never set optimistically. */
  const [appliedCode, setAppliedCode] = useState(null);
  const [couponError, setCouponError] = useState(null);
  const [couponReason, setCouponReason] = useState(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [pincode, setPincode] = useState(() => getRememberedPincode() || '');

  const {
    summary: serverSummary,
    loading: summaryLoading,
    pending: summaryPending,
    error: summaryError,
    refresh: refreshSummary,
  } = useCartSummary({
    coupon: appliedCode,
    pincode,
    enabled: isAuthenticated,
  });

  const guestSummary = useMemo(
    () => (isAuthenticated ? null : guestCartSummary(cart, policy)),
    [isAuthenticated, cart, policy]
  );
  const summary = isAuthenticated ? serverSummary : guestSummary;

  /* The server re-evaluates the coupon on every summary call. If it has since
     become invalid (expired mid-session, basket dropped below the minimum), the
     block comes back `valid:false` — the applied state is dropped and the
     server's own reason is shown. The UI never keeps a discount the server has
     withdrawn. */
  useEffect(() => {
    const block = serverSummary?.coupon;
    if (!block) return;
    if (block.valid === false && appliedCode) {
      setAppliedCode(null);
      setCouponError(block.message || 'That code is no longer valid.');
      setCouponReason(block.reason || null);
    }
  }, [serverSummary, appliedCode]);

  /** Re-price after any mutation: the money changes the moment a quantity does. */
  const afterMutation = useCallback(() => {
    if (isAuthenticated) refreshSummary();
  }, [isAuthenticated, refreshSummary]);

  const handleQuantityChange = useCallback(
    async (productId, quantity) => {
      const result = await updateQuantity(productId, quantity);
      if (result === true) afterMutation();
      return result;
    },
    [updateQuantity, afterMutation]
  );

  const handleRemove = useCallback(
    async (productId) => {
      const result = await removeFromCart(productId);
      if (result === true) afterMutation();
      return result;
    },
    [removeFromCart, afterMutation]
  );

  const handleApplyCoupon = useCallback(
    async (code) => {
      setApplyingCoupon(true);
      setCouponError(null);
      setCouponReason(null);
      try {
        // §2b #14. A rejection is a 400 with a structured body, which api.js
        // resolves rather than throws — it is a RESULT, not a transport failure.
        const result = await validateCoupon({
          code,
          subtotal: summary ? summary.subtotal : 0,
        });
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

  const handleRemoveCoupon = useCallback(() => {
    setAppliedCode(null);
    setCouponError(null);
    setCouponReason(null);
  }, []);

  const handlePincodeResult = useCallback((result) => {
    setPincode(result && result.pincode ? result.pincode : '');
  }, []);

  const lines = summary ? summary.lines : [];

  /* §2.28 — the empty bag shows REAL PRODUCTS. `summary.crossSell` is the
     server's own pick, but `cart/summary/` is IsAuthenticated, so a guest's
     empty bag has none and the slot rendered a ~400px void. The shared
     `useProductShelf()` (the same source §5.8's table gives 404, Search-idle,
     Profile and Orders) fills it, and only fetches when it will be shown. */
  const { products: shelfFallback } = useProductShelf({
    inStockOnly: true,
    limit: 4,
    enabled: lines.length === 0,
  });
  const emptyBagPicks = summary?.crossSell?.length ? summary.crossSell : shelfFallback;

  const unavailableByProduct = useMemo(() => {
    const map = new Map();
    (summary?.unavailable || []).forEach((entry) => {
      map.set(entry.product_id, entry);
    });
    return map;
  }, [summary]);

  const blockingLines = lines.filter((line) => !line.inStock);
  const canCheckout = lines.length > 0 && blockingLines.length === 0;

  /* ---------------- loading ---------------- */
  // `initialised` is the context's "we have asked" flag. Only after it is true
  // may this page claim the bag is empty.
  const showSkeleton = !initialised || (isAuthenticated && summaryLoading && !serverSummary);

  if (showSkeleton) {
    return (
      <Box sx={{ backgroundColor: 'var(--lf-canvas)', py: 'var(--lf-sect)' }}>
        <SeoHead title="Your bag" noindex description="Review the items in your bag." />
        <Container maxWidth="lg">
          <Typography variant="h3" component="h1" sx={{ mb: 3 }}>
            Your bag
          </Typography>
          <CartSkeleton />
        </Container>
      </Box>
    );
  }

  /* ---------------- nothing to show, because the call failed ---------------- */
  // Distinct from "empty": an API failure must never render as "you have
  // nothing in your bag". That was the old page's worst state.
  if (!summary || (lines.length === 0 && (summaryError || cartError))) {
    return (
      <Box sx={{ backgroundColor: 'var(--lf-canvas)', py: 'var(--lf-sect)' }}>
        <SeoHead title="Your bag" noindex description="Review the items in your bag." />
        <Container maxWidth="sm">
          <ErrorState
            variant="page"
            headingComponent="h1"
            title="We could not load your bag"
            error={summaryError}
            message={
              summaryError
                ? undefined
                : cartError || 'Your items are safe — this is our side. Try again.'
            }
            onRetry={() => {
              refreshCart();
              if (isAuthenticated) refreshSummary();
            }}
            secondaryLabel="Browse all products"
            secondaryTo="/products"
          />
        </Container>
      </Box>
    );
  }

  /* ---------------- empty ---------------- */
  if (lines.length === 0) {
    return (
      <Box sx={{ backgroundColor: 'var(--lf-canvas)', py: 'var(--lf-sect)' }}>
        <SeoHead title="Your bag" noindex description="Review the items in your bag." />
        {/* §2.28/§5.4: the empty state shows REAL PRODUCTS, not a 64px beige
            circle and a full stop. `summary.crossSell` is the server's own
            pick — with an empty bag `_cross_sell([])` falls back to the wider
            catalogue, so it is the shop. A guest's bag is priced client-side
            (`cart/summary/` is IsAuthenticated), so there is no server pick to
            show, so the shared `useProductShelf()` supplies the shelf instead
            — the slot is never empty and the void §2.28 names never returns. */}
        <Container maxWidth="md">
          <EmptyState
            variant="page"
            headingComponent="h1"
            icon={<ShoppingBagOutlinedIcon sx={{ fontSize: 28 }} />}
            title="Your bag is empty"
            message="Nothing in here yet. The full range is two taps away."
            primaryLabel="Shop all skincare"
            primaryTo="/products"
            secondaryLabel="Help"
            secondaryTo="/faq"
          >
            <CrossSell products={emptyBagPicks} title="Start here" />
          </EmptyState>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: 'var(--lf-canvas)', py: 'var(--lf-sect)' }}>
      <SeoHead title="Your bag" noindex description="Review the items in your bag." />
      <Container maxWidth="lg">
        <Typography variant="h3" component="h1" sx={{ mb: 1 }}>
          Your bag
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)', mb: 3 }}>
          {summary.totalQuantity} item{summary.totalQuantity === 1 ? '' : 's'}
        </Typography>

        {/* A cart call that failed is NOT an empty cart. Retry, in place. */}
        {(summaryError || cartError) && (
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            action={
              <Button
                variant="outlined"
                onClick={() => {
                  refreshCart();
                  if (isAuthenticated) refreshSummary();
                }}
              >
                Retry
              </Button>
            }
          >
            <AlertTitle>We could not load your bag</AlertTitle>
            {summaryError
              ? getApiErrorMessage(summaryError, 'Your items are safe — this is our side.')
              : cartError}
          </Alert>
        )}

        {/* Lines dropped when a guest bag was merged at sign-in (§2b #16). */}
        {mergeSkipped && mergeSkipped.length > 0 && (
          <Alert
            severity="warning"
            sx={{ mb: 3 }}
            onClose={dismissMergeNotice}
          >
            <AlertTitle>Some saved items could not be added</AlertTitle>
            {mergeSkipped
              .map((entry) => entry.name || `Product ${entry.product_id}`)
              .join(', ')}{' '}
            — these are no longer available in the quantity you had saved.
          </Alert>
        )}

        {blockingLines.length > 0 && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <AlertTitle>One or more items are no longer available</AlertTitle>
            Remove them to continue — an order containing an unavailable item is
            refused in full, so we stop you here rather than at payment.
          </Alert>
        )}

        <Grid container spacing={{ xs: 3, md: 4 }}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Box
              sx={{
                px: { xs: 2, md: 3 },
                py: 0.5,
                borderRadius: 'var(--lf-r-panel)',
                border: '1px solid var(--lf-hairline)',
                backgroundColor: 'var(--lf-paper)',
              }}
            >
              <Box component="ul" sx={{ m: 0, p: 0 }}>
                {lines.map((line, index) => {
                  const entry = unavailableByProduct.get(line.productId);
                  return (
                    <CartLine
                      key={line.cartItemId ?? line.productId}
                      line={line}
                      last={index === lines.length - 1}
                      pending={pendingItemIds.includes(line.productId)}
                      reason={entry?.reason}
                      available={entry?.available}
                      onQuantityChange={handleQuantityChange}
                      onRemove={handleRemove}
                    />
                  );
                })}
              </Box>
            </Box>

            <Button
              component={RouterLink}
              to="/products"
              variant="text"
              startIcon={<ArrowBackIcon fontSize="small" />}
              sx={{ mt: 2.5 }}
            >
              Continue shopping
            </Button>

            <Box sx={{ mt: 3, maxWidth: 420 }}>
              <PincodeCheck
                variant="block"
                initialPincode={pincode}
                onResult={handlePincodeResult}
                label="Delivery pincode"
              />
            </Box>

            <CrossSell products={summary.crossSell} onAdded={afterMutation} />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ position: { md: 'sticky' }, top: { md: 'calc(var(--lf-nav-h) + 24px)' } }}>
              <CartTotals
                summary={summary}
                pending={summaryPending}
                footer={<ReassuranceStrip />}
              >
                <Stack spacing={2}>
                  <CouponField
                    appliedCode={appliedCode}
                    discountAmount={summary.discountAmount}
                    onApply={handleApplyCoupon}
                    onRemove={handleRemoveCoupon}
                    applying={applyingCoupon}
                    error={couponError}
                    reason={couponReason}
                    disabled={!isAuthenticated}
                    disabledHint={
                      isAuthenticated ? undefined : 'Sign in at checkout to apply a coupon.'
                    }
                  />
                  <Divider />
                  <Button
                    component={RouterLink}
                    to="/checkout"
                    size="large"
                    fullWidth
                    disabled={!canCheckout}
                  >
                    Proceed to checkout
                  </Button>
                  {!isAuthenticated && (
                    <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
                      You will sign in on the next step. Your bag comes with you.
                    </Typography>
                  )}
                  {!canCheckout && lines.length > 0 && (
                    <Typography variant="caption" sx={{ color: 'var(--lf-warn-ink)' }}>
                      Remove the unavailable items above to continue.
                    </Typography>
                  )}
                </Stack>
              </CartTotals>

              {summary.delivery && summary.delivery.expected_delivery_date && (
                <Typography
                  variant="caption"
                  sx={{ display: 'block', mt: 1.5, color: 'var(--lf-ok-ink)' }}
                >
                  Expected delivery to {summary.delivery.pincode}:{' '}
                  {summary.delivery.expected_delivery_date}
                </Typography>
              )}
              {!summary.delivery && (
                <Typography
                  variant="caption"
                  sx={{ display: 'block', mt: 1.5, color: 'var(--lf-ink-3)' }}
                >
                  {copy.codLine}
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Cart;
