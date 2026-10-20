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
 */

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
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import SeoHead from '../components/common/SeoHead';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import SupportLink from '../components/common/SupportLink';
import OrderCard from '../components/order/OrderCard';
import { useAuth } from '../context/AuthContext';
import { getApiErrorMessage, listOrders, resendVerification } from '../services/api';
import { useBrand } from '../content/brand';

const RECENT_COUNT = 3;

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
    if (!user?.email) return;
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
      <Container maxWidth="sm" sx={{ py: 8 }}>
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
      </Container>
    );
  }

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ');

  return (
    <Box sx={{ backgroundColor: 'var(--lf-canvas)', py: { xs: 4, md: 7 } }}>
      <SeoHead title="My account" noindex description="Your account and recent orders." />
      <Container maxWidth="lg">
        <Typography variant="h3" component="h1" sx={{ mb: 3 }}>
          My account
        </Typography>

        <Grid container spacing={{ xs: 3, md: 4 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Box
              sx={{
                p: { xs: 2, md: 3 },
                borderRadius: 'var(--lf-r-panel)',
                border: '1px solid var(--lf-hairline)',
                backgroundColor: 'var(--lf-surface)',
                boxShadow: 'var(--lf-e-edge), var(--lf-e1)',
                position: { md: 'sticky' },
                top: { md: 'calc(var(--lf-nav-h) + 24px)' },
              }}
            >
              <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
                Details
              </Typography>

              {displayName && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="overline" sx={{ color: 'var(--lf-ink-3)' }}>
                    Name
                  </Typography>
                  <Typography variant="body1">{displayName}</Typography>
                </Box>
              )}

              <Box sx={{ mb: 2 }}>
                <Typography variant="overline" sx={{ color: 'var(--lf-ink-3)' }}>
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
                  <Typography variant="overline" sx={{ color: 'var(--lf-ink-3)' }}>
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
                    disabled={resending}
                    startIcon={resending ? <CircularProgress size={16} /> : null}
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
                <Button variant="text" component={RouterLink} to={brand.support.faqPath}>
                  Read the FAQ
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
                      backgroundColor: 'var(--lf-surface)',
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

            {!loading && !error && orders.length === 0 && (
              <EmptyState
                icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 28 }} />}
                title="No orders yet"
                message="When you place an order it will show up here."
                primaryLabel="Shop all skincare"
                primaryTo="/products"
              />
            )}

            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Profile;
