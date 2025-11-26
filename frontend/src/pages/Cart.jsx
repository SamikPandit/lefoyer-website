import React from 'react';
import { Container, Typography, Box, Grid, Button, IconButton, Paper, Divider, TextField } from '@mui/material';
import { Add, Remove, Delete, ArrowBack } from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const Cart = () => {
    const { cart, updateQuantity, removeFromCart } = useCart();
    const navigate = useNavigate();

    if (cart.items.length === 0) {
        return (
            <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontFamily: "'Cormorant Garamond', serif", mb: 2 }}>
                    Your Cart is Empty
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                    Looks like you haven't added anything to your cart yet.
                </Typography>
                <Button
                    variant="contained"
                    component={Link}
                    to="/products"
                    sx={{
                        backgroundColor: '#C9A96E',
                        '&:hover': { backgroundColor: '#B08D55' },
                        px: 4, py: 1.5
                    }}
                >
                    Continue Shopping
                </Button>
            </Container>
        );
    }

    return (
        <Box sx={{ backgroundColor: '#FAFAFA', minHeight: '80vh', py: 4 }}>
            <Container maxWidth="lg">
                <Typography variant="h3" sx={{ fontFamily: "'Cormorant Garamond', serif", mb: 4 }}>
                    Shopping Cart
                </Typography>

                <Grid container spacing={4}>
                    {/* Cart Items */}
                    <Grid item xs={12} md={8}>
                        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid #E0E0E0' }}>
                            {cart.items.map((item) => (
                                <React.Fragment key={item.id}>
                                    <Box sx={{ display: 'flex', gap: 2, py: 3 }}>
                                        {/* Product Image */}
                                        <Box
                                            component="img"
                                            src={item.image_main}
                                            alt={item.name}
                                            sx={{
                                                width: 100,
                                                height: 100,
                                                objectFit: 'cover',
                                                borderRadius: 1,
                                                backgroundColor: '#F5F5F5'
                                            }}
                                        />

                                        {/* Product Details */}
                                        <Box sx={{ flexGrow: 1 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                <Typography variant="h6" sx={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 }}>
                                                    {item.name}
                                                </Typography>
                                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                    ₹{item.price * item.quantity}
                                                </Typography>
                                            </Box>

                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                Size: {item.size}
                                            </Typography>

                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                {/* Quantity Selector */}
                                                <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #E0E0E0', borderRadius: 1 }}>
                                                    <IconButton size="small" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                                                        <Remove fontSize="small" />
                                                    </IconButton>
                                                    <Typography sx={{ px: 2, minWidth: 30, textAlign: 'center' }}>
                                                        {item.quantity}
                                                    </Typography>
                                                    <IconButton size="small" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                                                        <Add fontSize="small" />
                                                    </IconButton>
                                                </Box>

                                                <Button
                                                    startIcon={<Delete />}
                                                    color="error"
                                                    onClick={() => removeFromCart(item.id)}
                                                    sx={{ textTransform: 'none' }}
                                                >
                                                    Remove
                                                </Button>
                                            </Box>
                                        </Box>
                                    </Box>
                                    <Divider />
                                </React.Fragment>
                            ))}

                            <Box sx={{ mt: 3 }}>
                                <Button
                                    startIcon={<ArrowBack />}
                                    component={Link}
                                    to="/products"
                                    sx={{ textTransform: 'none', color: 'text.secondary' }}
                                >
                                    Continue Shopping
                                </Button>
                            </Box>
                        </Paper>
                    </Grid>

                    {/* Order Summary */}
                    <Grid item xs={12} md={4}>
                        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid #E0E0E0', position: 'sticky', top: 100 }}>
                            <Typography variant="h5" sx={{ fontFamily: "'Cormorant Garamond', serif", mb: 3 }}>
                                Order Summary
                            </Typography>

                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                <Typography color="text.secondary">Subtotal</Typography>
                                <Typography fontWeight={600}>₹{cart.total}</Typography>
                            </Box>

                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                <Typography color="text.secondary">Shipping</Typography>
                                <Typography color="success.main" fontWeight={600}>Free</Typography>
                            </Box>

                            <Divider sx={{ my: 2 }} />

                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                                <Typography variant="h6">Total</Typography>
                                <Typography variant="h6" color="primary.main">₹{cart.total}</Typography>
                            </Box>

                            <Button
                                variant="contained"
                                fullWidth
                                size="large"
                                onClick={() => navigate('/checkout')}
                                sx={{
                                    backgroundColor: '#C9A96E',
                                    '&:hover': { backgroundColor: '#B08D55' },
                                    py: 1.5,
                                    mb: 2
                                }}
                            >
                                Proceed to Checkout
                            </Button>

                            <Typography variant="caption" color="text.secondary" align="center" display="block">
                                Secure Checkout - SSL Encrypted
                            </Typography>
                        </Paper>
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
};

export default Cart;
