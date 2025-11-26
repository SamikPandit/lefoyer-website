import React, { useState } from 'react';
import { Container, Typography, Box, Grid, TextField, Button, Paper, Radio, RadioGroup, FormControlLabel, Divider, Stepper, Step, StepLabel } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const Checkout = () => {
    const { cart, clearCart } = useCart();
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
        paymentMethod: 'card'
    });

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

    const handlePlaceOrder = () => {
        // Simulate order placement
        setTimeout(() => {
            clearCart();
            navigate('/order-confirmation');
        }, 1500);
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
                                <Box>
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
                                        <Button variant="contained" onClick={handleNext} sx={{ backgroundColor: '#C9A96E', '&:hover': { backgroundColor: '#B08D55' } }}>
                                            Continue to Payment
                                        </Button>
                                    </Box>
                                </Box>
                            )}

                            {activeStep === 1 && (
                                <Box>
                                    <Typography variant="h6" sx={{ mb: 3 }}>Payment Method</Typography>
                                    <RadioGroup name="paymentMethod" value={formData.paymentMethod} onChange={handleInputChange}>
                                        <FormControlLabel value="card" control={<Radio />} label="Credit / Debit Card" />
                                        <FormControlLabel value="upi" control={<Radio />} label="UPI" />
                                        <FormControlLabel value="cod" control={<Radio />} label="Cash on Delivery" />
                                    </RadioGroup>

                                    {formData.paymentMethod === 'card' && (
                                        <Box sx={{ mt: 3, p: 3, backgroundColor: '#F5F5F5', borderRadius: 1 }}>
                                            <Grid container spacing={2}>
                                                <Grid item xs={12}>
                                                    <TextField fullWidth label="Card Number" placeholder="0000 0000 0000 0000" />
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <TextField fullWidth label="Expiry Date" placeholder="MM/YY" />
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <TextField fullWidth label="CVV" type="password" />
                                                </Grid>
                                            </Grid>
                                        </Box>
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
                                            disabled
                                            sx={{ backgroundColor: '#C9A96E', '&:hover': { backgroundColor: '#B08D55' }, px: 4 }}
                                        >
                                            Place Order (Coming Soon)
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
