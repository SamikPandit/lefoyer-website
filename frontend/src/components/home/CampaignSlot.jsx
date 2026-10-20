/**
 * CampaignSlot — the one admin-driven slot on the homepage.
 *
 * LF-25: this replaces `NewYearBanner.jsx`, a 600px panel hardcoded to one
 * seasonal headline, still live in October because retiring it needed a deploy. The slot now renders `listHomeSections()` (§2a / §2b #36), and the
 * backend server-filters to `is_active AND starts_at <= now <= ends_at`
 * (backend/content/views.py HomeSectionsView), treating a null bound as
 * open-ended. A campaign therefore starts and retires on a date in the admin,
 * with no code change and no deploy.
 *
 * KIND FILTER — DOCUMENTED DISCREPANCY. IMPL_SPEC §3 WP-09 says filter to
 * `kind in ('campaign','editorial')`. The shipped model has no `campaign`
 * choice: `content.HomeSection.KIND_CHOICES` is hero / banner / product_rail /
 * editorial / category_grid / concern_grid / testimonials / newsletter. Per the
 * brief's "where a document and the code disagree, the CODE wins", this filters
 * to the real promotional kinds — `banner` and `editorial` — and keeps
 * `campaign` in the set so that if the choice is added later it renders here
 * without another frontend change.
 *
 * FALLBACK: when nothing is scheduled (the normal state), when the content app
 * is not deployed yet, or when the request fails, the slot renders an evergreen
 * editorial block built from `brand.js` — the brand's own territory line and
 * positioning statement, which assert nothing unsubstantiated (§4 LF-05). The
 * homepage never shows a hole where a campaign used to be, and never shows an
 * error panel for a decorative module.
 *
 * TYPOGRAPHY: this is the single home interstitial that may use Fraunces
 * (`variant="brandDisplay"`), which is DESIGN_SYSTEM §2.2's second of three
 * licensed uses, on `.lf-ink-section` where the gold tokens are redefined to
 * 8.4:1 and are legible as text.
 */

import { useEffect, useState } from 'react';

import { Box, Button, Container, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

import { useBrand } from '../../content/brand';
import { listHomeSections } from '../../services/api';

/** The kinds that belong in this slot. See the header note on `campaign`. */
const SLOT_KINDS = ['campaign', 'banner', 'editorial'];

/** An in-app path routes client-side; anything else is left to the browser. */
const isInternal = (target) => typeof target === 'string' && target.startsWith('/');

const CampaignSlot = () => {
  const brand = useBrand();
  const [section, setSection] = useState(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let alive = true;

    listHomeSections()
      .then(({ items }) => {
        if (!alive) return;
        const candidates = (items || [])
          .filter((item) => SLOT_KINDS.includes(item.kind))
          .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
        setSection(candidates[0] || null);
        setResolved(true);
      })
      .catch(() => {
        // A decorative slot does not get an error panel: the evergreen block
        // below is a complete, honest module in its own right.
        if (!alive) return;
        setSection(null);
        setResolved(true);
      });

    return () => {
      alive = false;
    };
  }, []);

  /* Nothing renders until the request settles. Showing the evergreen block
     first and then swapping in a campaign headline would rewrite a heading
     under the reader; this section is below the fold, so waiting costs nothing
     above it. */
  if (!resolved) return null;

  const heading = section && section.title ? section.title : brand.territoryLine;
  const subtitle = section ? section.subtitle : null;
  const body = section && section.body ? section.body : brand.positioningStatement;
  const image = section ? section.image : null;
  const ctaLabel = section && section.cta_label ? section.cta_label : 'Shop all products';
  const ctaTarget = section && section.cta_target ? section.cta_target : '/products';

  const ctaProps = isInternal(ctaTarget)
    ? { component: Link, to: ctaTarget }
    : { component: 'a', href: ctaTarget, rel: 'noopener' };

  return (
    <Box
      component="section"
      className="lf-ink-section"
      aria-labelledby="home-campaign-heading"
      sx={{
        backgroundColor: 'var(--lf-canvas, #14110F)',
        color: 'var(--lf-ink, #F7F4F0)',
        py: { xs: 6, md: 10 },
      }}
    >
      <Container>
        <Box sx={{ maxWidth: 720 }}>
          {subtitle ? (
            <Typography
              variant="overline"
              component="p"
              sx={{ color: 'var(--lf-gold-ink, #E3C78C)', mb: 1 }}
            >
              {subtitle}
            </Typography>
          ) : null}

          <Typography
            id="home-campaign-heading"
            variant="brandDisplay"
            component="h2"
            sx={{ color: 'var(--lf-ink, #F7F4F0)', mb: 2 }}
          >
            {heading}
          </Typography>

          <Typography
            variant="body1"
            sx={{ color: 'var(--lf-ink-2, #D3CBC2)', mb: 3, maxWidth: 560 }}
          >
            {body}
          </Typography>

          <Button
            {...ctaProps}
            variant="outlined"
            className="lf-press"
            sx={{
              minHeight: 48,
              px: 4,
              borderColor: 'var(--lf-border-ink, #F7F4F0)',
              color: 'var(--lf-ink, #F7F4F0)',
              '@media (hover:hover)': {
                '&:hover': {
                  backgroundColor: 'var(--lf-ink, #F7F4F0)',
                  color: 'var(--lf-on-ink, #14110F)',
                  borderColor: 'var(--lf-border-ink, #F7F4F0)',
                },
              },
            }}
          >
            {ctaLabel}
          </Button>
        </Box>

        {image ? (
          <Box
            sx={{
              mt: { xs: 4, md: 6 },
              borderRadius: 'var(--lf-r-media, 24px)',
              overflow: 'hidden',
              aspectRatio: { xs: '4 / 5', sm: '16 / 9', md: '21 / 9' },
              backgroundColor: 'var(--lf-surface-sunken, #211E1B)',
            }}
          >
            <Box
              component="img"
              src={image}
              /* The campaign's own words describe it; an invented alt would be
                 worse than none, so the heading carries the meaning and the
                 image is presentational when the admin gave no text. */
              alt={section && section.title ? section.title : ''}
              loading="lazy"
              decoding="async"
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </Box>
        ) : null}
      </Container>
    </Box>
  );
};

export default CampaignSlot;
