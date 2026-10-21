/**
 * OrderTimeline — LF-28.
 *
 * TWO DEFECTS, BOTH FIXED HERE
 *
 * 1. **There was no error branch.** Every step was "complete or not yet", so a
 *    FAILED payment rendered as a healthy in-progress order: step 1 green, the
 *    rest grey, nothing anywhere saying the payment did not go through or that
 *    the customer could retry. A failed order looked exactly like one that was
 *    simply early. Now FAILED / CANCELLED / EXPIRED render the Payment step with
 *    `error` styling, an explanation, and the recovery actions — and the
 *    timeline **stops there**, because the steps after it are not going to
 *    happen until the payment does.
 *
 * 2. **`ColorlibConnector` was inert.** It was written as legacy JSS — nested
 *    `alternativeLabel`, `active`, `completed`, `line` keys with `'& $line'`
 *    selectors — which `styled()` has never supported. Emotion emitted
 *    `alternativeLabel { top: 22 }` as a literal, unmatched CSS block, so the
 *    gradient, the 3px height and the divider colour all did nothing. Rewritten
 *    with MUI v7 `stepConnectorClasses` selectors, using the design system's own
 *    tokens rather than the teal-to-yellow gradient (which belongs to no palette
 *    in this project).
 *
 * `order.status` is the server's DERIVED status (C-19: there is no `status`
 * column; both this file and OrderDetail read one and silently fell back to the
 * string 'Pending' for every order ever placed).
 *
 * ALCOVE: `--lf-surface-quiet` → `--lf-quiet` (§3.1 — the deprecated alias is
 * deleted in step 9.10), the recovery buttons drop `size="small"` because the
 * theme's small button is 36px and A6 sets a 44px floor on every target, and
 * `--lf-ink-4` stays only where it already was: on an IDLE step's glyph, which
 * is non-text and is the one role §3.2 keeps it for.
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepConnector, { stepConnectorClasses } from '@mui/material/StepConnector';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PaymentOutlinedIcon from '@mui/icons-material/PaymentOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import { Link as RouterLink } from 'react-router-dom';

import SupportLink from '../common/SupportLink';

/** Payment states from which the timeline cannot continue (§2f). */
const BROKEN_PAYMENT_STATES = new Set(['FAILED', 'CANCELLED', 'EXPIRED']);

const SHIPPED_STATES = new Set(['in_transit', 'out_for_delivery', 'delivered']);
const PROCESSING_STATES = new Set([
  'pending',
  'booked',
  'pickup_scheduled',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'undelivered',
]);

/** The copy for each broken state. The order number is always in it. */
const BROKEN_COPY = {
  FAILED: (number) =>
    `Payment for order ${number} did not go through. You have not been charged, and your bag is still here.`,
  CANCELLED: (number) =>
    `Payment for order ${number} was cancelled before it completed. Nothing has been charged.`,
  EXPIRED: (number) =>
    `We could not confirm the payment for order ${number}. If you were charged it is refunded automatically — quote this number to support.`,
};

const Connector = styled(StepConnector)(() => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 23,
    left: 'calc(-50% + 24px)',
    right: 'calc(50% + 24px)',
  },
  [`& .${stepConnectorClasses.line}`]: {
    height: 3,
    border: 0,
    borderRadius: 2,
    backgroundColor: 'var(--lf-hairline)',
  },
  [`&.${stepConnectorClasses.active} .${stepConnectorClasses.line}`]: {
    backgroundColor: 'var(--lf-gold-edge)',
  },
  [`&.${stepConnectorClasses.completed} .${stepConnectorClasses.line}`]: {
    backgroundColor: 'var(--lf-ink)',
  },
}));

const formatStamp = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
};

const StepBubble = ({ Icon, state }) => {
  const palette = {
    complete: { bg: 'var(--lf-ink)', fg: 'var(--lf-on-ink)' },
    active: { bg: 'var(--lf-gold-tint)', fg: 'var(--lf-gold-ink)' },
    error: { bg: 'var(--lf-err-tint)', fg: 'var(--lf-err-ink)' },
    idle: { bg: 'var(--lf-quiet)', fg: 'var(--lf-ink-4)' },
  }[state];

  return (
    <Box
      aria-hidden="true"
      sx={{
        width: 46,
        height: 46,
        borderRadius: 'var(--lf-r-pill)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.bg,
        color: palette.fg,
        border: state === 'error' ? '1px solid var(--lf-err-ink)' : 'none',
      }}
    >
      <Icon sx={{ fontSize: 22 }} />
    </Box>
  );
};

/**
 * @param {object} props
 * @param {object} props.order An Order payload (§2b #25).
 * @param {Function} [props.onRetryPayment] Opens the retry flow in place. When
 *   omitted the step links to the order page, which carries the same action.
 * @param {Function} [props.onRestoreCart]
 */
