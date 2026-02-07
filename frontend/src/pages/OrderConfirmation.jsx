import React, { useState, useEffect } from 'react';
import { Container, Box, Typography, Button, Paper, CircularProgress, Alert } from '@mui/material';
import { CheckCircleOutline, ErrorOutline, HourglassEmpty } from '@mui/icons-material';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';

const OrderConfirmation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if coming from PhonePe redirect with query params
    const searchParams = new URLSearchParams(location.search);
    const transactionId = searchParams.get('transactionId');
    const merchantTransactionId = searchParams.get('merchantTransactionId');
    const code = searchParams.get('code');

    // If coming from location.state (direct navigation from checkout)
    const { orderId, total, status } = location.state || {};

    if (orderId) {
      // Direct navigation from checkout
      setOrderDetails({ id: orderId, total });
      setPaymentStatus(status || 'success');
      setLoading(false);
    } else if (merchantTransactionId || transactionId) {
      // Coming from PhonePe redirect
      fetchOrderByTransaction(merchantTransactionId || transactionId, code);
    } else {
      // No order info available
      setLoading(false);
      setPaymentStatus('unknown');
    }
  }, [location]);

  const fetchOrderByTransaction = async (transactionId, code) => {
    try {
      const response = await api.get(`/orders/`);
      const orders = response.data;

      // Find order with matching transaction ID
      const order = orders.find(o => o.provider_order_id === transactionId);

      if (order) {
        setOrderDetails(order);

        // Determine status from PhonePe code
        if (code === 'PAYMENT_SUCCESS') {
          setPaymentStatus('success');
        } else if (code === 'PAYMENT_ERROR' || code === 'PAYMENT_DECLINED') {
          setPaymentStatus('failed');
        } else if (code === 'PAYMENT_PENDING') {
          setPaymentStatus('pending');
        } else {
          setPaymentStatus('cancelled');
        }
      } else {
        setPaymentStatus('unknown');
      }
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Unable to fetch order details');
      setPaymentStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = () => {
    switch (paymentStatus) {
      case 'success':
        return <CheckCircleOutline sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />;
      case 'failed':
      case 'cancelled':
      case 'error':
        return <ErrorOutline sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />;
      case 'pending':
        return <HourglassEmpty sx={{ fontSize: 80, color: 'warning.main', mb: 2 }} />;
      default:
        return <ErrorOutline sx={{ fontSize: 80, color: 'grey.500', mb: 2 }} />;
    }
  };

  const getStatusTitle = () => {
    switch (paymentStatus) {
      case 'success':
        return 'Order Placed Successfully!';
      case 'failed':
        return 'Payment Failed';
      case 'cancelled':
        return 'Payment Cancelled';
      case 'pending':
        return 'Payment Pending';
      case 'error':
        return 'Something Went Wrong';
      default:
        return 'Order Status Unknown';
    }
  };

  const getStatusMessage = () => {
    switch (paymentStatus) {
      case 'success':
        return 'Thank you for your purchase. Your order has been confirmed and will be processed shortly.';
      case 'failed':
        return 'Your payment could not be processed. Please try again or use a different payment method.';
      case 'cancelled':
        return 'You cancelled the payment. Your order has not been placed. You can try again when ready.';
      case 'pending':
        return 'Your payment is being processed. You will receive a confirmation once it is complete.';
      case 'error':
        return error || 'We encountered an error while processing your order. Please contact support if you were charged.';
      default:
        return 'We could not determine your order status. Please check your order history or contact support.';
    }
  };

  const getStatusColor = () => {
    switch (paymentStatus) {
      case 'success':
        return 'success';
      case 'failed':
      case 'cancelled':
      case 'error':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'info';
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading order details...
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 5, textAlign: 'center' }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        {getStatusIcon()}

        <Typography variant="h4" gutterBottom sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700 }}>
          {getStatusTitle()}
        </Typography>

        <Alert severity={getStatusColor()} sx={{ mb: 3, textAlign: 'left' }}>
          {getStatusMessage()}
        </Alert>

        {orderDetails && (
          <Box sx={{ mb: 3 }}>
            {orderDetails.id && (
              <Typography variant="h6" sx={{ mb: 1 }}>
                Order ID: <Box component="span" sx={{ fontWeight: 'bold' }}>#{orderDetails.id}</Box>
              </Typography>
            )}
            {orderDetails.total && (
              <Typography variant="h6">
                Amount: <Box component="span" sx={{ fontWeight: 'bold' }}>₹{Number(orderDetails.total).toFixed(2)}</Box>
              </Typography>
            )}
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
          {paymentStatus === 'success' ? (
            <>
              <Button
                variant="contained"
                color="primary"
                component={Link}
                to="/products"
                sx={{ borderRadius: '25px', px: 4, py: 1.5 }}
              >
                Continue Shopping
              </Button>
              <Button
                variant="outlined"
                component={Link}
                to="/profile"
                sx={{ borderRadius: '25px', px: 4, py: 1.5 }}
              >
                View Orders
              </Button>
            </>
          ) : paymentStatus === 'failed' || paymentStatus === 'cancelled' ? (
            <>
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate('/cart')}
                sx={{ borderRadius: '25px', px: 4, py: 1.5 }}
              >
                Go to Cart
              </Button>
              <Button
                variant="outlined"
                component={Link}
                to="/products"
                sx={{ borderRadius: '25px', px: 4, py: 1.5 }}
              >
                Continue Shopping
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="contained"
                color="primary"
                component={Link}
                to="/profile"
                sx={{ borderRadius: '25px', px: 4, py: 1.5 }}
              >
                View Orders
              </Button>
              <Button
                variant="outlined"
                component={Link}
                to="/products"
                sx={{ borderRadius: '25px', px: 4, py: 1.5 }}
              >
                Continue Shopping
              </Button>
            </>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default OrderConfirmation;
