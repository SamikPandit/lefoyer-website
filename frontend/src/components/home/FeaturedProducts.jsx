import React, { useState, useEffect } from 'react';
import { Grid, Box, Container, Typography, Button, CircularProgress } from '@mui/material';
import { Link } from 'react-router-dom';
import ProductCard from '../product/ProductCard';
import { getProducts } from '../../services/api';

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
    <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: '#FDFBF9' }}>
      <Container maxWidth="xl">
        <Grid container spacing={6} alignItems="center">
          {/* Editorial Text - Left */}
          <Grid item xs={12} md={4}>
            <Box sx={{ pr: { md: 4 } }}>
              <Typography
                variant="h2"
                sx={{
                  fontFamily: "'Oswald', sans-serif",
                  fontWeight: 700,
                  fontSize: { xs: '2.5rem', md: '4rem' },
                  lineHeight: 1,
                  mb: 3,
                  textTransform: 'uppercase',
                  color: '#1a1a1a'
                }}
              >
                Curated<br />
                <Box component="span" sx={{ color: '#C9A96E' }}>Essentials</Box>
              </Typography>

              <Typography
                variant="body1"
                sx={{
                  mb: 4,
                  fontSize: '1.1rem',
                  lineHeight: 1.8,
                  color: 'text.secondary',
                  maxWidth: '400px'
                }}
              >
                Discover our most beloved formulations, hand-picked for their transformative results and uncompromising quality.
              </Typography>

              <Button
                component={Link}
                to="/products"
                variant="outlined"
                size="large"
                sx={{
                  borderColor: '#1a1a1a',
                  color: '#1a1a1a',
                  px: 5,
                  py: 1.5,
                  borderRadius: 0,
                  borderWidth: '1px',
                  '&:hover': {
                    backgroundColor: '#1a1a1a',
                    color: '#fff',
                    borderWidth: '1px'
                  }
                }}
              >
                View All
              </Button>
            </Box>
          </Grid>

          {/* Products - Right (Horizontal Scroll on Mobile) */}
          <Grid item xs={12} md={8}>
            <Box sx={{
              display: 'flex',
              gap: 3,
              overflowX: 'auto',
              pb: 2,
              '::-webkit-scrollbar': { display: 'none' },
              scrollbarWidth: 'none'
            }}>
              {products.slice(0, 3).map((product) => (
                <Box key={product.id} sx={{ minWidth: '300px', flex: 1 }}>
                  <ProductCard product={product} />
                </Box>
              ))}
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default FeaturedProducts;