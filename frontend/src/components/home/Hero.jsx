/**
 * ============================================================================
 * ① HERO — THE LIT ALCOVE. ART_DIRECTION.md §5.1① / §2.15 / §4.4.
 *
 * What this replaces: a ~300px text-only band — 406px of centred Inter Tight
 * on near-white with ZERO imagery — whose own file header used an unsolved
 * build problem ("shipping one of those into the first viewport would cost
 * more than the layout gains") to settle a brand decision. §2.12: A BUILD STEP
 * WAS MAKING THE BRAND'S BIGGEST DESIGN DECISION. The pipeline landed first
 * (§9.1), so that comment is deleted and the product is in the first viewport
 * with a real price and a real `Add to bag`.
 *
 * THE COMPOSITION (§5.1①), desktop content 1216 at 1440:
 *   media column 560 · 48px gap · text column 608
 *   media:  <Alcove surface="hero" priority> — at 900vh the niche is 576 tall
 *           and 488 wide (576 ÷ the locked 1.18 ratio), centred in its column.
 *   text:   eyebrow → display 60/600/−0.006em headline → 16px → body1 subhead
 *           at 46ch → 28px → the gold LEDGE → 20px → three substantiated
 *           claims with 16px --lf-gold-edge glyphs.
 *   card:   396px of opaque --lf-paper at left:32 / bottom:−28, so it overlaps
 *           the niche's foot and sits half on the canvas. NEVER real glass
 *           (§2.15's own instruction, §9.4) — a backdrop-filter above the fold
 *           is the single most expensive thing available on a mid-range
 *           Android, and this one would sit over a photograph.
 *
 * THE MOBILE REORDER (§5.1①) is the reason the DOM is three blocks rather than
 * two columns: eyebrow → headline → NICHE → purchase card → subhead. The
 * transaction has to clear the fold on a 360×640, and the only way to do that
 * is to put the photograph and the card ABOVE the subhead. DOM order is
 * headline-block, media-block, subhead-block, which is the mobile order
 * exactly; desktop places the media block into column 1 spanning both text
 * rows. Nothing is reordered away from its reading order, and the only
 * interactive control in the whole section — `Add to bag` — sits in the same
 * place in the DOM as it does on screen at every width.
 *
 * THE FOLD, §4.4, re-derived against what this file actually renders:
 *   1440×900   nav 64 + pad 128 + niche 576 + card overhang 28  =  796 ✓ < 900
 *   1366×768   nav 64 + pad 128 + 64svh 491 + 28                =  711 ✓ < 768
 *   360×640    nav 56 + pad 24 + eyebrow 26 + headline 2×34 ≈ 89
 *              + niche 300 + card overhang −24 = 471, then 16 pad
 *              + 24 name + 12 + 52 CTA                          =  575 ✓ < 584
 * The mobile card's internal order is derived from that last line and is
 * documented on <PurchaseCard>: everything above the CTA is spent out of 88px.
 * §5.1① writes `py: var(--lf-sect-lg)`, which is 72px below 900 — that pushes
 * the mobile CTA to ~611 and FAILS the 360×640 gate §5.1① itself defers to
 * ("Arithmetic in §4.4: the CTA clears a 360×640 fold"). §4.4's own mobile row
 * budgets 24px there. Where the two halves of one sentence disagree, the
 * measured gate wins: top padding is --lf-6 below 900 and --lf-sect-lg from
 * 900 up. Reported as a deviation.
 *
 * NO TYPED PRODUCT FACT (§10.21). §5.1① names UV Armor Tinted Sunscreen as the
 * hero frame; this component takes "the bestseller, in stock" from the API
 * payload and never from a string — the brief that produced the art direction
 * miscalled a moisturiser a sunscreen, which is precisely the failure mode.
 *
 * NO FABRICATED PROOF. Three claims, from `useSubstantiatedClaims({limit:3})`
 * and nowhere else. No star row, no review count (§10.9).
 * ========================================================================== */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Link as RouterLink } from 'react-router-dom';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import SpaOutlinedIcon from '@mui/icons-material/SpaOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';

