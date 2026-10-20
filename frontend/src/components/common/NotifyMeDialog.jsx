/**
 * NotifyMeDialog — what replaces a hidden Add to Cart.
 *
 * IMPL_SPEC §2d: "Unsellable means an action, not a dead end." Wherever availability
 * suppresses Add to Cart — an out-of-stock card, a coming-soon PDP — a "Notify me when
 * it's back" control takes its place and opens this dialog. DESIGN_SYSTEM §6.8 is
 * stricter still: on an unbuyable product the quantity stepper and Buy Now are REMOVED
 * rather than disabled, and the primary CTA becomes this. A disabled grey button with no
 * path forward is the version of this screen we are deleting.
 *
 * It posts to `products/products/:slug/notify-me/`, which is throttled to 5/hour, so the
 * 429 path is a real path and is handled as "slow down", not as "failed".
 *
 * Two ways in:
 *   <NotifyMeButton slug={p.slug} productName={p.name} fullWidth />   // owns its state
 *   <NotifyMeDialog open={open} onClose={close} slug={p.slug} productName={p.name} />
 */

import { useEffect, useId, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';

import { getApiErrorMessage, notifyMe } from '../../services/api';
import { firstServerMessage, isLikelyEmail } from './NewsletterForm';
import { FOCUS_RING_SX, TOUCH_TARGET_SX } from './EmptyState';

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {Function} props.onClose Called on backdrop click, Escape, Close and Done.
 * @param {string} props.slug Product slug. The dialog does nothing without it.
 * @param {string} [props.productName] Shown in the title and the confirmation, so the
 *   customer knows which product they just signed up for.
 * @param {Function} [props.onSubscribed] Called with `'subscribed'` or
 *   `'already_subscribed'` once the server confirms.
 */
const NotifyMeDialog = ({ open, onClose, slug, productName, onSubscribed }) => {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const emailId = `${baseId}-email`;
  const consentId = `${baseId}-consent`;
  const statusId = `${baseId}-status`;

  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState(null);
  const [consentError, setConsentError] = useState(null);
  const [errorText, setErrorText] = useState(null);
  /** `'subscribed' | 'already_subscribed' | null` — set only by the server. */
  const [done, setDone] = useState(null);

  // Reopening is a fresh request, not a return to the last one.
  useEffect(() => {
    if (open) {
      setFieldError(null);
      setConsentError(null);
      setErrorText(null);
      setDone(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || !slug) return;

    const trimmed = email.trim();
    setFieldError(null);
    setConsentError(null);
    setErrorText(null);

    if (!trimmed) {
      setFieldError('Enter your email address.');
      return;
    }
    if (!isLikelyEmail(trimmed)) {
      setFieldError("That doesn't look like a complete email address.");
      return;
    }
    if (!consent) {
      setConsentError('Tick the box so we can email you about this product.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await notifyMe(slug, { email: trimmed, consent });
      const status = (data && data.status) === 'already_subscribed'
        ? 'already_subscribed'
        : 'subscribed';
      setDone(status);
      setEmail('');
      setConsent(false);
      if (typeof onSubscribed === 'function') onSubscribed(status);
    } catch (error) {
      const data = error && error.response && error.response.data;
      const emailMessage = firstServerMessage(data, 'email');
      const consentMessage = firstServerMessage(data, 'consent');

      if (emailMessage) {
        setFieldError(emailMessage);
      } else if (consentMessage) {
        setConsentError(consentMessage);
      } else if (error && (error.isThrottled || error.isNetwork)) {
        setErrorText(getApiErrorMessage(error));
      } else {
        setErrorText(
          firstServerMessage(data, 'detail', 'error') ||
            "We couldn't save that just now. Please try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const named = productName ? `"${productName}"` : 'this product';

  return (
    <Dialog
      open={Boolean(open)}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      aria-labelledby={titleId}
      sx={{
        '& .MuiDialog-paper': {
          // 320px viewport: 16px of gutter each side, never a 256px paper.
          m: 2,
          width: 'calc(100% - 32px)',
          maxWidth: 420,
          borderRadius: 'var(--lf-r-panel, 18px)',
        },
      }}
    >
      <DialogTitle
        id={titleId}
        sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, pr: 7 }}
      >
        <Box
          aria-hidden="true"
          sx={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: 'var(--lf-r-pill, 999px)',
            backgroundColor: 'var(--lf-gold-tint, #F7F0E2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <NotificationsNoneOutlinedIcon
            sx={{ fontSize: 22, color: 'var(--lf-gold-ink, #7A5A24)' }}
          />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" component="span" sx={{ display: 'block' }}>
            Notify me when it&apos;s back
          </Typography>
          {productName ? (
            <Typography
              variant="body2"
              sx={{ color: 'var(--lf-ink-3, #6B635A)', fontWeight: 400 }}
            >
              {productName}
            </Typography>
          ) : null}
        </Box>
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 44,
            height: 44,
            color: 'var(--lf-ink-3, #6B635A)',
            ...FOCUS_RING_SX,
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {done ? (
        <>
          <DialogContent sx={{ pt: 0 }}>
            <Alert
              id={statusId}
              role="status"
              severity={done === 'already_subscribed' ? 'info' : 'success'}
              variant="outlined"
            >
              {done === 'already_subscribed'
                ? `You are already on the list for ${named}.`
                : `Done — we will email you as soon as ${named} is back in stock.`}
            </Alert>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button
              className="lf-press"
              variant="contained"
              color="primary"
              disableElevation
              onClick={onClose}
              sx={{ ...TOUCH_TARGET_SX, px: 3, ...FOCUS_RING_SX }}
            >
              Done
            </Button>
          </DialogActions>
        </>
      ) : (
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <DialogContent sx={{ pt: 0 }}>
            <Typography variant="body2" sx={{ color: 'var(--lf-ink-2, #4A433C)', mb: 2 }}>
              One email, once it is back. Nothing else.
            </Typography>

            <TextField
              id={emailId}
              type="email"
              name="email"
              label="Email address"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (fieldError) setFieldError(null);
              }}
              disabled={submitting}
              error={Boolean(fieldError)}
              helperText={fieldError || ' '}
              FormHelperTextProps={{ id: `${emailId}-helper` }}
              autoComplete="email"
              autoFocus
              fullWidth
              inputProps={{
                inputMode: 'email',
                enterKeyHint: 'send',
                maxLength: 254,
                'aria-describedby': `${emailId}-helper ${statusId}`,
                'aria-invalid': fieldError ? 'true' : undefined,
              }}
              sx={{
                '& .MuiOutlinedInput-root': { minHeight: 44 },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'var(--lf-border-field, #8A8178)',
                },
                '& .MuiFormHelperText-root': { marginLeft: 0 },
              }}
            />

            <FormControlLabel
              sx={{
                alignItems: 'flex-start',
                ml: 0,
                mr: 0,
                '& .MuiFormControlLabel-label': { mt: '10px' },
              }}
              control={
                <Checkbox
                  id={consentId}
                  checked={consent}
                  onChange={(event) => {
                    setConsent(event.target.checked);
                    if (consentError) setConsentError(null);
                  }}
                  disabled={submitting}
                  required
                  sx={{
                    width: 44,
                    height: 44,
                    color: 'var(--lf-border-field, #8A8178)',
                    ...FOCUS_RING_SX,
                  }}
                />
              }
              label={
                <Typography
                  variant="body2"
                  component="span"
                  sx={{ color: 'var(--lf-ink-2, #4A433C)', display: 'block' }}
                >
                  Email me when this product is back in stock. This is a one-off
                  notification, not a subscription.
                </Typography>
              }
            />
            {consentError ? (
              <Typography
                variant="caption"
                role="alert"
                sx={{ display: 'block', color: 'var(--lf-err-ink, #A01C15)', mt: 0.5 }}
              >
                {consentError}
              </Typography>
            ) : null}

            <Box id={statusId} role="alert" aria-live="assertive">
              {errorText ? (
                <Alert severity="error" variant="outlined" sx={{ mt: 2 }}>
                  {errorText}
                </Alert>
              ) : null}
            </Box>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button
              className="lf-press"
              variant="text"
              onClick={onClose}
              disabled={submitting}
              sx={{
                ...TOUCH_TARGET_SX,
                px: 2,
                color: 'var(--lf-ink-2, #4A433C)',
                ...FOCUS_RING_SX,
              }}
            >
              Cancel
            </Button>
            <Button
              className="lf-press"
              type="submit"
              variant="contained"
              color="primary"
              disableElevation
              disabled={submitting}
              sx={{ ...TOUCH_TARGET_SX, px: 3, ...FOCUS_RING_SX }}
              startIcon={
                submitting ? (
                  <CircularProgress size={16} thickness={3.6} color="inherit" />
                ) : null
              }
            >
              {submitting ? 'Saving' : 'Notify me'}
            </Button>
          </DialogActions>
        </Box>
      )}
    </Dialog>
  );
};

/**
 * The control that belongs where Add to Cart would have been, with the dialog wired up.
 * @param {object} props
 * @param {string} props.slug
 * @param {string} [props.productName]
 * @param {string} [props.label="Notify me when it's back"]
 * @param {boolean} [props.fullWidth=false] Set true on a product card, where it takes
 *   the full-width Add to Bag slot.
 * @param {'text'|'outlined'|'contained'} [props.variant='contained'] On an unsellable
 *   product this IS the primary action, so `contained` is the default.
 * @param {'small'|'medium'|'large'} [props.size='medium']
 * @param {Function} [props.onSubscribed]
 * @param {object} [props.sx]
 */
export const NotifyMeButton = ({
  slug,
  productName,
  label = "Notify me when it's back",
  fullWidth = false,
  variant = 'contained',
  size = 'medium',
  onSubscribed,
  sx,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        className="lf-press"
        variant={variant}
        color="primary"
        size={size}
        disableElevation
        fullWidth={fullWidth}
        onClick={(event) => {
          // Product cards wrap their title in a link; opening a dialog must not
          // also navigate.
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        sx={{ ...TOUCH_TARGET_SX, ...FOCUS_RING_SX, ...sx }}
        startIcon={<NotificationsNoneOutlinedIcon />}
      >
        {label}
      </Button>
      <NotifyMeDialog
        open={open}
        onClose={() => setOpen(false)}
        slug={slug}
        productName={productName}
        onSubscribed={onSubscribed}
      />
    </>
  );
};

export default NotifyMeDialog;
