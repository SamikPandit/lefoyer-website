/**
 * EmptyState — and `StateShell`, the ONE approved form for every empty and every error
 * state on the site (ART_DIRECTION §2.16 / §5.8; DESIGN_SYSTEM §6.9).
 *
 * THE ILLUSTRATION DECISION, WHICH IS FINAL
 * No illustrations. No mascots. No spot art. Ever. There is no illustration system, a
 * per-state SVG is 8-20 KB carrying zero information, and a cartoon in an empty cart is
 * the single most common way a premium store tells you it is not premium.
 *
 * The approved form, identical everywhere:
 *   64px tinted circle -> one 28px MUI *outline* icon
 *   heading, the state in plain words
 *   one line of body, max two sentences
 *   -> one PRIMARY action (the way forward)
 *   -> one TEXT action    (the way out)
 *   -> REAL PRODUCTS as `children`
 *
 * §2.28 is the half that was never built: `children` shipped with a docstring example
 * and zero callers, so six routes rendered a 64px circle and stopped. With six SKUs
 * every empty state can show the entire shop. `useProductShelf()` below is what makes
 * that one line at each call site instead of six copies of a fetch.
 *
 * ============================================================================
 * ALSO EXPORTED: THE TWO PAGE ARCHETYPES (§2.34 / §5.9)
 *
 * Nine pages used five heading sizes and five padding pairs — "Saved items" rendered
 * 50% larger than "My orders" and "My account", three pages of the same kind reached
 * from the same menu. §5.9 collapses that to two:
 *
 *   EDITORIAL  About · Contact · Help · 404 (and the three legal pages)
 *              h1 (30→44px), left, 56ch measure, py: var(--lf-sect-lg)
 *   UTILITY    Cart · Checkout · Orders · Profile · Wishlist · Search · Confirmation
 *              h3 as h1 (22→26px), left, py: var(--lf-sect)
 *
 * They live in this file rather than a new module for the same reason `FOCUS_RING_SX`
 * does, stated by the comment below it: this work package owns a fixed file list and
 * may not add to it, and hand-copied layouts are how the build acquired five paddings
 * in the first place. `AuthPanel` sits in `components/auth/CheckYourInbox.jsx` under
 * exactly the same convention. If a later change may add `components/common/page.jsx`,
 * move `PageShell`/`PageHeader`/`useProductShelf` there and re-point the importers —
 * nothing else changes.
 *
 * `<SecurityNotice>` (§5.8) sits here for the same reason: the fraud notice moved off
 * every route in the site and onto exactly two — `/contact` and `/faq` — and a warning
 * that exists twice has to exist once in the source.
 *
 * `useProductShelf` imports `services/api` only. It must NEVER import `ProductCard`:
 * ProductCard -> NotifyMe -> NotifyMeDialog -> EmptyState is a real edge, so pulling
 * the card in here would close a module cycle. Callers render the cards; this hook
 * only fetches, sorts and aborts.
 * ============================================================================
 *
 * Usage:
 *   <EmptyState
 *     icon={<ShoppingBagOutlinedIcon />}
 *     title="Your bag is empty"
 *     primaryLabel="Shop all products" primaryTo="/products"
 *   >
 *     <CrossSell title="You might like" limit={4} />
 *   </EmptyState>
 */

import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import SearchOffIcon from '@mui/icons-material/SearchOff';

import { listProducts } from '../../services/api';
import { useBrand } from '../../content/brand';

/* ---------------------------------------------------------------------------- *
 * Shared `sx` fragments. They live in this file rather than a utils module
 * because WP-07c owns exactly twelve files and may not add a thirteenth; every
 * other shared component in this package imports them from here. If a later
 * change is allowed to add `components/common/sx.js`, move these two there and
 * re-point the six importers — nothing else needs to change.
 * ---------------------------------------------------------------------------- */

/** §3.6: the focus ring, applied explicitly so it survives any theme ordering. */
export const FOCUS_RING_SX = {
  '&:focus-visible': {
    outline: '2px solid var(--lf-focus)',
    outlineOffset: '2px',
  },
};

/** A6: every interactive target in this package is at least 44px. */
export const TOUCH_TARGET_SX = { minHeight: 44 };