const OrderTimeline = ({ order, onRetryPayment, onRestoreCart }) => {
  if (!order) return null;

  const paymentStatus = String(order.payment_status || 'PENDING').toUpperCase();
  const shipment = order.shipment || null;
  const shipmentStatus = shipment?.status ? String(shipment.status).toLowerCase() : null;
  const orderNumber = order.order_number || `#${order.id}`;
  const broken = BROKEN_PAYMENT_STATES.has(paymentStatus);
  const paid = paymentStatus === 'COMPLETED';
  /* Only PENDING and FAILED can actually be paid again: CANCELLED and EXPIRED
     are refused with 409 ORDER_CLOSED by `services.start_payment_attempt`, so
     those states get Restore-my-cart and support instead of a dead button. */
  const retryable =
    order.can_retry === true ||
    (order.can_retry === undefined && ['PENDING', 'FAILED'].includes(paymentStatus));

  const steps = [
    {
      key: 'placed',
      label: 'Order placed',
      Icon: CheckCircleOutlineIcon,
      state: 'complete',
      stamp: order.created_at,
    },
    {
      key: 'payment',
      label:
        paymentStatus === 'CANCELLED'
          ? 'Payment cancelled'
          : paymentStatus === 'FAILED'
            ? 'Payment failed'
            : paymentStatus === 'EXPIRED'
              ? 'Payment unconfirmed'
              : order.payment_method === 'COD' && paid
                ? 'Order confirmed'
                : 'Payment confirmed',
      Icon: broken ? ErrorOutlineIcon : PaymentOutlinedIcon,
      state: broken ? 'error' : paid ? 'complete' : 'active',
      stamp: paid || broken ? order.updated_at : null,
    },
  ];

  // Everything past Payment is only meaningful once the money is in.
  if (!broken) {
    const processing = Boolean(shipment) && PROCESSING_STATES.has(shipmentStatus);
    const shipped = SHIPPED_STATES.has(shipmentStatus);
    const delivered = shipmentStatus === 'delivered';

    steps.push(
      {
        key: 'processing',
        label: 'Packed',
        Icon: Inventory2OutlinedIcon,
        state: processing ? 'complete' : paid ? 'active' : 'idle',
        stamp: shipment?.created_at || null,
      },
      {
        key: 'shipped',
        label: 'Shipped',
        Icon: LocalShippingOutlinedIcon,
        state: shipped ? 'complete' : processing ? 'active' : 'idle',
        stamp: shipped ? shipment?.shipped_at || shipment?.updated_at : null,
      },
      {
        key: 'delivered',
        label: 'Delivered',
        Icon: VerifiedOutlinedIcon,
        state: delivered ? 'complete' : shipped ? 'active' : 'idle',
        stamp: delivered ? shipment?.delivered_at || shipment?.updated_at : null,
      }
    );
  }

  const activeStep = steps.findIndex((step) => step.state !== 'complete');

  return (
    <Box sx={{ width: '100%' }}>
      <Stepper
        activeStep={activeStep === -1 ? steps.length : activeStep}
        alternativeLabel
        connector={<Connector />}
        sx={{ py: 2 }}
      >
        {steps.map((step) => (
          <Step key={step.key} completed={step.state === 'complete'}>
            <StepLabel
              error={step.state === 'error'}
              icon={<StepBubble Icon={step.Icon} state={step.state} />}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  color: step.state === 'error' ? 'var(--lf-err-ink)' : 'var(--lf-ink)',
                  fontWeight: 600,
                }}
              >
                {step.label}
              </Typography>
              {formatStamp(step.stamp) && (
                <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
                  {formatStamp(step.stamp)}
                </Typography>
              )}
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* The error branch: an explanation and real actions, not a grey wall. */}
      {broken && (
        <Box
          role="alert"
          sx={{
            mt: 1,
            p: 2,
            borderRadius: 'var(--lf-r-field)',
            backgroundColor: 'var(--lf-err-tint)',
            borderLeft: '3px solid var(--lf-err-ink)',
          }}
        >
          <Typography variant="subtitle2" sx={{ color: 'var(--lf-err-ink)' }}>
            {steps[1].label} — order {orderNumber}
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)', mt: 0.5 }}>
            {(BROKEN_COPY[paymentStatus] || BROKEN_COPY.FAILED)(orderNumber)}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
            {retryable && (
              <Button
                startIcon={<ReplayIcon fontSize="small" />}
                onClick={onRetryPayment}
                {...(onRetryPayment
                  ? {}
                  : { component: RouterLink, to: `/orders/${order.id}?action=payment` })}
              >
                Retry payment
              </Button>
            )}
            {onRestoreCart && (
              <Button variant="outlined" onClick={onRestoreCart}>
                Restore my cart
              </Button>
            )}
            <SupportLink variant="button" orderNumber={order.order_number} topic="payment" />
          </Stack>
        </Box>
      )}

      {/* The honest note for an unpaid-but-not-failed order. The old copy said
          "Your order has not been placed", which is false: the order exists and
          is awaiting payment — which is exactly why it can be retried. */}
      {!broken && !paid && (
        <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)', mt: 1 }}>
          Order {orderNumber} is placed and awaiting payment. Nothing has been charged yet.
        </Typography>
      )}

      {shipmentStatus === 'undelivered' && (
        <Typography variant="body2" sx={{ color: 'var(--lf-warn-ink)', mt: 1 }}>
          A delivery attempt was unsuccessful. The courier will try again — contact us if it
          does not arrive.
        </Typography>
      )}
    </Box>
  );
};

export default OrderTimeline;