import Alcove from '../common/Alcove';
import AddToBag from '../product/AddToBag';
import PriceBlock, { hasPrice } from '../product/PriceBlock';
import StockLabel from '../product/StockLabel';
import { productPath } from '../product/productPresentation';
import { useBrand } from '../../content/brand';
import { useSubstantiatedClaims } from '../../content/claims';
import { usePolicy } from '../../content/policy';
import { stockState } from '../../utils/stock';

/** claims.js `iconKey` → glyph. Decorative: every one is aria-hidden. */
const CLAIM_ICONS = {
  india: PlaceOutlinedIcon,
  'cruelty-free': FavoriteBorderOutlinedIcon,
  derm: ScienceOutlinedIcon,
  botanical: SpaOutlinedIcon,
  generic: VerifiedOutlinedIcon,
};

/* §5.1① — the desktop column pair, as proportions rather than pixels so the
   560/608 split survives every width between 900 and 1440 without a second
   breakpoint. At 1440: 1216 content − 48 gap = 1168 × (560/1168) = 560. */
const DESKTOP = '@media (min-width:900px)';

/**
 * The eyebrow is `brand.tagline` set in small caps by CSS, not a second copy
 * of the same sentence typed into a component (brand.js: "components that want
 * the uppercase look must apply CSS, not retype the name"). The sentence-final
 * stop is dropped because an eyebrow is a label, not a sentence; §5.1① prints
 * it without one.
 */
function eyebrowFrom(tagline) {
  return typeof tagline === 'string' ? tagline.replace(/\.\s*$/, '') : '';
}

/**
 * ONE claim, in the hero's proof row. 13px --lf-ink-3 (5.38:1 on canvas) with
 * a 16px --lf-gold-edge glyph (3.16:1 — an indicator, never type, §10.7).
 */
const ProofItem = ({ claim }) => {
  const Icon = CLAIM_ICONS[claim.iconKey] || CLAIM_ICONS.generic;
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--lf-2)', minWidth: 0 }}>
      <Icon aria-hidden="true" sx={{ fontSize: 16, color: 'var(--lf-gold-edge)', flex: 'none' }} />
      <Typography variant="caption" component="span" sx={{ color: 'var(--lf-ink-3)' }}>
        {claim.label}
      </Typography>
    </Box>
  );
};

/**
 * THE PURCHASE CARD (§5.1①). Opaque paper, a real 1.5px edge as well as
 * --lf-e3: on a warm ground a near-white panel carrying only a shadow reads as
 * a smudge on a cheap Android panel, which is the one place this store's
 * traffic actually is.
 *
 * Desktop order is §5.1①'s, verbatim: 56px thumb → eyebrow → h4 name →
 * priceLg → <StockLabel> → 52px ink CTA → delivery line from policy.js.
 *
 * MOBILE IS NOT THAT CARD WITH SMALLER PADDING, and §4.4 is the reason.
 * Its 360×640 row leaves the card EXACTLY 88px above the fold line
 * (56 nav + 24 pad + 26 eyebrow + 89 headline + 300 niche − 24 overhang =
 * 471; the gate is ~584). Every element placed above the CTA inside the card
 * is spent out of that 88px, so:
 *   - the 56px thumbnail is dropped below 900. It is a 56px copy of the
 *     photograph standing 24px above it at 300px; §5.1① puts it there because
 *     at desktop the card floats half on the canvas away from its niche.
 *   - the category eyebrow is dropped below 900, and the name clamps to one
 *     line instead of two.
 *   - `price` and the 52px CTA share one row (§5.1①) and the STOCK LINE MOVES
 *     BELOW THEM rather than above — above the CTA it costs 32px and pushes
 *     the CTA's bottom edge to 607, past the fold. It is still rendered
 *     always (§6.4), and reading order stays price → stock → CTA.
 * Measured for what this renders: 16 pad + 24 name + 12 + 52 CTA = 104,
 * so the CTA's bottom edge lands at 575 — inside 584, with the identity,
 * stock and delivery lines continuing below it.
 *
 * `useMediaQuery` rather than `display: none`: a hidden <Alcove> still mounts
 * a <picture>, and the `thumb` surface's candidate list (160/320) does not
 * overlap the `hero` surface's (480–1600), so the browser would fetch a
 * SECOND derivative of the same frame on the connection P4 budgets for.
 * `MuiUseMediaQuery.defaultProps.noSsr` is true in theme.js, so this resolves
 * on the first render and costs no second paint.
 */
