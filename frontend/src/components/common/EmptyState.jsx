/**
 * EmptyState — and `StateShell`, the ONE approved form for every empty and every error
 * state on the site (DESIGN_SYSTEM §6.9).
 *
 * THE ILLUSTRATION DECISION, WHICH IS FINAL
 * No illustrations. No mascots. No spot art. Ever. There is no illustration system, a
 * per-state SVG is 8-20 KB carrying zero information, and a cartoon in an empty cart is
 * the single most common way a premium store tells you it is not premium.
 *
 * The approved form, identical everywhere:
 *   64px circle (sunken for empty, the semantic tint for error)
 *     -> one 28px MUI *outline* icon
 *   heading, the state in plain words
 *   one line of body, max two sentences
 *   -> one PRIMARY action (the way forward)
 *   -> one TEXT action    (the way out)
 *   -> optionally a real product rail as `children`, where that is commercially sensible
 *
 * `StateShell` is exported so ErrorState renders the same box rather than a lookalike.
 * Import `StateShell` only if you are building a state this pair genuinely cannot cover.
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

import { useEffect, useRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import SearchOffIcon from '@mui/icons-material/SearchOff';

/* ---------------------------------------------------------------------------- *
 * Shared `sx` fragments. They live in this file rather than a utils module
 * because WP-07c owns exactly twelve files and may not add a thirteenth; every
 * other shared component in this package imports them from here. If a later
 * change is allowed to add `components/common/sx.js`, move these two there and
 * re-point the six importers — nothing else needs to change.
 * ---------------------------------------------------------------------------- */

/** §6.1: the focus ring, applied explicitly so it survives any theme ordering. */
export const FOCUS_RING_SX = {
  '&:focus-visible': {
    outline: '2px solid var(--lf-focus, #14110F)',
    outlineOffset: '2px',
  },
};

/** Every control in this package is at least 44px tall. */
export const TOUCH_TARGET_SX = { minHeight: 44 };

const TONES = {
  neutral: {
    circleBg: 'var(--lf-surface-sunken, #F6F2EC)',
    iconColor: 'var(--lf-ink-3, #6B635A)',
    edge: null,
    panelBg: null,
  },
  error: {
    circleBg: 'var(--lf-err-tint, #FCECEA)',
    iconColor: 'var(--lf-err-ink, #A01C15)',
    edge: 'var(--lf-err-ink, #A01C15)',
    panelBg: 'var(--lf-err-tint, #FCECEA)',
  },
  warn: {
    circleBg: 'var(--lf-warn-tint, #FDF3E0)',
    iconColor: 'var(--lf-warn-ink, #7A4F00)',
    edge: 'var(--lf-warn-ink, #7A4F00)',
    panelBg: 'var(--lf-warn-tint, #FDF3E0)',
  },
  ok: {
    circleBg: 'var(--lf-ok-tint, #E7F4EC)',
    iconColor: 'var(--lf-ok-ink, #15663D)',
    edge: 'var(--lf-ok-ink, #15663D)',
    panelBg: 'var(--lf-ok-tint, #E7F4EC)',
  },
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
        py: isPage ? { xs: 6, md: 10 } : { xs: 4, md: 5 },
        width: '100%',
        maxWidth: '100%',
        ...(panel && toneTokens.edge
          ? {
              backgroundColor: toneTokens.panelBg,
              borderLeft: `3px solid ${toneTokens.edge}`,
              borderRadius: 'var(--lf-r-panel, 18px)',
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
      <Box
        aria-hidden="true"
        sx={{
          width: 64,
          height: 64,
          flex: '0 0 auto',
          borderRadius: 'var(--lf-r-pill, 999px)',
          backgroundColor: toneTokens.circleBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2.5,
          '& > svg': { fontSize: 28, color: toneTokens.iconColor },
        }}
      >
        {icon || <SearchOffIcon />}
      </Box>

      <Typography
        variant={isPage ? 'h3' : 'h4'}
        component={headingComponent}
        sx={{ color: 'var(--lf-ink, #14110F)', mb: message ? 1 : 0, maxWidth: 520 }}
      >
        {title}
      </Typography>

      {message ? (
        <Typography
          variant="body1"
          sx={{ color: 'var(--lf-ink-2, #4A433C)', maxWidth: 440, mx: 'auto' }}
        >
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
  primaryDisabled,
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
        disabled={primaryDisabled}
        onClick={onPrimary}
        {...(primaryTo ? { component: RouterLink, to: primaryTo } : {})}
        sx={{
          ...TOUCH_TARGET_SX,
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
          color: 'var(--lf-ink-2, #4A433C)',
          width: { xs: '100%', sm: 'auto' },
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
