/**
 * ============================================================================
 * ④ WHAT WE CAN EVIDENCE — ART_DIRECTION.md §5.1④ / §1.3.
 *
 * THE CLAIMS, ONCE. The page used to print the same four
 * `useSubstantiatedClaims()` labels TWICE: as a 38-second infinite auto-scroll
 * rail at the very top of the page (a WCAG 2.2.2 failure whose pause control
 * collided with the viewport edge), and again ~2,000px below as four bordered
 * cards preceded by a third printing of `brand.territoryLine`. Both are
 * deleted; substantiation lands here, once.
 *
 * ONE FLAT ROW. NO CARDS, NO BORDERS, NO BOXES (§5.1④). Four bordered boxes
 * around four short labels is the "empty ceremony" this direction exists to
 * remove — the border was carrying no information the 1px vertical rules do
 * not carry for free. Full-bleed `--lf-mat` with the gold LEDGE along its top
 * edge is what separates the band; the items are separated from each other by
 * 1px `--lf-hairline` verticals and nothing else. 2×2 below 680.
 *
 * `brand.territoryLine` IS NOT REPRINTED HERE (§5.1④): the section already has
 * an eyebrow and a heading, and the line is the headline of ② one screen up.
 *
 * EVERY STRING COMES FROM `content/claims.js` AND NOWHERE ELSE. Consumers
 * render only `substantiated: true` rows — the eight withdrawn claims carry
 * `label: null` precisely so that a component cannot render one by accident,
 * and an admin re-evidencing one makes it appear here with no code change.
 * The eight withdrawn phrases must not appear anywhere in `frontend/src` —
 * they are not quoted here either, because LF-05 is made provable by a grep
 * and a comment reciting them would break the test it is explaining. Their
 * audit record, and the exact evidence each one needs to come back, lives in
 * `claims.js` under `WITHDRAWN_CLAIMS`. Nothing in this file types a claim.
 *
 * MEASURED, because §5.1④ names the tokens: `--lf-ink` on `--lf-mat` is
 * 14.79:1, `--lf-ink-3` on `--lf-mat` is 4.98:1 — both AA. The 20px glyph at
 * `--lf-gold-edge` measures 2.93:1 on `--lf-mat`, short of SC 1.4.11's 3:1;
 * it is `aria-hidden` and duplicates the label beside it, so it carries no
 * information and 1.4.11 does not bite. Noted rather than silently swapped,
 * because §5.1④ specifies that token by name.
 * ========================================================================== */

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import SpaOutlinedIcon from '@mui/icons-material/SpaOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';

import { useSubstantiatedClaims } from '../../content/claims';

/** claims.js `iconKey` → glyph. Unknown keys get the generic mark. */
const ICONS = {
  india: PlaceOutlinedIcon,
  'cruelty-free': FavoriteBorderOutlinedIcon,
  derm: ScienceOutlinedIcon,
  botanical: SpaOutlinedIcon,
  generic: VerifiedOutlinedIcon,
};

const HAIRLINE = '1px solid var(--lf-hairline)';
const SHELF = '@media (min-width:680px)';

const Evidence = () => {
  const { claims } = useSubstantiatedClaims();

  /* No evidenced claim, no proof band. There is no placeholder version of
     this section, and an empty substantiation slot is how an unevidenced
     claim gets re-added from memory. */
  if (claims.length === 0) return null;

  return (
    <Box component="section" aria-labelledby="home-evidence-heading" sx={{ backgroundColor: 'var(--lf-mat)' }}>
      {/* LEDGE 3 of 4 on this page (§3.3), along the band's top edge. */}
      <Box className="lf-ledge" aria-hidden="true" />

      <Container sx={{ py: 'var(--lf-sect-sm)' }}>
        <Box sx={{ maxWidth: '56ch', minWidth: 0 }}>
          <Typography variant="eyebrow">What we can evidence</Typography>
          <Typography
            id="home-evidence-heading"
            variant="h3"
            component="h2"
            sx={{ mt: 'var(--lf-2)', color: 'var(--lf-ink)' }}
          >
            Only what we can stand behind
          </Typography>
        </Box>

        <Box
          component="ul"
          sx={{
            mt: 'var(--lf-6)',
            listStyle: 'none',
            display: 'grid',
            minWidth: 0,
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            rowGap: 'var(--lf-5)',
            [SHELF]: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', rowGap: 0 },
          }}
        >
          {claims.map((claim) => {
            const Icon = ICONS[claim.iconKey] || ICONS.generic;

            return (
              <Box
                component="li"
                key={claim.id}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--lf-2)',
                  minWidth: 0,
                  px: 'var(--lf-4)',
                  /* 2×2 below 680: the right-hand column carries the rule. */
                  '&:nth-of-type(2n+1)': { pl: 0 },
                  '&:nth-of-type(2n)': { borderInlineStart: HAIRLINE },
                  [SHELF]: {
                    /* §5.1④: ONE 72px row. */
                    minHeight: 72,
                    '&:nth-of-type(2n+1)': { pl: 'var(--lf-4)' },
                    '&:first-of-type': { pl: 0 },
                    '&:not(:first-of-type)': { borderInlineStart: HAIRLINE },
                  },
                }}
              >
                <Icon
                  aria-hidden="true"
                  sx={{ fontSize: 20, color: 'var(--lf-gold-edge)', flex: 'none', mt: '1px' }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    component="p"
                    sx={{ fontWeight: 600, color: 'var(--lf-ink)' }}
                  >
                    {claim.label}
                  </Typography>

                  {claim.description ? (
                    <Typography
                      variant="caption"
                      component="p"
                      sx={{ mt: '2px', color: 'var(--lf-ink-3)' }}
                    >
                      {claim.description}
                    </Typography>
                  ) : null}

                  {/* A claim's evidence line, when the `Claim` row carries one. */}
                  {claim.footnote ? (
                    <Typography
                      variant="caption"
                      component="p"
                      sx={{ mt: '2px', color: 'var(--lf-ink-3)' }}
                    >
                      {claim.footnote}
                    </Typography>
                  ) : null}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Container>
    </Box>
  );
};

export default Evidence;
