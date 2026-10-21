/**
 * ErrorState — what a backend outage is supposed to look like.
 *
 * §5.8: "Error panels keep their 3px semantic left edge, `role="alert"`, plain
 * language, NEVER a status code, and backoff 600ms -> 1.5s -> 4s." All four were
 * already true here and all four are preserved verbatim; this revision only moves the
 * primary action onto §5.8's 48px ink geometry and drops the stale hex fallbacks that
 * predate §3's token rewrite.
 *
 * This component exists because of the single most common defect in the previous code:
 * a failed fetch and an empty result set were the same branch, so stopping the API made
 * the listing page say "No products found. Try adjusting your filters." The shopper
 * removed every filter and still saw nothing. ErrorState and EmptyState are different
 * components on purpose, and a `catch` block must never render EmptyState.
 *
 * Shape and rules (DESIGN_SYSTEM §6.9):
 *   - the same 64px circle + 28px outline icon as every other state. No illustrations.
 *   - a 3px semantic left edge on the error tint, `role="alert"`.
 *   - plain language, and NEVER a status code. We take the axios error only to read its
 *     `isNetwork` / `isThrottled` flags; its `.message` ("Request failed with status
 *     code 500") is never shown.
 *   - a PRIMARY "Try again" and a TEXT escape, which defaults to "Browse all products".
 *   - Retry backs off 600ms -> 1.5s -> 4s across three attempts, then stops offering
 *     Retry and offers support instead. Three identical failures are not a connectivity
 *     blip and a fourth button press will not help.
 *   - focus moves to the panel only when the failure was user-initiated — pass
 *     `focusOnMount` from a Retry handler, never on a background load.
 *   - `variant="inline"` keeps the rest of the page alive: a failed filter fetch must
 *     not take the grid down with it.
 *
 * Usage:
 *   <ErrorState title="Couldn't load products" onRetry={fetchProducts} />
 *   <ErrorState title="Couldn't load this product" error={err}
 *               onRetry={reload} secondaryLabel="Shop all" secondaryTo="/products" />
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WifiOffOutlinedIcon from '@mui/icons-material/WifiOffOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';

import SupportLink from './SupportLink';
import { FOCUS_RING_SX, PRIMARY_ACTION_SX, StateShell, TOUCH_TARGET_SX } from './EmptyState';

/** §6.9: 600ms, then 1.5s, then 4s. Index = attempts already made. */
export const RETRY_BACKOFF_MS = [600, 1500, 4000];
export const MAX_RETRY_ATTEMPTS = 3;

/**
 * Honest copy for the three failure classes we can actually distinguish. api.js sets
 * `isNetwork` and `isThrottled` on the error; everything else is "the server said no",
 * and we do not pretend to know more than that.
 */
function describe(error) {
  if (error && error.isNetwork) {
    return {
      icon: <WifiOffOutlinedIcon />,
      message: "We couldn't reach the server. Check your connection and try again.",
    };
  }
  if (error && error.isThrottled) {
    return {
      icon: <HourglassEmptyOutlinedIcon />,
      message: 'Too many requests in a row. Give it a few seconds, then try again.',
    };
  }
  return {
    icon: <ErrorOutlineIcon />,
    message: 'Something went wrong on our side. Trying again usually fixes it.',
  };
}

/**
 * @param {object} props
 * @param {string} [props.title="Something went wrong"] The state in plain words. Prefer
 *   the specific wording: "Couldn't load products", "Couldn't load this product".
 * @param {React.ReactNode} [props.message] Overrides the derived copy. Never put a
 *   status code, a stack, or an axios message in here.
 * @param {object} [props.error] The caught axios error. Read for `isNetwork` /
 *   `isThrottled` only.
 * @param {Function} [props.onRetry] Re-runs the real request. May return a promise; if
 *   it does, the button shows a spinner until it settles.
 * @param {string} [props.retryLabel="Try again"]
 * @param {string} [props.secondaryLabel="Browse all products"] The way out. Pass `null`
 *   to suppress it (for example inside the cart, where leaving is not the point).
 * @param {string} [props.secondaryTo="/products"]
 * @param {Function} [props.onSecondary] Use instead of `secondaryTo` for an in-page
 *   escape such as "Clear all filters".
 * @param {'inline'|'page'} [props.variant='inline']
 * @param {boolean} [props.focusOnMount=false] Only for a user-initiated failure.
 * @param {number} [props.maxAttempts=3] After this many failed retries, Retry is
 *   replaced by a support link.
 * @param {React.ReactNode} [props.icon] Override the derived glyph.
 * @param {'h1'|'h2'|'h3'|'h4'} [props.headingComponent='h2']
 * @param {object} [props.sx]
 * @param {React.ReactNode} [props.children]
 */
