/**
 * FeaturedProducts — the "Curated Essentials" rail.
 *
 * LF-02 / LF-20 (IMPL_SPEC §1 C-5): this rail used to send `{is_featured:true}`
 * to `products/products/`, whose filter does not declare that field, so
 * django-filter dropped it silently and the rail was page 1 of the UNORDERED
 * catalogue sliced to three client-side. It now calls the real merchandising
 * endpoint — `getFeaturedProducts({limit:3, include_out_of_stock:false})`
 * (§2a / §2b #2) — which returns at most three sellable products in
 * `display_order`. No client-side slicing: whatever the server curated is what
 * renders.
 *
 * STATES, and why they matter here: the previous version returned `null` both
 * when the API was down and when the catalogue was empty, so an outage was
 * indistinguishable from "nothing featured" — the section simply vanished.
 * Now: three card skeletons while loading, an ErrorState with Retry on failure,
 * and a distinct empty state that still gets the shopper into the catalogue.
 *
 * LF-05: the old copy promised "transformative results" and "uncompromising
 * quality". Both are withdrawn claim families (claims.js `visible-outcome`,
 * `superlative-quality`). The replacement states only what the merchandising
 * data actually says: these are the products the shop leads with.
 */

import { useCallback, useEffect, useState } from 'react';

import { Box, Button, Container, Grid, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import ProductCardSkeleton from '../common/ProductCardSkeleton';
import ProductCard from '../product/ProductCard';
import { getFeaturedProducts } from '../../services/api';

const FEATURED_LIMIT = 3;

const FeaturedProducts = () => {
  /** 'loading' | 'error' | 'empty' | 'ready' */
  const [status, setStatus] = useState('loading');
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    let alive = true;
    setStatus('loading');
    setError(null);

    getFeaturedProducts({ limit: FEATURED_LIMIT, include_out_of_stock: false })
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

  return (
    <Box
      component="section"
      aria-labelledby="home-featured-heading"
      sx={{ py: { xs: 5, md: 8 }, backgroundColor: 'var(--lf-canvas, #FDFBF9)' }}
    >
      <Container>
        <Grid container spacing={{ xs: 3, md: 5 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography
              variant="overline"
              component="p"
              sx={{ color: 'var(--lf-gold-ink, #7A5A24)' }}
            >
              Curated essentials
            </Typography>
            <Typography
              id="home-featured-heading"
              variant="h2"
              component="h2"
              sx={{ color: 'var(--lf-ink, #14110F)', mt: 0.5, mb: 1.5 }}
            >
              The short shelf
            </Typography>
            <Box className="lf-rule" component="hr" sx={{ maxWidth: 160, mb: 2 }} />

            <Typography variant="body2" sx={{ color: 'var(--lf-ink-2, #4A433C)', mb: 2.5 }}>
              The formulations we lead with right now, in the order our shop keeps them.
              The full range is one tap away.
            </Typography>

            <Button
              component={Link}
              to="/products"
              variant="outlined"
              className="lf-press"
              sx={{ minHeight: 44 }}
            >
              View all products
            </Button>
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            {status === 'error' ? (
              <ErrorState
                title="We could not load these products"
                error={error}
                onRetry={load}
                secondaryLabel="Browse all products"
                secondaryTo="/products"
              />
            ) : status === 'empty' ? (
              <EmptyState
                title="Nothing is featured just now"
                message="The shelf is being restocked. The full catalogue is still open."
                primaryLabel="Browse all products"
                primaryTo="/products"
              />
            ) : (
              <Grid container spacing={2} aria-busy={status === 'loading'}>
                {status === 'loading'
                  ? Array.from({ length: FEATURED_LIMIT }).map((_, index) => (
                      <Grid
                        key={`featured-skeleton-${index}`}
                        size={{ xs: 12, sm: 6, md: 4 }}
                      >
                        <ProductCardSkeleton count={1} announce={index === 0} />
                      </Grid>
                    ))
                  : products.map((product) => (
                      <Grid key={product.id ?? product.slug} size={{ xs: 12, sm: 6, md: 4 }}>
                        <ProductCard product={product} />
                      </Grid>
                    ))}
              </Grid>
            )}
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default FeaturedProducts;
