/**
 * /verify-email/:token — LF-31. Branches on the server's machine-readable `code`,
 * never on the English in `detail`.
 *
 * `GET /api/auth/verify-email/<token>/` (§2b #30, and read from
 * `accounts/views.py::VerifyEmailView` to be sure) answers with exactly four:
 *   200 `verified`         — this click did it
 *   200 `already_verified` — a second click, or a mail scanner that prefetched
 *                            the link before the human ever opened the message
 *   400 `invalid_token`    — no such token (usually: a newer link replaced it)
 *   400 `token_expired`    — past the window, with `expired_at`
 *
 * WHAT WAS WRONG (C-26)
 * The old page had two states, success and "Verification Failed", derived from
 * whether the request threw. Because the old backend nulled the token on success,
 * the second click on a perfectly good account produced a red failure page. And
 * the failure state's only button was **"Sign Up Again"**, which is a hard dead
 * end: the account already exists, so `validate_email` rejects the re-signup with
 * "An account with this email already exists." That button is deleted. The way
 * out of an expired link is a new link, which is what this page now offers.
 *
 * `already_verified` routes to /login carrying an info banner, because the
 * account is in exactly the state the customer wanted — there is nothing for them
 * to read on this page.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, Navigate, useParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined';

import SeoHead from '../components/common/SeoHead';
import CheckYourInbox, { AuthPanel } from '../components/auth/CheckYourInbox';
import SupportLink from '../components/common/SupportLink';
import { FOCUS_RING_SX, TOUCH_TARGET_SX } from '../components/common/EmptyState';
import { getApiErrorMessage, resendVerification, verifyEmail } from '../services/api';
import { useAuth } from '../context/AuthContext';

const VerifyEmail = () => {
  const { token } = useParams();
  const { isAuthenticated, refreshUser } = useAuth();

  /** 'loading' | 'verified' | 'already_verified' | 'invalid_token' | 'token_expired' | 'unreachable' */
  const [state, setState] = useState(token ? 'loading' : 'invalid_token');
  const [detail, setDetail] = useState(
    token ? '' : 'That link is missing its verification code. Please open the link from your email, or ask for a new one below.',
  );

  /* The inline "send me a new link" form, for the two failure codes. */
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [sentDetail, setSentDetail] = useState('');

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;

    setState('loading');
    verifyEmail(token)
      .then((response) => {
        if (cancelled) return;
        const code = response?.code;
        setDetail(response?.detail || '');
        setState(code === 'already_verified' ? 'already_verified' : 'verified');
        // A signed-in shopper who verifies in the same browser must not keep a
        // cached `is_email_verified: false` driving the UI. `refreshUser()`
        // already no-ops when there is no stored token, so it is called
        // unconditionally — reading `isAuthenticated` here instead would put it
        // in this effect's dependencies, and AuthContext flips it false -> true
        // while it adopts a stored session. That would re-run the effect and
        // fire a SECOND GET on the same token, whose honest answer is
        // `already_verified` — so a successful verification would redirect to
        // "already verified" instead of showing the success screen.
        refreshUser();
      })
      .catch((error) => {
        if (cancelled) return;
        const data = error?.response?.data || {};
        setDetail(data.detail || getApiErrorMessage(error));
        if (data.code === 'token_expired') setState('token_expired');
        else if (data.code === 'invalid_token') setState('invalid_token');
        // No response at all (offline, or the API is down) is NOT a bad token.
        // Saying "this link is invalid" here would send the customer off to
        // request links that were never the problem.
        else if (error?.isNetwork || error?.isServerError) setState('unreachable');
        else setState('invalid_token');
      });

    return () => {
      cancelled = true;
    };
  }, [refreshUser, token]);

  const handleSendNewLink = useCallback(
    async (event) => {
      event.preventDefault();
      if (sending) return;
      const address = email.trim().toLowerCase();
      if (!address) {
        setSendError('Please enter the email address you signed up with.');
        return;
      }
      setSending(true);
      setSendError('');
      try {
        const response = await resendVerification(address);
        setSentDetail(response?.detail || '');
        setSentTo(address);
      } catch (error) {
        setSendError(
          getApiErrorMessage(error, 'We could not send a new link just now. Please try again shortly.'),
        );
      } finally {
        setSending(false);
      }
    },
    [email, sending],
  );

  if (state === 'loading') {
    return (
      <>
        <SeoHead title="Verifying your email" canonical="/verify-email" noindex />
        <AuthPanel title="Verifying your email">
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <CircularProgress aria-label="Verifying" />
            <Typography variant="body1" sx={{ mt: 2, color: 'var(--lf-ink-2)' }}>
              One moment — we are confirming your link.
            </Typography>
          </Box>
        </AuthPanel>
      </>
    );
  }

  if (state === 'already_verified') {
    /* Nothing to read here: the account is already in the state the customer
       wanted, so they go straight to the thing they were trying to do. */
    return (
      <Navigate
        to="/login"
        replace
        state={{
          notice: {
            severity: 'info',
            message: detail || 'That email address is already verified. You can sign in.',
          },
        }}
      />
    );
  }

  if (state === 'verified') {
    return (
      <>
        <SeoHead title="Email verified" canonical="/verify-email" noindex />
        <AuthPanel title="Email verified">
          <Box sx={{ textAlign: 'center' }}>
            <Box
              aria-hidden="true"
              sx={{
                width: 64,
                height: 64,
                mx: 'auto',
                mb: 2.5,
                borderRadius: 'var(--lf-r-pill)',
                backgroundColor: 'var(--lf-ok-tint)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '& > svg': { fontSize: 28, color: 'var(--lf-ok-ink)' },
              }}
            >
              <CheckCircleOutlineIcon />
            </Box>
            <Typography variant="h4" component="h2" sx={{ color: 'var(--lf-ink)', mb: 1 }}>
              You are all set
            </Typography>
            <Typography variant="body1" sx={{ color: 'var(--lf-ink-2)' }}>
              {detail || 'Your email address is confirmed.'}
            </Typography>

            <Button
              className="lf-press"
              component={RouterLink}
              to={isAuthenticated ? '/' : '/login'}
              variant="contained"
              color="primary"
              disableElevation
              fullWidth
              state={
                isAuthenticated
                  ? undefined
                  : { notice: { severity: 'success', message: 'Email verified — sign in to continue.' } }
              }
              sx={{ mt: 3, py: 1.5, ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
            >
              {isAuthenticated ? 'Continue shopping' : 'Continue to sign in'}
            </Button>
          </Box>
        </AuthPanel>
      </>
    );
  }

  if (state === 'unreachable') {
    return (
      <>
        <SeoHead title="Verify your email" canonical="/verify-email" noindex />
        <AuthPanel title="We could not check that link">
          <Box sx={{ textAlign: 'center' }}>
            <Alert severity="warning" role="alert" sx={{ textAlign: 'left' }}>
              {detail}
            </Alert>
            <Typography variant="body2" sx={{ mt: 2, color: 'var(--lf-ink-2)' }}>
              Your link is probably fine — we just could not reach the server. Try
              again in a moment before asking for a new one.
            </Typography>
            <Stack spacing={1.5} sx={{ mt: 3 }}>
              <Button
                className="lf-press"
                variant="contained"
                color="primary"
                disableElevation
                fullWidth
                onClick={() => window.location.reload()}
                sx={{ ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
              >
                Try again
              </Button>
              <SupportLink variant="button" label="Contact support" topic="other" />
            </Stack>
          </Box>
        </AuthPanel>
      </>
    );
  }

  /* invalid_token | token_expired — one screen, because the way out is the same:
     a new link. The old "Sign Up Again" button is deliberately gone. */
  if (sentTo) {
    return (
      <>
        <SeoHead title="Verify your email" canonical="/verify-email" noindex />
        <AuthPanel title="A new link is on its way">
          <CheckYourInbox
            email={sentTo}
            detail={sentDetail}
            onEditEmail={() => {
              setSentTo('');
              setSentDetail('');
            }}
            editLabel="Use a different email"
            primary={{ label: 'Back to sign in', to: '/login' }}
            autoFocus
          />
        </AuthPanel>
      </>
    );
  }

  return (
    <>
      <SeoHead title="Verify your email" canonical="/verify-email" noindex />
      <AuthPanel
        title={state === 'token_expired' ? 'That link has expired' : 'That link is not valid'}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 64,
              height: 64,
              mx: 'auto',
              mb: 2.5,
              borderRadius: 'var(--lf-r-pill)',
              backgroundColor: 'var(--lf-warn-tint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              '& > svg': { fontSize: 28, color: 'var(--lf-warn-ink)' },
            }}
          >
            <LinkOffOutlinedIcon />
          </Box>

          <Typography variant="body1" sx={{ color: 'var(--lf-ink-2)' }}>
            {detail}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1.5, color: 'var(--lf-ink-3)' }}>
            Your account is still there — only the link has gone stale. Enter your
            address and we will send a fresh one.
          </Typography>

          <Box component="form" onSubmit={handleSendNewLink} noValidate sx={{ mt: 3 }}>
            {sendError ? (
              <Alert severity="error" role="alert" sx={{ mb: 2, textAlign: 'left' }}>
                {sendError}
              </Alert>
            ) : null}

            <TextField
              fullWidth
              required
              id="email"
              name="email"
              type="email"
              label="Email address"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <Stack spacing={1.5} sx={{ mt: 2.5 }}>
              <Button
                className="lf-press"
                type="submit"
                variant="contained"
                color="primary"
                disableElevation
                fullWidth
                aria-disabled={sending}
                startIcon={sending ? <CircularProgress size={16} color="inherit" /> : null}
                sx={{ py: 1.5, ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
              >
                {sending ? 'Sending…' : 'Send me a new link'}
              </Button>
              <Button
                className="lf-press"
                component={RouterLink}
                to="/login"
                variant="outlined"
                fullWidth
                sx={{ ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
              >
                Back to sign in
              </Button>
            </Stack>
          </Box>

          <Box sx={{ mt: 2.5 }}>
            <SupportLink topic="other" label="Still stuck? Contact support" />
          </Box>
        </Box>
      </AuthPanel>
    </>
  );
};

export default VerifyEmail;
