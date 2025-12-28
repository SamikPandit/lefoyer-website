import React from 'react';
import { Box, Typography, Button, Grid, Container } from '@mui/material';
import { Link } from 'react-router-dom';

const NewYearBanner = () => {
    return (
        <Box sx={{ py: 8, backgroundColor: '#FDFBF9' }}>
            <Container maxWidth="xl">
                <Box sx={{
                    backgroundColor: '#000',
                    color: 'white',
                    overflow: 'hidden',
                    position: 'relative',
                    minHeight: '600px',
                    display: 'flex',
                    alignItems: 'center'
                }}>
                    <Grid container spacing={0} alignItems="center">
                        {/* Left Image Section */}
                        <Grid item xs={12} md={6} sx={{ position: 'relative', height: '600px' }}>
                            <Box
                                component="img"
                                src="/images/products/Spotless_10.png"
                                alt="New Year Collection"
                                sx={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    opacity: 0.9
                                }}
                            />
                            <Box sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%)',
                                display: { xs: 'none', md: 'block' }
                            }} />
                        </Grid>

                        {/* Right Text Section */}
                        <Grid item xs={12} md={6} sx={{ p: { xs: 4, md: 8 }, textAlign: { xs: 'center', md: 'right' } }}>
                            <Typography variant="h2" sx={{
                                fontFamily: "'Oswald', sans-serif",
                                fontWeight: 700,
                                fontSize: { xs: '3rem', md: '6rem' },
                                lineHeight: 0.9,
                                textTransform: 'uppercase',
                                mb: 2,
                                color: '#fff'
                            }}>
                                New Year,<br />
                                <Box component="span" sx={{ color: '#C9A96E' }}>New You.</Box>
                            </Typography>

                            <Typography variant="h6" sx={{
                                mb: 4,
                                fontWeight: 300,
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                                opacity: 0.9,
                                color: '#C9A96E'
                            }}>
                                Navigate your way towards perfection.
                            </Typography>

                            <Button
                                component={Link}
                                to="/products"
                                variant="outlined"
                                size="large"
                                sx={{
                                    borderColor: '#fff',
                                    color: '#fff',
                                    px: 6,
                                    py: 1.5,
                                    fontSize: '1.1rem',
                                    borderRadius: 0,
                                    borderWidth: '1px',
                                    '&:hover': {
                                        backgroundColor: '#fff',
                                        color: '#000',
                                        borderColor: '#fff'
                                    }
                                }}
                            >
                                Shop Now
                            </Button>
                        </Grid>
                    </Grid>
                </Box>
            </Container>
        </Box>
    );
};

export default NewYearBanner;
