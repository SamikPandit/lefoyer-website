/**
 * ============================================================================
 * <Footer> — ART_DIRECTION.md §5.11, §6.10, §2.7, §1.3.
 *
 * The previous system's own scorecard called this file under-designed, and it
 * was right: a weightless link farm painted `var(--lf-canvas)` — the IDENTICAL
 * colour as the page body — so the brand's last moment had no edge, no colour
 * and no merchandise in it.
 *
 * THREE BANDS, ON THE HEARTH (§2.7). `.lf-hearth-section` has existed in
 * index.css from day one with 28 contrast-audited redefinitions, and §2.6
 * decided it belonged on "footer + interstitial"; the build never applied it
 * to either. Every child works inside it with ZERO overrides, which is why
 * this file sets no colour of its own beyond the licensed gold wordmark.
 *
 *   1. The Fraunces wordmark at 28px (licence 3 of 3, §2.2) and
 *      `brand.territoryLine` one step below `brandDisplay`. THE BRAND'S LAST
 *      WORD IS THE HEARTH SENTENCE, NOT A LINK FARM.
 *   2. ALL SIX PRODUCTS as 72px niches — the same <Alcove> component as the
 *      490px hero, which is the whole point of the direction (§1.1). THIS ROW
 *      IS THE SHOP LINK.
 *   3. The gold ledge, then one compressed row: support, legal, the one
 *      social handle, `Made in India` as plain text, and the newsletter.
 *
 * WHAT §1.3 DELETES FROM THIS FILE, AND WHY EACH DELETION IS CORRECT:
 *
 *   · THE SHOP COLUMN (All products / Search / Your bag / Our story). Three of
 *     the four are nav items one row above, and "Your bag" is a stateful user
 *     destination, not a footer link. Band 2 IS the shop link, and it shows
 *     the actual shop rather than naming it.
 *
 *   · THE GLOBAL FRAUD NOTICE. It warned on EVERY page — including /checkout —
 *     that the brand "will never ask you to make a payment through a link",
 *     three scroll-seconds above a button that calls `window.location.assign()`
 *     to a PhonePe link. It moves to /contact and /faq (§5.8), reworded so it
 *     cannot be read as being about the gateway the customer is mid-way
 *     through using. Deleting it here is not dropping it; §5.8 names its new
 *     home and its new wording.
 *
 *   · THE STATE EMBLEM OF INDIA. Its commercial use is restricted under the
 *     State Emblem of India (Prohibition of Improper Use) Act, 2005, and this
 *     repository holds no authorisation (§10.25). "Made in India" is PLAIN
 *     TEXT. It was already unreferenced after the previous pass; this file now
 *     also drops the two `--lf-rule-gold` hairlines that framed it (1.30:1
 *     over canvas — an accent below the perception floor, §2.10 overturned).
 *
 * THE ONE NEWSLETTER ON THE SITE (§1.3, §10.23). `home/NewsletterSignup.jsx`
 * is deleted by the home package; `<NewsletterForm>` is the single
 * implementation, posting to the real endpoint with real consent.
 *
 * `chrome="minimal"` (§5.5): on /checkout and /order-confirmation the footer
 * is ONE COPYRIGHT LINE. No links out of the funnel.
 *
 * LF-06 (every link is a client-side route, no `#`), LF-29 (Help and Contact
 * reachable from the footer) and LF-30 (every string from brand.js) are
 * preserved.
 * ========================================================================== */

