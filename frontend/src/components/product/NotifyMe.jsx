/**
 * ============================================================================
 * <NotifyMe> — ART_DIRECTION.md §6.6. GOLD FILL, NEVER ABSENT, NEVER DISABLED.
 *
 * Half this catalogue is unbuyable — three of six products, verified — so the
 * restock row is not the dead half of the page: it is the WARMEST thing on the
 * shelf, and email capture is this shop's highest-value action while stock is
 * out. `--lf-gold` fill with an `--lf-ink` label measures **8.15:1** and is
 * LICENSED FILL 1 of 2 (§2.18, §3.3). Ink at 15.97:1 still outranks gold at
 * 1.96:1, so §2.17's hierarchy is unharmed, and the `BACK SOON` status ledge
 * sits ABOVE the product name, so the words land before the eye reaches the
 * button — which is the misread-as-promotion mitigation, stated in the
 * appendix's risk table.
 *
 * THE THREE RULES THIS COMPONENT EXISTS TO ENFORCE (§6.6, §6.8 rules 1–3,
 * §10.12, A4):
 *   1. **`aria-disabled`, never the `disabled` attribute.** A `disabled`
 *      button leaves the tab order and takes its own explanation with it; the
 *      theme's `notify` variant keeps its colour under `aria-disabled` so it
 *      never degrades into a dead grey rectangle either.
 *   2. **The reason is always stated adjacent**, 13px `--lf-ink-3` (4.65:1 on
 *      quiet, 5.38:1 on canvas) — not left to colour, not left to a tooltip.
 *   3. **The button never vanishes.** Not while submitting, not after success,
 *      not on an unpriced product.
 *
 * GEOMETRY: the same 48px (card) / 52px (buy box) as <AddToBag>, full width,
 * `white-space: nowrap` — `Notify me` at 15px/600 measures ~68px in a 248px
 * label box at the 288px floor, where today it wraps onto two lines (§4.3).
 *
 * TWO SURFACES, ONE CONTROL:
 *   card   — `Notify me`, opening the existing `<NotifyMeDialog>`. There is no
 *            second notify mechanism (§10.23): the dialog is the one that owns
 *            the throttle path, the 429 copy and the already-subscribed case.
 *   buybox — `Notify me when it's back`, revealing ONE inline email field and
 *            the honest line `One email, the day it's back. Nothing else.`
 *
 * CONSENT: `products/serializers.py` requires `consent: true` and stores the
 * row AS a consent record with its own timestamp ("not the row's creation time
 * — this is the evidence of consent"). §6.6 describes the inline form as one
 * field; a POST that asserted consent the customer never gave would fabricate
 * that evidence, so the inline form carries the tick box the record requires,
 * and §6.6's sentence is rendered verbatim beneath it. Reported as a deviation.
 * ========================================================================== */

