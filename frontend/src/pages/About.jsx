/**
 * /about — LF-05 and LF-30.
 *
 * EVERY WORD ON THIS PAGE NOW COMES FROM `content/brand.js` OR `content/claims.js`.
 * What was deleted, and why (IMPL_SPEC §4 LF-05):
 *   - "Derma-tested … pigmentation, dryness, and sun damage" — an efficacy claim
 *     against three named concerns, with no study anywhere in the repository. The
 *     softened, substantiated form ("Dermatologist-tested formulations", skin
 *     safety only) now arrives from `claims.js` instead of being typed here.
 *   - "suitable for all skin and hair types" — withdrawn as a site-wide promise.
 *     Suitability is a per-SKU fact rendered from `Product.suitable_for` on the
 *     PDP, so the page states what each product actually claims.
 *   - The **State Emblem of India** image. Its commercial use is restricted under
 *     Indian law and the repo holds no authorisation, so §4 replaces it with a
 *     typographic "Made in India" mark — which is also the only form of the claim
 *     that is actually substantiated.
 *   - "true luxury", "grounded luxury", "as effective as they are indulgent" —
 *     unprovable superlatives, the same family as the withdrawn
 *     `superlative-quality` and `visible-outcome` claims in claims.js.
 *
 * THE RETAILER-FRAMING NOTE
 * WP-12's brief says to delete About's "Curating … natural beauty products"
 * retailer line, which contradicts "we are a modern cosmetic company".
 * `grep -rn "Curating" frontend/src` is **empty**: that sentence lived in the old
 * `Footer.jsx`, which wave 1 already rewrote. The surviving manufacturer framing
 * ("We are a modern cosmetic company") is the one kept here, which is the outcome
 * the instruction was after.
 *
 * THE LAYOUT BUG (fixed)
 * The "Welcome to the Hearth" `Grid container` held a single `md={6}` child, so
 * half of that row was empty at every desktop width — and because MUI 7.3.5
 * ignores `item`/`xs`/`md` entirely (C-3), the column widths were not applying in
 * the first place. The row now has two real columns on `size={{...}}`.
 *
 * TYPEFACES: the inline display-serif overrides on nine headings here are gone.
 * That family is no longer part of the system (DESIGN_SYSTEM §9.1) and index.html
 * never loaded it, so every one of those headings was already falling back to a
 * system face. The brand serif is deliberately NOT used on this page either: it
 * has exactly three licensed moments site-wide and they are spent elsewhere, so a
 * fourth use would be a regression against an explicit owner decision.
 */

import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PetsOutlinedIcon from '@mui/icons-material/PetsOutlined';
import HealthAndSafetyOutlinedIcon from '@mui/icons-material/HealthAndSafetyOutlined';
import SpaOutlinedIcon from '@mui/icons-material/SpaOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';

import SeoHead from '../components/common/SeoHead';
import { FOCUS_RING_SX, TOUCH_TARGET_SX } from '../components/common/EmptyState';
import { useBrand } from '../content/brand';
import { getClaim, useSubstantiatedClaims } from '../content/claims';
import { usePolicy } from '../content/policy';

/** `claims.js` ships `iconKey` as a string so it never imports an icon set. */
const CLAIM_ICONS = {
  india: PlaceOutlinedIcon,
  'cruelty-free': PetsOutlinedIcon,
  derm: HealthAndSafetyOutlinedIcon,
  botanical: SpaOutlinedIcon,
  generic: AutoAwesomeOutlinedIcon,
};

const SectionHeading = ({ children, id }) => (
  <>
    <Typography variant="h2" component="h2" id={id} sx={{ color: 'var(--lf-ink)' }}>
      {children}
    </Typography>
    <Box component="hr" className="lf-rule" sx={{ mt: 2, mb: 4, maxWidth: 96, mx: 'auto' }} />
  </>
);

