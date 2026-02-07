import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Container,
    Box,
    Typography,
    Paper,
    Grid,
    Chip,
    Button,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
    Alert,
    Stack,
} from '@mui/material';
import {
    ArrowBack,
    Payment,
    LocalShipping,
    Receipt,
} from '@mui/icons-material';
import api from '../services/api';
import OrderTimeline from '../components/order/OrderTimeline';
import PaymentCompletionDialog from '../components/order/PaymentCompletionDialog';

const OrderDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        fetchOrderDetails();
    }, [id]);

    useEffect(() => {
        if (searchParams.get('action') === 'payment' && order) {
            setPaymentDialogOpen(true);
        }
    }, [searchParams, order]);

    const fetchOrderDetails = async () => {
        try {
            const response = await api.get(`orders/${id}/`);
            setOrder(response.data);
        } catch (err) {
            setError('Failed to load order details');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'delivered':
                return 'success';
            case 'shipped':
            case 'out_for_delivery':
                return 'info';
            case 'processing':
                return 'warning';
            case 'cancelled':
                return 'error';
            default:
                return 'default';
        }
    };

    const getPaymentStatusColor = (paymentStatus) => {
        switch (paymentStatus?.toUpperCase()) {
            case 'COMPLETED':
                return 'success';
            case 'FAILED':
                return 'error';
            case 'PENDING':
                return 'warning';
            default:
                return 'default';
        }
    };

    if (loading) {
        return (
            <Box
                sx={{
                    minHeight: '60vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <CircularProgress />
            </Box>
        );
    }

    if (error || !order) {
        return (
            <Container maxWidth="lg" sx={{ py: 8 }}>
                <Alert severity="error">{error || 'Order not found'}</Alert>
                <Button startIcon={<ArrowBack />} onClick={() => navigate('/profile')} sx={{ mt: 2 }}>
                    Back to Orders
                </Button>
            </Container>
        );
    }

    const subtotal = order.items?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0;
    const shipping = 0; // Add shipping logic if needed
    const discount = order.discount || 0;

    return (
        <Container maxWidth="lg" sx={{ py: 8 }}>
            {/* Header */}
            <Box sx={{ mb: 4 }}>
                <Button startIcon={<ArrowBack />} onClick={() => navigate('/profile')} sx={{ mb: 2 }}>
                    Back to Orders
                </Button>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                    <Box>
                        <Typography variant="h4" gutterBottom>
                            Order #{order.id}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Chip label={order.status || 'Pending'} color={getStatusColor(order.status)} />
                            <Chip
                                icon={<Payment />}
                                label={order.payment_status || 'PENDING'}
                                color={getPaymentStatusColor(order.payment_status)}
                                variant="outlined"
                            />
                            <Chip label={order.payment_method || 'PREPAID'} variant="outlined" />
                        </Box>
                    </Box>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        {order.payment_status === 'PENDING' && (
                            <Button
                                variant="contained"
                                color="warning"
                                startIcon={<Payment />}
                                onClick={() => setPaymentDialogOpen(true)}
                            >
                                Complete Payment
                            </Button>
                        )}
                        {order.shipment?.tracking_url && (
                            <Button
                                variant="outlined"
                                startIcon={<LocalShipping />}
                                onClick={() => navigate(order.shipment.tracking_url)}
                            >
                                Track Shipment
                            </Button>
                        )}
                    </Stack>
                </Box>
            </Box>

            {/* Timeline */}
            <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" gutterBottom>
                    Order Status
                </Typography>
                <OrderTimeline order={order} />
            </Paper>

            <Grid container spacing={3}>
                {/* Items */}
                <Grid item xs={12} md={8}>
                    <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="h6" gutterBottom>
                            Order Items
                        </Typography>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Product</TableCell>
                                        <TableCell align="center">Quantity</TableCell>
                                        <TableCell align="right">Price</TableCell>
                                        <TableCell align="right">Subtotal</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {order.items?.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    <Box
                                                        component="img"
                                                        src={item.product_image || item.product?.image_main}
                                                        alt={item.product_name || item.product?.name}
                                                        sx={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 1 }}
                                                    />
                                                    <Typography variant="body2">
                                                        {item.product_name || item.product?.name}
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell align="center">{item.quantity}</TableCell>
                                            <TableCell align="right">₹{item.price}</TableCell>
                                            <TableCell align="right">₹{item.price * item.quantity}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        <Divider sx={{ my: 2 }} />

                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Box sx={{ minWidth: 300 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography variant="body2">Subtotal:</Typography>
                                    <Typography variant="body2">₹{subtotal.toFixed(2)}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography variant="body2">Shipping:</Typography>
                                    <Typography variant="body2">₹{shipping.toFixed(2)}</Typography>
                                </Box>
                                {discount > 0 && (
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="body2" color="success.main">
                                            Discount:
                                        </Typography>
                                        <Typography variant="body2" color="success.main">
                                            -₹{discount.toFixed(2)}
                                        </Typography>
                                    </Box>
                                )}
                                <Divider sx={{ my: 1 }} />
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="h6">Total:</Typography>
                                    <Typography variant="h6">₹{order.total}</Typography>
                                </Box>
                            </Box>
                        </Box>
                    </Paper>
                </Grid>

                {/* Shipping & Payment Info */}
                <Grid item xs={12} md={4}>
                    <Stack spacing={3}>
                        {/* Shipping Address */}
                        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="h6" gutterBottom>
                                Shipping Address
                            </Typography>
                            <Typography variant="body2">
                                {order.shipping_first_name} {order.shipping_last_name}
                            </Typography>
                            <Typography variant="body2">{order.shipping_address}</Typography>
                            <Typography variant="body2">
                                {order.shipping_city}, {order.shipping_state} - {order.shipping_pincode}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 1 }}>
                                Phone: {order.shipping_phone}
                            </Typography>
                            <Typography variant="body2">Email: {order.shipping_email}</Typography>
                        </Paper>

                        {/* Payment Info */}
                        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="h6" gutterBottom>
                                Payment Information
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Method:
                                </Typography>
                                <Chip label={order.payment_method || 'PREPAID'} size="small" />
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Status:
                                </Typography>
                                <Chip
                                    label={order.payment_status || 'PENDING'}
                                    color={getPaymentStatusColor(order.payment_status)}
                                    size="small"
                                />
                            </Box>
                            {order.payment_id && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Transaction ID:
                                    </Typography>
                                    <Typography variant="caption">{order.payment_id}</Typography>
                                </Box>
                            )}
                        </Paper>

                        {/* Shipment Info */}
                        {order.shipment && (
                            <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="h6" gutterBottom>
                                    Shipment Details
                                </Typography>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        AWB Number:
                                    </Typography>
                                    <Typography variant="body2" fontWeight={600}>
                                        {order.shipment.awb_number}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Status:
                                    </Typography>
                                    <Chip label={order.shipment.status} size="small" color="info" />
                                </Box>
                                {order.shipment.tracking_url && (
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        fullWidth
                                        startIcon={<LocalShipping />}
                                        onClick={() => navigate(order.shipment.tracking_url)}
                                    >
                                        Track Shipment
                                    </Button>
                                )}
                            </Paper>
                        )}
                    </Stack>
                </Grid>
            </Grid>

            {/* Payment Completion Dialog */}
            <PaymentCompletionDialog
                open={paymentDialogOpen}
                onClose={() => setPaymentDialogOpen(false)}
                order={order}
                onSuccess={() => {
                    fetchOrderDetails();
                }}
            />
        </Container>
    );
};

export default OrderDetail;
