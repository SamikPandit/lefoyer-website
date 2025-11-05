import React from 'react';
import { Container, Box, Typography, Button, Paper } from '@mui/material';
import { CheckCircleOutline } from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';

const OrderConfirmation = () => {
  const location = useLocation();
  const { orderId, total } = location.state || {};

  return (
    <Container maxWidth="sm" sx={{ py: 5, textAlign: 'center' }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <CheckCircleOutline sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
        <Typography variant="h4" gutterBottom sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700 }}>
          Order Placed Successfully!
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Thank you for your purchase. Your order has been confirmed.
        </Typography>
        {orderId && (
          <Typography variant="h6" sx={{ mb: 1 }}>
            Order ID: <Box component="span" sx={{ fontWeight: 'bold' }}>#{orderId}</Box>
          </Typography>
        )}
        {total && (
          <Typography variant="h6" sx={{ mb: 3 }}>
            Total Amount: <Box component="span" sx={{ fontWeight: 'bold' }}>₹{total.toFixed(2)}</Box>
          </Typography>
        )}
        <Button variant="contained" color="primary" component={Link} to="/products" sx={{ borderRadius: '25px', px: 4, py: 1.5, mr: 2 }}>
          Continue Shopping
        </Button>
        <Button variant="outlined" component={Link} to="/user/orders" sx={{ borderRadius: '25px', px: 4, py: 1.5 }}>
          View Orders
        </Button>
      </Paper>
    </Container>
  );
};

export default OrderConfirmation;
