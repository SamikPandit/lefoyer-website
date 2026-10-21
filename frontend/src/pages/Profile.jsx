/**
 * Profile — the account page.
 *
 * WHAT CHANGED
 *  - **It had no error state.** `fetchOrders` caught the failure, logged it to
 *    the console and left `orders: []`, so a failed request rendered as "No
 *    orders yet" — telling a customer with orders that they have none, on the
 *    page they would go to in order to chase one.
 *  - **It was the only route to order history, and it showed page 1 of 10.**
 *    It now shows the three most recent orders and links to `/orders`, which
 *    paginates properly. That list is the only path to payment recovery.
 *  - **Email verification was invisible.** An unverified account cannot sign in
 *    after the §2b #28 change, so the state belongs on this page, with a working
 *    resend.
 *  - `response.data.results || response.data` is gone: `listOrders()` normalises
 *    the envelope once, in api.js (§2a).
 *  - Cormorant Garamond overrides deleted (the font is no longer loaded at all);
 *    `<Grid item>` migrated to v7 `size`.
 *
 * ART_DIRECTION §5.8 / §5.9, applied here:
 *  - **UTILITY archetype.** `h3 component="h1"`, left, `py: var(--lf-sect)` — via
 *    `<PageShell>`, so "My account" can no longer be a different size from "My orders"
 *    and "Saved items", three pages reached from the same menu (§2.34).
 *  - **The empty state finally gets its `children`** (§2.28): the three in-stock
 *    products, rather than a 64px beige circle and a full stop.
 *  - `boxShadow: 'var(--lf-e-edge), var(--lf-e1)'` on the details panel is gone. §3.11
 *    makes `elevation` the single way to ask for depth and gives panels **none**; the
 *    1px ring it was painting is also exactly the card frame §2.6 deletes.
 *  - The resend control uses `aria-disabled` with the guard in the handler, never the
 *    `disabled` attribute (A4), and states its reason adjacent.
 */

import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import SeoHead from '../components/common/SeoHead';
import EmptyState, {
  FOCUS_RING_SX,
  PageShell,
  TOUCH_TARGET_SX,
  useProductShelf,
} from '../components/common/EmptyState';
import ProductCard from '../components/product/ProductCard';
import ProductCardSkeleton from '../components/common/ProductCardSkeleton';
import { PRODUCT_RAIL_SX } from '../components/product/productGrid';
import ErrorState from '../components/common/ErrorState';
import SupportLink from '../components/common/SupportLink';
import OrderCard from '../components/order/OrderCard';
import { useAuth } from '../context/AuthContext';
import { getApiErrorMessage, listOrders, resendVerification } from '../services/api';
import { useBrand } from '../content/brand';

const RECENT_COUNT = 3;
/** §5.8's table: the Profile empty state's rail is the three in-stock products. */
const RAIL_SIZE = 3;

