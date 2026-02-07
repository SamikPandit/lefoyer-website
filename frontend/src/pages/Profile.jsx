import React, { useState, useEffect } from 'react';
import { Container, Typography, Box, Paper, Grid, Divider, Button, CircularProgress } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import OrderCard from '../components/order/OrderCard';

const Profile = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await api.get('orders/');
                setOrders(response.data.results || response.data);
            } catch (error) {
                console.error('Failed to fetch orders:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    if (!user) return null;

    return (
        <Box sx={{ backgroundColor: '#FAFAFA', minHeight: '80vh', py: 8 }}>
            <Container maxWidth="lg">
                <Grid container spacing={4}>
                    {/* Sidebar / User Info */}
                    <Grid item xs={12} md={4}>
                        <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid #E0E0E0', position: 'sticky', top: 100 }}>
                            <Typography variant="h5" sx={{ fontFamily: "'Cormorant Garamond', serif", mb: 3 }}>
                                My Profile
                            </Typography>

                            <Box sx={{ mb: 3 }}>
                                <Typography variant="subtitle2" color="text.secondary">Name</Typography>
                                <Typography variant="body1">{user.first_name} {user.last_name || user.username}</Typography>
                            </Box>

                            <Box sx={{ mb: 3 }}>
                                <Typography variant="subtitle2" color="text.secondary">Email</Typography>
                                <Typography variant="body1">{user.email}</Typography>
                            </Box>

                            <Divider sx={{ my: 3 }} />

                            <Button
                                variant="outlined"
                                color="error"
                                fullWidth
                                onClick={handleLogout}
                            >
                                Logout
                            </Button>
                        </Paper>
                    </Grid>

                    {/* Orders */}
                    <Grid item xs={12} md={8}>
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="h5" sx={{ fontFamily: "'Cormorant Garamond', serif" }}>
                                Order History
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                {orders.length} order{orders.length !== 1 ? 's' : ''} found
                            </Typography>
                        </Box>

                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                                <CircularProgress />
                            </Box>
                        ) : orders.length === 0 ? (
                            <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px solid #E0E0E0', borderRadius: 2 }}>
                                <Typography color="text.secondary" variant="h6" gutterBottom>
                                    No orders yet
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                    Start shopping to see your orders here
                                </Typography>
                                <Button variant="contained" onClick={() => navigate('/products')}>
                                    Browse Products
                                </Button>
                            </Paper>
                        ) : (
                            <Box>
                                {orders.map((order) => (
                                    <OrderCard key={order.id} order={order} />
                                ))}
                            </Box>
                        )}
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
};

export default Profile;
