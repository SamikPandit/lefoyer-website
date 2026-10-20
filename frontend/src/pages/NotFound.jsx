/**
 * The 404 route. LF-29.
 *
 * It had four hardcoded grey hex literals and two actions, both of which assumed
 * the visitor wanted to start over. Now:
 *   - every colour is a theme token, so it follows the palette and the dark scheme
 *     instead of staying a grey page on a warm canvas (DESIGN_SYSTEM §9.11);
 *   - it is built on the shared `EmptyState`, so a 404 looks like every other
 *     empty state on the site rather than like a different website;
 *   - the recovery links are the ones a lost shopper actually needs: search, the
 *     FAQ, and a route to a human. A 404 is the most common place a customer gives
 *     up, and the old page offered them no way to ask.
 *   - `noindex`, because a soft 404 in the index is worse than none.
 *
 * A dead product URL is the usual way someone arrives here (the catalogue is
 * slug-routed), which is why "Browse all products" is the primary action rather
 * than "Go home".
 */

import { Box, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import TravelExploreOutlinedIcon from '@mui/icons-material/TravelExploreOutlined';

import SeoHead from '../components/common/SeoHead';
import EmptyState, { FOCUS_RING_SX } from '../components/common/EmptyState';
import SupportLink from '../components/common/SupportLink';

const RECOVERY_LINKS = [
  { to: '/search', label: 'Search the catalogue' },
  { to: '/faq', label: 'Frequently asked questions' },
  { to: '/shipping-returns', label: 'Delivery, returns & refunds' },
];

export default function NotFound() {
  return (
    <>
      <SeoHead title="Page not found" noindex />

      <Box sx={{ backgroundColor: 'var(--lf-canvas)' }}>
        <EmptyState
          variant="page"
          headingComponent="h1"
          icon={<TravelExploreOutlinedIcon />}
          title="We cannot find that page"
          message="The link may be old, or the product may have moved. Nothing is wrong with your account or your bag."
          primaryLabel="Browse all products"
          primaryTo="/products"
          secondaryLabel="Go to the homepage"
          secondaryTo="/"
        >
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="overline" component="p" sx={{ color: 'var(--lf-ink-3)', mb: 1.5 }}>
              Or try one of these
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 1, sm: 3 }}
              justifyContent="center"
              alignItems="center"
              flexWrap="wrap"
              sx={{ rowGap: 1 }}
            >
              {RECOVERY_LINKS.map((link) => (
                <Box
                  key={link.to}
                  component={RouterLink}
                  to={link.to}
                  sx={{
                    color: 'var(--lf-gold-ink)',
                    fontWeight: 500,
                    textDecoration: 'underline',
                    display: 'inline-flex',
                    alignItems: 'center',
                    minHeight: 44,
                    '&:hover': { color: 'var(--lf-gold-ink-hv)' },
                    ...FOCUS_RING_SX,
                  }}
                >
                  {link.label}
                </Box>
              ))}
              <SupportLink topic="other" label="Ask us where it went" />
            </Stack>
          </Box>
        </EmptyState>
      </Box>
    </>
  );
}