/** §5.8: the one primary on a utility/auth route is 48px of ink. */
/* `whiteSpace: nowrap` is not decoration: these labels sit in a centred action
   row whose children are shrink-to-fit, so `Browse all products` broke across
   two lines inside a 48px button on the 404. A commerce label never wraps
   (§6.5 applies the same rule to Add to bag). */
export const PRIMARY_ACTION_SX = { minHeight: 48, whiteSpace: 'nowrap' };

/* ---------------------------------------------------------------------------- *
 * §5.9 — THE TWO PAGE ARCHETYPES
 * ---------------------------------------------------------------------------- */

/**
 * §5.9's reading measure. Applied to the editorial intro and to long-form body
 * columns; `body1` already carries the 62ch cap from §3.7, so this is the tighter
 * editorial setting, not a second opinion about the same thing.
 */
export const MEASURE_SX = { maxWidth: '56ch' };

/** The section rhythm each archetype runs on (§3.8). */
export const ARCHETYPE_PY = {
  editorial: 'var(--lf-sect-lg)',
  utility: 'var(--lf-sect)',
};

const isEditorial = (archetype) => archetype !== 'utility';

/**
 * The heading block both archetypes share. Left-aligned, one `h1` per route, and
 * the only place a page title is sized — so a page cannot pick its own register.
 *
 * @param {object} props
 * @param {'editorial'|'utility'} [props.archetype='editorial']
 * @param {React.ReactNode} [props.eyebrow] 12px gold-ink kicker (§3.7 `eyebrow`).
 * @param {React.ReactNode} props.title The route's one `h1`.
 * @param {React.ReactNode} [props.intro] One short paragraph, at the 56ch measure.
 * @param {React.ReactNode} [props.actions] Optional trailing row (a link, a button).
 * @param {object} [props.sx]
 */
export const PageHeader = ({ archetype = 'editorial', eyebrow, title, intro, actions, sx }) => {
  const editorial = isEditorial(archetype);
  return (
    <Box
      component="header"
      sx={{ mb: editorial ? { xs: 4, md: 6 } : { xs: 3, md: 4 }, ...sx }}
    >
      {eyebrow ? (
        <Typography variant="eyebrow" component="p" sx={{ mb: 1.5 }}>
          {eyebrow}
        </Typography>
      ) : null}

      <Typography
        variant={editorial ? 'h1' : 'h3'}
        component="h1"
        sx={{ color: 'var(--lf-ink)', ...MEASURE_SX }}
      >
        {title}
      </Typography>

      {intro ? (
        <Typography variant="body1" sx={{ mt: 2, color: 'var(--lf-ink-2)', ...MEASURE_SX }}>
          {intro}
        </Typography>
      ) : null}

      {actions ? <Box sx={{ mt: 3 }}>{actions}</Box> : null}
    </Box>
  );
};

/**
 * The whole page frame: canvas, the archetype's section rhythm, a container on the
 * `--lf-gutter` (MuiContainer reads it, §3.13) and the heading block.
 *
 * @param {object} props
 * @param {'editorial'|'utility'} [props.archetype='editorial']
 * @param {'sm'|'md'|'lg'|'xl'|false} [props.maxWidth='lg']
 * @param {React.ReactNode} [props.eyebrow]
 * @param {React.ReactNode} [props.title] Omit to render the frame with no header.
 * @param {React.ReactNode} [props.intro]
 * @param {React.ReactNode} [props.headerActions]
 * @param {object} [props.headerSx]
 * @param {object} [props.sx] Applied to the outer canvas band.
 * @param {React.ReactNode} props.children
 */
export const PageShell = ({
  archetype = 'editorial',
  maxWidth = 'lg',
  eyebrow,
  title,
  intro,
  headerActions,
  headerSx,
  sx,
  children,
  ...rest
}) => (
  <Box
    sx={{ backgroundColor: 'var(--lf-canvas)', py: ARCHETYPE_PY[archetype] || ARCHETYPE_PY.editorial, ...sx }}
    {...rest}
  >
    <Container maxWidth={maxWidth}>
      {title ? (
        <PageHeader
          archetype={archetype}
          eyebrow={eyebrow}
          title={title}
          intro={intro}
          actions={headerActions}
          sx={headerSx}
        />
      ) : null}
      {children}
    </Container>
  </Box>
);

/* ---------------------------------------------------------------------------- *
 * §2.28 — the real products every empty state is supposed to show
 * ---------------------------------------------------------------------------- */