import { useEffect, useState } from 'react';
import { Box, Grid, Link as MuiLink, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import { useBrand } from '../../content/brand';
import { listProducts } from '../../services/api';
import { stockState } from '../../utils/stock';
import Alcove from './Alcove';
import NewsletterForm from './NewsletterForm';
import PriceBlock from '../product/PriceBlock';
import StockLabel from '../product/StockLabel';
import { productPath } from '../product/productPresentation';

/**
 * Support and legal. The SHOP column is deleted (§1.3) — band 2 is the shop
 * link. Every entry is a route `App.jsx` declares, and the shape is a
 * `[{label, to}]` array rather than a ternary chain precisely so no label can
 * fall through to `'#'`: there is no fallback to fall through to.
 * `/faq` is labelled `Help` and nothing else, anywhere (§5.8).
 */
const LEGAL_LINKS = Object.freeze([
  { label: 'Help', to: '/faq' },
  { label: 'Contact', to: '/contact' },
  { label: 'Shipping & returns', to: '/shipping-returns' },
  { label: 'Privacy', to: '/privacy-policy' },
  { label: 'Terms', to: '/terms' },
]);

/** §5.11 band 2 — the whole catalogue. Six products, exactly. */
const SHELF_SIZE = 6;

/**
 * The footer renders on every route, so the shelf is fetched ONCE per page
 * load and shared by every mount. A module-level promise is the smallest
 * thing that does that; it never rejects, because a footer that cannot reach
 * the API must still be a footer.
 *
 * Exported because §5.10's idle search state is THE SAME SIX PRODUCTS, and
 * two module-level caches would mean two identical requests on a 4G
 * connection. TODO(wp): the honest home for this is `services/` — it lives
 * here only because this package owns no file there.
 */
let shelfPromise = null;
export function loadShelfProducts() {
  if (!shelfPromise) {
    shelfPromise = listProducts({ page_size: SHELF_SIZE })
      .then((result) => (Array.isArray(result?.items) ? result.items : []))
      .catch(() => []);
  }
  return shelfPromise;
}

/**
 * §2.23 — in stock sorts first, everywhere, unless the customer explicitly
 * sorts. Three of six are unbuyable today, and opening on the sold-out half
 * reads as *sold out*, not as *organised*. `sort` is stable in every engine
 * this app supports, so the API's order survives inside each group.
 * @param {object[]} products
 * @returns {object[]}
 */
export function inStockFirst(products) {
  return [...products].sort(
    (a, b) => Number(stockState(b).sellable) - Number(stockState(a).sellable)
  );
}

/** The 72px niche, its name, its price — one product, linked. */
const ShelfTile = ({ product }) => {
  const stock = stockState(product);

  return (
    <Box
      component={RouterLink}
      to={productPath(product)}
      className="lf-press"
      data-press="card"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--lf-2)',
        minWidth: 0,
        textDecoration: 'none',
        color: 'var(--lf-ink)',
      }}
    >
      {/* THE SAME COMPONENT AS THE HERO (§1.1, §2.30). `stock` is passed
          because a footer row has no <ProductCard data-stock> ancestor to
          read — the single derivation in utils/stock.js stays single. */}
      {/* alt="" because the tile prints the name directly beneath: a
          composed alt here would announce the product twice inside one link
          (and §7.5 rule 2 is why the no-image case is an empty lit shelf
          rather than the name as artwork). */}
      <Alcove
        product={product}
        surface="thumb"
        stock={stock.state}
        alt=""
        style={{ marginInline: 0 }}
      />

      <Typography
        variant="caption"
        component="span"
        className="lf-clamp-2"
        sx={{ color: 'var(--lf-ink-2)' }}
      >
        {product.name}
      </Typography>

      <PriceBlock product={product} size="md" sellable={stock.sellable} />

      {/* A8 — an unlit niche is a colour. When a product is not buyable the
          fact has to be carried by WORDS too, so the status line renders
          exactly where colour alone would otherwise have spoken. */}
      {stock.sellable ? null : <StockLabel stock={stock} variant="inline" />}
    </Box>
  );
};

