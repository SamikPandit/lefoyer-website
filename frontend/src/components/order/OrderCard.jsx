import React from 'react';
import { Card, CardContent, Box, Typography, Chip, Button, Stack, Grid } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { AccessTime, LocalShipping, Payment } from '@mui/icons-material';

const OrderCard = ({ order }) => {
    const navigate = useNavigate();

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'delivered': return 'success';
            case 'shipped': case 'out_for_delivery': return 'info';
            case 'processing': return 'warning';
            case 'cancelled': return 'error';
            default: return 'default';
        }
    };

    const getPaymentStatusColor = (paymentStatus) => {
        switch (paymentStatus?.toUpperCase()) {
            case 'COMPLETED': return 'success';
            case 'FAILED': return 'error';
            case 'PENDING': return 'warning';
            default: return 'default';
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const firstThreeItems = order.items?.slice(0, 3) || [];
    const remainingCount = Math.max(0, (order.items?.length || 0) - 3);

    return (
        <Card
            sx={{
                mb: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                transition: 'all 0.2s ease',
                '&:hover': {
                    boxShadow: 3,
                    borderColor: 'primary.main',
                },
            }}
            elevation={0}
        >
            <CardContent sx={{ p: 3 }}>
                <Grid container spacing={3}>
                    {/* Left: Order Info */}
                    <Grid item xs={12} md={8}>
                        <Stack spacing={2}>
                            {/* Order Header */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    Order #{order.id}
                                </Typography>
                                <Chip
                                    label={order.status || 'Pending'}
                                    color={getStatusColor(order.status)}
                                    size="small"
                                />
                                <Chip
                                    icon={<Payment />}
                                    label={order.payment_status || 'PENDING'}
                                    color={getPaymentStatusColor(order.payment_status)}
                                    size="small"
                                    variant="outlined"
                                />
                            </Box>

                            {/* Date and Total */}
                            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', color: 'text.secondary' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <AccessTime fontSize="small" />
                                    <Typography variant="body2">{formatDate(order.created_at)}</Typography>
                                </Box>
                                <Typography variant="body2" fontWeight={600} color="text.primary">
                                    Total: ₹{order.total}
                                </Typography>
                                {order.shipment?.awb_number && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <LocalShipping fontSize="small" />
                                        <Typography variant="body2">AWB: {order.shipment.awb_number}</Typography>
                                    </Box>
                                )}
                            </Box>

                            {/* Product Thumbnails */}
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', pt: 1 }}>
                                {firstThreeItems.map((item, index) => (
                                    <Box
                                        key={index}
                                        component="img"
                                        src={item.product_image || item.product?.image_main}
                                        alt={item.product_name || item.product?.name}
                                        sx={{
                                            width: 60,
                                            height: 60,
                                            objectFit: 'cover',
                                            borderRadius: 1,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                        }}
                                    />
                                ))}
                                {remainingCount > 0 && (
                                    <Box
                                        sx={{
                                            width: 60,
                                            height: 60,
                                            borderRadius: 1,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: 'action.hover',
                                        }}
                                    >
                                        <Typography variant="caption" fontWeight={600}>
                                            +{remainingCount}
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                        </Stack>
                    </Grid>

                    {/* Right: Actions */}
                    <Grid item xs={12} md={4} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <Stack spacing={1.5} sx={{ width: { xs: '100%', md: 'auto' } }}>
                            <Button
                                variant="contained"
                                fullWidth
                                onClick={() => navigate(`/orders/${order.id}`)}
                                sx={{ minWidth: 150 }}
                            >
                                View Details
                            </Button>
                            {order.payment_status === 'PENDING' && (
                                <Button
                                    variant="outlined"
                                    color="warning"
                                    fullWidth
                                    onClick={() => navigate(`/orders/${order.id}?action=payment`)}
                                    sx={{ minWidth: 150 }}
                                >
                                    Complete Payment
                                </Button>
                            )}
                            {order.shipment?.tracking_url && (
                                <Button
                                    variant="outlined"
                                    fullWidth
                                    onClick={() => navigate(order.shipment.tracking_url)}
                                    sx={{ minWidth: 150 }}
                                >
                                    Track Order
                                </Button>
                            )}
                        </Stack>
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
};

export default OrderCard;
