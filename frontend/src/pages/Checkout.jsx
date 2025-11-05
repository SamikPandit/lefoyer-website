import React, { useState } from 'react';
import { Container, Box, Typography, Button, Stepper, Step, StepLabel, TextField, FormControlLabel, RadioGroup, Radio, Paper, Divider, CircularProgress, Alert } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { createOrder } from '../services/api';

const steps = ['Shipping Information', 'Shipping Method', 'Payment Method', 'Order Review'];

const Checkout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { cart, cartTotal, clearCart } = useCart();
  const { couponDiscount } = location.state || { couponDiscount: 0 };

  const [activeStep, setActiveStep] = useState(0);
  const [shippingInfo, setShippingInfo] = useState({
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
  });
  const [shippingMethod, setShippingMethod] = useState('standard');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const estimatedShipping = 50; // Static for now
  const totalWithShipping = cartTotal + estimatedShipping;
  const finalTotal = totalWithShipping - (totalWithShipping * (couponDiscount / 100));

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleShippingInfoChange = (event) => {
    setShippingInfo({
      ...shippingInfo,
      [event.target.name]: event.target.value,
    });
  };

  const handlePlaceOrder = async () => {
    setLoading(true);
    setError('');
    try {
      const orderData = {
        shipping_info: {
          first_name: shippingInfo.firstName,
          last_name: shippingInfo.lastName,
          address: shippingInfo.address,
          city: shippingInfo.city,
          state: shippingInfo.state,
          pincode: shippingInfo.pincode,
          phone: shippingInfo.phone,
          email: shippingInfo.email,
        },
        coupon_code: location.state?.couponCode || null, // Pass coupon code if applied
      };
      const response = await createOrder(orderData);
      clearCart(); // Clear cart after successful order
      navigate('/order-confirmation', { state: { orderId: response.data.id, total: finalTotal } });
    } catch (err) {
      setError('Failed to place order. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box component="form" sx={{ mt: 3 }}>
            <Grid container spacing={2}>
              <Grid xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  label="First Name"
                  name="firstName"
                  value={shippingInfo.firstName}
                  onChange={handleShippingInfoChange}
                />
              </Grid>
              <Grid xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  label="Last Name"
                  name="lastName"
                  value={shippingInfo.lastName}
                  onChange={handleShippingInfoChange}
                />
              </Grid>
              <Grid xs={12}>
                <TextField
                  required
                  fullWidth
                  label="Address"
                  name="address"
                  value={shippingInfo.address}
                  onChange={handleShippingInfoChange}
                />
              </Grid>
              <Grid xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  label="City"
                  name="city"
                  value={shippingInfo.city}
                  onChange={handleShippingInfoChange}
                />
              </Grid>
              <Grid xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  label="State"
                  name="state"
                  value={shippingInfo.state}
                  onChange={handleShippingInfoChange}
                />
              </Grid>
              <Grid xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  label="Pincode"
                  name="pincode"
                  value={shippingInfo.pincode}
                  onChange={handleShippingInfoChange}
                />
              </Grid>
              <Grid xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  label="Phone Number"
                  name="phone"
                  value={shippingInfo.phone}
                  onChange={handleShippingInfoChange}
                />
              </Grid>
              <Grid xs={12}>
                <TextField
                  required
                  fullWidth
                  label="Email Address"
                  name="email"
                  type="email"
                  value={shippingInfo.email}
                  onChange={handleShippingInfoChange}
                />
              </Grid>
            </Grid>
          </Box>
        );
      case 1:
        return (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>Select Shipping Method</Typography>
            <RadioGroup
              name="shippingMethod"
              value={shippingMethod}
              onChange={(e) => setShippingMethod(e.target.value)}
            >
              <FormControlLabel value="standard" control={<Radio />} label="Standard Shipping (₹50)" />
              <FormControlLabel value="express" control={<Radio />} label="Express Shipping (₹100)" />
            </RadioGroup>
          </Box>
        );
      case 2:
        return (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>Select Payment Method</Typography>
            <RadioGroup
              name="paymentMethod"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <FormControlLabel value="cod" control={<Radio />} label="Cash on Delivery" />
              <FormControlLabel value="card" control={<Radio />} label="Credit/Debit Card (UI Only)" disabled />
              <FormControlLabel value="upi" control={<Radio />} label="UPI (UI Only)" disabled />
            </RadioGroup>
          </Box>
        );
      case 3:
        return (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>Order Summary</Typography>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Shipping To:</Typography>
              <Typography>{shippingInfo.firstName} {shippingInfo.lastName}</Typography>
              <Typography>{shippingInfo.address}, {shippingInfo.city}</Typography>
              <Typography>{shippingInfo.state} - {shippingInfo.pincode}</Typography>
              <Typography>Phone: {shippingInfo.phone}</Typography>
              <Typography>Email: {shippingInfo.email}</Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Shipping Method:</Typography>
              <Typography>{shippingMethod === 'standard' ? 'Standard Shipping' : 'Express Shipping'}</Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Payment Method:</Typography>
              <Typography>{paymentMethod === 'cod' ? 'Cash on Delivery' : paymentMethod === 'card' ? 'Credit/Debit Card' : 'UPI'}</Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Items:</Typography>
              {cart?.items.map((item) => (
                <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">{item.product.name} x {item.quantity}</Typography>
                  <Typography variant="body2">₹{(item.product.price * item.quantity).toFixed(2)}</Typography>
                </Box>
              ))}
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body1">Subtotal:</Typography>
                <Typography variant="body1">₹{cartTotal.toFixed(2)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body1">Shipping:</Typography>
                <Typography variant="body1">₹{estimatedShipping.toFixed(2)}</Typography>
              </Box>
              {couponDiscount > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, color: 'success.main' }}>
                  <Typography variant="body1">Coupon Discount ({couponDiscount}%):</Typography>
                  <Typography variant="body1">-₹{(totalWithShipping * (couponDiscount / 100)).toFixed(2)}</Typography>
                </Box>
              )}
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Order Total:</Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>₹{finalTotal.toFixed(2)}</Typography>
              </Box>
            </Paper>
          </Box>
        );
      default:
        return 'Unknown step';
    }
  };

  if (!cart || cart.items.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ py: 5, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>Your cart is empty</Typography>
        <Button variant="contained" component={Link} to="/products">Continue Shopping</Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h4" gutterBottom sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, mb: 4 }}>
        Checkout
      </Typography>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {getStepContent(activeStep)}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
          {activeStep !== 0 && (
            <Button onClick={handleBack} sx={{ mr: 1, borderRadius: '25px' }}>
              Back
            </Button>
          )}
          {activeStep === steps.length - 1 ? (
            <Button
              variant="contained"
              color="primary"
              onClick={handlePlaceOrder}
              disabled={loading}
              sx={{ borderRadius: '25px', px: 4, py: 1.5 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Place Order'}
            </Button>
          ) : (
            <Button variant="contained" color="primary" onClick={handleNext} sx={{ borderRadius: '25px', px: 4, py: 1.5 }}>
              Next
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default Checkout;