const About = () => {
  const brand = useBrand();
  const { claims } = useSubstantiatedClaims();
  const { copy } = usePolicy();
  const madeInIndia = getClaim('made-in-india');

  return (
    <>
      <SeoHead
        title="Our story"
        description={brand.positioningStatement}
        canonical="/about"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          name: `About ${brand.seo.siteName}`,
          description: brand.positioningStatement,
          publisher: { '@type': 'Organization', name: brand.legalName },
        }}
      />

      <Box sx={{ backgroundColor: 'var(--lf-canvas)' }}>
        {/* ---------------------------------------------------------- hero */}
        <Container maxWidth="md" sx={{ py: { xs: 7, md: 12 }, textAlign: 'center' }}>
          <Typography variant="overline" sx={{ color: 'var(--lf-gold-ink)', display: 'block', mb: 2 }}>
            Our story
          </Typography>
          <Typography variant="h1" component="h1" sx={{ color: 'var(--lf-ink)', mb: 3 }}>
            The art of the everyday ritual
          </Typography>
          {/* The hearth/ritual territory, which §4 explicitly preserves. */}
          <Typography variant="subtitle1" sx={{ color: 'var(--lf-ink-2)', maxWidth: 560, mx: 'auto' }}>
            {brand.territoryLine}
          </Typography>
        </Container>

        {/* ------------------------------------------- made-in-india mark */}
        {madeInIndia ? (
          <Box
            sx={{
              py: { xs: 4, md: 5 },
              backgroundColor: 'var(--lf-surface)',
              borderTop: '1px solid var(--lf-hairline)',
              borderBottom: '1px solid var(--lf-hairline)',
              textAlign: 'center',
            }}
          >
            <Container maxWidth="md">
              <Typography variant="overline" sx={{ color: 'var(--lf-ink-3)', display: 'block' }}>
                {madeInIndia.label}
              </Typography>
              <Typography variant="h4" component="p" sx={{ color: 'var(--lf-ink)', mt: 1 }}>
                {madeInIndia.description}
              </Typography>
            </Container>
          </Box>
        ) : null}

        {/* ------------------------------------------------ welcome / hearth */}
        <Container maxWidth="lg" sx={{ py: { xs: 7, md: 11 } }}>
          <Grid container spacing={{ xs: 5, md: 8 }} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="h2" component="h2" sx={{ color: 'var(--lf-ink)', mb: 3 }}>
                Welcome to the hearth
              </Typography>
              <Typography variant="body1" paragraph sx={{ color: 'var(--lf-ink-2)', lineHeight: 1.9 }}>
                In French, <strong>{brand.wordmark}</strong> means &lsquo;the hearth&rsquo; — the heart
                of the home: a place of warmth, comfort and belonging. We started this
                company on a simple belief, that looking after your skin is one of the
                small, repeated acts of care a day is actually made of.
              </Typography>
              <Typography variant="body1" paragraph sx={{ color: 'var(--lf-ink-2)', lineHeight: 1.9 }}>
                We are a modern cosmetic company: we formulate and make what we sell,
                rather than reselling someone else&rsquo;s shelf. {brand.hero.subhead}
              </Typography>
              <Typography variant="body1" sx={{ color: 'var(--lf-ink-2)', lineHeight: 1.9 }}>
                {copy.d2cAdvantage}
              </Typography>
            </Grid>

            {/* The second column this row has been missing. It is a real panel
                with real facts, not a spacer: the positioning statement every
                other surface renders, plus the two policy numbers a first-time
                visitor actually wants, read from the single policy source. */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  p: { xs: 3, md: 4 },
                  backgroundColor: 'var(--lf-surface-sunken)',
                  borderRadius: 'var(--lf-r-panel)',
                }}
              >
                <Typography variant="overline" sx={{ color: 'var(--lf-gold-ink)', display: 'block', mb: 1.5 }}>
                  What we stand for
                </Typography>
                <Typography variant="h4" component="p" sx={{ color: 'var(--lf-ink)', mb: 3 }}>
                  {brand.positioningStatement}
                </Typography>

                <Stack spacing={1.25}>
                  <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
                    {copy.shippingLabel} · {copy.deliveryWindow}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
                    {copy.returnsWindow}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)' }}>
                    Full terms on our{' '}
                    <Box
                      component={RouterLink}
                      to="/shipping-returns"
                      sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}
                    >
                      delivery &amp; returns page
                    </Box>
                    .
                  </Typography>
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Container>

        {/* ------------------------------------------------------- the claims */}
        {claims.length > 0 ? (
          <Box sx={{ py: { xs: 7, md: 11 }, backgroundColor: 'var(--lf-surface)' }}>
            <Container maxWidth="lg">
              <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
                <SectionHeading>How we formulate</SectionHeading>
                <Typography
                  variant="body1"
                  sx={{ maxWidth: 560, mx: 'auto', color: 'var(--lf-ink-2)' }}
                >
                  These are the only claims we make, and each one is kept on a short
                  leash: if we cannot evidence it, it does not appear on this site.
                </Typography>
              </Box>

              <Grid container spacing={3}>
                {claims.map((claim) => {
                  const Icon = CLAIM_ICONS[claim.iconKey] || CLAIM_ICONS.generic;
                  return (
                    <Grid key={claim.id} size={{ xs: 12, sm: 6, md: 3 }}>
                      <Box
                        sx={{
                          height: '100%',
                          p: 3,
                          textAlign: 'center',
                          backgroundColor: 'var(--lf-surface-raised)',
                          border: '1px solid var(--lf-hairline)',
                          borderRadius: 'var(--lf-r-card)',
                        }}
                      >
                        <Box
                          aria-hidden="true"
                          sx={{
                            width: 56,
                            height: 56,
                            mx: 'auto',
                            mb: 2,
                            borderRadius: 'var(--lf-r-pill)',
                            backgroundColor: 'var(--lf-gold-tint)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            '& > svg': { fontSize: 26, color: 'var(--lf-gold-ink)' },
                          }}
                        >
                          <Icon />
                        </Box>
                        <Typography variant="h5" component="h3" sx={{ color: 'var(--lf-ink)', mb: 1 }}>
                          {claim.label}
                        </Typography>
                        {claim.description ? (
                          <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
                            {claim.description}
                          </Typography>
                        ) : null}
                        {claim.footnote ? (
                          <Typography variant="caption" component="p" sx={{ mt: 1.5, color: 'var(--lf-ink-3)' }}>
                            {claim.footnote}
                          </Typography>
                        ) : null}
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </Container>
          </Box>
        ) : null}

        {/* ------------------------------------------------------------ close */}
        <Box sx={{ py: { xs: 7, md: 11 }, backgroundColor: 'var(--lf-surface-sunken)', textAlign: 'center' }}>
          <Container maxWidth="md">
            <Typography variant="h3" component="p" sx={{ color: 'var(--lf-ink)' }}>
              Welcome to our hearth. Welcome home.
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              justifyContent="center"
              sx={{ mt: 4 }}
            >
              <Button
                className="lf-press"
                component={RouterLink}
                to={brand.hero.primaryCta.to}
                variant="contained"
                color="primary"
                disableElevation
                sx={{ px: 3, ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
              >
                {brand.hero.primaryCta.label}
              </Button>
              <Button
                className="lf-press"
                component={RouterLink}
                to={brand.support.contactPath}
                variant="outlined"
                sx={{ px: 3, ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
              >
                Talk to us
              </Button>
            </Stack>
          </Container>
        </Box>
      </Box>
    </>
  );
};

export default About;
