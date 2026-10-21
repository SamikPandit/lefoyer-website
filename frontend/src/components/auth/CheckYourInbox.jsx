/**
 * CheckYourInbox — what a shopper sees after we claim to have emailed them.
 *
 * WHY THIS IS A COMPONENT AND NOT AN `<Alert severity="success">`
 * `SignUp.jsx` used to render one inline green alert, "Registration successful!
 * Please check your email…", for every outcome. `POST /api/auth/register/` now
 * reports `verification_email_sent` (§2b #29) precisely because that sentence was
 * a lie whenever Celery or SMTP was down: the account existed, no mail had been
 * sent, and the customer sat watching an empty inbox blaming themselves. This
 * component renders a WARNING in that case, with Resend as the primary action.
 *
 * It is also the whole "verify your email" surface for `Login.jsx` (the
 * `email_not_verified` branch) and for `VerifyEmail.jsx`'s expired/invalid branch,
 * so the resend affordance behaves identically wherever a customer meets it.
 *
 * THE RESEND CONTRACT, matched to the server rather than guessed:
 *   `accounts/throttles.py::ResendVerificationThrottle` is `3/hour` keyed on the
 *   submitted EMAIL with `min_interval_seconds = 60`. So the button cools down for
 *   60s after each attempt (a user who waits for it to re-enable never sees a 429)
 *   and the counter stops at three. A 429 that arrives anyway carries
 *   `retry_after`, which api.js surfaces as `error.retryAfter`, and the countdown
 *   adopts it instead of inventing one.
 *   `POST /api/auth/resend-verification/` answers with ONE neutral body for an
 *   unknown address, an unverified one and an already-verified one, so this
 *   component must never phrase the response as confirmation that an account
 *   exists. It prints the server's own sentence.
 *
 * ALSO EXPORTED: `AuthPanel`
 * The five auth routes (Login, SignUp, VerifyEmail, ForgotPassword,
 * ResetPassword) need one identical card. WP-12 owns exactly thirteen
 * files and may not add a fourteenth, and five hand-copied layouts is how the
 * previous build ended up with three different page paddings, so the shell lives
 * here next to its heaviest consumer — the same reason `EmptyState.jsx` exports
 * `FOCUS_RING_SX`. If a later change may add `components/auth/AuthPanel.jsx`,
 * move it there and re-point the five importers; nothing else changes.
 *
 * ART_DIRECTION §5.8, which this revision applies:
 *   "Auth (/login, /signup, /verify-email, /forgot-password) — UTILITY, single
 *    column capped at 420px, --lf-paper panel on --lf-canvas, --lf-border-field
 *    on every input (SC 1.4.11), one 48px ink primary, one text escape. No
 *    marketing copy, no product rail, no social proof."
 * So: the `width="sm"` escape hatch is gone (SignUp's two-up field row with it),
 * the panel is `--lf-paper` on `--lf-canvas` at the §3.1 1.115:1 step, the page
 * rhythm is the UTILITY archetype's `var(--lf-sect)`, and the title is §5.9's
 * `h3 component="h1"`, left. `--lf-border-field` arrives from `theme.js`'s
 * `MuiOutlinedInput` override, so no page sets an input border by hand.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import ReportGmailerrorredOutlinedIcon from '@mui/icons-material/ReportGmailerrorredOutlined';

import { getApiErrorMessage, resendVerification } from '../../services/api';
import {
  ARCHETYPE_PY,
  FOCUS_RING_SX,
  PRIMARY_ACTION_SX,
  StateIcon,
  TOUCH_TARGET_SX,
} from '../common/EmptyState';
import SupportLink from '../common/SupportLink';

/** Matches `ResendVerificationThrottle.min_interval_seconds`. */
export const RESEND_COOLDOWN_SECONDS = 60;
/** Matches the `resend_verification` scope's `3/hour`. */
export const RESEND_MAX_ATTEMPTS = 3;

/* ------------------------------------------------------------------ *
 * The shared auth card.
 * ------------------------------------------------------------------ */

/** §5.8 — the auth column is capped here and nowhere else. */
export const AUTH_COLUMN_MAX = 420;

/**
 * @param {object} props
 * @param {string} props.title Page heading. §5.9's UTILITY register: `h3` as `h1`.
 * @param {React.ReactNode} [props.subtitle] One line under the heading. Never
 *   marketing copy — §5.8 bans it on these four routes.
 * @param {React.ReactNode} [props.children] The form or the state.
 * @param {React.ReactNode} [props.footer] Links under the card (sign in / sign up).
 * @param {object} [props.sx]
 */
