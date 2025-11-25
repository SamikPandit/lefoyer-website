import React, { useState, useEffect } from 'react';
import { Grid, Box, Container, Typography, Button, CircularProgress } from '@mui/material';
import { Link } from 'react-router-dom';
import ProductCard from '../product/ProductCard';
import { getProducts } from '../../services/mockApi';

const FeaturedProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeaturedProducts = async () => {
      try {
        const response = await getProducts({ is_featured: true });
        setProducts(response.data.results || []);
      } catch (error) {
        console.error('Error fetching featured products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedProducts();
  }, []);

  if (loading) {
    return (
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        py: { xs: 8, md: 12 },
        backgroundColor: 'background.default',
      }}
    >
      <Container maxWidth="lg">
        {/* Section Header */}
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography
            variant="caption"
            component="p"
            sx={{
              color: 'primary.main',
              mb: 2,
              fontWeight: 600,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}
          >
            Curated Favorites
          </Typography>

          <Typography
            variant="h2"
            component="h2"
            sx={{
              color: 'text.primary',
              mb: 3,
            }}
          >
            Featured Products
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            sx={{
              maxWidth: '600px',
              mx: 'auto',
              fontSize: '1.1rem',
              lineHeight: 1.6,
            }}
          >
            Discover our most beloved products, hand-picked for their exceptional quality and transformative results.
          </Typography>
        </Box>

        {/* Products Grid */}
        <Grid container spacing={4} justifyContent="center">
          {products.slice(0, 2).map((product) => (
            <Grid item xs={12} sm={6} md={4} key={product.id} sx={{ display: 'flex', justifyContent: 'center' }}>
              <Box sx={{ width: '100%', maxWidth: '350px' }}>
                <ProductCard product={product} />
              </Box>
            </Grid>
          ))}
        </Grid>

        {/* View All Button */}
        <Box sx={{ textAlign: 'center', mt: 8 }}>
          <Button
            variant="outlined"
            component={Link}
            to="/products"
            size="large"
            sx={{
              px: 6,
              py: 1.5,
              fontSize: '0.9rem',
              borderColor: 'primary.main',
              color: 'primary.main',
              '&:hover': {
                backgroundColor: 'rgba(201, 169, 110, 0.05)',
                borderColor: 'primary.dark',
              },
            }}
          >
            View All Products
          </Button>
        </Box>
      </Container>
    </Box>
  );
};

export default FeaturedProducts;