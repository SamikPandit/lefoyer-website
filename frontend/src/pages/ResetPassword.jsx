/**
 * /reset-password/:uid/:token — NEW. The other half of LF-31's password recovery.
 *
 * `POST /api/auth/password-reset/confirm/<uidb64>/<token>/` has existed all along
 * and nothing has ever called it; the reset email's link had nowhere to land.
 * `accounts/serializers.py::PasswordResetSerializer` builds the link as
 * `reset-password/<uid>/<token>` with **no** `/#/`, which is the route App.jsx
 * declares, so the two now meet.
 *
 * WHAT THE SERVER RETURNS, read from `PasswordResetConfirmView`:
 *   200 `{detail, code:'password_reset'}`
 *   400 `{detail, code:'invalid_reset_link'}`   — bad uid, bad token, or used
 *   400 `{new_password:[…]}`                    — Django's password validators
 * The first two are whole-page states; the third belongs on the field, which is
 * where the customer can act on it.
 *
 * `default_token_generator` keys off the current password hash, so a successful
 * reset invalidates this link automatically. That is why the success state sends
 * the customer to sign in rather than offering the form again.
 */

import { useCallback, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
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
import { AuthPanel } from '../components/auth/CheckYourInbox';
import SupportLink from '../components/common/SupportLink';
import {
  FOCUS_RING_SX,
  PRIMARY_ACTION_SX,
  StateIcon,
  TOUCH_TARGET_SX,
} from '../components/common/EmptyState';
import { confirmPasswordReset, getApiErrorMessage } from '../services/api';

/** `SetNewPasswordSerializer`: `new_password = CharField(min_length=8)`. */
const PASSWORD_MIN_LENGTH = 8;

const ResetPassword = () => {
  const { uid, token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [banner, setBanner] = useState('');
  const [saving, setSaving] = useState(false);
  /** 'form' | 'done' | 'invalid' */
  const [state, setState] = useState(uid && token ? 'form' : 'invalid');
  const [detail, setDetail] = useState(
    uid && token
      ? ''
      : 'That reset link is incomplete. Open the link straight from your email, or request a new one.',
  );

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (saving) return;

      setFieldError('');
      setConfirmError('');
      setBanner('');

      if (password.length < PASSWORD_MIN_LENGTH) {
        setFieldError(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
        return;
      }
      if (password !== confirm) {
        setConfirmError('The two passwords do not match.');
        return;
      }

      setSaving(true);
      try {
        const response = await confirmPasswordReset(uid, token, password);
        setDetail(response?.detail || 'Your password has been reset. You can now sign in.');
        setState('done');
      } catch (error) {
        const data = error?.response?.data || {};
        if (data.code === 'invalid_reset_link') {
          setDetail(data.detail || 'This password reset link is invalid or has expired.');
          setState('invalid');
        } else if (Array.isArray(data.new_password) && data.new_password.length > 0) {
          // Django's validators: "too common", "entirely numeric", "too similar
          // to your email". They belong on the field.
          setFieldError(data.new_password.join(' '));
        } else {
          setBanner(
            getApiErrorMessage(error, 'We could not set that password. Please try again.'),
          );
        }
      } finally {
        setSaving(false);
      }
    },
    [confirm, password, saving, token, uid],
  );

  if (state === 'done') {
    return (
      <>
        <SeoHead title="Password updated" canonical="/reset-password" noindex />
        <AuthPanel title="Password updated">
          <Box sx={{ textAlign: 'center' }}>
            <StateIcon tone="ok">
              <CheckCircleOutlineIcon />
            </StateIcon>
            <Typography variant="body1" sx={{ color: 'var(--lf-ink-2)' }}>
              {detail}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1.5, color: 'var(--lf-ink-3)' }}>
              The link you used has stopped working, so nobody else can reuse it.
            </Typography>
            <Button
              className="lf-press"
              variant="contained"
              color="primary"
              disableElevation
              fullWidth
              onClick={() =>
                navigate('/login', {
                  replace: true,
                  state: {
                    notice: {
                      severity: 'success',
                      message: 'Your password is updated. Sign in with your new password.',
                    },
                  },
                })
              }
              sx={{ mt: 3, ...PRIMARY_ACTION_SX, ...FOCUS_RING_SX }}
            >
              Sign in
            </Button>
          </Box>
        </AuthPanel>
      </>
    );
  }

  if (state === 'invalid') {
    return (
      <>
        <SeoHead title="Reset link expired" canonical="/reset-password" noindex />
        <AuthPanel title="That link no longer works">
          <Box sx={{ textAlign: 'center' }}>
            <StateIcon tone="warn">
              <LinkOffOutlinedIcon />
            </StateIcon>
            <Typography variant="body1" sx={{ color: 'var(--lf-ink-2)' }}>
              {detail}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1.5, color: 'var(--lf-ink-3)' }}>
              Reset links are single-use and expire. Ask for a fresh one and it
              will arrive in a moment.
            </Typography>
            <Stack spacing={1.5} sx={{ mt: 3 }}>
              <Button
                className="lf-press"
                component={RouterLink}
                to="/forgot-password"
                variant="contained"
                color="primary"
                disableElevation
                fullWidth
                sx={{ ...PRIMARY_ACTION_SX, ...FOCUS_RING_SX }}
              >
                Send me a new link
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
            <Box sx={{ mt: 2.5 }}>
              <SupportLink topic="other" label="Contact support" />
            </Box>
          </Box>
        </AuthPanel>
      </>
    );
  }

  return (
    <>
      <SeoHead title="Set a new password" canonical="/reset-password" noindex />
      <AuthPanel
        title="Set a new password"
        subtitle="Choose a password you do not use anywhere else."
      >
        <Box component="form" onSubmit={handleSubmit} noValidate>
          {banner ? (
            <Alert severity="error" role="alert" sx={{ mb: 2.5 }}>
              {banner}
            </Alert>
          ) : null}

          <TextField
            fullWidth
            required
            autoFocus
            margin="normal"
            id="new_password"
            name="new_password"
            type="password"
            label="New password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={Boolean(fieldError)}
            helperText={fieldError || `At least ${PASSWORD_MIN_LENGTH} characters.`}
          />
          <TextField
            fullWidth
            required
            margin="normal"
            id="confirm_password"
            name="confirm_password"
            type="password"
            label="Confirm new password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            error={Boolean(confirmError)}
            helperText={confirmError || ' '}
          />

          <Button
            className="lf-press"
            type="submit"
            variant="contained"
            color="primary"
            disableElevation
            fullWidth
            aria-disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ mt: 2, ...PRIMARY_ACTION_SX, ...FOCUS_RING_SX }}
          >
            {saving ? 'Saving…' : 'Save new password'}
          </Button>

          <Box sx={{ mt: 2.5, textAlign: 'center' }}>
            <SupportLink topic="other" label="Need help signing in?" />
          </Box>
        </Box>
      </AuthPanel>
    </>
  );
};

export default ResetPassword;