export const AuthPanel = ({ title, subtitle, children, footer, sx }) => (
  <Box sx={{ backgroundColor: 'var(--lf-canvas)', py: ARCHETYPE_PY.utility }}>
    <Container
      component="main"
      maxWidth={false}
      sx={{ maxWidth: AUTH_COLUMN_MAX, ...sx }}
    >
      <Box sx={{ mb: 3 }}>
        <Typography variant="h3" component="h1" sx={{ color: 'var(--lf-ink)' }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body1" sx={{ mt: 1.5, color: 'var(--lf-ink-2)' }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3.5 },
          backgroundColor: 'var(--lf-paper)',
          border: '1px solid var(--lf-hairline)',
          borderRadius: 'var(--lf-r-panel)',
        }}
      >
        {children}
      </Paper>

      {footer ? <Box sx={{ mt: 3 }}>{footer}</Box> : null}
    </Container>
  </Box>
);

/* ------------------------------------------------------------------ *
 * CheckYourInbox
 * ------------------------------------------------------------------ */

/**
 * @param {object} props
 * @param {string} props.email The address the customer actually submitted, echoed
 *   back verbatim. Without this they cannot tell a typo from a mail delay.
 * @param {boolean|null} [props.emailSent=null] `verification_email_sent` from the
 *   register response. `false` switches the whole block to a warning. `null` means
 *   "we were not told" (the Login and VerifyEmail entry points), which is rendered
 *   as the neutral "check your inbox" state.
 * @param {string} [props.detail] The server's own sentence, printed as-is.
 * @param {string} [props.title]
 * @param {Function} [props.onEditEmail] Renders "Edit email address" when given.
 * @param {string} [props.editLabel='Edit email address']
 * @param {{label: string, to: string, state?: object}} [props.primary] An optional
 *   way forward, e.g. "Go to sign in".
 * @param {string} [props.supportTopic='other'] Prefills /contact's topic field.
 * @param {boolean} [props.autoFocus=false] Move focus to the heading on mount —
 *   use it when this block replaces a form the customer just submitted.
 * @param {object} [props.sx]
 */
