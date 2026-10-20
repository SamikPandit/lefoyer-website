/**
 * /login — LF-13's frontend half.
 *
 * THE BUG THIS PAGE EXISTED TO CAUSE (C-28, verified)
 * `ProtectedRoute.jsx:19` has always done the right thing:
 *   <Navigate to="/login" state={{ from: location }} replace />
 * and this page has always thrown that away: `navigate('/')` on success, with
 * `useLocation` never imported. So a guest who filled a bag, pressed Proceed to
 * Checkout, and signed in landed on the homepage and had to find their way back
 * to the cart. That is the whole of LF-13 on the client, and it is two lines.
 *
 * The destination is resolved in this order:
 *   1. `location.state.from` — the location object ProtectedRoute captured.
 *   2. `?next=` — a plain path, for links written by hand (DESIGN_SYSTEM §8 has
 *      checkout's auth redirect carrying `?next=/checkout`).
 *   3. `/`.
 * Both are passed through `internalPath()`, which rejects anything that is not a
 * same-origin path. Without that check `?next=https://evil.example` would make
 * this form an open redirect on a page that has just been handed a password.
 *
 * The `from` state is also forwarded to the Sign-up and Forgot-password links, so
 * a shopper who detours through either one still comes back to their checkout.
 *
 * OTHER FIXES HERE
 * - "Remember me" was a checkbox wired to a `useState` that nothing read: pure
 *   decoration on a security control, which is worse than no checkbox at all. It
 *   now does exactly what it says and no more — it remembers the EMAIL on this
 *   device. It does not extend the session (that is SIMPLE_JWT's business) and so
 *   it does not claim to.
 * - `resendVerification(...)` was read as `response.data.detail`. api.js returns
 *   the parsed body (§2a), so that was `undefined` and the user got the fallback
 *   string every time. The email-not-verified branch now renders the shared
 *   `<CheckYourInbox />`, which owns the 60s cooldown and the attempt counter.
 * - `/forgot-password` is a real route now (App.jsx), so the link is live.
 * - The inline display-serif font override is gone; that family was never
 *   loaded by index.html, so it had always fallen back to a system face (C-30).
 */

import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import SeoHead from '../components/common/SeoHead';
import CheckYourInbox, { AuthPanel } from '../components/auth/CheckYourInbox';
import { FOCUS_RING_SX, TOUCH_TARGET_SX } from '../components/common/EmptyState';
import { useAuth } from '../context/AuthContext';

/** localStorage key for the "Remember me" address. Per-device, never a token. */
const REMEMBERED_EMAIL_KEY = 'lefoyer:remembered-email';

const readRemembered = () => {
  try {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) || '';
  } catch {
    return '';
  }
};

/**
 * Accept only a same-origin path. A protocol-relative value (`//evil.example`)
 * and an absolute URL are both rejected, so this form cannot be turned into an
 * open redirect by a crafted link.
 * @param {unknown} value
 * @returns {string|null}
 */
export function internalPath(value) {
  if (typeof value !== 'string') return null;
  const path = value.trim();
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  if (path.startsWith('/login') || path.startsWith('/signup')) return null;
  return path;
}

const Login = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState(() => readRemembered());
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => Boolean(readRemembered()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);

  /* Set by VerifyEmail ("already verified → sign in") and by ResetPassword. */
  const notice = location.state?.notice || null;

  /** The captured destination — a location object from ProtectedRoute. */
  const fromLocation = location.state?.from || null;
  const from =
    internalPath(
      fromLocation
        ? `${fromLocation.pathname || ''}${fromLocation.search || ''}`
        : searchParams.get('next'),
    ) || '/';

  /* Keep the remembered address in step with the checkbox, including unticking it. */
  useEffect(() => {
    try {
      if (rememberMe && email.trim()) localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
      else if (!rememberMe) localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    } catch {
      /* Private browsing or blocked storage. Not worth failing a sign-in over. */
    }
  }, [rememberMe, email]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      // `aria-disabled` keeps the button focusable (DESIGN_SYSTEM §9.10), so the
      // double-submit guard lives here rather than on the control.
      if (loading) return;
      setLoading(true);
      setError('');
      setUnverifiedEmail(null);

      // `username` is the email: the project authenticates by email but kept
      // Django's username column (accounts/serializers.py mirrors the two).
      const result = await login({ username: email.trim(), password });

      if (result === true) {
        // LF-13. `replace` so Back does not land the shopper on a sign-in form
        // they have already satisfied.
        navigate(from, { replace: true });
        return;
      }

      setLoading(false);
      if (result?.code === 'email_not_verified') {
        setUnverifiedEmail(result.email || email.trim());
        setError('');
        return;
      }
      // AuthContext already turned the response into one printable sentence;
      // it is the server's own wording, not a blanket "check your credentials".
      setError(result?.detail || 'That email and password do not match an account.');
    },
    [email, from, loading, login, navigate, password],
  );

  const linkSx = {
    color: 'var(--lf-gold-ink)',
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    ...TOUCH_TARGET_SX,
    ...FOCUS_RING_SX,
  };

  if (unverifiedEmail) {
    return (
      <>
        <SeoHead title="Sign in" canonical="/login" noindex />
        <AuthPanel title="Verify your email to sign in">
          <CheckYourInbox
            email={unverifiedEmail}
            title="One step left"
            detail="Your account exists, but the email address has not been confirmed yet. Open the link we sent you, then sign in."
            onEditEmail={() => setUnverifiedEmail(null)}
            editLabel="Use a different email"
            supportTopic="other"
            autoFocus
          />
        </AuthPanel>
      </>
    );
  }

  return (
    <>
      <SeoHead title="Sign in" canonical="/login" noindex />
      <AuthPanel
        title="Sign in"
        subtitle={from !== '/' ? 'Sign in to pick up where you left off.' : null}
        footer={
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 0.5, sm: 2 }}
            justifyContent="center"
            alignItems="center"
          >
            <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
              New here?{' '}
              <Link
                component={RouterLink}
                to="/signup"
                // The captured destination travels with the shopper, so signing
                // up instead of signing in still returns them to their checkout.
                state={location.state}
                underline="always"
                sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}
              >
                Create an account
              </Link>
            </Typography>
          </Stack>
        }
      >
        <Box component="form" onSubmit={handleSubmit} noValidate>
          {notice ? (
            <Alert severity={notice.severity || 'info'} sx={{ mb: 2.5 }}>
              {notice.message}
            </Alert>
          ) : null}

          {error ? (
            <Alert severity="error" role="alert" sx={{ mb: 2.5 }}>
              {error}
            </Alert>
          ) : null}

          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            name="email"
            type="email"
            label="Email address"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            id="password"
            name="password"
            type="password"
            label="Password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Checkbox
                name="remember"
                color="primary"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
            }
            label={
              <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
                Remember my email address on this device
              </Typography>
            }
          />

          <Button
            className="lf-press"
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            disableElevation
            aria-disabled={loading}
            sx={{ mt: 3, py: 1.5, ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>

          <Box sx={{ mt: 2.5, textAlign: 'center' }}>
            <Link
              component={RouterLink}
              to="/forgot-password"
              state={location.state}
              underline="always"
              sx={linkSx}
            >
              Forgot your password?
            </Link>
          </Box>
        </Box>
      </AuthPanel>
    </>
  );
};

export default Login;
