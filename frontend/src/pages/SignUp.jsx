/**
 * /signup — LF-31's frontend half.
 *
 * WHAT WAS WRONG, ALL VERIFIED IN THE OLD FILE
 * 1. On success it rendered one inline green `<Alert severity="success">` saying
 *    "Registration successful! Please check your email…" — regardless of whether
 *    any email had been sent. `POST /api/auth/register/` now returns
 *    `verification_email_sent` (§2b #29) and `<CheckYourInbox />` renders a
 *    warning, with Resend as the primary action, when it is `false`.
 * 2. It never sent `first_name` / `last_name`, although the serializer has
 *    accepted both all along. That is the direct cause of reviewer display names
 *    needing a masked-email fallback: every account in the database has an empty
 *    name because this form never asked for one.
 * 3. It sent neither `terms_accepted` nor `marketing_consent`. `terms_accepted`
 *    is now REQUIRED server-side, so the old payload would 400; and marketing
 *    consent is a separate, unticked box, because agreeing to the terms is not
 *    agreeing to be marketed to.
 * 4. `password` validator errors (the serializer runs Django's
 *    AUTH_PASSWORD_VALIDATORS) were funnelled into one generic banner. They are
 *    now shown on the password field, which is where the fix has to happen.
 * 5. The legacy Grid column props did nothing in MUI 7.3.5 — it is ex-Grid2, so
 *    `item`/`xs`/`md` are not props (C-3) — and the inline display-serif override
 *    pointed at a family the app never loads (C-30). Both are migrated/removed.
 *
 * The `from` location captured by ProtectedRoute is forwarded to the sign-in
 * link, so a shopper who came from a protected page and chose "I already have an
 * account" still lands back where they were going.
 */

