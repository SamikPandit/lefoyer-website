/**
 * NewsletterForm — ONE newsletter implementation for the whole site.
 *
 * WHAT IT REPLACES
 * Two different fakes, neither of which stored anything:
 *   - home/NewsletterSignup.jsx: `await new Promise(r => setTimeout(r, 1500))` and then
 *     "Thank you for subscribing!" if the string merely contained an `@`. So `a@b` was
 *     a success, and no address was ever saved.
 *   - common/Footer.jsx: accepted a single space as a valid address and showed the same
 *     invented success.
 * Telling a customer they are subscribed when nothing was written is the kind of lie
 * that is only discovered when the first campaign never arrives.
 *
 * THE RULES THIS COMPONENT KEEPS
 *   1. Nothing is claimed that the server did not say. Every message below is selected
 *      from the HTTP response. There is no optimistic success and no timer.
 *   2. `already_subscribed` is NOT an error. It is the second most common outcome of a
 *      newsletter form, and rendering it red teaches customers the site is broken.
 *   3. Consent is EXPLICIT and its state is what gets submitted. No pre-ticked box, no
 *      "by subscribing you agree" small print standing in for a checkbox.
 *   4. Real validation. `a@b` is rejected before a request is made (one-character TLDs
 *      do not exist), and so is an empty or whitespace address.
 *   5. In-flight: the field, the box and the button are all disabled, so a double
 *      submit cannot create two requests.
 *
 * Usage:
 *   <NewsletterForm variant="inline" source="footer" />
 *   <NewsletterForm variant="hero"   source="home" />
 */

import { useId, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { getApiErrorMessage, subscribeNewsletter } from '../../services/api';
import { useBrand } from '../../content/brand';
import { FOCUS_RING_SX, TOUCH_TARGET_SX } from './EmptyState';

/** The sources the backend accepts (IMPL_SPEC §2a). Anything else is coerced to this. */
export const NEWSLETTER_SOURCES = Object.freeze([
  'home',
  'footer',
  'cart',
  'oos_notify',
]);

/**
 * Deliberately stricter than `type="email"`: at least one dot after the `@` and a
 * final label of two characters or more, which is what rejects `a@b`. It is not an
 * RFC 5322 parser and does not need to be — the server is the authority, this only
 * stops the obviously-wrong request.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)*\.[^\s@.]{2,}$/;

export function isLikelyEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value.trim());
}

/**
 * Pull a usable, human message out of a DRF error body without inventing one.
 * Deliberately narrower than api.js's `getApiErrorMessage`: that helper falls back to
 * `error.message`, which is "Request failed with status code 500" — a status code, which
 * no customer-facing string in this package is allowed to contain. We use it only for
 * the network and throttle branches, where it returns fixed prose.
 * Exported so NotifyMeDialog shares exactly one implementation.
 */
export function firstServerMessage(data, ...keys) {
  if (!data || typeof data !== 'object') return null;
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
      return value[0].trim();
    }
  }
  return null;
}

/**
 * @param {object} props
 * @param {'inline'|'hero'} [props.variant='inline'] `inline` is a single row for the
 *   footer and other tight spots; `hero` is the centred block with a heading.
 * @param {'home'|'footer'|'cart'|'oos_notify'} [props.source='footer'] Stored with the
 *   subscription so campaigns can be attributed.
 * @param {string} [props.title] Hero heading. Defaults to `brand.newsletter.heading`.
 * @param {string} [props.description] Hero body. Defaults to `brand.newsletter.body`.
 * @param {string} [props.buttonLabel] Defaults to `brand.newsletter.buttonLabel`.
 * @param {string} [props.placeholder] Defaults to `brand.newsletter.placeholder`.
 * @param {string} [props.consentLabel] Defaults to `brand.newsletter.consentLabel`.
 *   Whatever this says is what the customer consented to — change it with care.
 * @param {object} [props.utm] Optional `{utm_source, utm_medium, utm_campaign}` passed
 *   through to the API.
 * @param {Function} [props.onSuccess] Called with `'subscribed' | 'already_subscribed'`.
 * @param {boolean} [props.showPrivacyNote=true]
 * @param {object} [props.sx]
 */
