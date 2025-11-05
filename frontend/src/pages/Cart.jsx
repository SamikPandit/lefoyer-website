import React from 'react';
import { Container, Grid, Box, Typography, Button, CircularProgress, Alert } from '@mui/material';
import { useCart } from '../context/CartContext';
import CartItem from '../components/cart/CartItem';
import CartSummary from '../components/cart/CartSummary';
import { Link } from 'react-router-dom';

const Cart = () => {
  const { cart, loading, error, clearCart } = useCart();

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 5, textAlign: 'center' }}>
        <CircularProgress />
        <Typography>Loading cart...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 5, textAlign: 'center' }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ py: 5, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700 }}>
          Your cart is empty
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Looks like you haven't added anything to your cart yet.
        </Typography>
        <Button variant="contained" color="primary" component={Link} to="/products" sx={{ borderRadius: '25px', px: 4, py: 1.5 }}>
          Continue Shopping
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Typography variant="h4" gutterBottom sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, mb: 4 }}>
        Shopping Cart
      </Typography>
      <Grid container spacing={4}>
        <Grid xs={12} md={8}>
          {cart.items.map((item) => (
            <CartItem key={item.id} item={item} />
          ))}
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
            <Button variant="outlined" component={Link} to="/products" sx={{ borderRadius: '25px' }}>
              Continue Shopping
            </Button>
            <Button variant="outlined" color="error" onClick={clearCart} sx={{ borderRadius: '25px' }}>
              Clear Cart
            </Button>
          </Box>
        </Grid>
        <Grid xs={12} md={4}>
          <CartSummary />
        </Grid>
      </Grid>
    </Container>
  );
};

export default Cart;
