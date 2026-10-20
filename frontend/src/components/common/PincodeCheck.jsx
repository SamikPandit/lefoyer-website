/**
 * PincodeCheck — a real delivery lookup, wherever the site talks about delivery.
 *
 * WHY IT EXISTS
 * The PDP told shoppers "Enter your postal code for Delivery Availability" with no
 * input anywhere on the page, and asserted "Cash on Delivery available" for every
 * pincode in India. The design system's ruling is blunt: PincodeCheck either ships with
 * a real lookup or the promise copy is deleted with it. This is the real lookup.
 *
 * THE 503 PATH IS NOT AN ERROR STATE
 * Blue Dart credentials live in a server-side `.env` and may be absent. When the
 * serviceability endpoint answers 503, the honest result is "we can't check right now,
 * and you can still order" — NOT a red failure that reads as "we don't deliver here".
 * Losing an order because a courier API was down is the worst possible outcome of a
 * component whose only job is reassurance.
 *
 * COD IS NEVER ASSERTED SITEWIDE
 * `cod_available` comes back per pincode. Before a successful check we say "check cash
 * on delivery for your pincode"; we never claim it.
 *
 * Usage:
 *   <PincodeCheck onResult={(r) => setCod(r && r.cod_available)} />
 *   <PincodeCheck variant="inline" showPolicyLine={false} />
 *   const prefill = getRememberedPincode();   // for Checkout's address form
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';

import { checkServiceability } from '../../services/api';
import { usePolicy } from '../../content/policy';
import SupportLink from './SupportLink';
import { FOCUS_RING_SX, TOUCH_TARGET_SX } from './EmptyState';

/** Where the last successfully-checked pincode is kept, so nobody retypes it. */
export const PINCODE_STORAGE_KEY = 'lf_pincode';

/** Indian PIN codes are six digits and never start with 0. */
const PINCODE_RE = /^[1-9][0-9]{5}$/;

/** @param {unknown} value @returns {boolean} */
export function isValidPincode(value) {
  return typeof value === 'string' && PINCODE_RE.test(value.trim());
}

/**
 * The last pincode this browser checked successfully, or `null`.
 * Safe in private mode and with site data blocked.
 */