/**
 * Fetch a short shelf for an empty state, a 404 or an idle search.
 *
 * §2.23: in-stock sorts first, everywhere, unless the customer explicitly sorted —
 * opening on sold-out rows reads as *sold out*, not as *organised*. The partition is
 * stable, so the server's own order survives inside each half.
 *
 * It never throws and never renders an error: a decorative shelf that fails is simply
 * absent. The page's own state is the thing that had to load.
 *
 * @param {object} [options]
 * @param {boolean} [options.inStockOnly=false] Ask the API for sellable rows only.
 * @param {number}  [options.limit=6] How many to keep.
 * @param {boolean} [options.enabled=true] Skip the request entirely.
 * @returns {{products: object[], loading: boolean}}
 */
export function useProductShelf({ inStockOnly = false, limit = 6, enabled = true } = {}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setProducts([]);
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    let alive = true;
    setLoading(true);

    listProducts(
      { page_size: limit, ...(inStockOnly ? { in_stock: true } : null) },
      { signal: controller.signal },
    )
      .then((result) => {
        if (!alive) return;
        const items = Array.isArray(result?.items) ? result.items : [];
        // §2.23 — stable in-stock-first partition.
        const lit = items.filter((item) => item?.in_stock !== false);
        const unlit = items.filter((item) => item?.in_stock === false);
        setProducts([...lit, ...unlit].slice(0, limit));
      })
      .catch(() => {
        if (alive) setProducts([]);
      })
      .then(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [enabled, inStockOnly, limit]);

  return { products, loading };
}

/* ---------------------------------------------------------------------------- *
 * §5.8 — the fraud notice, which used to render on every route
 * ---------------------------------------------------------------------------- */

/**
 * §5.8 — the fraud notice, moved off every page in the site and reworded so it cannot
 * be read as being about the payment gateway. The sentence is the one §5.8 specifies,
 * verbatim; the report-it line is assembled from `brand.js` so neither the trading name
 * nor the support address is ever retyped.
 *
 * Rendered on `/contact` and `/faq` and nowhere else. It is deliberately NOT
 * `role="alert"` and NOT an error tint: it is standing advice, not an event, and a red
 * panel beside a support form reads as "something has gone wrong with your order".
 *
 * @param {object} props
 * @param {object} [props.sx]
 */
export const SecurityNotice = ({ sx }) => {
  const brand = useBrand();
  return (
    <Box
      component="section"
      aria-labelledby="security-notice-heading"
      sx={{
        p: { xs: 2.5, md: 3 },
        backgroundColor: 'var(--lf-warn-tint)',
        borderRadius: 'var(--lf-r-panel)',
        ...sx,
      }}
    >
      <Typography
        id="security-notice-heading"
        variant="h5"
        component="h2"
        sx={{ color: 'var(--lf-warn-ink)', mb: 1 }}
      >
        If someone asks you for a payment
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
        We will never call or message you asking for a payment. All payments happen on
        this site or on PhonePe&rsquo;s own page.
      </Typography>
      <Typography variant="body2" sx={{ mt: 1.5, color: 'var(--lf-ink-2)' }}>
        If someone contacts you claiming to be {brand.legalName}, report it to{' '}
        <Link
          href={`mailto:${brand.support.email}`}
          underline="always"
          sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}
        >
          {brand.support.email}
        </Link>
        .
      </Typography>
    </Box>
  );
};

/* ---------------------------------------------------------------------------- *
 * The state shell
 * ---------------------------------------------------------------------------- */

const TONES = {
  neutral: {
    /* §3.1 — the niche wall. --lf-ink-3 measures 4.98:1 on it. */
    circleBg: 'var(--lf-mat)',
    iconColor: 'var(--lf-ink-3)',
    edge: null,
    panelBg: null,
  },
  error: {
    circleBg: 'var(--lf-err-tint)',
    iconColor: 'var(--lf-err-ink)',
    edge: 'var(--lf-err-ink)',
    panelBg: 'var(--lf-err-tint)',
  },
  warn: {
    circleBg: 'var(--lf-warn-tint)',
    iconColor: 'var(--lf-warn-ink)',
    edge: 'var(--lf-warn-ink)',
    panelBg: 'var(--lf-warn-tint)',
  },
  ok: {
    circleBg: 'var(--lf-ok-tint)',
    iconColor: 'var(--lf-ok-ink)',
    edge: 'var(--lf-ok-ink)',
    panelBg: 'var(--lf-ok-tint)',
  },
  /* §3.3: --lf-gold-ink measures 5.26:1 on --lf-gold-tint. Used for the "we have
     emailed you" moments, which are neither a success nor a warning. */
  gold: {
    circleBg: 'var(--lf-gold-tint)',
    iconColor: 'var(--lf-gold-ink)',
    edge: 'var(--lf-gold-ink)',
    panelBg: 'var(--lf-gold-tint)',
  },
};

