import React, { useState } from 'react';
import { Box, Typography, Button, Divider, TextField, CircularProgress, Alert } from '@mui/material';
import { useCart } from '../../context/CartContext';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const CartSummary = () => {
  const { cart, cartTotal, loading, error } = useCart();
  const navigate = useNavigate();
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  const estimatedShipping = 50; // Static for now
  const totalWithShipping = cartTotal + estimatedShipping;
  const finalTotal = totalWithShipping - (totalWithShipping * (couponDiscount / 100));

  const handleApplyCoupon = async () => {
    setCouponLoading(true);
    setCouponError('');
    try {
      const response = await api.post('coupons/validate/', { code: couponCode });
      setCouponDiscount(response.data.discount);
    } catch (err) {
      setCouponError('Invalid or expired coupon.');
      setCouponDiscount(0);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleProceedToCheckout = () => {
    navigate('/checkout', { state: { cart, couponDiscount } });
  };

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!cart || cart.items.length === 0) return null; // Render nothing if cart is empty

  return (
    <Box component={Paper} elevation={3} sx={{ p: 3, borderRadius: 2 }}>
      <Typography variant="h5" gutterBottom sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700 }}>
        Cart Summary
      </Typography>
      <Divider sx={{ my: 2 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body1">Subtotal:</Typography>
        <Typography variant="body1">₹{cartTotal.toFixed(2)}</Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body1">Estimated Shipping:</Typography>
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
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Total:</Typography>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>₹{finalTotal.toFixed(2)}</Typography>
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          label="Coupon Code"
          variant="outlined"
          size="small"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
          sx={{ mb: 1 }}
        />
        <Button 
          fullWidth 
          variant="outlined" 
          onClick={handleApplyCoupon} 
          disabled={couponLoading}
          sx={{ borderRadius: '25px' }}
        >
          {couponLoading ? <CircularProgress size={24} /> : 'Apply Coupon'}
        </Button>
        {couponError && <Alert severity="error" sx={{ mt: 1 }}>{couponError}</Alert>}
      </Box>

      <Button 
        fullWidth 
        variant="contained" 
        color="primary" 
        size="large" 
        onClick={handleProceedToCheckout}
        sx={{ borderRadius: '25px', py: 1.5 }}
      >
        Proceed to Checkout
      </Button>
    </Box>
  );
};

export default CartSummary;