import { useEffect, useId, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { getApiErrorMessage, notifyMe } from '../../services/api';
import { firstServerMessage, isLikelyEmail } from '../common/NewsletterForm';
import NotifyMeDialog from '../common/NotifyMeDialog';
import { stockState } from '../../utils/stock';

/** 48 on a card, 52 in a buy box — identical to <AddToBag> (§6.6). */
const HEIGHTS = { card: 48, buybox: 52 };

/** §6.6, verbatim. The whole promise, in one line, before anyone types. */
const PROMISE = 'One email, the day it’s back. Nothing else.';

/**
 * @param {object}   props
 * @param {object}   props.product     The API payload — slug and name. Never a
 *   typed product name (§10.21).
 * @param {'card'|'buybox'} [props.size='card']
 * @param {boolean}  [props.fullWidth=true]
 * @param {string}   [props.label]     Defaults to §6.6's label for the surface.
 * @param {string|null} [props.reason] The adjacent reason. Defaults to the one
 *   `utils/stock.js` derives, so the card and the PDP cannot word it
 *   differently. Pass `null` to let a caller render it elsewhere.
 * @param {Function} [props.onSubscribed] Called with `'subscribed'` or
 *   `'already_subscribed'` once the SERVER confirms. Never optimistic.
 * @param {object}   [props.sx]
 * @param {string}   [props.className]
 * @returns {JSX.Element}
 */
export default function NotifyMe({
  product,
  size = 'card',
  fullWidth = true,
  label,
  reason: reasonProp,
  onSubscribed,
  sx,
  className,
  ...rest
}) {
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const emailId = `${baseId}-email`;
  const statusId = `${baseId}-status`;

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState(null);
  const [consentError, setConsentError] = useState(null);
  const [errorText, setErrorText] = useState(null);
  /** `'subscribed' | 'already_subscribed' | null` — set only by the server. */
  const [done, setDone] = useState(null);

  const emailRef = useRef(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /* The field is revealed, so it is also where focus belongs. */
  useEffect(() => {
    if (open && !done && emailRef.current) emailRef.current.focus();
  }, [open, done]);

  const inBuyBox = size === 'buybox';
  const height = HEIGHTS[size] || HEIGHTS.card;
  const slug = product?.slug || null;
  const ctaLabel = label || (inBuyBox ? 'Notify me when it’s back' : 'Notify me');
  const reason = reasonProp === undefined ? stockState(product).reason : reasonProp;

  const triggerSx = {
    minHeight: height,
    whiteSpace: 'nowrap',
    ...sx,
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    event.stopPropagation();
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
      setFieldError('That doesn’t look like a complete email address.');
      return;
    }
    if (!consent) {
      setConsentError('Tick the box so we can email you about this product.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await notifyMe(slug, { email: trimmed, consent });
      if (!aliveRef.current) return;
      const status = data && data.status === 'already_subscribed'
        ? 'already_subscribed'
        : 'subscribed';
      setDone(status);
      setEmail('');
      setConsent(false);
      if (typeof onSubscribed === 'function') onSubscribed(status);
    } catch (error) {
      if (!aliveRef.current) return;
      const data = error && error.response && error.response.data;
      const emailMessage = firstServerMessage(data, 'email');
      const consentMessage = firstServerMessage(data, 'consent');
      if (emailMessage) setFieldError(emailMessage);
      else if (consentMessage) setConsentError(consentMessage);
      else if (error && (error.isThrottled || error.isNetwork)) setErrorText(getApiErrorMessage(error));
      else {
        setErrorText(
          firstServerMessage(data, 'detail', 'error') ||
            'We couldn’t save that just now. Please try again.',
        );
      }
    } finally {
      if (aliveRef.current) setSubmitting(false);
    }
  };

  /* -------------------------------------------------------------------- *
   * The trigger. Identical on both surfaces: gold fill, ink label, never
   * `disabled`, never absent.
   * -------------------------------------------------------------------- */
  const trigger = (
    <Button
      className={className ? `lf-press ${className}` : 'lf-press'}
      type="button"
      variant="notify"
      fullWidth={fullWidth}
      onClick={(event) => {
        /* The card's whole surface is a link; this must not navigate. */
        event.preventDefault();
        event.stopPropagation();
        setOpen(true);
      }}
      aria-haspopup={inBuyBox ? undefined : 'dialog'}
      aria-expanded={inBuyBox ? open : undefined}
      aria-controls={inBuyBox && open ? panelId : undefined}
      sx={triggerSx}
      {...rest}
    >
      {ctaLabel}
    </Button>
  );

  /* -------------------------------------------------------------------- *
   * The adjacent reason (§6.6 rule 2 / §10.12). Always, on both surfaces.
   * -------------------------------------------------------------------- */
  const reasonLine = reason ? (
    <Typography
      variant="caption"
      sx={{ display: 'block', color: 'var(--lf-ink-3)', mt: 'var(--lf-2)' }}
    >
      {reason}
    </Typography>
  ) : null;

  /* -------------------------------------------------------------------- *
   * CARD — the existing dialog, which already owns the throttle and the
   * already-subscribed paths. No second notify mechanism (§10.23).
   * -------------------------------------------------------------------- */
  if (!inBuyBox) {
    return (
      <>
        {trigger}
        {reasonLine}
        <NotifyMeDialog
          open={open}
          onClose={() => setOpen(false)}
          slug={slug}
          productName={product?.name}
          onSubscribed={onSubscribed}
        />
      </>
    );
  }

  /* -------------------------------------------------------------------- *
   * BUY BOX — one inline email field, revealed in place (§6.6).
   * -------------------------------------------------------------------- */
  return (
    <>
      {trigger}
      {reasonLine}

      {open ? (
        <Box id={panelId} sx={{ mt: 'var(--lf-3)', minWidth: 0 }}>
          {done ? (
            <Typography
              id={statusId}
              role="status"
              variant="body2"
              sx={{ color: 'var(--lf-ok-ink)' }}
            >
              {done === 'already_subscribed'
                ? 'You are already on the list. We will email you the day it’s back.'
                : 'Done. We will email you the day it’s back.'}
            </Typography>
          ) : (
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <TextField
                id={emailId}
                inputRef={emailRef}
                type="email"
                name="email"
                label="Email address"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (fieldError) setFieldError(null);
                }}
                error={Boolean(fieldError)}
                helperText={fieldError || ' '}
                autoComplete="email"
                fullWidth
                inputProps={{
                  inputMode: 'email',
                  enterKeyHint: 'send',
                  maxLength: 254,
                  'aria-invalid': fieldError ? 'true' : undefined,
                }}
              />

              {/* The row IS a consent record (products/serializers.py), so the
                  tick is collected, never assumed. */}
              <FormControlLabel
                sx={{ alignItems: 'flex-start', ml: 0, mr: 0 }}
                control={
                  <Checkbox
                    checked={consent}
                    onChange={(event) => {
                      setConsent(event.target.checked);
                      if (consentError) setConsentError(null);
                    }}
                    sx={{ width: 44, height: 44 }}
                  />
                }
                label={
                  <Typography
                    variant="body2"
                    component="span"
                    sx={{ display: 'block', color: 'var(--lf-ink-2)', mt: '10px' }}
                  >
                    Email me when this product is back in stock.
                  </Typography>
                }
              />
              {consentError ? (
                <Typography
                  variant="caption"
                  role="alert"
                  sx={{ display: 'block', color: 'var(--lf-err-ink)', mt: 'var(--lf-1)' }}
                >
                  {consentError}
                </Typography>
              ) : null}

              {/* §6.6, verbatim: the whole promise, before anyone commits. */}
              <Typography
                variant="caption"
                sx={{ display: 'block', color: 'var(--lf-ink-3)', mt: 'var(--lf-2)' }}
              >
                {PROMISE}
              </Typography>

              <Button
                className="lf-press"
                type="submit"
                variant="notify"
                fullWidth
                /* RULE 1: aria-disabled while in flight, never `disabled`, so
                   it keeps its colour, its focus and its explanation. */
                aria-disabled={submitting || undefined}
                aria-busy={submitting || undefined}
                sx={{
                  minHeight: HEIGHTS.card,
                  whiteSpace: 'nowrap',
                  mt: 'var(--lf-3)',
                  ...(submitting ? { pointerEvents: 'none' } : null),
                }}
                startIcon={
                  submitting ? <CircularProgress size={16} thickness={3.6} color="inherit" /> : null
                }
              >
                {submitting ? 'Saving' : 'Notify me'}
              </Button>

              <Box id={statusId} role="alert" aria-live="assertive">
                {errorText ? (
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', color: 'var(--lf-err-ink)', mt: 'var(--lf-2)' }}
                  >
                    {errorText}
                  </Typography>
                ) : null}
              </Box>
            </Box>
          )}
        </Box>
      ) : null}
    </>
  );
}
