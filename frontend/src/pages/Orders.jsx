/**
 * Orders — the paginated order history (new page).
 *
 * WHY IT EXISTS
 * `Profile.jsx` was the only place an order could be reached, it read page 1 of
 * a paginated list, and it showed no pagination — so the eleventh order was
 * unreachable forever. That matters more than it sounds: the order page is the
 * ONLY route to payment recovery. An order whose payment failed can be retried
 * from its own page and nowhere else, so an unreachable order is an unreachable
 * recovery and, in practice, a lost sale with the customer's stock still held.
 *
 * The page number lives in the URL (`/orders?page=2`), so the browser's Back
 * button walks the history rather than dumping the shopper on page 1.
 *
 * NOTE ON PAGE SIZE: `/api/orders/` uses DRF's global `PageNumberPagination`
 * with `PAGE_SIZE: 10` and does NOT set `page_size_query_param` (verified in
 * `lefoyer/settings.py:243-244` — only the catalogue viewsets have a custom
 * paginator). Sending `page_size` would be silently ignored, so the constant
 * below mirrors the server's value and is used only to turn `count` into a page
 * count. It is never sent.
 *
 * ALCOVE (ART_DIRECTION.md §5.9): the UTILITY archetype — `h3` as the `h1`,
 * left aligned, `py: var(--lf-sect)` — so "My orders", "Saved items" and "My
 * account", three pages of the same kind reached from the same menu, stop
 * rendering at three different heading sizes (§2.34).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Pagination from '@mui/material/Pagination';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { useSearchParams } from 'react-router-dom';

import SeoHead from '../components/common/SeoHead';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import OrderCard from '../components/order/OrderCard';
import { listOrders } from '../services/api';

/** Mirrors DRF's global PAGE_SIZE. Never sent as a parameter — see the header. */
const SERVER_PAGE_SIZE = 10;

const AWAITING = new Set(['PENDING', 'FAILED']);

/** §3.10 — the `thumb` surface caps the niche at 72px of height. */
const THUMB_NICHE_W = 'calc(72px / var(--lf-arch-ratio))';

/* P5 / CLS: the placeholder draws the ARCH at the real row's size, because
   <OrderCard> now stands its thumbnails in niches. A rounded 56px rectangle
   where a 72px niche is about to appear is a layout shift with extra steps. */
const OrdersSkeleton = () => (
  <Stack spacing={2} aria-hidden="true">
    {Array.from({ length: 3 }).map((_, index) => (
      <Box
        key={index}
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 'var(--lf-r-card)',
          border: '1px solid var(--lf-hairline)',
          backgroundColor: 'var(--lf-paper)',
        }}
      >
        <Skeleton variant="text" width="38%" height={26} />
        <Skeleton variant="text" width="24%" height={18} />
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          {Array.from({ length: 3 }).map((__, thumb) => (
            <Box
              key={thumb}
              className="lf-skel lf-skel--alcove lf-skel--media"
              sx={{ flex: 'none', width: THUMB_NICHE_W }}
            />
          ))}
        </Stack>
      </Box>
    ))}
  </Stack>
);

const Orders = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawPage = Number(searchParams.get('page'));
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.trunc(rawPage) : 1;

  const [orders, setOrders] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { items, count: total } = await listOrders({ page });
      setOrders(Array.isArray(items) ? items : []);
      setCount(Number(total) || 0);
      setError(null);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil((count || 0) / SERVER_PAGE_SIZE)),
    [count]
  );

  const awaitingPayment = orders.filter((order) =>
    AWAITING.has(String(order.payment_status || '').toUpperCase())
  );

  const handlePageChange = (_event, nextPage) => {
    const params = new URLSearchParams(searchParams);
    if (nextPage <= 1) params.delete('page');
    else params.set('page', String(nextPage));
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Box sx={{ backgroundColor: 'var(--lf-canvas)', py: 'var(--lf-sect)' }}>
      <SeoHead title="My orders" noindex description="Your order history." />
      <Container maxWidth="lg">
        <Typography variant="h3" component="h1" sx={{ mb: 1 }}>
          My orders
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)', mb: 3 }}>
          {count > 0
            ? `${count} order${count === 1 ? '' : 's'} · page ${page} of ${pageCount}`
            : 'Every order you place appears here.'}
        </Typography>

        {/* The recovery entry point, surfaced rather than buried. */}
        {awaitingPayment.length > 0 && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <AlertTitle>
              {awaitingPayment.length === 1
                ? 'One order is still awaiting payment'
                : `${awaitingPayment.length} orders are still awaiting payment`}
            </AlertTitle>
            Nothing has been charged for{' '}
            {awaitingPayment.map((order) => order.order_number || `#${order.id}`).join(', ')}. You
            can complete the payment from the order below — the items are still reserved for you
            as the order stands.
          </Alert>
        )}

        {loading && orders.length === 0 && <OrdersSkeleton />}

        {!loading && error && (
          <ErrorState
            variant="page"
            headingComponent="h2"
            title="We could not load your orders"
            error={error}
            onRetry={load}
            secondaryLabel="Browse all products"
            secondaryTo="/products"
          />
        )}

        {!loading && !error && orders.length === 0 && (
          <EmptyState
            variant="page"
            headingComponent="h2"
            icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 28 }} />}
            title={page > 1 ? 'Nothing on this page' : 'No orders yet'}
            message={
              page > 1
                ? 'That page is past the end of your history.'
                : 'When you place an order it will show up here, with its payment and delivery state.'
            }
            primaryLabel={page > 1 ? 'Back to the first page' : 'Shop all skincare'}
            primaryTo={page > 1 ? '/orders' : '/products'}
          />
        )}

        {orders.length > 0 && (
          <Box sx={{ opacity: loading ? 0.72 : 1, transition: 'opacity var(--lf-dur-2) var(--lf-ease)' }}>
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </Box>
        )}

        {pageCount > 1 && (
          <Stack alignItems="center" sx={{ mt: 4 }}>
            <Pagination
              count={pageCount}
              page={Math.min(page, pageCount)}
              onChange={handlePageChange}
              disabled={loading}
              aria-label="Order history pages"
            />
          </Stack>
        )}
      </Container>
    </Box>
  );
};

export default Orders;
