import React, { useState, useEffect } from 'react';
import { Container, Typography, Box, Paper, Grid, Divider, Button, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

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
                        <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid #E0E0E0' }}>
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
                        <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid #E0E0E0' }}>
                            <Typography variant="h5" sx={{ fontFamily: "'Cormorant Garamond', serif", mb: 3 }}>
                                Order History
                            </Typography>

                            {loading ? (
                                <Typography>Loading orders...</Typography>
                            ) : orders.length === 0 ? (
                                <Typography color="text.secondary">No orders found.</Typography>
                            ) : (
                                <TableContainer>
                                    <Table>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Order ID</TableCell>
                                                <TableCell>Date</TableCell>
                                                <TableCell>Total</TableCell>
                                                <TableCell>Status</TableCell>
                                                <TableCell>Payment</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {orders.map((order) => (
                                                <TableRow key={order.id}>
                                                    <TableCell>#{order.id}</TableCell>
                                                    <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                                                    <TableCell>₹{order.total}</TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={order.status}
                                                            size="small"
                                                            color={order.status === 'delivered' ? 'success' : 'default'}
                                                            variant="outlined"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={order.payment_status || 'PENDING'}
                                                            size="small"
                                                            color={order.payment_status === 'COMPLETED' ? 'success' : order.payment_status === 'FAILED' ? 'error' : 'warning'}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </Paper>
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
};

export default Profile;
