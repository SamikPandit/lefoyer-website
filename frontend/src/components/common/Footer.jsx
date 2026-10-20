/**
 * Footer — rewritten. LF-06 (routing), LF-29 (FAQ/Contact reachable), LF-30 (copy from
 * brand.js), IMPL_SPEC §1 C-15.
 *
 * FIVE DEFECTS THIS FILE USED TO CARRY, AND WHAT REPLACED THEM
 *
 * 1. EVERY LINK WAS DEAD. The SUPPORT column was the array
 *    `['Shipping & Returns','Privacy Policy','Terms of Service']` run through a
 *    ternary chain containing an `item === 'FAQ' ? '#/faq'` branch that no label could
 *    ever reach, and ending `: '#'`. Worse, each one was a MUI `Link` pointing at a
 *    legacy hash path rather than a `RouterLink` — so the day `App.jsx` became a
 *    `BrowserRouter`, all of them broke. Links are now a declarative `[{label, to}]` array rendered with
 *    `component={RouterLink} to=…`: no label can fall through to `'#'`, because there
 *    is no fallback to fall through to. `href` + `target="_blank"` + `rel="noopener
 *    noreferrer"` survives only on Instagram, which genuinely is external.
 *
 * 2. FAQ AND CONTACT WERE UNREACHABLE from the footer (LF-29). Both are now listed.
 *
 * 3. THE NEWSLETTER FORM WAS THEATRE. `if (email) setSubscribed(true)` — a single
 *    space passed, nothing was ever sent anywhere, and the visitor was thanked for
 *    subscribing to a list they were not on. Replaced by `<NewsletterForm
 *    variant="inline" source="footer" />`, which posts to the real endpoint with the
 *    consent text and reports what the server actually said.
 *
 * 4. A RED `severity="error"` ALERT OPENED THE FOOTER ON EVERY PAGE — including
 *    directly beneath the payment step, where a red fraud warning reads as "something
 *    just went wrong with your payment". The warning itself is legitimate and worth
 *    keeping, so it is demoted to neutral small print in the legal row: same words,
 *    no alarm, no `role="alert"`, no tinted band.
 *
 * 5. THE STATE EMBLEM OF INDIA WAS USED AS A DECORATIVE "MADE IN INDIA" BADGE. Its
 *    use is restricted under the State Emblem of India (Prohibition of Improper Use)
 *    Act, 2005, and this repository holds no authorisation for it. Replaced with a
 *    typographic mark. `frontend/public/images/products/State_Emblem_of_India.png`
 *    is now unreferenced and should be deleted from the repo (see the report's
 *    cross-package requests — WP-08 owns no asset directory).
 *
 * Also: the wordmark/blurb/support details come from `content/brand.js` (LF-30 — the
 * old "curating … natural beauty products" retailer framing is gone, along with the
 * hand-uppercased second spelling of the brand name), the three legacy v1 Grid
 * `item`/`xs`/`md` prop sets are migrated to MUI v7 `size={{…}}`, and the two
 * hardcoded fonts and six hardcoded hex values are replaced by design tokens (§9.11).
 */

import { Box, Container, Divider, Grid, Link as MuiLink, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import InstagramIcon from '@mui/icons-material/Instagram';

import { useBrand } from '../../content/brand';
import NewsletterForm from './NewsletterForm';
import { FOCUS_RING_SX } from './EmptyState';

/**
 * Internal destinations only, and every one of them is a route App.jsx declares.
 * Adding a label here without a `to` is a type error waiting to happen rather than a
 * silent `'#'`, which is the entire point of the shape.
 */
const SHOP_LINKS = Object.freeze([
  { label: 'All products', to: '/products' },
  { label: 'Search', to: '/search' },
  { label: 'Your bag', to: '/cart' },
  { label: 'Our story', to: '/about' },
]);

const SUPPORT_LINKS = Object.freeze([
  { label: 'FAQ & delivery', to: '/faq' },
  { label: 'Contact us', to: '/contact' },
  { label: 'Shipping & Returns', to: '/shipping-returns' },
  { label: 'Privacy Policy', to: '/privacy-policy' },
  { label: 'Terms of Service', to: '/terms' },
]);

const LinkColumn = ({ title, links }) => (
  <Box component="nav" aria-label={title}>
    <Typography variant="overline" component="h2" sx={{ color: 'var(--lf-ink-3)', mb: 1.5 }}>
      {title}
    </Typography>
    <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {links.map((link) => (
        <Box component="li" key={link.to}>
          <MuiLink
            component={RouterLink}
            to={link.to}
            underline="none"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 44,
              color: 'var(--lf-ink-2)',
              fontSize: '0.9375rem',
              transition: 'color var(--lf-dur-2) var(--lf-ease)',
              '@media (hover: hover)': {
                '&:hover': { color: 'var(--lf-ink)', textDecoration: 'underline' },
              },
              ...FOCUS_RING_SX,
            }}
          >
            {link.label}
          </MuiLink>
        </Box>
      ))}
    </Stack>
  </Box>
);