import { useCallback, useMemo, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import SeoHead from '../components/common/SeoHead';
import CheckYourInbox, { AuthPanel } from '../components/auth/CheckYourInbox';
import { FOCUS_RING_SX, TOUCH_TARGET_SX } from '../components/common/EmptyState';
import { getApiErrorMessage, registerUser } from '../services/api';
import { useBrand } from '../content/brand';

/** `accounts/serializers.py`: `password = CharField(min_length=8)`. */
const PASSWORD_MIN_LENGTH = 8;

const EMPTY_FORM = Object.freeze({
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone_number: '',
  terms_accepted: false,
  marketing_consent: false,
});

/** DRF field errors → `{field: 'first message'}`, plus a non-field remainder. */
function splitErrors(error) {
  const data = error?.response?.data;
  const fields = {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { fields, banner: getApiErrorMessage(error, 'We could not create your account.') };
  }

  const known = ['email', 'password', 'first_name', 'last_name', 'phone_number', 'terms_accepted'];
  for (const key of known) {
    const value = data[key];
    if (Array.isArray(value) && value.length > 0) fields[key] = value.join(' ');
    else if (typeof value === 'string' && value.trim()) fields[key] = value.trim();
  }

  const banner =
    typeof data.detail === 'string'
      ? data.detail
      : Object.keys(fields).length > 0
        ? null
        : getApiErrorMessage(error, 'We could not create your account.');

  return { fields, banner };
}

const SignUp = () => {
  const location = useLocation();
  const brand = useBrand();

  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [loading, setLoading] = useState(false);
  /** `{email, verification_email_sent, detail}` once the account exists. */
  const [created, setCreated] = useState(null);

  const handleChange = useCallback((event) => {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    setFieldErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      // `aria-disabled` keeps the button focusable (DESIGN_SYSTEM §9.10), so the
      // double-submit guard has to be here, not on the control.
      if (loading) return;
      setBanner('');

      const localErrors = {};
      if (form.password.length < PASSWORD_MIN_LENGTH) {
        localErrors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
      }
      if (form.confirmPassword !== form.password) {
        localErrors.confirmPassword = 'The two passwords do not match.';
      }
      if (!form.terms_accepted) {
        localErrors.terms_accepted = 'Please accept the terms to create an account.';
      }
      if (Object.keys(localErrors).length > 0) {
        setFieldErrors(localErrors);
        return;
      }

      setLoading(true);
      setFieldErrors({});
      const email = form.email.trim().toLowerCase();

      try {
        const response = await registerUser({
          email,
          password: form.password,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          phone_number: form.phone_number.trim(),
          terms_accepted: true,
          // Separate and independently timestamped server-side. Never derived
          // from the terms checkbox.
          marketing_consent: Boolean(form.marketing_consent),
        });
        setCreated({
          email: response?.email || email,
          // `undefined` (an older deployment that does not send the field) is
          // NOT the same as `false`, so it is kept as `null`: unknown, which
          // CheckYourInbox renders as the neutral state rather than a warning.
          sent:
            typeof response?.verification_email_sent === 'boolean'
              ? response.verification_email_sent
              : null,
          detail: response?.detail || '',
        });
      } catch (error) {
        const split = splitErrors(error);
        setFieldErrors(split.fields);
        if (split.banner) setBanner(split.banner);
      } finally {
        setLoading(false);
      }
    },
    [form, loading],
  );

  const signInLink = useMemo(
    () => (
      <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)', textAlign: 'center' }}>
        Already have an account?{' '}
        <Link
          component={RouterLink}
          to="/login"
          state={location.state}
          underline="always"
          sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}
        >
          Sign in
        </Link>
      </Typography>
    ),
    [location.state],
  );

  if (created) {
    return (
      <>
        <SeoHead title="Check your inbox" canonical="/signup" noindex />
        <AuthPanel title="Almost there" footer={signInLink}>
          <CheckYourInbox
            email={created.email}
            emailSent={created.sent}
            detail={created.detail}
            // Back to the form with everything still typed in, for the common
            // case: a typo in the address.
            onEditEmail={() => setCreated(null)}
            primary={{ label: 'Go to sign in', to: '/login', state: location.state }}
            autoFocus
          />
        </AuthPanel>
      </>
    );
  }

  return (
    <>
      <SeoHead
        title="Create an account"
        description="Create a Le foyeR. account to track orders, save your wishlist and check out faster."
        canonical="/signup"
        noindex
      />
      <AuthPanel title="Create an account" width="sm" footer={signInLink}>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          {banner ? (
            <Alert severity="error" role="alert" sx={{ mb: 2.5 }}>
              {banner}
            </Alert>
          ) : null}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                id="first_name"
                name="first_name"
                label="First name"
                autoComplete="given-name"
                value={form.first_name}
                onChange={handleChange}
                error={Boolean(fieldErrors.first_name)}
                helperText={fieldErrors.first_name || ' '}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                id="last_name"
                name="last_name"
                label="Last name"
                autoComplete="family-name"
                value={form.last_name}
                onChange={handleChange}
                error={Boolean(fieldErrors.last_name)}
                helperText={fieldErrors.last_name || ' '}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                required
                fullWidth
                id="email"
                name="email"
                type="email"
                label="Email address"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                error={Boolean(fieldErrors.email)}
                helperText={
                  fieldErrors.email || 'We send your order updates and the verification link here.'
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                required
                fullWidth
                id="password"
                name="password"
                type="password"
                label="Password"
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                error={Boolean(fieldErrors.password)}
                // The server runs Django's AUTH_PASSWORD_VALIDATORS, so its
                // messages ("too common", "too similar to your email") land
                // here rather than in a banner at the top of the page.
                helperText={fieldErrors.password || `At least ${PASSWORD_MIN_LENGTH} characters.`}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                required
                fullWidth
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                label="Confirm password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={handleChange}
                error={Boolean(fieldErrors.confirmPassword)}
                helperText={fieldErrors.confirmPassword || ' '}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                id="phone_number"
                name="phone_number"
                label="Phone number (optional)"
                autoComplete="tel"
                inputMode="tel"
                value={form.phone_number}
                onChange={handleChange}
                error={Boolean(fieldErrors.phone_number)}
                helperText={fieldErrors.phone_number || 'Only used for delivery updates.'}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    name="terms_accepted"
                    checked={form.terms_accepted}
                    onChange={handleChange}
                    color="primary"
                  />
                }
                label={
                  <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
                    I agree to the{' '}
                    <Link
                      component={RouterLink}
                      to="/terms"
                      target="_blank"
                      rel="noopener"
                      underline="always"
                      sx={{ color: 'var(--lf-gold-ink)', ...FOCUS_RING_SX }}
                    >
                      Terms &amp; Conditions
                    </Link>{' '}
                    and the{' '}
                    <Link
                      component={RouterLink}
                      to="/privacy-policy"
                      target="_blank"
                      rel="noopener"
                      underline="always"
                      sx={{ color: 'var(--lf-gold-ink)', ...FOCUS_RING_SX }}
                    >
                      Privacy Policy
                    </Link>
                    .
                  </Typography>
                }
              />
              {fieldErrors.terms_accepted ? (
                <Typography variant="caption" component="p" sx={{ color: 'var(--lf-err-ink)' }}>
                  {fieldErrors.terms_accepted}
                </Typography>
              ) : null}

              <FormControlLabel
                sx={{ mt: 0.5 }}
                control={
                  <Checkbox
                    name="marketing_consent"
                    checked={form.marketing_consent}
                    onChange={handleChange}
                    color="primary"
                  />
                }
                label={
                  <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
                    {brand.newsletter.consentLabel}
                  </Typography>
                }
              />
            </Grid>
          </Grid>

          <Button
            className="lf-press"
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            disableElevation
            aria-disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ mt: 3, py: 1.5, ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
          >
            {loading ? 'Creating your account…' : 'Create account'}
          </Button>
        </Box>
      </AuthPanel>
    </>
  );
};

export default SignUp;