const PurchaseCard = ({ product, stock }) => {
  const { copy } = usePolicy();
  const roomy = useMediaQuery('(min-width:900px)');

  const categoryName =
    typeof product.category?.name === 'string' && product.category.name.trim()
      ? product.category.name.trim()
      : null;

  return (
    <Box
      sx={{
        width: { xs: 'min(326px, 100%)', md: 396 },
        maxWidth: '100%',
        p: { xs: 'var(--lf-4)', md: 'var(--lf-5)' },
        backgroundColor: 'var(--lf-paper)',
        borderRadius: 'var(--lf-r-panel)',
        /* §5.1①, verbatim. There is no token for this edge: it exists only
           here, because only this panel floats on the canvas over a
           photograph. Reported as the one raw value in these files. */
        boxShadow: 'var(--lf-e3), 0 0 0 1.5px rgba(26,20,16,.16)',
        /* The card overlaps the niche's foot. On desktop it is taken out of
           flow so the niche keeps its own height; on mobile it stays in flow
           and pulls up, because the subhead has to follow it. */
        position: { xs: 'static', md: 'absolute' },
        left: { md: 32 },
        bottom: { md: -28 },
        mt: { xs: '-24px', md: 0 },
        zIndex: 2,
        /* The thumbnail is 56px here, not the `thumb` surface's 72 (§5.1①).
           --lf-alcove-max is a size cap, never the locked proportion. */
        '& .lf-alcove[data-surface="thumb"]': { '--lf-alcove-max': '56px' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 'var(--lf-3)', minWidth: 0 }}>
        {roomy ? <Alcove product={product} surface="thumb" stock={stock.state} alt="" /> : null}
        <Box sx={{ minWidth: 0 }}>
          {roomy && categoryName ? <Typography variant="eyebrow">{categoryName}</Typography> : null}
          <Typography
            variant="h4"
            component="p"
            sx={{ mt: roomy && categoryName ? '2px' : 0, color: 'var(--lf-ink)' }}
          >
            <Box
              component={RouterLink}
              to={productPath(product)}
              className={roomy ? 'lf-clamp-2' : 'lf-clamp-1'}
              sx={{ color: 'inherit', textDecoration: 'none' }}
            >
              {product.name}
            </Box>
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          mt: { xs: 'var(--lf-3)', md: 'var(--lf-4)' },
          display: 'flex',
          flexDirection: { xs: 'row', md: 'column' },
          flexWrap: { xs: 'wrap', md: 'nowrap' },
          alignItems: { xs: 'center', md: 'stretch' },
          gap: 'var(--lf-3)',
          minWidth: 0,
        }}
      >
        <PriceBlock
          product={product}
          size="lg"
          sellable={stock.sellable}
          sx={{ order: 1, flex: 'none' }}
        />

        {/* Rendered always, in stock or out (§6.4). Below 900 it takes the
            whole line BENEATH the price/CTA row — see the header: above it,
            it costs the CTA its place in the fold. */}
        <StockLabel
          stock={stock}
          variant="inline"
          sx={{ order: { xs: 3, md: 2 }, flexBasis: { xs: '100%', md: 'auto' } }}
        />

        {/* <AddToBag> returns the button AND its adjacent message slot, so it
            is wrapped to make exactly one flex item of the pair. */}
        <Box sx={{ order: { xs: 2, md: 3 }, flex: { xs: 1, md: 'none' }, minWidth: 0 }}>
          <AddToBag product={product} size="buybox" showIcon={false} />
        </Box>
      </Box>

      {/* Read from policy.js, never typed: a "7-day" or a "free over ₹X" in a
          component is how this repo ended up asserting five incompatible
          policies at once (LF-12). */}
      <Typography variant="caption" component="p" sx={{ mt: 'var(--lf-3)', color: 'var(--lf-ink-2)' }}>
        {`${copy.shippingLabel} · ${copy.deliveryWindow}`}
      </Typography>
    </Box>
  );
};