const Footer = () => {
  const brand = useBrand();
  const year = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        backgroundColor: 'var(--lf-canvas)',
        borderTop: '1px solid var(--lf-hairline)',
        pt: { xs: 6, md: 9 },
        pb: 4,
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={{ xs: 5, md: 8 }}>
          {/* ---- brand ---- */}
          <Grid size={{ xs: 12, md: 4 }}>
            {/* Fraunces use 3 of 3 (DESIGN_SYSTEM §2.2: nav wordmark, one home
                interstitial, footer wordmark at 28px). */}
            <Typography
              variant="wordmark"
              component="p"
              sx={{ fontSize: '1.75rem', color: 'var(--lf-ink)', mb: 2 }}
            >
              {brand.wordmark}
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)', maxWidth: 420, mb: 2 }}>
              {brand.positioningStatement}
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center">
              <InstagramIcon fontSize="small" aria-hidden="true" sx={{ color: 'var(--lf-ink-3)' }} />
              <MuiLink
                href={brand.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 44,
                  color: 'var(--lf-ink-2)',
                  fontSize: '0.9375rem',
                  '@media (hover: hover)': { '&:hover': { color: 'var(--lf-ink)' } },
                  ...FOCUS_RING_SX,
                }}
              >
                {brand.social.instagramHandle}
                <Box component="span" className="lf-sr-only">
                  {' '}
                  (opens in a new tab)
                </Box>
              </MuiLink>
            </Stack>
          </Grid>

          {/* ---- two link columns: 6/6 at 320px, so neither wraps to one word ---- */}
          <Grid size={{ xs: 6, md: 2 }}>
            <LinkColumn title="Shop" links={SHOP_LINKS} />
          </Grid>

          <Grid size={{ xs: 6, md: 3 }}>
            <LinkColumn title="Support" links={SUPPORT_LINKS} />
          </Grid>

          {/* ---- newsletter: the real form, the real endpoint, real consent ---- */}
          <Grid size={{ xs: 12, md: 3 }}>
            <Typography variant="overline" component="h2" sx={{ color: 'var(--lf-ink-3)', mb: 1.5 }}>
              Newsletter
            </Typography>
            <NewsletterForm variant="inline" source="footer" />
          </Grid>
        </Grid>

        {/* ---- "Made in India": typographic, no emblem ---- */}
        <Box
          sx={{
            mt: { xs: 6, md: 8 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}
        >
          <Box sx={{ height: '1px', flex: '0 1 64px', backgroundColor: 'var(--lf-rule-gold)' }} />
          <Typography variant="overline" component="p" sx={{ color: 'var(--lf-ink-3)' }}>
            Made in India
          </Typography>
          <Box sx={{ height: '1px', flex: '0 1 64px', backgroundColor: 'var(--lf-rule-gold)' }} />
        </Box>

        <Divider sx={{ mt: 4, mb: 3 }} />

        {/* ---- legal row ---- */}
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 1, sm: 2 }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
          >
            <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
              © {year} {brand.legalName}. All rights reserved.
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
              Questions?{' '}
              <MuiLink
                href={`mailto:${brand.support.email}`}
                underline="always"
                sx={{ color: 'var(--lf-gold-ink)', ...FOCUS_RING_SX }}
              >
                {brand.support.email}
              </MuiLink>
            </Typography>
          </Stack>

          {/* Demoted from a red severity="error" Alert on a pink band. Same words,
              stated once, quietly — not shouted under the payment step. */}
          <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)', maxWidth: 760 }}>
            Security note: {brand.legalName} will never call you with offers or free
            gifts, and will never ask you to make a payment through a link. If someone
            does, please report it to {brand.support.email}.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
};

export default Footer;