const NewsletterForm = ({
  variant = 'inline',
  /* §5.11 / §2.18 — the ONE newsletter on the site is the footer's, and its
     `Join` is LICENSED GOLD FILL 2 of 2. theme.js carries that as the
     `brandFill` Button variant; this prop is how the footer asks for it
     without forking a second newsletter (§10.23). Everything else keeps the
     ink `contained` default. Integration step: this replaces the scoped sx
     bridge Footer.jsx used to paint the button with. */
  buttonVariant = 'contained',
  source = 'footer',
  title,
  description,
  buttonLabel,
  placeholder,
  consentLabel,
  utm,
  onSuccess,
  showPrivacyNote = true,
  sx,
}) => {
  const brand = useBrand();
  const copy = brand.newsletter;
  const baseId = useId();
  const emailId = `${baseId}-email`;
  const consentId = `${baseId}-consent`;
  const statusId = `${baseId}-status`;
  const consentErrorId = `${baseId}-consent-error`;

  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState(null);
  const [consentError, setConsentError] = useState(null);
  /** `{ kind: 'success'|'info'|'error', text: string }` or null. */
  const [status, setStatus] = useState(null);

  const isHero = variant === 'hero';
  const safeSource = NEWSLETTER_SOURCES.includes(source) ? source : 'footer';

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const trimmed = email.trim();
    setStatus(null);
    setFieldError(null);
    setConsentError(null);

    if (!trimmed) {
      setFieldError('Enter your email address.');
      return;
    }
    if (!isLikelyEmail(trimmed)) {
      setFieldError("That doesn't look like a complete email address.");
      return;
    }
    if (!consent) {
      // The backend requires consent:true, so an unticked box cannot be submitted.
      // We never send `consent: true` for an unticked box.
      setConsentError('Tick the box so we know you want these emails.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = { email: trimmed, consent, source: safeSource };
      if (utm && typeof utm === 'object') payload.utm = utm;

      const data = await subscribeNewsletter(payload);
      const outcome = data && data.status;

      if (outcome === 'already_subscribed') {
        // Not an error. Nothing is broken and nothing more is required of them.
        setStatus({
          kind: 'info',
          text:
            firstServerMessage(data, 'detail') ||
            "You're already on the list — nothing more to do.",
        });
      } else {
        setStatus({
          kind: 'success',
          text:
            firstServerMessage(data, 'detail') ||
            "You're on the list. Look out for an email from us.",
        });
      }

      setEmail('');
      setConsent(false);
      if (typeof onSuccess === 'function') onSuccess(outcome || 'subscribed');
    } catch (error) {
      const response = error && error.response;
      const data = response && response.data;

      // A 400 on `email` belongs on the field, not in a banner at the bottom.
      const emailMessage = firstServerMessage(data, 'email');
      const consentMessage = firstServerMessage(data, 'consent');

      if (emailMessage) {
        setFieldError(emailMessage);
      } else if (consentMessage) {
        setConsentError(consentMessage);
      } else if (error && (error.isThrottled || error.isNetwork)) {
        // One wording for these two across the whole app.
        setStatus({ kind: 'error', text: getApiErrorMessage(error) });
      } else {
        setStatus({
          kind: 'error',
          text:
            firstServerMessage(data, 'detail', 'error') ||
            "We couldn't save your address just now. Please try again.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: isHero ? 560 : '100%',
        mx: isHero ? 'auto' : 0,
        textAlign: isHero ? 'center' : 'left',
        ...sx,
      }}
    >
      {isHero ? (
        <>
          <Typography
            variant="h3"
            component="h2"
            sx={{ color: 'var(--lf-ink, #14110F)', mb: 1 }}
          >
            {title || copy.heading}
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: 'var(--lf-ink-2, #4A433C)', mb: 3, mx: 'auto', maxWidth: 480 }}
          >
            {description || copy.body}
          </Typography>
        </>
      ) : null}

      <Box
        component="form"
        onSubmit={handleSubmit}
        noValidate
        aria-busy={submitting ? 'true' : undefined}
      >
        <Box
          sx={{
            display: 'flex',
            // One column at 320px. The button never shrinks below its label.
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'flex-start',
            gap: 1.5,
          }}
        >
          <TextField
            id={emailId}
            type="email"
            name="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (fieldError) setFieldError(null);
            }}
            disabled={submitting}
            error={Boolean(fieldError)}
            helperText={fieldError || ' '}
            FormHelperTextProps={{ id: `${emailId}-helper` }}
            placeholder={placeholder || copy.placeholder}
            // The inline row has no space for a floating label, so there the name is
            // carried by `aria-label` on the input instead. It is never absent.
            label={isHero ? 'Email address' : undefined}
            autoComplete="email"
            inputProps={{
              inputMode: 'email',
              enterKeyHint: 'send',
              maxLength: 254,
              'aria-label': isHero ? undefined : 'Email address',
              'aria-describedby': `${emailId}-helper ${statusId}`,
              'aria-invalid': fieldError ? 'true' : undefined,
            }}
            fullWidth
            sx={{
              flex: 1,
              minWidth: 0,
              '& .MuiOutlinedInput-root': {
                minHeight: 44,
                backgroundColor: 'var(--lf-paper)',
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'var(--lf-border-field)',
              },
              '& .MuiFormHelperText-root': { marginLeft: 0 },
            }}
          />

          <Button
            className="lf-press"
            type="submit"
            variant={buttonVariant}
            disableElevation
            disabled={submitting}
            sx={{
              ...TOUCH_TARGET_SX,
              px: 3,
              // Matches the field's height so the row reads as one control.
              mt: 0,
              width: { xs: '100%', sm: 'auto' },
              flexShrink: 0,
              ...FOCUS_RING_SX,
            }}
            startIcon={
              submitting ? (
                <CircularProgress size={16} thickness={3.6} color="inherit" />
              ) : null
            }
          >
            {submitting ? 'Joining' : buttonLabel || copy.buttonLabel}
          </Button>
        </Box>

        <FormControlLabel
          sx={{
            alignItems: 'flex-start',
            mr: 0,
            ml: 0,
            mt: 0.5,
            ...(isHero ? { textAlign: 'left' } : {}),
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
              // Required by the API, and stated here rather than implied.
              required
              aria-describedby={consentError ? consentErrorId : undefined}
              sx={{
                // 44px hit area around a 20px box.
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
              {consentLabel || copy.consentLabel}
            </Typography>
          }
        />

        {consentError ? (
          <Typography
            id={consentErrorId}
            variant="caption"
            role="alert"
            sx={{ display: 'block', color: 'var(--lf-err-ink, #A01C15)', mt: 0.5 }}
          >
            {consentError}
          </Typography>
        ) : null}

        {showPrivacyNote ? (
          <Typography
            variant="caption"
            sx={{ display: 'block', color: 'var(--lf-ink-3, #6B635A)', mt: 1 }}
          >
            {copy.privacyNote}
          </Typography>
        ) : null}

        {/* One live region. Success and "already subscribed" are polite; a failure is
            assertive, because the customer is about to walk away believing it worked. */}
        <Box
          id={statusId}
          role={status && status.kind === 'error' ? 'alert' : 'status'}
          aria-live={status && status.kind === 'error' ? 'assertive' : 'polite'}
          sx={{ mt: status ? 2 : 0 }}
        >
          {status ? (
            <Alert
              severity={status.kind === 'error' ? 'error' : status.kind}
              variant="outlined"
              sx={{ textAlign: 'left' }}
            >
              {status.text}
            </Alert>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
};

export default NewsletterForm;