/**
 * @param {object} props
 * @param {object|null} [props.product] The hero frame — "the bestseller, in
 *   stock" (§5.1①), chosen from the API payload by `pickHeroProduct` in
 *   `pages/Home.jsx`. Never a hardcoded slug.
 * @param {'loading'|'ready'|'error'|'empty'} [props.status='loading']
 * @returns {JSX.Element}
 */
const Hero = ({ product = null, status = 'loading' }) => {
  const brand = useBrand();
  const { claims } = useSubstantiatedClaims({ limit: 3 });

  const stock = product ? stockState(product) : null;
  /* A product with no usable price cannot carry a purchase card: §6.3 forbids
     ₹undefined and §5.1① is a TRANSACTION, not a poster. */
  const transactable = Boolean(product && hasPrice(product));

  return (
    <Box
      component="section"
      aria-labelledby="home-hero-heading"
      sx={{
        backgroundColor: 'var(--lf-canvas)',
        /* See the header: --lf-sect-lg below 900 fails §4.4's 360×640 gate. */
        pt: { xs: 'var(--lf-6)', md: 'var(--lf-sect-lg)' },
        /* The card overhangs the niche by 28px and is out of flow at desktop,
           so the section pays for it rather than letting it collide with ②. */
        pb: { xs: 'var(--lf-sect-lg)', md: 'calc(var(--lf-sect-lg) + 28px)' },
      }}
    >
      <Container>
        <Box
          sx={{
            display: 'grid',
            minWidth: 0,
            gridTemplateColumns: '1fr',
            rowGap: 'var(--lf-4)',
            [DESKTOP]: {
              gridTemplateColumns: 'minmax(0, 560fr) minmax(0, 608fr)',
              gridTemplateRows: 'auto auto',
              /* A STRING, deliberately. Inside `sx`, a bare number goes through MUI's
                 spacing transform (createUnaryUnit(theme,'spacing',8,'columnGap')), so
                 `columnGap: 48` renders as 384px and starves the media column from 560px
                 down to ~414px. The unit makes it the 48px the spec asks for. */
              columnGap: '48px',
              rowGap: 'var(--lf-4)',
            },
          }}
        >
          {/* ---- A. EYEBROW + HEADLINE ------------------------------------ */}
          <Box sx={{ minWidth: 0, [DESKTOP]: { gridColumn: 2, gridRow: 1, alignSelf: 'end' } }}>
            <Typography variant="eyebrow">{eyebrowFrom(brand.tagline)}</Typography>
            <Typography
              id="home-hero-heading"
              variant="display"
              component="h1"
              sx={{
                mt: 'var(--lf-3)',
                color: 'var(--lf-ink)',
                /* §5.1①: the measure is capped so the headline breaks to two
                   lines. At 1440 the 608px column already does that; this is
                   the cap that stops a wider column from flattening it. */
                maxWidth: '20ch',
              }}
            >
              {brand.hero.headline}
            </Typography>
          </Box>

          {/* ---- B. THE NICHE + THE PURCHASE CARD ------------------------- */}
          <Box
            sx={{
              position: 'relative',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              /* §5.1①'s mobile niche cap. The ratio is untouched and locked
                 (§10.4); only the HEIGHT cap moves. The selector has to beat
                 index.css §6's own `.lf-alcove[data-surface="hero"]`, which
                 declares the property ON the niche, so inheritance cannot
                 reach it. One local var so the skeleton and the niche cannot
                 resolve to different widths (P5). */
              '--lf-hero-max': '300px',
              '& .lf-alcove[data-surface="hero"]': { '--lf-alcove-max': 'var(--lf-hero-max)' },
              [DESKTOP]: {
                '--lf-hero-max': 'clamp(420px, 64svh, 660px)',
                gridColumn: 1,
                gridRow: '1 / 3',
                alignSelf: 'center',
              },
            }}
          >
            {status === 'loading' ? (
              /* P5 / CLS ≤ 0.05: the placeholder is the NICHE's shape, at the
                 niche's width, so first paint and loaded paint are the same
                 geometry. */
              <Box
                className="lf-skel lf-skel--alcove lf-skel--media"
                aria-hidden="true"
                sx={{ inlineSize: 'min(100%, calc(var(--lf-hero-max) / var(--lf-arch-ratio)))' }}
              />
            ) : transactable ? (
              <Alcove product={product} surface="hero" priority stock={stock.state} />
            ) : null}

            {status === 'loading' ? (
              /* The card is out of flow at desktop, so it costs nothing there.
                 At mobile it IS in flow and the subhead sits under it, so its
                 box has to be reserved or the whole page below the fold jumps
                 when the catalogue lands (P5). Measured against what
                 <PurchaseCard> actually renders:
                   xs  16 pad + 24 name + 12 + 52 price/CTA row + 12 + 20
                       stock + 12 + 19 delivery + 16 pad          = 183
                   md  20 pad + 56 thumb row + 16 + 34 price + 12 + 20 stock
                       + 12 + 52 CTA + 12 + 19 delivery + 20 pad  = 273 */
              <Box
                className="lf-skel"
                aria-hidden="true"
                sx={{
                  width: { xs: 'min(326px, 100%)', md: 396 },
                  maxWidth: '100%',
                  height: { xs: 183, md: 273 },
                  borderRadius: 'var(--lf-r-panel)',
                  position: { xs: 'static', md: 'absolute' },
                  left: { md: 32 },
                  bottom: { md: -28 },
                  mt: { xs: '-24px', md: 0 },
                }}
              />
            ) : null}

            {transactable && status === 'ready' ? (
              <PurchaseCard product={product} stock={stock} />
            ) : null}
          </Box>

          {/* ---- C. SUBHEAD + LEDGE + PROOF ROW --------------------------- */}
          <Box sx={{ minWidth: 0, [DESKTOP]: { gridColumn: 2, gridRow: 2, alignSelf: 'start' } }}>
            <Typography variant="body1" component="p" sx={{ color: 'var(--lf-ink-2)', maxWidth: '46ch' }}>
              {brand.hero.subhead}
            </Typography>

            {/* LEDGE 1 of 4 on this page (§3.3): hero, shelf, evidence, footer.
                Full column width — never capped by a call site. */}
            <Box component="hr" className="lf-ledge" sx={{ mt: '28px' }} />

            {claims.length > 0 ? (
              <Box
                component="ul"
                sx={{
                  mt: '20px',
                  listStyle: 'none',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--lf-2) var(--lf-5)',
                  minWidth: 0,
                }}
              >
                {claims.map((claim) => (
                  <Box component="li" key={claim.id} sx={{ minWidth: 0 }}>
                    <ProofItem claim={claim} />
                  </Box>
                ))}
              </Box>
            ) : null}

            {/* The transaction IS the hero's call to action (§5.1①). When the
                catalogue is unreachable or carries nothing sellable, LF-03's
                requirement — something real and clickable above the fold —
                lands on brand.js's own approved CTAs instead. Nothing renders
                a broken frame or a dead button. */}
            {!transactable && status !== 'loading' ? (
              <Box sx={{ mt: 'var(--lf-5)', display: 'flex', flexWrap: 'wrap', gap: 'var(--lf-3)' }}>
                <Button
                  component={RouterLink}
                  to={brand.hero.primaryCta.to}
                  variant="contained"
                  className="lf-press"
                  sx={{ minHeight: 52, px: 'var(--lf-6)' }}
                >
                  {brand.hero.primaryCta.label}
                </Button>
                <Button
                  component={RouterLink}
                  to={brand.hero.secondaryCta.to}
                  variant="outlined"
                  className="lf-press"
                  sx={{ minHeight: 52, px: 'var(--lf-6)' }}
                >
                  {brand.hero.secondaryCta.label}
                </Button>
              </Box>
            ) : null}
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Hero;