const Profile = () => {
  const navigate = useNavigate();
  const { user, isEmailVerified, logout, refreshUser } = useAuth();
  const brand = useBrand();

  const [orders, setOrders] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState(null);

  /* §5.8's table: the Profile empty state shows the three in-stock products.
     Gated on the state that renders it, so the common path — an account WITH
     orders — costs no extra request. */
  const showEmptyOrders = !loading && !error && orders.length === 0;
  const { products: rail, loading: railLoading } = useProductShelf({
    inStockOnly: true,
    limit: RAIL_SIZE,
    enabled: showEmptyOrders,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // `page_size` is ignored by this endpoint (DRF's global paginator), so we
      // take page 1 and show the newest few. The full history is at /orders.
      const { items, count: total } = await listOrders();
      setOrders(Array.isArray(items) ? items.slice(0, RECENT_COUNT) : []);
      setCount(Number(total) || 0);
      setError(null);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleResend = async () => {
    // A4: `aria-disabled` keeps the control focusable, so the double-submit guard
    // lives here rather than on the element.
    if (resending || !user?.email) return;
    setResending(true);
    setResendNotice(null);
    try {
      const result = await resendVerification(user.email);
      setResendNotice({
        severity: 'success',
        text:
          result?.detail ||
          `If that address needs verifying, a new link is on its way to ${user.email}.`,
      });
      // The link may have been clicked in another tab already.
      refreshUser();
    } catch (requestError) {
      setResendNotice({
        severity: requestError?.isThrottled ? 'warning' : 'error',
        text: getApiErrorMessage(requestError, 'We could not send that email just now.'),
      });
    } finally {
      setResending(false);
    }
  };

  if (!user) {
    // ProtectedRoute has already settled `loading`, so this is the rare case of
    // a token without a readable account. Say so rather than rendering nothing.
    return (
      <PageShell archetype="utility" maxWidth="sm">
        <SeoHead title="My account" noindex />
        <ErrorState
          variant="page"
          headingComponent="h1"
          title="We could not load your account"
          message="Try signing in again — your orders and bag are untouched."
          onRetry={refreshUser}
          secondaryLabel="Sign in"
          secondaryTo="/login"
        />
      </PageShell>
    );
  }

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ');

  return (
    <PageShell archetype="utility" maxWidth="lg" title="My account">
      <SeoHead title="My account" noindex description="Your account and recent orders." />

      <Grid container spacing={{ xs: 3, md: 4 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Box
              sx={{
                p: { xs: 2, md: 3 },
                borderRadius: 'var(--lf-r-panel)',
                border: '1px solid var(--lf-hairline)',
                backgroundColor: 'var(--lf-paper)',
                position: { md: 'sticky' },
                top: { md: 'calc(var(--lf-nav-h) + 24px)' },
              }}
            >
              <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
                Details
              </Typography>

              {displayName && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="eyebrow" component="p" sx={{ color: 'var(--lf-ink-3)' }}>
                    Name
                  </Typography>
                  <Typography variant="body1">{displayName}</Typography>
                </Box>
              )}

              <Box sx={{ mb: 2 }}>
                <Typography variant="eyebrow" component="p" sx={{ color: 'var(--lf-ink-3)' }}>
                  Email
                </Typography>
                <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>
                  {user.email}
                </Typography>
                <Box sx={{ mt: 1 }}>
                  {isEmailVerified === true && (
                    <Chip
                      size="small"
                      color="success"
                      icon={<CheckCircleOutlineIcon />}
                      label="Email verified"
                    />
                  )}
                  {isEmailVerified === false && (
                    <Chip
                      size="small"
                      color="warning"
                      icon={<ErrorOutlineIcon />}
                      label="Email not verified"
                    />
                  )}
                  {isEmailVerified === null && (
                    <Chip size="small" variant="outlined" label="Verification state unknown" />
                  )}
                </Box>
              </Box>

              {user.phone_number && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="eyebrow" component="p" sx={{ color: 'var(--lf-ink-3)' }}>
                    Mobile
                  </Typography>
                  <Typography variant="body1" data-tnum="true">
                    {user.phone_number}
                  </Typography>
                </Box>
              )}

              {isEmailVerified === false && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <AlertTitle>Verify your email</AlertTitle>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Order updates and password resets go to this address, so it has to be
                    confirmed.
                  </Typography>
                  <Button
                    size="small"
                    onClick={handleResend}
                    aria-disabled={resending}
                    aria-busy={resending ? 'true' : undefined}
                    startIcon={
                      resending ? <CircularProgress size={16} thickness={3.6} color="inherit" /> : null
                    }
                    sx={{ ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
                  >
                    {resending ? 'Sending…' : 'Send a new link'}
                  </Button>
                </Alert>
              )}

              {resendNotice && (
                <Alert severity={resendNotice.severity} sx={{ mb: 2 }}>
                  {resendNotice.text}
                </Alert>
              )}

              <Divider sx={{ my: 2 }} />

              <Stack spacing={1}>
                <Button
                  variant="outlined"
                  component={RouterLink}
                  to="/orders"
                  startIcon={<ReceiptLongOutlinedIcon />}
                  fullWidth
                >
                  All my orders
                </Button>
                <Button variant="outlined" component={RouterLink} to="/wishlist" fullWidth>
                  My wishlist
                </Button>
                <SupportLink variant="button" topic="account" />
                {/* §5.8: one label per route. The nav item, the footer link and this
                    button all say Help; the route is still /faq. */}
                <Button variant="text" component={RouterLink} to={brand.support.faqPath}>
                  Help
                </Button>
                <Button variant="destructive" onClick={handleLogout} fullWidth>
                  Sign out
                </Button>
              </Stack>

              {/* TODO(business): the Privacy page promises account deletion, a
                  control this page does not have. §3 WP-12 either builds it or
                  rewords the policy to a written-request process — flagged here
                  so the two cannot silently disagree. */}
            </Box>
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="baseline"
              sx={{ mb: 2 }}
            >
              <Typography variant="h5" component="h2">
                Recent orders
              </Typography>
              {count > RECENT_COUNT && (
                <Button variant="text" component={RouterLink} to="/orders">
                  View all {count}
                </Button>
              )}
            </Stack>

            {loading && orders.length === 0 && (
              <Stack spacing={2} aria-hidden="true">
                {Array.from({ length: 2 }).map((_, index) => (
                  <Box
                    key={index}
                    sx={{
                      p: 3,
                      borderRadius: 'var(--lf-r-card)',
                      border: '1px solid var(--lf-hairline)',
                      backgroundColor: 'var(--lf-paper)',
                    }}
                  >
                    <Skeleton variant="text" width="40%" height={26} />
                    <Skeleton variant="text" width="25%" height={18} />
                  </Box>
                ))}
              </Stack>
            )}

            {!loading && error && (
              <ErrorState
                title="We could not load your orders"
                error={error}
                onRetry={load}
                secondaryLabel="Open my order history"
                secondaryTo="/orders"
              />
            )}

            {showEmptyOrders && (
              <EmptyState
                icon={<ReceiptLongOutlinedIcon />}
                title="No orders yet"
                message="When you place an order it will show up here."
                primaryLabel="Shop all skincare"
                primaryTo="/products"
                headingComponent="h3"
              >
                {railLoading || rail.length > 0 ? (
                  <Box component="section" aria-labelledby="profile-rail-heading">
                    <Typography
                      id="profile-rail-heading"
                      variant="h5"
                      component="h4"
                      sx={{ color: 'var(--lf-ink)', mb: 2 }}
                    >
                      In stock right now
                    </Typography>
                    {/* The RAIL, not the catalogue grid: this sits in the md:8
                        column, where §4.1's viewport-keyed 3-up would produce
                        ~225px cards — under the 288px floor the card's own
                        arithmetic depends on (§4.3). 300px tracks hold. */}
                    <Box className="lf-rail" sx={PRODUCT_RAIL_SX}>
                      {railLoading && rail.length === 0 ? (
                        <ProductCardSkeleton count={RAIL_SIZE} label="Loading products" />
                      ) : (
                        rail.map((product) => (
                          <ProductCard key={product.id ?? product.slug} product={product} />
                        ))
                      )}
                    </Box>
                  </Box>
                ) : null}
              </EmptyState>
            )}

            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </Grid>
      </Grid>
    </PageShell>
  );
};

export default Profile;
