/**
 * /about — ART_DIRECTION §5.7, §5.9 (EDITORIAL). LF-05, LF-30.
 *
 * §5.7, verbatim: "EDITORIAL. H1 becomes the brand's own words: `The hearth is where a
 * family gathers`, subhead `We make the shelf it gathers around.` The hand-typed `The
 * art of the everyday ritual` — a line that appears nowhere in brand.js and belongs to
 * no brand in particular — is deleted. The claims grid is cut from this page (it would
 * be the third rendering of the same four strings after the marquee and the home grid;
 * substantiation belongs once). In its place, the only image this page can own: the
 * six-product shelf at full width, in order, as the thing the family gathers around."
 *
 * WHAT WENT, AND WHY
 *  - `The art of the everyday ritual` — deleted by §5.7 by name.
 *  - `Welcome to our hearth. Welcome home.` — the same defect one scroll lower: a
 *    strapline in no content module, closing a page whose whole argument is that the
 *    brand only says what it can source. It is replaced by the shelf and two actions.
 *  - The four-card claims grid AND the single "Made in India" band above it. §5.7 cuts
 *    the grid; the band is the same substantiation rendered once more on the same page,
 *    and "substantiation belongs once" is the stated reason. Both claims surfaces now
 *    live on Home ④ and in the footer's legal row. `claims.js` is untouched.
 *  - `--lf-surface-raised` went with the claims grid — its only call site in the app
 *    (§3.1 wants the alias deleted outright at step 9.10; now nothing blocks it).
 *  - Five bespoke `py` pairs, two `textAlign: center` blocks and a hand-rolled
 *    `SectionHeading` with a gold-less `.lf-rule` under it. The page frame, the title
 *    register and the section rhythm all come from `<PageShell archetype="editorial">`
 *    now (§5.9), which is why this file is ~40% shorter than the one it replaces.
 *
 * THE H1 IS NOT TYPED. `brand.territoryLine` IS the two sentences §5.7 asks for, so the
 * page splits that one string rather than retyping half of it into a component — if the
 * API ever overlays the territory line, the heading follows it. §10.21 in spirit.
 *
 * TYPEFACES: Fraunces has exactly three licensed uses site-wide (nav wordmark, one home
 * interstitial, footer wordmark) and all three are spent elsewhere, so this page — the
 * obvious place to want a fourth — deliberately does not get one (§10.6).
 */

import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import SeoHead from '../components/common/SeoHead';
import ProductCard from '../components/product/ProductCard';
import ProductCardSkeleton from '../components/common/ProductCardSkeleton';
import { PRODUCT_GRID_SX, skeletonCount } from '../components/product/productGrid';
import {
  FOCUS_RING_SX,
  MEASURE_SX,
  PRIMARY_ACTION_SX,
  PageShell,
  TOUCH_TARGET_SX,
  useProductShelf,
} from '../components/common/EmptyState';
import { useBrand } from '../content/brand';
import { usePolicy } from '../content/policy';

/** The whole catalogue is six products (§Appendix); ask for a little headroom. */
const SHELF_LIMIT = 12;

/**
 * `brand.territoryLine` is "The hearth is where a family gathers. We make the shelf it
 * gathers around." — §5.7's heading and subhead, in one approved string. Split it on
 * the first sentence boundary rather than retyping either half.
 * @param {string} line
 * @returns {{heading: string, subhead: string|null}}
 */
function splitTerritory(line) {
  const text = typeof line === 'string' ? line.trim() : '';
  const boundary = text.indexOf('. ');
  if (boundary === -1) return { heading: text, subhead: null };
  return {
    heading: text.slice(0, boundary),
    subhead: text.slice(boundary + 2).trim() || null,
  };
}

/** One editorial block: a section heading and its prose, at the 56ch measure. */
const Chapter = ({ id, title, children }) => (
  <Box component="section" id={id} sx={{ scrollMarginTop: 'calc(var(--lf-nav-h) + 16px)' }}>
    <Typography variant="h2" component="h2" sx={{ color: 'var(--lf-ink)', mb: 2, ...MEASURE_SX }}>
      {title}
    </Typography>
    <Stack spacing={2} sx={MEASURE_SX}>
      {children}
    </Stack>
  </Box>
);

const Prose = ({ children }) => (
  <Typography variant="body1" sx={{ color: 'var(--lf-ink-2)' }}>
    {children}
  </Typography>
);

const About = () => {
  const brand = useBrand();
  const { copy } = usePolicy();
  const { products, loading } = useProductShelf({ limit: SHELF_LIMIT });

  const { heading, subhead } = splitTerritory(brand.territoryLine);

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

      <PageShell
        archetype="editorial"
        maxWidth="lg"
        eyebrow="Our story"
        title={heading}
        intro={subhead}
      >
        <Stack spacing={{ xs: 6, md: 9 }}>
          <Chapter id="the-name" title="What the name means">
            {/* The positioning statement is the etymology AND the family line, already
                approved and already rendered by the meta description. It is the lead
                here rather than a hand-typed paragraph that says the same thing. */}
            <Typography variant="h4" component="p" sx={{ color: 'var(--lf-ink)' }}>
              {brand.positioningStatement}
            </Typography>
            <Prose>
              A hearth is not an adjective. It is an arched opening in a wall with light
              coming out of it — the warmest corner of a house, and the one a family
              actually gathers in front of. That opening is the frame around every
              photograph on this site, which is as close as an online shop gets to
              putting you in the room.
            </Prose>
          </Chapter>

          <Chapter id="how-we-work" title="How we work">
            <Prose>
              We are a modern cosmetic company: we formulate and make what we sell,
              rather than reselling someone else&rsquo;s shelf.
            </Prose>
            <Prose>{copy.d2cAdvantage}</Prose>
            <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)' }}>
              The delivery and returns terms are the same ones on{' '}
              <Box
                component={RouterLink}
                to="/shipping-returns"
                sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}
              >
                our policy page
              </Box>
              , on every product page and in your bag.
            </Typography>
          </Chapter>

          {/* §5.7: the only image this page can own. Until TODO(business) 4 lands —
              one editorial hearth frame, 2400x1600 — the shelf is a better page than
              a text-only story, and it is the real catalogue, not a mock-up. */}
          <Box component="section" id="the-shelf">
            <Typography variant="h2" component="h2" sx={{ color: 'var(--lf-ink)', mb: 4, ...MEASURE_SX }}>
              The shelf it gathers around
            </Typography>

            <Box sx={PRODUCT_GRID_SX}>
              {loading && products.length === 0 ? (
                <ProductCardSkeleton count={skeletonCount(SHELF_LIMIT)} label="Loading products" />
              ) : (
                products.map((product) => (
                  <ProductCard key={product.id ?? product.slug} product={product} />
                ))
              )}
            </Box>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
            <Button
              className="lf-press"
              component={RouterLink}
              to={brand.hero.primaryCta.to}
              variant="contained"
              color="primary"
              disableElevation
              sx={{ px: 3, ...PRIMARY_ACTION_SX, ...FOCUS_RING_SX }}
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
        </Stack>
      </PageShell>
    </>
  );
};

export default About;
