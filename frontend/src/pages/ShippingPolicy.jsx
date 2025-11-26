import React from 'react';
import { Box, Container, Typography, Paper, Divider } from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';

const ShippingPolicy = () => {
    return (
        <Box sx={{ backgroundColor: '#FDFBF9', minHeight: '80vh', py: { xs: 8, md: 12 } }}>
            <Container maxWidth="md">
                <Box sx={{ textAlign: 'center', mb: 8 }}>
                    <Typography
                        variant="h2"
                        sx={{
                            fontFamily: "'Cormorant Garamond', serif",
                            mb: 2,
                            color: 'text.primary',
                        }}
                    >
                        Shipping & Returns
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Everything you need to know about delivery, returns, and refunds.
                    </Typography>
                </Box>

                <Paper elevation={0} sx={{ p: { xs: 4, md: 6 }, borderRadius: 2, border: '1px solid #E0E0E0' }}>

                    {/* Shipping Policy */}
                    <Box sx={{ mb: 6 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <LocalShippingIcon sx={{ color: 'primary.main', mr: 2, fontSize: 28 }} />
                            <Typography variant="h5" sx={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 }}>
                                Shipping Policy
                            </Typography>
                        </Box>
                        <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8, ml: { xs: 0, md: 5.5 } }}>
                            We will deliver your products within 3-7 days.
                        </Typography>
                    </Box>

                    <Divider sx={{ my: 4 }} />

                    {/* Return Policy */}
                    <Box sx={{ mb: 6 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <AssignmentReturnIcon sx={{ color: 'primary.main', mr: 2, fontSize: 28 }} />
                            <Typography variant="h5" sx={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 }}>
                                Return Policy
                            </Typography>
                        </Box>
                        <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8, ml: { xs: 0, md: 5.5 } }}>
                            You can initiate for a return within 7 days of delivery.
                        </Typography>
                    </Box>

                    <Divider sx={{ my: 4 }} />

                    {/* Refund Policy */}
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <CurrencyExchangeIcon sx={{ color: 'primary.main', mr: 2, fontSize: 28 }} />
                            <Typography variant="h5" sx={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 }}>
                                Refund Policy
                            </Typography>
                        </Box>
                        <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8, ml: { xs: 0, md: 5.5 } }}>
                            If any refund is approved, we will initiate and credited the refund within 10 days.
                        </Typography>
                    </Box>

                </Paper>
            </Container>
        </Box>
    );
};

export default ShippingPolicy;
