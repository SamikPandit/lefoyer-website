/**
 * Hero — the first viewport.
 *
 * LF-03 (IMPL_SPEC §1 C-12): the previous hero had its only CTA inside a
 * `/* *\/` comment, with `Button` and `Link` imported and unused, so nothing
 * above the fold was clickable at any breakpoint. The primary CTA below is
 * real, 48px tall, and sits directly under the subhead.
 *
 * LF-05 / §4: every word here comes from `content/brand.js`. The old headline's
 * primacy claim and the old subhead's outcome guarantee are both withdrawn
 * (claims.js ids `indias-first` and `guaranteed-outcome`, which record exactly
 * what evidence would switch each one back on) and must not be reintroduced
 * here or anywhere else.
 *
 * NO HERO IMAGE, DELIBERATELY. DESIGN_SYSTEM §8 sketches a 7/5 media hero with
 * a floating purchase card; this repository contains no hero asset — the only
 * real photography is 1.18-6.10 MB product PNGs (AGENT_BRIEF "Environment
 * facts"), and shipping one of those into the first viewport would cost more
 * than the layout gains. A typographic hero on the warm canvas is the honest
 * version until art exists. Reported as a deviation, not hidden.
 *
 * FIRST-VIEWPORT BUDGET at 360x667 (iPhone SE):
 *   nav 56 + marquee ~44 + section padding 2x32 + headline ~2 lines 72
 *   + subhead ~4 lines 90 + gap 16 + CTA row 48  =  ~418px.  Clears 667 with
 *   room for the sticky bar, so "Shop Skincare" is visible without scrolling.
 */

import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

import { useBrand } from '../../content/brand';

const Hero = () => {
  const brand = useBrand();
  const { headline, subhead, primaryCta, secondaryCta } = brand.hero;

  return (
    <Box
      component="section"
      aria-labelledby="home-hero-heading"
      sx={{
        backgroundColor: 'var(--lf-canvas, #FDFBF9)',
        borderBottom: '1px solid var(--lf-hairline, #E7E0D6)',
        py: { xs: 4, sm: 6, md: 10 },
      }}
    >
      <Container>
        <Box sx={{ maxWidth: 760, mx: 'auto', textAlign: 'center' }}>
          <Typography
            id="home-hero-heading"
            variant="h1"
            component="h1"
            sx={{ color: 'var(--lf-ink, #14110F)', mb: { xs: 1.5, md: 2 } }}
          >
            {headline}
          </Typography>

          <Typography
            variant="subtitle1"
            component="p"
            sx={{
              color: 'var(--lf-ink-2, #4A433C)',
              maxWidth: 560,
              mx: 'auto',
              mb: { xs: 2.5, md: 3 },
            }}
          >
            {subhead}
          </Typography>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            justifyContent="center"
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <Button
              component={Link}
              to={primaryCta.to}
              variant="contained"
              className="lf-press"
              sx={{ minHeight: 48, px: 4 }}
            >
              {primaryCta.label}
            </Button>

            <Button
              component={Link}
              to={secondaryCta.to}
              variant="outlined"
              className="lf-press"
              sx={{ minHeight: 48, px: 4 }}
            >
              {secondaryCta.label}
            </Button>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default Hero;
