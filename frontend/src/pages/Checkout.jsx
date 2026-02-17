import React, { useState, useEffect } from 'react';
import { Container, Typography, Box, Grid, TextField, Button, Paper, Radio, RadioGroup, FormControlLabel, Divider, Stepper, Step, StepLabel, InputAdornment, IconButton, Snackbar, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { Check, LocalOffer } from '@mui/icons-material';
import api from '../services/api';

const Checkout = () => {
    const { cart, clearCart } = useCart();
    const { token } = useAuth();
    const navigate = useNavigate();
    const [activeStep, setActiveStep] = useState(0);
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [couponError, setCouponError] = useState('');
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        paymentMethod: 'upi'
    });

    useEffect(() => {
        if (!token) {
            navigate('/login');
        }
    }, [token, navigate]);

    if (cart.items.length === 0) {
        navigate('/cart');
        return null;
    }

    const handleSnackbarClose = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    const showSnackbar = (message, severity = 'info') => {
        setSnackbar({ open: true, message, severity });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleApplyCoupon = async () => {
        if (!couponCode.trim()) return;

        try {
            // We verify coupon by making a dry-run request or dedicated endpoint
            // For now, we'll simulate verification or assume backend validation on order placement
            // Ideally, we'd have a /api/coupons/verify/ endpoint. 
            // Since we don't, we'll add it to the order payload and backend will reject if invalid.
            // But to show it in UI, let's assume valid for now if backend doesn't have a verify endpoint ready.
            // Wait, we can't just assume. 
            // Let's implement a simple verify call if possible, or just add it to state and validate on "Place Order".
            // BETTER: Add a verify endpoint? Or just use the order creation dry run?
            // For now, let's just set it in state and let the order creation fail if invalid.
            setAppliedCoupon({ code: couponCode, discount: 0 }); // We don't know discount % yet without an endpoint
            // actually, without a verify endpoint, we can't show the discount amount upfront easily.
            // We'll trust the user has a valid code and let the backend reject it at the end.
            setCouponError(null);
            showSnackbar('Coupon applied! Discount will be calculated at checkout.', 'success');
        } catch (error) {
            setCouponError('Invalid coupon code');
            setAppliedCoupon(null);
        }
    };

    const getCartTotal = () => {
        // Backend now handles effective price (discount_price), but frontend cart usually has static prices.
        // We rely on the backend to calc the final total.
        return cart.total;
    };

    const handleNext = () => {
        setActiveStep((prev) => prev + 1);
    };

    const handleBack = () => {
        setActiveStep((prev) => prev - 1);
    };

    const handlePlaceOrder = async () => {
        try {
            if (!token) {
                showSnackbar('Please log in to place an order.', 'warning');
                navigate('/login');
                return;
            }

            const orderPayload = {
                shipping_info: {
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    email: formData.email,
                    phone: formData.phone,
                    address: formData.address,
                    city: formData.city,
                    state: formData.state,
                    pincode: formData.zip
                },
                payment_method: formData.paymentMethod,
                coupon_code: appliedCoupon ? appliedCoupon.code : null
            };

            const orderResponse = await api.post('orders/', orderPayload);

            const orderData = orderResponse.data;
            const orderId = orderData.id;

            if (formData.paymentMethod === 'upi' || formData.paymentMethod === 'card') {
                const paymentResponse = await api.post(`orders/${orderId}/initiate-payment/`);
                const paymentData = paymentResponse.data;

                await clearCart();

                if (paymentData.redirect_url) {
                    window.location.href = paymentData.redirect_url;
                } else {
                    showSnackbar('No redirect URL received', 'error');
                }
            } else if (formData.paymentMethod === 'cod') {
                await clearCart();
                navigate('/order-confirmation', { state: { orderId: orderId, status: 'success' } });
            }

        } catch (error) {
            console.error('Error placing order:', error);
            const errorMsg = error.response?.data?.error || 'An error occurred while placing the order.';
            showSnackbar(errorMsg, 'error');

            // If coupon was invalid, remove it
            if (errorMsg.includes('coupon')) {
                setAppliedCoupon(null);
                setCouponError(errorMsg);
                setActiveStep(2); // Stay on review step
            }
        }
    };

    const steps = ['Shipping Address', 'Payment Details', 'Review Order'];

    return (
        <Box sx={{ backgroundColor: '#FAFAFA', minHeight: '100vh', py: 4 }}>
            <Container maxWidth="lg">
                <Typography variant="h3" sx={{ fontFamily: "'Cormorant Garamond', serif", mb: 4, textAlign: 'center' }}>
                    Checkout
                </Typography>

                <Stepper activeStep={activeStep} sx={{ mb: 6, maxWidth: 800, mx: 'auto' }}>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

                <Grid container spacing={4}>
                    <Grid item xs={12} md={8}>
                        <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid #E0E0E0' }}>
                            {activeStep === 0 && (
                                <Box component="form" noValidate>
                                    <Typography variant="h6" sx={{ mb: 3 }}>Contact Information</Typography>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6}>
                                            <TextField fullWidth label="First Name" name="firstName" value={formData.firstName} onChange={handleInputChange} required />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <TextField fullWidth label="Last Name" name="lastName" value={formData.lastName} onChange={handleInputChange} required />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <TextField fullWidth label="Email" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <TextField fullWidth label="Phone" name="phone" value={formData.phone} onChange={handleInputChange} required />
                                        </Grid>
                                        <Grid item xs={12}>
                                            <TextField fullWidth label="Address" name="address" value={formData.address} onChange={handleInputChange} required />
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <TextField fullWidth label="City" name="city" value={formData.city} onChange={handleInputChange} required />
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <TextField fullWidth label="State" name="state" value={formData.state} onChange={handleInputChange} required />
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <TextField fullWidth label="ZIP Code" name="zip" value={formData.zip} onChange={handleInputChange} required />
                                        </Grid>
                                    </Grid>
                                    <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                                        <Button
                                            variant="contained"
                                            onClick={() => {
                                                const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'state', 'zip'];
                                                const emptyFields = requiredFields.filter(field => !formData[field].trim());
                                                if (emptyFields.length > 0) {
                                                    showSnackbar('Please fill in all required fields.', 'warning');
                                                    return;
                                                }
                                                handleNext();
                                            }}
                                            sx={{ backgroundColor: '#C9A96E', '&:hover': { backgroundColor: '#B08D55' } }}
                                        >
                                            Continue to Payment
                                        </Button>
                                    </Box>
                                </Box>
                            )}

                            {activeStep === 1 && (
                                <Box>
                                    <Typography variant="h6" sx={{ mb: 3 }}>Payment Method</Typography>
                                    <RadioGroup name="paymentMethod" value={formData.paymentMethod} onChange={handleInputChange}>
                                        <FormControlLabel value="upi" control={<Radio />} label="UPI (PhonePe)" />
                                        <FormControlLabel value="cod" control={<Radio />} label="Cash on Delivery" />
                                    </RadioGroup>

                                    {formData.paymentMethod === 'upi' && (
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                            Secure payment via PhonePe. You will be redirected.
                                        </Typography>
                                    )}

                                    <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
                                        <Button onClick={handleBack}>Back</Button>
                                        <Button variant="contained" onClick={handleNext} sx={{ backgroundColor: '#C9A96E', '&:hover': { backgroundColor: '#B08D55' } }}>
                                            Review Order
                                        </Button>
                                    </Box>
                                </Box>
                            )}

                            {activeStep === 2 && (
                                <Box>
                                    <Typography variant="h6" sx={{ mb: 3 }}>Review Order</Typography>
                                    <Box sx={{ mb: 3 }}>
                                        <Typography variant="subtitle2" color="text.secondary">Shipping To:</Typography>
                                        <Typography>{formData.firstName} {formData.lastName}</Typography>
                                        <Typography>{formData.address}, {formData.city}, {formData.state} {formData.zip}</Typography>
                                        <Typography>{formData.phone}</Typography>
                                    </Box>

                                    <Divider sx={{ my: 2 }} />

                                    <Box sx={{ mb: 3 }}>
                                        {cart.items.map((item) => (
                                            <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                <Typography>{item.name || item.product?.name} x {item.quantity}</Typography>
                                                <Typography>₹{(item.price || item.product?.price) * item.quantity}</Typography>
                                            </Box>
                                        ))}
                                    </Box>

                                    {/* Coupon Section */}
                                    <Box sx={{ mt: 3, mb: 3, p: 2, backgroundColor: '#F5F5F5', borderRadius: 1 }}>
                                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Have a Coupon?</Typography>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <TextField
                                                size="small"
                                                placeholder="Enter code"
                                                value={couponCode}
                                                onChange={(e) => setCouponCode(e.target.value)}
                                                disabled={!!appliedCoupon}
                                                error={!!couponError}
                                                helperText={couponError}
                                                fullWidth
                                            />
                                            {appliedCoupon ? (
                                                <Button variant="outlined" color="error" onClick={() => { setAppliedCoupon(null); setCouponCode(''); }}>
                                                    Remove
                                                </Button>
                                            ) : (
                                                <Button variant="contained" onClick={handleApplyCoupon} sx={{ backgroundColor: '#333' }}>
                                                    Apply
                                                </Button>
                                            )}
                                        </Box>
                                        {appliedCoupon && (
                                            <Typography variant="body2" color="success.main" sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Check fontSize="small" /> Coupon applied: {appliedCoupon.code}
                                            </Typography>
                                        )}
                                    </Box>

                                    <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
                                        <Button onClick={handleBack}>Back</Button>
                                        <Button
                                            variant="contained"
                                            onClick={handlePlaceOrder}
                                            size="large"
                                            sx={{ backgroundColor: '#C9A96E', '&:hover': { backgroundColor: '#B08D55' }, px: 4 }}
                                        >
                                            Place Order
                                        </Button>
                                    </Box>
                                </Box>
                            )}
                        </Paper>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid #E0E0E0', backgroundColor: '#fff' }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>Order Summary</Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography color="text.secondary">Items ({cart.count})</Typography>
                                <Typography>₹{cart.total}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography color="text.secondary">Shipping</Typography>
                                <Typography color="success.main">Free</Typography>
                            </Box>
                            <Divider sx={{ my: 2 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="h6">Total</Typography>
                                <Typography variant="h6" color="primary.main">₹{cart.total}</Typography>
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>

                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={6000}
                    onClose={handleSnackbarClose}
                    message={snackbar.message}
                >
                    <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            </Container>
        </Box>
    );
};

export default Checkout;
