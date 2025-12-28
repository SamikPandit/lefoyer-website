import React, { useState, useEffect } from 'react';
import { Box, Typography, Container, IconButton } from '@mui/material';
import { Link } from 'react-router-dom';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { getProducts } from '../../services/api';

const CircularProductSlider = () => {
    const [products, setProducts] = useState([]);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await getProducts();
                setProducts(response.data.results || []);
            } catch (error) {
                console.error('Failed to fetch products:', error);
            }
        };
        fetchProducts();
    }, []);

    return (
        <Box sx={{ py: 8, backgroundColor: '#fff', overflow: 'hidden' }}>
            <Container maxWidth="xl">
                <Box
                    sx={{
                        display: 'flex',
                        gap: { xs: 4, md: 8 },
                        overflowX: 'auto',
                        pb: 4,
                        px: 2,
                        '::-webkit-scrollbar': { display: 'none' },
                        scrollbarWidth: 'none',
                        justifyContent: { xs: 'flex-start', md: 'center' } // Center on desktop if few items
                    }}
                >
                    {products.slice(0, 5).map((product) => (
                        <Box
                            key={product.id}
                            component={Link}
                            to={`/product/${product.slug}`}
                            sx={{
                                flexShrink: 0,
                                textAlign: 'center',
                                textDecoration: 'none',
                                color: 'inherit',
                                group: 'true',
                                position: 'relative',
                                width: { xs: 200, md: 280 },
                            }}
                        >
                            {/* Circular Image Container */}
                            <Box
                                sx={{
                                    width: { xs: 200, md: 280 },
                                    height: { xs: 200, md: 280 },
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    border: '1px solid #E0E0E0',
                                    mb: 2,
                                    position: 'relative',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        borderColor: '#C9A96E',
                                        transform: 'scale(1.02)',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
                                    }
                                }}
                            >
                                <img
                                    src={product.image_main}
                                    alt={product.name}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        transition: 'transform 0.5s ease'
                                    }}
                                />

                                {/* Hover Overlay */}
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        backgroundColor: 'rgba(0,0,0,0.3)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        opacity: 0,
                                        transition: 'opacity 0.3s ease',
                                        '&:hover': { opacity: 1 }
                                    }}
                                >
                                    <Typography variant="button" sx={{ color: 'white', fontWeight: 600 }}>
                                        View Product
                                    </Typography>
                                </Box>
                            </Box>

                            {/* Product Info */}
                            <Typography
                                variant="h6"
                                sx={{
                                    fontFamily: "'Cormorant Garamond', serif",
                                    fontWeight: 600,
                                    fontSize: '1.2rem',
                                    mb: 0.5
                                }}
                            >
                                {product.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {product.category?.name}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            </Container>
        </Box>
    );
};

export default CircularProductSlider;