const CheckYourInbox = ({
  email,
  emailSent = null,
  detail,
  title,
  onEditEmail,
  editLabel = 'Edit email address',
  primary,
  supportTopic = 'other',
  autoFocus = false,
  sx,
}) => {
  const failed = emailSent === false;
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const headingRef = useRef(null);

  useEffect(() => {
    if (autoFocus && headingRef.current) headingRef.current.focus();
  }, [autoFocus]);

  /* One interval while a countdown is running, cleared the moment it is not. */
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((seconds) => (seconds <= 1 ? 0 : seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const exhausted = attempts >= RESEND_MAX_ATTEMPTS;
  const blocked = sending || cooldown > 0 || exhausted || !email;

  const handleResend = useCallback(async () => {
    // `aria-disabled` rather than `disabled` (DESIGN_SYSTEM §9.10), so the guard
    // has to live here: the button stays focusable and keeps its visible reason.
    if (sending || cooldown > 0 || exhausted || !email) return;
    setSending(true);
    setFeedback(null);
    try {
      const response = await resendVerification(email);
      setAttempts((count) => count + 1);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setFeedback({
        severity: 'info',
        // The server's body is deliberately neutral ("if an account … exists"):
        // printing our own cheerier sentence here would re-open the account
        // enumeration oracle that §2b #31 just closed.
        text: response?.detail || 'If that address needs verifying, a new link is on its way.',
      });
    } catch (error) {
      if (error?.isThrottled) {
        const wait = Number(error.retryAfter);
        setCooldown(Number.isFinite(wait) && wait > 0 ? Math.ceil(wait) : RESEND_COOLDOWN_SECONDS);
        setFeedback({ severity: 'warning', text: getApiErrorMessage(error) });
      } else {
        setFeedback({
          severity: 'error',
          text: getApiErrorMessage(
            error,
            'We could not send that email just now. Please try again in a moment.',
          ),
        });
      }
    } finally {
      setSending(false);
    }
  }, [cooldown, email, exhausted, sending]);

  const heading =
    title || (failed ? 'Account created — but the email did not send' : 'Check your inbox');

  return (
    <Box sx={{ textAlign: 'center', ...sx }}>
      <StateIcon tone={failed ? 'warn' : 'gold'}>
        {failed ? <ReportGmailerrorredOutlinedIcon /> : <MarkEmailReadOutlinedIcon />}
      </StateIcon>

      <Typography
        ref={headingRef}
        tabIndex={autoFocus ? -1 : undefined}
        variant="h4"
        component="h2"
        sx={{ color: 'var(--lf-ink)', mb: 1, ...FOCUS_RING_SX }}
      >
        {heading}
      </Typography>

      {email ? (
        <Typography variant="body1" sx={{ color: 'var(--lf-ink-2)' }}>
          {failed ? 'The address on the account is' : 'We sent a verification link to'}{' '}
          <Box component="strong" sx={{ color: 'var(--lf-ink)', wordBreak: 'break-word' }}>
            {email}
          </Box>
        </Typography>
      ) : null}

      {/* The server's own words. On the failure path this is the sentence that
          tells the truth, so it is rendered as a warning, not as body copy. */}
      {detail ? (
        failed ? (
          <Alert severity="warning" sx={{ mt: 2.5, textAlign: 'left' }}>
            {detail}
          </Alert>
        ) : (
          <Typography variant="body2" sx={{ mt: 1.5, color: 'var(--lf-ink-3)' }}>
            {detail}
          </Typography>
        )
      ) : null}

      {!failed ? (
        <Typography variant="body2" sx={{ mt: 1.5, color: 'var(--lf-ink-3)' }}>
          It can take a minute to arrive. If it is not there, check your spam or
          promotions folder before resending.
        </Typography>
      ) : null}

      {feedback ? (
        <Alert severity={feedback.severity} sx={{ mt: 2.5, textAlign: 'left' }}>
          {feedback.text}
        </Alert>
      ) : null}

      <Stack spacing={1.5} sx={{ mt: 3 }}>
        <Button
          className="lf-press"
          variant={failed ? 'contained' : 'outlined'}
          color="primary"
          disableElevation={failed}
          fullWidth
          aria-disabled={blocked}
          onClick={handleResend}
          startIcon={sending ? <CircularProgress size={16} thickness={3.6} color="inherit" /> : null}
          sx={{
            ...PRIMARY_ACTION_SX,
            ...FOCUS_RING_SX,
            /* A4/A5: `aria-disabled`, never `disabled`, and the recessive state is
               §3.2's disabled pair (--lf-ink-3 on --lf-quiet, 4.65:1) rather than an
               opacity wash that drags the label under 4.5:1. The reason is stated
               adjacent, below, which is what licenses the inert look at all. */
            ...(blocked
              ? {
                  cursor: 'default',
                  color: 'var(--lf-ink-3)',
                  backgroundColor: failed ? 'var(--lf-quiet)' : 'transparent',
                  borderColor: 'var(--lf-border-strong)',
                  '&:hover': {
                    backgroundColor: failed ? 'var(--lf-quiet)' : 'transparent',
                    borderColor: 'var(--lf-border-strong)',
                  },
                }
              : {}),
          }}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
        </Button>

        {primary ? (
          <Button
            className="lf-press"
            variant={failed ? 'outlined' : 'contained'}
            color="primary"
            disableElevation={!failed}
            fullWidth
            component={RouterLink}
            to={primary.to}
            state={primary.state}
            sx={{ ...PRIMARY_ACTION_SX, ...FOCUS_RING_SX }}
          >
            {primary.label}
          </Button>
        ) : null}
      </Stack>

      {/* The visible reason the button is inert, which is what makes
          `aria-disabled` acceptable instead of a dead grey control. */}
      <Typography
        variant="caption"
        component="p"
        aria-live="polite"
        sx={{ mt: 1.5, color: 'var(--lf-ink-3)' }}
      >
        {exhausted
          ? `You have used all ${RESEND_MAX_ATTEMPTS} resend attempts for this hour. Contact support and we will verify the address for you.`
          : cooldown > 0
            ? `You can ask for another link in ${cooldown} second${cooldown === 1 ? '' : 's'}.`
            : attempts > 0
              ? `${attempts} of ${RESEND_MAX_ATTEMPTS} resend attempts used this hour.`
              : `Up to ${RESEND_MAX_ATTEMPTS} resends per hour.`}
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 0.5, sm: 2 }}
        justifyContent="center"
        alignItems="center"
        sx={{ mt: 2.5 }}
      >
        {onEditEmail ? (
          <Link
            component="button"
            type="button"
            onClick={onEditEmail}
            underline="always"
            sx={{
              color: 'var(--lf-gold-ink)',
              fontWeight: 500,
              background: 'none',
              border: 0,
              p: 0,
              display: 'inline-flex',
              alignItems: 'center',
              ...TOUCH_TARGET_SX,
              ...FOCUS_RING_SX,
            }}
          >
            {editLabel}
          </Link>
        ) : null}
        <SupportLink topic={supportTopic} label="Contact support" />
      </Stack>
    </Box>
  );
};

export default CheckYourInbox;