/** A niche-shaped placeholder, so band 2 occupies its final height (P5). */
const ShelfSkeleton = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--lf-2)', minWidth: 0 }}>
    <Box
      className="lf-skel lf-skel--alcove"
      aria-hidden="true"
      sx={{ inlineSize: 'calc(72px / var(--lf-arch-ratio))' }}
    />
    <Box className="lf-skel lf-skel--text" aria-hidden="true" sx={{ height: 12, width: '80%' }} />
    <Box className="lf-skel lf-skel--text" aria-hidden="true" sx={{ height: 14, width: '42%' }} />
  </Box>
);

const FooterLink = ({ to, children }) => (
  <MuiLink
    component={RouterLink}
    to={to}
    underline="hover"
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: 44, /* A6 — compressed type, full-size target */
      fontSize: '0.8125rem',
      color: 'var(--lf-ink-2)',
      '@media (hover: hover)': { '&:hover': { color: 'var(--lf-ink)' } },
    }}
  >
    {children}
  </MuiLink>
);

/**
 * @param {object} props
 * @param {'full'|'minimal'} [props.chrome='full'] `minimal` is one copyright
 *   line — /checkout and /order-confirmation only (§5.5).
 * @returns {JSX.Element}
 */
const Footer = ({ chrome = 'full' }) => {
  const brand = useBrand();
  const year = new Date().getFullYear();
  const minimal = chrome === 'minimal';

  const [shelf, setShelf] = useState(null);

  useEffect(() => {
    if (minimal) return undefined;
    let alive = true;
    loadShelfProducts().then((items) => {
      if (alive) setShelf(items);
    });
    return () => {
      alive = false;
    };
  }, [minimal]);

  const copyright = `© ${year} ${brand.legalName}. All rights reserved.`;

  if (minimal) {
    return (
      <Box
        component="footer"
        className="lf-hearth-section"
        sx={{ py: 'var(--lf-4)', px: 'var(--lf-gutter)', textAlign: 'center' }}
      >
        <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
          {copyright}
        </Typography>
      </Box>
    );
  }

  const products = shelf ? inStockFirst(shelf) : [];

  return (
    <Box
      component="footer"
      className="lf-hearth-section"
      sx={{ mt: 'var(--lf-sect)', px: 'var(--lf-gutter)' }}
    >
      <Box sx={{ maxWidth: 'var(--lf-container)', mx: 'auto' }}>
        {/* ================= BAND 1 — the brand's last word ================= */}
        <Box sx={{ py: 'var(--lf-sect-sm)' }}>
          {/* Fraunces licence 3 of 3. --lf-gold as text is 8.11:1 here — the
              ONE surface where §10.7's ban is lifted, because the class
              redefines the ground it sits on (§3.5). */}
          <Typography
            variant="wordmark"
            component="p"
            data-wordmark="footer"
            sx={{ color: 'var(--lf-gold)' }}
          >
            {brand.wordmark}
          </Typography>

          <Typography
            variant="h2"
            component="p"
            sx={{ mt: 'var(--lf-4)', maxWidth: '20ch', color: 'var(--lf-ink)' }}
          >
            {brand.territoryLine}
          </Typography>
        </Box>

        {/* ================= BAND 2 — the shop link =========================
            Withheld entirely when the catalogue could not be reached: an
            empty band with a heading over nothing is the empty ceremony this
            direction exists to delete, and §7.5 rule 2's principle — if a
            tile has no content it does not render as a tile — scales up to
            the row that holds them. */}
        {shelf !== null && products.length === 0 ? null : (
        <Box
          component="nav"
          aria-label="Shop"
          sx={{ py: 'var(--lf-sect-sm)', borderTop: '1px solid var(--lf-hairline)' }}
        >
          <Typography variant="eyebrow" component="h2" sx={{ mb: 'var(--lf-4)' }}>
            The shelf
          </Typography>

          <Box
            sx={{
              display: 'grid',
              /* Six tiles in one row from the `shelf` breakpoint up. Below it
                 the same six fall into two rows of three rather than
                 shrinking the niche to 53px, where a product name would
                 column into ten lines. The niche itself never changes shape:
                 it is a percentage geometry at every size (§3.10). */
              gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))', shelf: 'repeat(6, minmax(0, 1fr))' },
              gap: 'var(--lf-5)',
              minWidth: 0,
            }}
          >
            {shelf === null
              ? Array.from({ length: SHELF_SIZE }, (unused, index) => (
                  <ShelfSkeleton key={`shelf-skeleton-${index}`} />
                ))
              : products.map((product) => (
                  <ShelfTile key={product.id ?? product.slug} product={product} />
                ))}
          </Box>
        </Box>
        )}

        {/* ================= BAND 3 — the compressed row ==================== */}
        {/* §3.3 — the ledge, full column width, never capped by a call site.
            One of at most four on any page. */}
        <Box className="lf-ledge" role="presentation" />

        {/* `spacing` is resolved through theme.spacing(), which multiplies a
            NUMBER by 8 — a var() string becomes NaN there. 3/5 are --lf-6 and
            --lf-10 exactly; this is the one place a token is spelled as its
            spacing step rather than its name. */}
        <Grid container spacing={{ xs: 3, md: 5 }} sx={{ py: 'var(--lf-sect-sm)' }}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Typography variant="eyebrow" component="h2" sx={{ mb: 'var(--lf-3)' }}>
              Newsletter
            </Typography>
            {/* THE ONLY NEWSLETTER ON THE SITE (§1.3). The Join button is
                gold fill 2 of 2 (§2.18, §3.3): theme.js's `brandFill` variant,
                which this is the single call site of. <NewsletterForm> now
                takes `buttonVariant`, so the scoped sx bridge this used to
                need is gone and no token is painted from here. */}
            <NewsletterForm variant="inline" buttonVariant="brandFill" source="footer" />
          </Grid>

          <Grid size={{ xs: 12, md: 7 }}>
            <Stack
              direction="row"
              useFlexGap
              flexWrap="wrap"
              sx={{ columnGap: 'var(--lf-5)', rowGap: 0 }}
              component="nav"
              aria-label="Legal and support"
            >
              {LEGAL_LINKS.map((link) => (
                <FooterLink key={link.to} to={link.to}>
                  {link.label}
                </FooterLink>
              ))}
            </Stack>

            <Stack
              direction="row"
              useFlexGap
              flexWrap="wrap"
              sx={{ columnGap: 'var(--lf-5)', rowGap: 0, mt: 'var(--lf-1)' }}
            >
              {/* Support email only. `brand.support.phone` is null and that
                  means "render no phone row" — never a plausible number
                  (§10.11). */}
              <MuiLink
                href={`mailto:${brand.support.email}`}
                underline="hover"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 44,
                  fontSize: '0.8125rem',
                  color: 'var(--lf-ink-2)',
                  '@media (hover: hover)': { '&:hover': { color: 'var(--lf-ink)' } },
                }}
              >
                {brand.support.email}
              </MuiLink>

              {/* The only social handle that exists anywhere in this repo. */}
              <MuiLink
                href={brand.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 44,
                  fontSize: '0.8125rem',
                  color: 'var(--lf-ink-2)',
                  '@media (hover: hover)': { '&:hover': { color: 'var(--lf-ink)' } },
                }}
              >
                {brand.social.instagramHandle}
                <Box component="span" className="lf-sr-only">
                  {' '}
                  (opens in a new tab)
                </Box>
              </MuiLink>
            </Stack>

            <Stack
              direction="row"
              useFlexGap
              flexWrap="wrap"
              sx={{ columnGap: 'var(--lf-5)', rowGap: 'var(--lf-1)', mt: 'var(--lf-2)' }}
            >
              <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
                {copyright}
              </Typography>
              {/* PLAIN TEXT. The State Emblem of India is not rendered here or
                  anywhere else (§10.25). */}
              <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
                Made in India
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default Footer;
