/**
 * /forgot-password — NEW. LF-31.
 *
 * `POST /api/auth/password-reset/` has existed in the backend the whole time and
 * **no page has ever called it**: `Login.jsx` linked to `/forgot-password`, which
 * was not a route, so the only recovery path for a forgotten password was an
 * email to support. App.jsx declares the route now; this is the page.
 *
 * THE NEUTRAL-MESSAGE RULE, AND WHY IT IS NOT NEGOTIABLE
 * §2b #32: the endpoint **always** answers 200 with the same body, whether or not
 * the address is registered — `accounts/serializers.py` used to reject an unknown
 * address with "User with this email does not exist.", which turned the form into
 * an account-enumeration oracle anyone could run an address list through. This
 * page therefore renders ONE confirmation for every submitted address and never
 * hints at whether an account was found.
 *
 * A 429 is a different thing from a neutral 200 and is shown as itself:
 * `PasswordResetThrottle` is `3/hour` keyed on the submitted email with a 60s
 * cooldown, and api.js exposes `retry_after` as `error.retryAfter`, so the page
 * can say how long rather than leaving the customer pressing a dead button.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';

import SeoHead from '../components/common/SeoHead';
import { AuthPanel } from '../components/auth/CheckYourInbox';
import SupportLink from '../components/common/SupportLink';
import { FOCUS_RING_SX, TOUCH_TARGET_SX } from '../components/common/EmptyState';
import { getApiErrorMessage, requestPasswordReset } from '../services/api';

/** `PasswordResetThrottle.min_interval_seconds`. */
const RESEND_COOLDOWN_SECONDS = 60;

const ForgotPassword = () => {
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  /** The neutral server sentence, once a request has gone through. */
  const [submitted, setSubmitted] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((seconds) => (seconds <= 1 ? 0 : seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const send = useCallback(
    async (address) => {
      setSending(true);
      setError('');
      try {
        const response = await requestPasswordReset(address);
        setSubmitted({
          email: address,
          detail:
            response?.detail ||
            'If an account exists for that email address, we have sent it a password reset link.',
        });
        setCooldown(RESEND_COOLDOWN_SECONDS);
      } catch (caught) {
        // Deliberately NOT folded into the neutral message: a throttle or an
        // outage means the request did not happen, and telling the customer to
        // go and check their inbox would be a lie of exactly the kind LF-31 is
        // about.
        setError(
          getApiErrorMessage(
            caught,
            'We could not send a reset link just now. Please try again in a moment.',
          ),
        );
      } finally {
        setSending(false);
      }
    },
    [],
  );

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      if (sending) return;
      const address = email.trim().toLowerCase();
      if (!address) {
        setError('Please enter your email address.');
        return;
      }
      send(address);
    },
    [email, send, sending],
  );

  if (submitted) {
    return (
      <>
        <SeoHead title="Reset your password" canonical="/forgot-password" noindex />
        <AuthPanel title="Check your inbox">
          <Box sx={{ textAlign: 'center' }}>
            <Box
              aria-hidden="true"
              sx={{
                width: 64,
                height: 64,
                mx: 'auto',
                mb: 2.5,
                borderRadius: 'var(--lf-r-pill)',
                backgroundColor: 'var(--lf-gold-tint)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '& > svg': { fontSize: 28, color: 'var(--lf-gold-ink)' },
              }}
            >
              <MarkEmailReadOutlinedIcon />
            </Box>

            <Typography variant="body1" sx={{ color: 'var(--lf-ink-2)' }}>
              {submitted.detail}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1.5, color: 'var(--lf-ink-3)' }}>
              We sent it to{' '}
              <Box component="strong" sx={{ color: 'var(--lf-ink)', wordBreak: 'break-word' }}>
                {submitted.email}
              </Box>
              . Check your spam or promotions folder before trying again — the link
              is single-use and stops working once you set a new password.
            </Typography>

            {error ? (
              <Alert severity="error" role="alert" sx={{ mt: 2.5, textAlign: 'left' }}>
                {error}
              </Alert>
            ) : null}

            <Stack spacing={1.5} sx={{ mt: 3 }}>
              <Button
                className="lf-press"
                variant="outlined"
                fullWidth
                aria-disabled={sending || cooldown > 0}
                startIcon={sending ? <CircularProgress size={16} color="inherit" /> : null}
                onClick={() => {
                  if (sending || cooldown > 0) return;
                  send(submitted.email);
                }}
                sx={{
                  ...TOUCH_TARGET_SX,
                  ...FOCUS_RING_SX,
                  ...(sending || cooldown > 0 ? { opacity: 0.6, cursor: 'default' } : {}),
                }}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Send the link again'}
              </Button>
              <Button
                className="lf-press"
                component={RouterLink}
                to="/login"
                state={location.state}
                variant="contained"
                color="primary"
                disableElevation
                fullWidth
                sx={{ ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
              >
                Back to sign in
              </Button>
            </Stack>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 0.5, sm: 2 }}
              justifyContent="center"
              alignItems="center"
              sx={{ mt: 2.5 }}
            >
              <Link
                component="button"
                type="button"
                onClick={() => {
                  setSubmitted(null);
                  setError('');
                }}
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
                Try a different address
              </Link>
              <SupportLink topic="other" label="Contact support" />
            </Stack>
          </Box>
        </AuthPanel>
      </>
    );
  }

  return (
    <>
      <SeoHead
        title="Reset your password"
        description="Send yourself a link to set a new Le foyeR. password."
        canonical="/forgot-password"
        noindex
      />
      <AuthPanel
        title="Reset your password"
        subtitle="Enter the email address on your account and we will send you a link to set a new password."
        footer={
          <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)', textAlign: 'center' }}>
            Remembered it?{' '}
            <Link
              component={RouterLink}
              to="/login"
              state={location.state}
              underline="always"
              sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}
            >
              Back to sign in
            </Link>
          </Typography>
        }
      >
        <Box component="form" onSubmit={handleSubmit} noValidate>
          {error ? (
            <Alert severity="error" role="alert" sx={{ mb: 2.5 }}>
              {error}
            </Alert>
          ) : null}

          <TextField
            fullWidth
            required
            autoFocus
            id="email"
            name="email"
            type="email"
            label="Email address"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <Button
            className="lf-press"
            type="submit"
            variant="contained"
            color="primary"
            disableElevation
            fullWidth
            aria-disabled={sending}
            startIcon={sending ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ mt: 3, py: 1.5, ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
          >
            {sending ? 'Sending…' : 'Email me a reset link'}
          </Button>

          <Box sx={{ mt: 2.5, textAlign: 'center' }}>
            <SupportLink topic="other" label="No longer have access to that inbox?" />
          </Box>
        </Box>
      </AuthPanel>
    </>
  );
};

export default ForgotPassword;
