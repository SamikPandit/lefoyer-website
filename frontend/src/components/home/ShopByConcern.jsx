/**
 * ShopByConcern — "Shop by concern", under the category grid.
 *
 * LF-24: like ProductCategories, this component was imported by Home.jsx and
 * rendered nowhere. It now renders, from the live `listConcerns()` endpoint
 * (§2a / §2b #7), and every card links to `/products?concern=<slug>`.
 *
 * NO INVENTED CONCERNS. Two of the six hardcoded cards named concern slugs that
 * exist nowhere in the catalogue and only ever existed in that dead array;
 * backend migration products/0008 derives Concern rows 1:1 from real
 * sub-categories and keeps those two slugs on a refusal list. A concern is rendered only when
 * `product_count > 0`, so a card can never land on an empty listing.
 *
 * DEAD CODE REMOVED: the `requestAnimationFrame` effect that computed a scroll
 * offset and then returned without ever using it, the `scrollRef` it never
 * attached, the `isPaused` state nothing ever set, and the 40s infinite
 * auto-scroll (pausable on hover only — unusable on touch, WCAG 2.2.2). The
 * grid is static; nothing moves, so nothing needs pausing.
 *
 * `icon_key` is a string key, mapped here. Backend 0008 seeds it equal to the
 * concern slug; an unknown key falls back to a neutral glyph rather than
 * breaking the row.
 */

import { useCallback, useEffect, useState } from 'react';

import { Box, Card, CardActionArea, Container, Grid, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import ContentCutOutlinedIcon from '@mui/icons-material/ContentCutOutlined';
import FaceRetouchingNaturalOutlinedIcon from '@mui/icons-material/FaceRetouchingNaturalOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import SpaOutlinedIcon from '@mui/icons-material/SpaOutlined';
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined';
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined';

import ErrorState from '../common/ErrorState';
import { listConcerns } from '../../services/api';

/** icon_key -> glyph. Keys are the seeded concern slugs (products/0008). */
const ICONS = {
  cleansers: WaterDropOutlinedIcon,
  'brightening-anti-pigmentation': AutoAwesomeOutlinedIcon,
  'moisturizers-hydrators': SpaOutlinedIcon,
  'sun-protection': WbSunnyOutlinedIcon,
  'serums-treatments': ScienceOutlinedIcon,
  'shampoo-conditioner': ContentCutOutlinedIcon,
  'body-care': SpaOutlinedIcon,
  'lip-care': FaceRetouchingNaturalOutlinedIcon,
};

const SKELETON_CARDS = 4;

const ConcernCard = ({ concern }) => {
  const { name, slug, description, icon_key: iconKey } = concern;
  const Icon = ICONS[iconKey] || ICONS[slug] || SpaOutlinedIcon;

  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea
        component={Link}
        to={`/products?concern=${encodeURIComponent(slug)}`}
        className="lf-press"
        data-press="card"
        sx={{
          height: '100%',
          p: { xs: 2, md: 2.5 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 1.25,
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--lf-gold-tint, #F7F0E2)',
            color: 'var(--lf-gold-ink, #7A5A24)',
          }}
        >
          <Icon sx={{ fontSize: 24 }} />
        </Box>

        <Typography variant="h5" component="h3" sx={{ color: 'var(--lf-ink, #14110F)' }}>
          {name}
        </Typography>

        {description ? (
          <Typography
            variant="body2"
            className="lf-clamp-2"
            sx={{ color: 'var(--lf-ink-2, #4A433C)' }}
          >
            {description}
          </Typography>
        ) : null}
      </CardActionArea>
    </Card>
  );
};

const ConcernSkeleton = () => (
  <Box
    aria-hidden="true"
    sx={{
      height: 168,
      borderRadius: 'var(--lf-r-card, 14px)',
      border: '1px solid var(--lf-hairline, #E7E0D6)',
      backgroundColor: 'var(--lf-surface, #FFFFFF)',
      p: 2.5,
    }}
  >
    <Box className="lf-skel lf-skel--text" sx={{ width: 44, height: 44, borderRadius: '50%' }} />
    <Box className="lf-skel lf-skel--text" sx={{ width: '70%', height: 14, mt: 2 }} />
    <Box className="lf-skel lf-skel--text" sx={{ width: '90%', height: 12, mt: 1.25 }} />
  </Box>
);

const ShopByConcern = () => {
  /** 'loading' | 'error' | 'ready' */
  const [status, setStatus] = useState('loading');
  const [concerns, setConcerns] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    let alive = true;
    setStatus('loading');
    setError(null);

    listConcerns()
      .then(({ items }) => {
        if (!alive) return;
        setConcerns((items || []).filter((concern) => Number(concern.product_count) > 0));
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

  // No concern is backed by a sellable product: no section.
  if (status === 'ready' && concerns.length === 0) return null;

  return (
    <Box
      component="section"
      aria-labelledby="home-concerns-heading"
      sx={{ py: { xs: 5, md: 8 }, backgroundColor: 'var(--lf-surface, #FFFFFF)' }}
    >
      <Container>
        <Box sx={{ mb: { xs: 3, md: 4 } }}>
          <Typography variant="overline" component="p" sx={{ color: 'var(--lf-gold-ink, #7A5A24)' }}>
            Shop by concern
          </Typography>
          <Typography
            id="home-concerns-heading"
            variant="h2"
            component="h2"
            sx={{ color: 'var(--lf-ink, #14110F)', mt: 0.5, mb: 1.5 }}
          >
            What are you looking after?
          </Typography>
          <Box className="lf-rule" component="hr" sx={{ maxWidth: 160 }} />
        </Box>

        {status === 'error' ? (
          <ErrorState
            title="We could not load these groups"
            error={error}
            onRetry={load}
            secondaryLabel="Browse all products"
            secondaryTo="/products"
          />
        ) : (
          <Grid container spacing={2} aria-busy={status === 'loading'}>
            {status === 'loading'
              ? Array.from({ length: SKELETON_CARDS }).map((_, index) => (
                  <Grid key={`concern-skeleton-${index}`} size={{ xs: 12, sm: 6, md: 3 }}>
                    <ConcernSkeleton />
                  </Grid>
                ))
              : concerns.map((concern) => (
                  <Grid key={concern.id ?? concern.slug} size={{ xs: 12, sm: 6, md: 3 }}>
                    <ConcernCard concern={concern} />
                  </Grid>
                ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
};

export default ShopByConcern;
