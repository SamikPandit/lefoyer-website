/**
 * CircularProductSlider — the bestsellers rail.
 *
 * WHAT WAS WRONG: it called `getProducts()` (a helper that no longer exists in
 * the §2a api surface), read `response.data.results` by hand, sliced the first
 * five rows of an UNORDERED catalogue, swallowed every error into
 * `console.error`, and rendered a circular crop with no price, no availability
 * and no call to action. `IconButton` and `ArrowForwardIcon` were imported and
 * unused.
 *
 * WHAT IT IS NOW: a real merchandised rail — `getBestsellers({limit, 
 * include_out_of_stock:false})` (§2a / §2b #3), scroll-snapped via `.lf-rail`,
 * with desktop arrow buttons, a section heading, a "View all" affordance, and a
 * price plus an availability label on every tile. Loading, error and empty are
 * three distinct states.
 *
 * DEVIATION, REPORTED: IMPL_SPEC §3 WP-09's Home render list omits this
 * component while its per-file instructions require rebuilding it, and
 * DESIGN_SYSTEM §8 lists a "proof + bestsellers rail" as home section 7. Driving
 * it from `bestsellers` rather than `featured` is what keeps it from duplicating
 * the Curated Essentials rail three sections above it; "the same curated source"
 * in the spec is read as "a real merchandising endpoint instead of page 1 of the
 * catalogue".
 *
 * PRICE AND STOCK are formatted locally because `utils/stock.js` and
 * `components/common/PriceBlock` (DESIGN_SYSTEM §7) are not part of this
 * change-set's shared primitives. The derivation below is §2d exactly, so it
 * cannot disagree with the backend; it should move to the shared helpers the
 * moment they exist.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { Box, Container, IconButton, Link as MuiLink, Stack, Typography } from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { Link } from 'react-router-dom';

import ErrorState from '../common/ErrorState';
import { CURRENCY, effectivePrice, getBestsellers } from '../../services/api';

const RAIL_LIMIT = 8;

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

/**
 * §2d, verbatim: `in_stock` is the server's own sellable flag;
 * `available_quantity` already zeroes out for a manually disabled or
 * coming-soon product. Four states, each with words — never colour alone.
 */
const availability = (product) => {
  if (product.coming_soon) return { label: 'Coming soon', tone: 'var(--lf-warn-ink, #7A4F00)' };
  const quantity = product.available_quantity ?? product.stock_quantity;
  if (product.in_stock === false || Number(quantity) <= 0) {
    return { label: 'Out of stock', tone: 'var(--lf-err-ink, #A01C15)' };
  }
  if (Number(quantity) <= 5) {
    return { label: `Only ${Number(quantity)} left`, tone: 'var(--lf-warn-ink, #7A4F00)' };
  }
  return { label: 'In stock', tone: 'var(--lf-ok-ink, #15663D)' };
};

const RailTile = ({ product }) => {
  const stock = availability(product);
  const price = effectivePrice(product);

  return (
    <Box
      component={Link}
      to={`/product/${product.slug}`}
      className="lf-press"
      data-press="card"
      sx={{
        width: { xs: 200, md: 240 },
        textAlign: 'center',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <Box
        sx={{
          width: { xs: 200, md: 240 },
          height: { xs: 200, md: 240 },
          borderRadius: '50%',
          overflow: 'hidden',
          mb: 1.5,
          border: '1px solid var(--lf-hairline, #E7E0D6)',
          backgroundColor: 'var(--lf-surface-sunken, #F6F2EC)',
        }}
      >
        {product.image_main ? (
          <Box
            component="img"
            src={product.image_main}
            alt={product.name}
            loading="lazy"
            decoding="async"
            width={240}
            height={240}
            sx={{ width: '100%', height: '100%', objectFit: 'contain', p: '8%', display: 'block' }}
          />
        ) : null}
      </Box>

      <Typography
        variant="h5"
        component="h3"
        className="lf-clamp-2"
        sx={{ color: 'var(--lf-ink, #14110F)', minHeight: 45 }}
      >
        {product.name}
      </Typography>

      <Typography variant="price" component="p" sx={{ mt: 0.5, color: 'var(--lf-ink, #14110F)' }}>
        {inr.format(price)}
      </Typography>

      <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center" sx={{ mt: 0.5 }}>
        <Box
          aria-hidden="true"
          sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: stock.tone }}
        />
        <Typography variant="caption" sx={{ color: stock.tone }}>
          {stock.label}
        </Typography>
      </Stack>
    </Box>
  );
};