/**
 * §2.16's glyph, which is the ONLY glyph treatment on the site: a 64px tinted circle
 * holding one 28px MUI *outline* icon. Never an illustration, never a spot graphic.
 *
 * Exported because four auth routes were each building this box by hand with their own
 * copy of the same nine declarations, which is how a 64px circle becomes a 56px circle
 * on one route.
 *
 * @param {object} props
 * @param {'neutral'|'error'|'warn'|'ok'|'gold'} [props.tone='neutral']
 * @param {object} [props.sx]
 * @param {React.ReactNode} props.children The 28px outline icon.
 */
export const StateIcon = ({ tone = 'neutral', sx, children }) => {
  const toneTokens = TONES[tone] || TONES.neutral;
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: 64,
        height: 64,
        flex: '0 0 auto',
        mx: 'auto',
        mb: 2.5,
        borderRadius: 'var(--lf-r-pill)',
        backgroundColor: toneTokens.circleBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        '& > svg': { fontSize: 28, color: toneTokens.iconColor },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

/**
 * The shared box. Renders the circle, the heading, one line, the actions and whatever
 * rail you pass as children — nothing else, by design.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.icon] A 28px MUI *outline* icon element.
 * @param {string} props.title The state, in plain words.
 * @param {React.ReactNode} [props.message] ONE line. Two sentences at the absolute most.
 * @param {'neutral'|'error'|'warn'|'ok'} [props.tone='neutral']
 * @param {'inline'|'page'} [props.variant='inline'] `page` adds vertical breathing room
 *   for a whole-route state; `inline` keeps a failed section inside a live page.
 * @param {boolean} [props.panel=false] Draw the 3px semantic left edge on a tinted
 *   panel. ErrorState sets this; an empty state never needs it.
 * @param {React.ReactNode} [props.actions] The button row.
 * @param {'h1'|'h2'|'h3'|'h4'} [props.headingComponent='h2'] Pick the level that fits
 *   the page outline — a section state is usually h2 or h3, never h1.
 * @param {string} [props.titleVariant] Overrides the heading's type register. The 404
 *   passes `h1`, because §5.9 gives that route the editorial title size.
 * @param {string} [props.role] e.g. `alert` for an error, omitted for an empty state.
 * @param {boolean} [props.focusOnMount=false] Move focus here. ONLY for a failure the
 *   user initiated (a Retry tap); never on a background load.
 * @param {object} [props.sx]
 * @param {React.ReactNode} [props.children] Optional product rail / extra content.
 */
export const StateShell = ({
  icon,
  title,
  message,
  tone = 'neutral',
  variant = 'inline',
  panel = false,
  actions,
  headingComponent = 'h2',
  titleVariant,
  role,
  focusOnMount = false,
  sx,
  children,
  ...rest
}) => {
  const toneTokens = TONES[tone] || TONES.neutral;
  const containerRef = useRef(null);

  useEffect(() => {
    if (focusOnMount && containerRef.current) containerRef.current.focus();
  }, [focusOnMount]);

  const isPage = variant === 'page';

  return (
    <Box
      ref={containerRef}
      role={role}
      tabIndex={focusOnMount ? -1 : undefined}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        // 16px side gutter: this must stay usable inside a 320px viewport.
        px: 2,
        py: isPage ? { xs: 5, md: 7 } : { xs: 4, md: 5 },
        width: '100%',
        maxWidth: '100%',
        ...(panel && toneTokens.edge
          ? {
              backgroundColor: toneTokens.panelBg,
              borderLeft: `3px solid ${toneTokens.edge}`,
              borderRadius: 'var(--lf-r-panel)',
              // Square off the edge side so the 3px rule reads as a rule.
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
            }
          : {}),
        ...FOCUS_RING_SX,
        ...sx,
      }}
      {...rest}
    >
      <StateIcon tone={tone}>{icon || <SearchOffIcon />}</StateIcon>

      <Typography
        variant={titleVariant || (isPage ? 'h3' : 'h4')}
        component={headingComponent}
        sx={{ color: 'var(--lf-ink)', mb: message ? 1 : 0, maxWidth: 520 }}
      >
        {title}
      </Typography>

      {message ? (
        <Typography variant="body1" sx={{ color: 'var(--lf-ink-2)', maxWidth: 440, mx: 'auto' }}>
          {message}
        </Typography>
      ) : null}

      {actions ? (
        <Box
          sx={{
            mt: 3,
            display: 'flex',
            // Stacks at 320px, sits in a row from 360px up.
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            width: '100%',
            maxWidth: 360,
          }}
        >
          {actions}
        </Box>
      ) : null}

      {children ? (
        <Box sx={{ mt: isPage ? 6 : 4, width: '100%', textAlign: 'left' }}>{children}</Box>
      ) : null}
    </Box>
  );
};

