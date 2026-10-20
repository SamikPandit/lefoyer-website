/**
 * ProductCategories — "Shop by category", directly under the hero.
 *
 * LF-24: Home.jsx imported this component and rendered it nowhere, so no
 * product group was reachable from the homepage. It now renders, and it renders
 * the LIVE taxonomy:
 *   - tiles come from `listCategories()` (§2a / §2b #9), never a hardcoded array;
 *   - a category is rendered ONLY when `product_count > 0`, so a tile can never
 *     land on an empty listing (IMPL_SPEC §1 C-10);
 *   - the three Unsplash URLs are gone, and so is the hardcoded `body-care`
 *     slug — the real Category slug is `body-lip-care`, which is exactly why
 *     hardcoding taxonomy is forbidden here;
 *   - a category with no admin image gets a typographic brand tile, not stock
 *     photography and not a broken <img>.
 *
 * STATES: skeleton → (error with Retry | tiles). Zero renderable categories
 * renders NOTHING: on a catalogue with nothing sellable, silence is correct and
 * a grid of dead links is not.
 */

import { useCallback, useEffect, useState } from 'react';

import { Box, Card, CardActionArea, Container, Grid, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

import ErrorState from '../common/ErrorState';
import { listCategories } from '../../services/api';

const SKELETON_TILES = 3;

const CategoryTile = ({ category }) => {
  const { name, slug, image, product_count: productCount } = category;

  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea
        component={Link}
        to={`/products?category=${encodeURIComponent(slug)}`}
        className="lf-press"
        data-press="card"
        sx={{ display: 'block', height: '100%' }}
      >
        <Box
          sx={{
            position: 'relative',
            aspectRatio: '4 / 5',
            backgroundColor: 'var(--lf-surface-sunken, #F6F2EC)',
            overflow: 'hidden',
          }}
        >
          {image ? (
            <>
              <Box
                component="img"
                src={image}
                alt={name}
                loading="lazy"
                decoding="async"
                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              {/* Bottom-anchored scrim so the label keeps its contrast over art. */}
              <Box
                aria-hidden="true"
                sx={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(to top, rgba(20,17,15,0.72) 0%, rgba(20,17,15,0.28) 46%, rgba(20,17,15,0) 72%)',
                }}
              />
            </>
          ) : (
            /* No admin image: the brand tile. Honest, and it cannot 404. */
            <Box
              aria-hidden="true"
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                px: 3,
                textAlign: 'center',
              }}
            >
              <Typography
                variant="h3"
                component="span"
                sx={{ color: 'var(--lf-ink-3, #6E675F)' }}
              >
                {name}
              </Typography>
            </Box>
          )}

          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              p: { xs: 2, md: 2.5 },
            }}
          >
            <Typography
              variant="h4"
              component="h3"
              sx={{ color: image ? 'var(--lf-on-ink, #FFFFFF)' : 'var(--lf-ink, #14110F)' }}
            >
              {name}
            </Typography>
            <Typography
              variant="caption"
              component="p"
              sx={{
                mt: 0.5,
                color: image ? 'rgba(255,255,255,0.86)' : 'var(--lf-ink-2, #4A433C)',
              }}
            >
              {productCount === 1 ? '1 product' : `${productCount} products`}
            </Typography>
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
};

const TileSkeleton = () => (
  <Box
    aria-hidden="true"
    className="lf-skel lf-skel--media"
    sx={{
      aspectRatio: '4 / 5',
      borderRadius: 'var(--lf-r-card, 14px)',
      border: '1px solid var(--lf-hairline, #E7E0D6)',
    }}
  />
);

const ProductCategories = () => {
  /** 'loading' | 'error' | 'ready' */
  const [status, setStatus] = useState('loading');
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    let alive = true;
    setStatus('loading');
    setError(null);

    listCategories()
      .then(({ items }) => {
        if (!alive) return;
        setCategories(
          (items || []).filter((category) => Number(category.product_count) > 0),
        );
        setStatus('ready');
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

  // Nothing sellable anywhere: render no section at all rather than dead links.
  if (status === 'ready' && categories.length === 0) return null;

  return (
    <Box
      component="section"
      aria-labelledby="home-categories-heading"
      sx={{ py: { xs: 5, md: 8 }, backgroundColor: 'var(--lf-canvas, #FDFBF9)' }}
    >
      <Container>
        <Box sx={{ mb: { xs: 3, md: 4 } }}>
          <Typography variant="overline" component="p" sx={{ color: 'var(--lf-gold-ink, #7A5A24)' }}>
            Shop by category
          </Typography>
          <Typography
            id="home-categories-heading"
            variant="h2"
            component="h2"
            sx={{ color: 'var(--lf-ink, #14110F)', mt: 0.5, mb: 1.5 }}
          >
            Start with a shelf
          </Typography>
          <Box className="lf-rule" component="hr" sx={{ maxWidth: 160 }} />
        </Box>

        {status === 'error' ? (
          <ErrorState
            title="We could not load the categories"
            error={error}
            onRetry={load}
            secondaryLabel="Browse all products"
            secondaryTo="/products"
          />
        ) : (
          <Grid container spacing={2} aria-busy={status === 'loading'}>
            {status === 'loading'
              ? Array.from({ length: SKELETON_TILES }).map((_, index) => (
                  <Grid key={`category-skeleton-${index}`} size={{ xs: 12, sm: 6, md: 4 }}>
                    <TileSkeleton />
                  </Grid>
                ))
              : categories.map((category) => (
                  <Grid key={category.id ?? category.slug} size={{ xs: 12, sm: 6, md: 4 }}>
                    <CategoryTile category={category} />
                  </Grid>
                ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
};

export default ProductCategories;