const TileSkeleton = () => (
  <Box aria-hidden="true" sx={{ width: { xs: 200, md: 240 } }}>
    <Box
      className="lf-skel lf-skel--media"
      sx={{ width: '100%', aspectRatio: '1 / 1', borderRadius: '50%' }}
    />
    <Box className="lf-skel lf-skel--text" sx={{ width: '80%', height: 14, mt: 2, mx: 'auto' }} />
    <Box className="lf-skel lf-skel--text" sx={{ width: '45%', height: 14, mt: 1, mx: 'auto' }} />
  </Box>
);

const CircularProductSlider = () => {
  /** 'loading' | 'error' | 'empty' | 'ready' */
  const [status, setStatus] = useState('loading');
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);
  const railRef = useRef(null);

  const load = useCallback(() => {
    let alive = true;
    setStatus('loading');
    setError(null);

    getBestsellers({ limit: RAIL_LIMIT, include_out_of_stock: false })
      .then(({ items }) => {
        if (!alive) return;
        const list = items || [];
        setProducts(list);
        setStatus(list.length === 0 ? 'empty' : 'ready');
      })
      .catch((err) => {
        if (!alive) return;
        setError(err);
        setStatus('error');
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(load, [load]);

  const nudge = (direction) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.round(rail.clientWidth * 0.9), behavior: 'smooth' });
  };

  // Nothing to merchandise: no rail. (The Curated Essentials section above
  // already tells the shopper, honestly, when the catalogue is empty.)
  if (status === 'empty') return null;

  return (
    <Box
      component="section"
      aria-labelledby="home-bestsellers-heading"
      sx={{ py: { xs: 5, md: 8 }, backgroundColor: 'var(--lf-canvas, #FDFBF9)' }}
    >
      <Container>
        <Stack
          direction="row"
          alignItems="flex-end"
          justifyContent="space-between"
          spacing={2}
          sx={{ mb: { xs: 3, md: 4 } }}
        >
          <Box>
            <Typography variant="overline" component="p" sx={{ color: 'var(--lf-gold-ink, #7A5A24)' }}>
              Bestsellers
            </Typography>
            <Typography
              id="home-bestsellers-heading"
              variant="h2"
              component="h2"
              sx={{ color: 'var(--lf-ink, #14110F)', mt: 0.5, mb: 1.5 }}
            >
              What leaves the shelf
            </Typography>
            <Box className="lf-rule" component="hr" sx={{ maxWidth: 160 }} />
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <MuiLink
              component={Link}
              to="/products"
              sx={{ whiteSpace: 'nowrap', color: 'var(--lf-ink, #14110F)' }}
            >
              View all
            </MuiLink>

            <Stack direction="row" spacing={0.5} sx={{ display: { xs: 'none', md: 'flex' } }}>
              <IconButton
                aria-label="Scroll bestsellers left"
                onClick={() => nudge(-1)}
                sx={{ border: '1px solid var(--lf-hairline, #E7E0D6)' }}
              >
                <ArrowBackIosNewIcon fontSize="small" />
              </IconButton>
              <IconButton
                aria-label="Scroll bestsellers right"
                onClick={() => nudge(1)}
                sx={{ border: '1px solid var(--lf-hairline, #E7E0D6)' }}
              >
                <ArrowForwardIosIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
        </Stack>

        {status === 'error' ? (
          <ErrorState
            title="We could not load the bestsellers"
            error={error}
            onRetry={load}
            secondaryLabel="Browse all products"
            secondaryTo="/products"
          />
        ) : (
          <Box
            ref={railRef}
            className="lf-rail"
            aria-busy={status === 'loading'}
            sx={{ pb: 1 }}
          >
            {status === 'loading'
              ? Array.from({ length: 4 }).map((_, index) => (
                  <TileSkeleton key={`bestseller-skeleton-${index}`} />
                ))
              : products.map((product) => (
                  <RailTile key={product.id ?? product.slug} product={product} />
                ))}
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default CircularProductSlider;
