import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    RadioGroup,
    FormControlLabel,
    Radio,
    Typography,
    Box,
    CircularProgress,
    Alert,
} from '@mui/material';
import { Payment, AccountBalance } from '@mui/icons-material';
import api from '../../services/api';

const PaymentCompletionDialog = ({ open, onClose, order, onSuccess }) => {
    const [paymentMethod, setPaymentMethod] = useState('PREPAID');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCompletePayment = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await api.post(`orders/${order.id}/complete_payment/`, {
                payment_method: paymentMethod,
            });

            if (response.data.success) {
                if (response.data.redirect_url) {
                    // Redirect to payment gateway for UPI
                    window.location.href = response.data.redirect_url;
                } else {
                    // COD confirmed
                    onSuccess();
                    onClose();
                }
            } else {
                setError(response.data.error || 'Payment initiation failed');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to process payment');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Complete Payment</DialogTitle>
            <DialogContent>
                <Box sx={{ pt: 2 }}>
                    <Typography variant="body1" gutterBottom>
                        Order #{order?.id} - ₹{order?.total}
                    </Typography>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Typography variant="subtitle2" sx={{ mt: 3, mb: 2 }}>
                        Select Payment Method
                    </Typography>

                    <RadioGroup value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                        <FormControlLabel
                            value="PREPAID"
                            control={<Radio />}
                            label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Payment />
                                    <Box>
                                        <Typography variant="body1">UPI / Card / Net Banking</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Pay now online via PhonePe
                                        </Typography>
                                    </Box>
                                </Box>
                            }
                        />
                        <FormControlLabel
                            value="COD"
                            control={<Radio />}
                            label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <AccountBalance />
                                    <Box>
                                        <Typography variant="body1">Cash on Delivery</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Pay when you receive your order
                                        </Typography>
                                    </Box>
                                </Box>
                            }
                        />
                    </RadioGroup>
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} disabled={loading}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={handleCompletePayment}
                    disabled={loading}
                    startIcon={loading && <CircularProgress size={20} />}
                >
                    {loading ? 'Processing...' : 'Proceed to Payment'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default PaymentCompletionDialog;
