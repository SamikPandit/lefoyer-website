/**
 * Benefits — the four-claim proof row.
 *
 * LF-05: the hardcoded benefit cards asserted a safety-AND-performance testing
 * line, a sitewide universal-suitability promise, a superlative-quality boast
 * and a visible-outcome promise (claims.js ids `universal-suitability`,
 * `superlative-quality`, `visible-outcome`). This repository contains zero
 * substantiation for any of them, so §4 withdrew them. This component now
 * renders `substantiatedClaims()` and nothing else — the softened
 * "Dermatologist-tested formulations" line arrives from claims.js with the word
 * *efficacy* already gone, and a claim an admin re-evidences appears here with
 * no code change. A claim's `footnote` (its evidence line) renders when the
 * `Claim` row carries one.
 *
 * MOTION, LF-26: the old row duplicated four cards into twelve and auto-scrolled
 * them for 60s, pausable on hover only — a WCAG 2.2.2 failure on every touch
 * device. The row is now a static grid: there is nothing to pause, nothing to
 * duplicate, and no `isPaused` state (which the old file declared and never
 * set). The hover lift is suppressed under `prefers-reduced-motion`.
 */

import { Box, Container, Grid, Typography } from '@mui/material';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import SpaOutlinedIcon from '@mui/icons-material/SpaOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';

import { useBrand } from '../../content/brand';
import { useSubstantiatedClaims } from '../../content/claims';

/** claims.js `iconKey` -> glyph. `generic` and anything unknown get a mark. */
const ICONS = {
  india: PlaceOutlinedIcon,
  'cruelty-free': FavoriteBorderOutlinedIcon,
  derm: ScienceOutlinedIcon,
  botanical: SpaOutlinedIcon,
  generic: VerifiedOutlinedIcon,
};

const Benefits = () => {
  const brand = useBrand();
  const { claims } = useSubstantiatedClaims();

  // No evidenced claim, no proof row. There is no placeholder version of this.
  if (claims.length === 0) return null;

  return (
    <Box
      component="section"
      aria-labelledby="home-benefits-heading"
      sx={{ py: { xs: 5, md: 8 }, backgroundColor: 'var(--lf-surface, #FFFFFF)' }}
    >
      <Container>
        <Box sx={{ mb: { xs: 3, md: 4 }, maxWidth: 640 }}>
          <Typography variant="overline" component="p" sx={{ color: 'var(--lf-gold-ink, #7A5A24)' }}>
            What we can evidence
          </Typography>
          <Typography
            id="home-benefits-heading"
            variant="h2"
            component="h2"
            sx={{ color: 'var(--lf-ink, #14110F)', mt: 0.5, mb: 1.5 }}
          >
            Only what we can stand behind
          </Typography>
          <Box className="lf-rule" component="hr" sx={{ maxWidth: 160, mb: 2 }} />
          <Typography variant="body2" sx={{ color: 'var(--lf-ink-2, #4A433C)' }}>
            {brand.territoryLine}
          </Typography>
        </Box>

        <Grid container spacing={2}>
          {claims.map((claim) => {
            const Icon = ICONS[claim.iconKey] || ICONS.generic;

            return (
              <Grid key={claim.id} size={{ xs: 12, sm: 6, md: 3 }}>
                <Box
                  sx={{
                    height: '100%',
                    p: { xs: 2, md: 2.5 },
                    borderRadius: 'var(--lf-r-card, 14px)',
                    border: '1px solid var(--lf-hairline, #E7E0D6)',
                    backgroundColor: 'var(--lf-surface, #FFFFFF)',
                    boxShadow: 'var(--lf-e-edge)',
                    transition: 'transform var(--lf-dur-2) var(--lf-ease)',
                    '@media (hover:hover)': { '&:hover': { transform: 'translateY(-2px)' } },
                    '@media (prefers-reduced-motion: reduce)': {
                      transition: 'none',
                      '&:hover': { transform: 'none' },
                    },
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
                      mb: 1.5,
                      backgroundColor: 'var(--lf-gold-tint, #F7F0E2)',
                      color: 'var(--lf-gold-ink, #7A5A24)',
                    }}
                  >
                    <Icon sx={{ fontSize: 24 }} />
                  </Box>

                  <Typography variant="h5" component="h3" sx={{ color: 'var(--lf-ink, #14110F)' }}>
                    {claim.label}
                  </Typography>

                  {claim.description ? (
                    <Typography
                      variant="body2"
                      sx={{ mt: 0.75, color: 'var(--lf-ink-2, #4A433C)' }}
                    >
                      {claim.description}
                    </Typography>
                  ) : null}

                  {claim.footnote ? (
                    <Typography
                      variant="caption"
                      component="p"
                      sx={{ mt: 1, color: 'var(--lf-ink-3, #6E675F)' }}
                    >
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
  );
};

export default Benefits;
