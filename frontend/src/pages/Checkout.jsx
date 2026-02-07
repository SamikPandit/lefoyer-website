import React, { useState, useEffect } from 'react';
import { Container, Typography, Box, Grid, TextField, Button, Paper, Radio, RadioGroup, FormControlLabel, Divider, Stepper, Step, StepLabel } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Checkout = () => {
    const { cart, clearCart } = useCart();
    const { token } = useAuth();
    const navigate = useNavigate();
    const [activeStep, setActiveStep] = useState(0);
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
            // Redirect to login if not authenticated
            navigate('/login');
        }
    }, [token, navigate]);

    if (cart.items.length === 0) {
        navigate('/cart');
        return null;
    }

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
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
                alert('Please log in to place an order.');
                navigate('/login');
                return;
            }

            // 1. Create Order
            const orderResponse = await api.post('orders/', {
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
                payment_method: formData.paymentMethod
            });

            const orderData = orderResponse.data;
            const orderId = orderData.id;

            // 2. Initiate Payment (if UPI/Card)
            if (formData.paymentMethod === 'upi' || formData.paymentMethod === 'card') {
                const paymentResponse = await api.post(`orders/${orderId}/initiate-payment/`);

                const paymentData = paymentResponse.data;

                // Refresh cart state (backend cart is already empty, this syncs frontend)
                await clearCart();

                if (paymentData.redirect_url) {
                    window.location.href = paymentData.redirect_url;
                } else {
                    alert('No redirect URL received');
                }
            } else if (formData.paymentMethod === 'cod') {
                // COD Flow
                await clearCart();
                // Pass order details to confirmation page if needed, or just navigate
                navigate('/order-confirmation', { state: { orderId: orderId, status: 'success' } });
            }

        } catch (error) {
            console.error('Error placing order:', error);
            alert('An error occurred while placing the order.');
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
                                            <TextField
                                                fullWidth
                                                label="First Name"
                                                name="firstName"
                                                value={formData.firstName}
                                                onChange={handleInputChange}
                                                required
                                                error={!formData.firstName && activeStep === 0} // Simple error indication
                                            />
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
                                                // Enhanced Validation
                                                const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'state', 'zip'];
                                                const emptyFields = requiredFields.filter(field => !formData[field].trim());

                                                if (emptyFields.length > 0) {
                                                    alert('Please fill in all required fields.');
                                                    return;
                                                }

                                                // Email Validation
                                                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                                if (!emailRegex.test(formData.email)) {
                                                    alert('Please enter a valid email address.');
                                                    return;
                                                }

                                                // Phone Validation (10 digits)
                                                const phoneRegex = /^\d{10}$/;
                                                if (!phoneRegex.test(formData.phone.replace(/\D/g, ''))) {
                                                    alert('Please enter a valid 10-digit phone number.');
                                                    return;
                                                }

                                                // ZIP Code Validation (6 digits)
                                                const zipRegex = /^\d{6}$/;
                                                if (!zipRegex.test(formData.zip)) {
                                                    alert('Please enter a valid 6-digit ZIP code.');
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
                                            Secure payment via PhonePe. You will be redirected to complete the payment.
                                        </Typography>
                                    )}

                                    {formData.paymentMethod === 'cod' && (
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                            Pay with cash or UPI upon delivery. No advance payment required.
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
                                                <Typography>{item.name} x {item.quantity}</Typography>
                                                <Typography>₹{item.price * item.quantity}</Typography>
                                            </Box>
                                        ))}
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
            </Container>
        </Box>
    );
};

export default Checkout;
