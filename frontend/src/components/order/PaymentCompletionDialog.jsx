/**
 * PaymentCompletionDialog — pay for an order that is already placed.
 *
 * WHAT CHANGED
 *  - It called `POST orders/<id>/complete_payment/` and then read
 *    `response.data.success` — a field that endpoint never returned under the
 *    old code either, which is why the dialog's happy path was unreachable for
 *    COD. It now calls the ONE unified action, `POST retry-payment/` (§2b #20),
 *    whose envelope is shared with `initiate-payment/`:
 *    `{redirect_url, merchant_order_id, attempt_id}` or, for COD,
 *    `{payment_status: 'COMPLETED'}`.
 *  - **Stock is re-validated.** `retry-payment/` answers `409 OUT_OF_STOCK`
 *    with the offending lines rather than sending someone to a payment page for
 *    goods that have sold out since. Those lines are rendered.
 *  - **Switching a FAILED prepaid order to COD is now a warning, not a
 *    silent flip.** It confirms the order there and then: stock is taken, the
 *    confirmation email goes out, and the order can no longer be paid online.
 *    That is a different contract from the one the customer started, so they are
 *    told before they commit.
 *  - On open it re-reads `payment-status/`, so an order that was paid in another
 *    tab (or confirmed by the gateway callback in the meantime) cannot be
 *    offered a second payment.
 */

import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import PaymentOutlinedIcon from '@mui/icons-material/PaymentOutlined';

import SupportLink from '../common/SupportLink';
import { formatMoney } from '../cart/CartTotals';
import { orderRef } from './OrderCard';
import { getApiErrorMessage, getPaymentStatus, retryPayment } from '../../services/api';

const PaymentCompletionDialog = ({ open, onClose, order, onSuccess }) => {
  const [paymentMethod, setPaymentMethod] = useState('PREPAID');
  const [working, setWorking] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const [shortfalls, setShortfalls] = useState([]);
  const [live, setLive] = useState(null);

  const orderId = order?.id;
  const wasFailed = String(order?.payment_status || '').toUpperCase() === 'FAILED';

  /* Re-read the authoritative state each time the dialog opens. */
  const verify = useCallback(async () => {
    if (!orderId) return;
    setChecking(true);
    setError(null);
    setBlocked(null);
    setShortfalls([]);
    try {
      const status = await getPaymentStatus(orderId);
      setLive(status);
      if (status?.payment_status === 'COMPLETED') {
        setBlocked('This order has already been paid for.');
      } else if (status?.can_retry === false) {
        setBlocked(
          'This order can no longer be paid for here. Contact support and we will sort it out.'
        );
      }
    } catch (requestError) {
      // A 503 means the gateway is unreachable, which is exactly when a retry is
      // worth offering — so it is not treated as a block.
      if (requestError?.response?.status !== 503) {
        setError(getApiErrorMessage(requestError, 'We could not check this order.'));
      }
    } finally {
      setChecking(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!open) return;
    setPaymentMethod('PREPAID');
    verify();
  }, [open, verify]);

  const total = live?.total ?? order?.total;

  const submit = async () => {
    if (!orderId || working) return;
    setWorking(true);
    setError(null);
    setShortfalls([]);
    try {
      const result = await retryPayment(orderId, { payment_method: paymentMethod });

      if (result?.redirect_url) {
        // Hand-off to the gateway: a real document navigation, not a route change.
        window.location.assign(result.redirect_url);
        return;
      }
      if (result?.payment_status === 'COMPLETED') {
        if (onSuccess) onSuccess();
        onClose();
        return;
      }
      setError('We could not open a payment page just now. Please try again shortly.');
    } catch (requestError) {
      const data = requestError?.response?.data || {};
      if (data.error === 'OUT_OF_STOCK' && Array.isArray(data.items)) {
        setShortfalls(data.items);
        setError(null);
      } else if (data.error === 'ALREADY_PAID') {
        setBlocked('This order has already been paid for.');
        if (onSuccess) onSuccess();
      } else if (data.error === 'ALREADY_SHIPPED') {
        setBlocked('This order has already been handed to the courier.');
      } else {
        setError(getApiErrorMessage(requestError, 'We could not start that payment.'));
      }
    } finally {
      setWorking(false);
    }
  };

  const codWarning = wasFailed && paymentMethod === 'COD';

  return (
    <Dialog open={Boolean(open)} onClose={working ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Complete payment</DialogTitle>
      <DialogContent>
        <Typography variant="body1" data-tnum="true" sx={{ mb: 0.5 }}>
          Order {orderRef(order)} · {formatMoney(total)}
        </Typography>
        <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
          Nothing has been charged for this order yet.
        </Typography>

        {checking && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
              Checking the current state of this order…
            </Typography>
          </Stack>
        )}

        {blocked && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {blocked}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }} role="alert">
            {error}
          </Alert>
        )}

        {shortfalls.length > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <AlertTitle>Some items are no longer available</AlertTitle>
            <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
              {shortfalls.map((item) => (
                <li key={item.product_id}>
                  <Typography variant="body2" component="span">
                    {item.name || item.product} —{' '}
                    {item.available > 0 ? `only ${item.available} left` : 'out of stock'}
                  </Typography>
                </li>
              ))}
            </Box>
            <Typography variant="body2" sx={{ mt: 1 }}>
              This order cannot be paid for as it stands.{' '}
              <SupportLink variant="inline" orderNumber={order?.order_number} topic="order" label="Contact support" />{' '}
              and we will adjust it.
            </Typography>
          </Alert>
        )}

        {!blocked && (
          <FormControl component="fieldset" sx={{ mt: 2.5, width: '100%' }}>
            <FormLabel
              component="legend"
              sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--lf-ink)', mb: 1 }}
            >
              How would you like to pay?
            </FormLabel>
            <RadioGroup
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              <FormControlLabel
                value="PREPAID"
                control={<Radio />}
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PaymentOutlinedIcon fontSize="small" />
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        Pay now — UPI, card or net banking
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
                        Opens PhonePe, then brings you back to this order.
                      </Typography>
                    </Box>
                  </Stack>
                }
              />
              <FormControlLabel
                value="COD"
                control={<Radio />}
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AccountBalanceWalletOutlinedIcon fontSize="small" />
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        Switch to cash on delivery
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
                        Pay the courier when the order arrives.
                      </Typography>
                    </Box>
                  </Stack>
                }
              />
            </RadioGroup>
          </FormControl>
        )}

        {codWarning && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <AlertTitle>This confirms the order straight away</AlertTitle>
            Switching order {orderRef(order)} to cash on delivery confirms it now: we reserve the
            stock, send the confirmation email, and it can no longer be paid online. Cash on
            delivery also depends on your pincode — if the courier does not offer it there, we
            will contact you.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={working}>
          Not now
        </Button>
        <Button
          onClick={submit}
          disabled={working || checking || Boolean(blocked) || shortfalls.length > 0}
          startIcon={working ? <CircularProgress size={18} /> : null}
        >
          {working
            ? 'Working…'
            : paymentMethod === 'COD'
              ? 'Confirm as cash on delivery'
              : `Pay ${formatMoney(total)}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentCompletionDialog;