/**
 * Shared action builder, so the primary/secondary pair looks the same in both states.
 * @param {object} config
 */
export function buildStateActions({
  primaryLabel,
  primaryTo,
  onPrimary,
  secondaryLabel,
  secondaryTo,
  onSecondary,
}) {
  const nodes = [];

  if (primaryLabel && (primaryTo || onPrimary)) {
    nodes.push(
      <Button
        key="primary"
        className="lf-press"
        variant="contained"
        color="primary"
        disableElevation
        onClick={onPrimary}
        {...(primaryTo ? { component: RouterLink, to: primaryTo } : {})}
        sx={{
          ...PRIMARY_ACTION_SX,
          px: 3,
          width: { xs: '100%', sm: 'auto' },
          ...FOCUS_RING_SX,
        }}
      >
        {primaryLabel}
      </Button>,
    );
  }

  if (secondaryLabel && (secondaryTo || onSecondary)) {
    nodes.push(
      <Button
        key="secondary"
        className="lf-press"
        variant="text"
        onClick={onSecondary}
        {...(secondaryTo ? { component: RouterLink, to: secondaryTo } : {})}
        sx={{
          ...TOUCH_TARGET_SX,
          px: 2,
          color: 'var(--lf-ink-2)',
          width: { xs: '100%', sm: 'auto' },
          whiteSpace: 'nowrap',
          ...FOCUS_RING_SX,
        }}
      >
        {secondaryLabel}
      </Button>,
    );
  }

  return nodes.length > 0 ? nodes : null;
}

/**
 * @param {object} props
 * @param {React.ReactNode} [props.icon] 28px MUI outline icon. Defaults to a search-off
 *   glyph; pass something closer to the domain where one exists.
 * @param {string} props.title e.g. "Your bag is empty", `No products match "xyz"`.
 * @param {React.ReactNode} [props.message] One line.
 * @param {string} [props.primaryLabel]
 * @param {string} [props.primaryTo] Client-side route for the primary action.
 * @param {Function} [props.onPrimary] Use instead of `primaryTo` for an in-page action
 *   such as "Clear all filters".
 * @param {string} [props.secondaryLabel]
 * @param {string} [props.secondaryTo]
 * @param {Function} [props.onSecondary]
 * @param {'inline'|'page'} [props.variant='inline']
 * @param {'h1'|'h2'|'h3'|'h4'} [props.headingComponent='h2']
 * @param {string} [props.titleVariant]
 * @param {object} [props.sx]
 * @param {React.ReactNode} [props.children] A real product rail, where it helps.
 */
const EmptyState = ({
  icon,
  title,
  message,
  primaryLabel,
  primaryTo,
  onPrimary,
  secondaryLabel,
  secondaryTo,
  onSecondary,
  variant = 'inline',
  headingComponent = 'h2',
  titleVariant,
  sx,
  children,
  ...rest
}) => (
  <StateShell
    icon={icon}
    title={title}
    message={message}
    tone="neutral"
    variant={variant}
    headingComponent={headingComponent}
    titleVariant={titleVariant}
    actions={buildStateActions({
      primaryLabel,
      primaryTo,
      onPrimary,
      secondaryLabel,
      secondaryTo,
      onSecondary,
    })}
    sx={sx}
    {...rest}
  >
    {children}
  </StateShell>
);

export default EmptyState;