export function getRememberedPincode() {
  try {
    const stored = window.localStorage.getItem(PINCODE_STORAGE_KEY);
    return isValidPincode(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Persist a pincode. Silently does nothing if storage is unavailable. */
export function rememberPincode(pincode) {
  try {
    if (isValidPincode(pincode)) {
      window.localStorage.setItem(PINCODE_STORAGE_KEY, pincode.trim());
    }
  } catch {
    /* private mode / blocked site data — the feature is a convenience, not a contract */
  }
}

/** "Fri, 24 Oct" — or null if the server sent something we cannot parse. */
function formatDeliveryDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(date);
  } catch {
    return null;
  }
}

const TONE_STYLES = {
  ok: {
    color: 'var(--lf-ok-ink, #15663D)',
    background: 'var(--lf-ok-tint, #E7F4EC)',
    Icon: CheckCircleOutlineIcon,
  },
  warn: {
    color: 'var(--lf-warn-ink, #7A4F00)',
    background: 'var(--lf-warn-tint, #FDF3E0)',
    Icon: InfoOutlinedIcon,
  },
  error: {
    color: 'var(--lf-err-ink, #A01C15)',
    background: 'var(--lf-err-tint, #FCECEA)',
    Icon: ErrorOutlineIcon,
  },
};

/**
 * @param {object} props
 * @param {'block'|'inline'} [props.variant='block'] `block` shows the label and the
 *   standing policy line (PDP, cart); `inline` is the bare row (checkout address step).
 * @param {string} [props.initialPincode] Prefill. Defaults to the remembered pincode.
 * @param {boolean} [props.autoCheck=true] Check the remembered pincode on mount, so a
 *   returning shopper sees a date without doing anything.
 * @param {Function} [props.onResult] Called with the normalised result object on every
 *   completed check, and with `null` when the field is cleared or a check fails. Shape:
 *   `{pincode, serviceable, cod_available, expected_delivery_date, transit_days,
 *     area_code, checked: true}`. `cod_available` is `null` when unknown — treat null
 *   as "do not claim COD", not as false.
 * @param {boolean} [props.showPolicyLine=true] Render the standing delivery sentence
 *   from policy.js above the field.
 * @param {string} [props.label='Delivery pincode']
 * @param {object} [props.sx]
 */
const PincodeCheck = ({
  variant = 'block',
  initialPincode,
  autoCheck = true,
  onResult,
  showPolicyLine = true,
  label = 'Delivery pincode',
  sx,
}) => {
  const { copy } = usePolicy();
  const baseId = useId();
  const inputId = `${baseId}-pincode`;
  const resultId = `${baseId}-result`;

  const remembered = useRef(getRememberedPincode());
  const [pincode, setPincode] = useState(
    () => initialPincode || remembered.current || '',
  );
  const [fieldError, setFieldError] = useState(null);
  const [checking, setChecking] = useState(false);
  /** `{ tone, heading, detail?, showSupport? }` or null. */
  const [outcome, setOutcome] = useState(null);
  const aliveRef = useRef(true);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const runCheck = useCallback(
    async (value) => {
      const candidate = String(value || '').trim();
      setFieldError(null);
      setOutcome(null);

      if (!isValidPincode(candidate)) {
        setFieldError('Enter a 6-digit pincode.');
        if (onResultRef.current) onResultRef.current(null);
        return;
      }

      setChecking(true);
      try {
        const data = (await checkServiceability(candidate)) || {};
        if (!aliveRef.current) return;

        // The backend coerces these to real booleans (WP-06); we still refuse to treat
        // anything other than `true` as a yes.
        const serviceable = data.serviceable === true;
        const codAvailable =
          typeof data.cod_available === 'boolean' ? data.cod_available : null;
        const normalised = {
          pincode: candidate,
          serviceable,
          cod_available: codAvailable,
          expected_delivery_date: data.expected_delivery_date || null,
          transit_days:
            typeof data.transit_days === 'number' ? data.transit_days : null,
          area_code: data.area_code || null,
          checked: true,
        };

        if (serviceable) {
          rememberPincode(candidate);
          const formatted = formatDeliveryDate(normalised.expected_delivery_date);
          const when = formatted
            ? `Expected by ${formatted}`
            : normalised.transit_days
              ? `Expected in ${normalised.transit_days} day${
                  normalised.transit_days === 1 ? '' : 's'
                }`
              : `Expected in ${copy.deliveryWindow}`;
          setOutcome({
            tone: 'ok',
            heading: `Delivers to ${candidate}`,
            detail: `${when} · ${copy.codLabelFor(codAvailable)}`,
          });
        } else {
          setOutcome({
            tone: 'warn',
            heading: `We don't deliver to ${candidate} yet`,
            detail: 'Try another pincode, or get in touch and we will look into it.',
            showSupport: true,
          });
        }

        if (onResultRef.current) onResultRef.current(normalised);
      } catch (error) {
        if (!aliveRef.current) return;
        const response = error && error.response;
        const statusCode = response && response.status;
        const body = (response && response.data) || {};

        if (statusCode === 400) {
          // Normalised envelope is `{error, field}` (WP-06). Prefer the server's words.
          setFieldError(
            (typeof body.error === 'string' && body.error) ||
              'Enter a valid 6-digit pincode.',
          );
          if (onResultRef.current) onResultRef.current(null);
        } else if (statusCode === 503 || (error && error.isNetwork)) {
          // NOT a failure the shopper needs to act on. Keep the order available.
          setOutcome({
            tone: 'warn',
            heading: 'Delivery check is temporarily unavailable',
            detail: `You can still place your order. ${copy.deliveryDetail}`,
          });
          if (onResultRef.current) onResultRef.current(null);
        } else if (error && error.isThrottled) {
          setOutcome({
            tone: 'warn',
            heading: 'Too many checks just now',
            detail: 'Give it a few seconds and try again.',
          });
          if (onResultRef.current) onResultRef.current(null);
        } else {
          setOutcome({
            tone: 'error',
            heading: "We couldn't check that pincode",
            detail: `Please try again. ${copy.deliveryDetail}`,
          });
          if (onResultRef.current) onResultRef.current(null);
        }
      } finally {
        if (aliveRef.current) setChecking(false);
      }
    },
    [copy],
  );

  // A returning shopper gets their date back without lifting a finger.
  const autoRunRef = useRef(false);
  useEffect(() => {
    if (autoRunRef.current) return;
    const prefill = initialPincode || remembered.current;
    if (autoCheck && isValidPincode(prefill)) {
      autoRunRef.current = true;
      runCheck(prefill);
    }
  }, [autoCheck, initialPincode, runCheck]);

  const handleChange = (event) => {
    // Phone keypads happily emit spaces and dashes; keep only digits.
    const digits = event.target.value.replace(/\D/g, '').slice(0, 6);
    setPincode(digits);
    if (fieldError) setFieldError(null);
    if (outcome) setOutcome(null);
    if (digits.length === 0 && onResultRef.current) onResultRef.current(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!checking) runCheck(pincode);
  };

  const toneStyle = outcome ? TONE_STYLES[outcome.tone] || TONE_STYLES.warn : null;
  const ToneIcon = toneStyle ? toneStyle.Icon : null;

  return (
    <Box sx={{ width: '100%', ...sx }}>
      {variant === 'block' && showPolicyLine ? (
        <Typography
          variant="body2"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            color: 'var(--lf-ink-2, #4A433C)',
            mb: 1,
          }}
        >
          <PlaceOutlinedIcon sx={{ fontSize: 18, color: 'var(--lf-ink-3, #6B635A)' }} />
          {copy.deliveryLine}
        </Typography>
      ) : null}

      <Box
        component="form"
        onSubmit={handleSubmit}
        noValidate
        aria-busy={checking ? 'true' : undefined}
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: 1,
        }}
      >
        <TextField
          id={inputId}
          value={pincode}
          onChange={handleChange}
          disabled={checking}
          error={Boolean(fieldError)}
          helperText={fieldError || ' '}
          FormHelperTextProps={{ id: `${inputId}-helper` }}
          label={variant === 'block' ? label : undefined}
          placeholder="560001"
          autoComplete="postal-code"
          inputProps={{
            inputMode: 'numeric',
            pattern: '[0-9]*',
            maxLength: 6,
            enterKeyHint: 'search',
            'aria-label': variant === 'block' ? undefined : label,
            'aria-describedby': `${inputId}-helper ${resultId}`,
            'aria-invalid': fieldError ? 'true' : undefined,
          }}
          sx={{
            // 160px holds six digits plus the label at 320px with the button beside it.
            width: 160,
            flex: '0 1 160px',
            minWidth: 128,
            '& .MuiOutlinedInput-root': { minHeight: 44 },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--lf-border-field, #8A8178)',
            },
            '& .MuiFormHelperText-root': { marginLeft: 0 },
          }}
        />
        <Button
          className="lf-press"
          type="submit"
          variant="outlined"
          disabled={checking}
          sx={{
            ...TOUCH_TARGET_SX,
            px: 2.5,
            flexShrink: 0,
            borderColor: 'var(--lf-border-ink, #14110F)',
            color: 'var(--lf-ink, #14110F)',
            ...FOCUS_RING_SX,
          }}
          startIcon={
            checking ? (
              <CircularProgress size={16} thickness={3.6} color="inherit" />
            ) : null
          }
        >
          {checking ? 'Checking' : 'Check'}
        </Button>
      </Box>

      {/* One live region for every outcome, so a result is announced once. */}
      <Box
        id={resultId}
        role={outcome && outcome.tone === 'error' ? 'alert' : 'status'}
        aria-live="polite"
      >
        {outcome ? (
          <Box
            sx={{
              mt: 1,
              p: 1.5,
              display: 'flex',
              gap: 1,
              alignItems: 'flex-start',
              borderRadius: 'var(--lf-r-field, 10px)',
              backgroundColor: toneStyle.background,
            }}
          >
            <ToneIcon
              aria-hidden="true"
              sx={{ fontSize: 20, color: toneStyle.color, flexShrink: 0, mt: '2px' }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{ color: toneStyle.color, fontWeight: 600 }}
              >
                {outcome.heading}
              </Typography>
              {outcome.detail ? (
                <Typography variant="body2" sx={{ color: 'var(--lf-ink-2, #4A433C)' }}>
                  {outcome.detail}
                </Typography>
              ) : null}
              {outcome.showSupport ? (
                <Box sx={{ mt: 0.5 }}>
                  <SupportLink variant="inline" topic="delivery" />
                </Box>
              ) : null}
            </Box>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
};

export default PincodeCheck;