const ErrorState = ({
  title = 'Something went wrong',
  message,
  error,
  onRetry,
  retryLabel = 'Try again',
  secondaryLabel = 'Browse all products',
  secondaryTo = '/products',
  onSecondary,
  variant = 'inline',
  focusOnMount = false,
  maxAttempts = MAX_RETRY_ATTEMPTS,
  icon,
  headingComponent = 'h2',
  sx,
  children,
  ...rest
}) => {
  const described = describe(error);
  const [attempts, setAttempts] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const timerRef = useRef(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // A new error object means a new failure: the user is allowed to try again.
  useEffect(() => {
    setAttempts(0);
  }, [error]);

  const handleRetry = useCallback(() => {
    if (!onRetry || retrying) return;
    const delay = RETRY_BACKOFF_MS[Math.min(attempts, RETRY_BACKOFF_MS.length - 1)];
    setRetrying(true);
    setAttempts((n) => n + 1);
    timerRef.current = setTimeout(() => {
      let result;
      try {
        result = onRetry();
      } catch {
        // A synchronous throw from the caller is still a finished attempt.
        if (aliveRef.current) setRetrying(false);
        return;
      }
      if (result && typeof result.then === 'function') {
        result
          .catch(() => {})
          .then(() => {
            if (aliveRef.current) setRetrying(false);
          });
      } else if (aliveRef.current) {
        setRetrying(false);
      }
    }, delay);
  }, [attempts, onRetry, retrying]);

  const exhausted = attempts >= maxAttempts;
  const showRetry = Boolean(onRetry) && !exhausted;

  const actions = [];

  if (showRetry) {
    actions.push(
      <Button
        key="retry"
        className="lf-press"
        variant="contained"
        color="primary"
        disableElevation
        onClick={handleRetry}
        aria-busy={retrying ? 'true' : undefined}
        sx={{
          ...PRIMARY_ACTION_SX,
          px: 3,
          width: { xs: '100%', sm: 'auto' },
          ...FOCUS_RING_SX,
        }}
        startIcon={
          retrying ? <CircularProgress size={16} thickness={3.6} color="inherit" /> : null
        }
      >
        {retrying ? 'Retrying' : retryLabel}
      </Button>,
    );
  }

  if (secondaryLabel && (secondaryTo || onSecondary)) {
    actions.push(
      <Button
        key="escape"
        className="lf-press"
        variant={showRetry ? 'text' : 'contained'}
        color="primary"
        disableElevation={!showRetry}
        onClick={onSecondary}
        {...(secondaryTo ? { component: RouterLink, to: secondaryTo } : {})}
        sx={{
          ...(showRetry ? TOUCH_TARGET_SX : PRIMARY_ACTION_SX),
          px: showRetry ? 2 : 3,
          color: showRetry ? 'var(--lf-ink-2)' : undefined,
          width: { xs: '100%', sm: 'auto' },
          ...FOCUS_RING_SX,
        }}
      >
        {secondaryLabel}
      </Button>,
    );
  }

  return (
    <StateShell
      icon={icon || described.icon}
      title={title}
      message={message || described.message}
      tone="error"
      panel
      variant={variant}
      role="alert"
      focusOnMount={focusOnMount}
      headingComponent={headingComponent}
      actions={actions.length > 0 ? actions : null}
      sx={sx}
      {...rest}
    >
      {exhausted ? (
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)', mb: 1 }}>
            That has failed {maxAttempts} times now, so it is not a connection blip.
          </Typography>
          <SupportLink topic="technical" />
        </Box>
      ) : null}
      {children}
    </StateShell>
  );
};

export default ErrorState;
