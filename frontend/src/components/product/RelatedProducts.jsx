import React, { useEffect, useState } from 'react';
import { Box, Typography, Grid } from '@mui/material';
import ProductCard from '../product/ProductCard';
import { getRelatedProducts } from '../../services/mockApi';

const RelatedProducts = ({ productId }) => {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (!productId) return;

    const fetchRelatedProducts = async () => {
      try {
        const response = await getRelatedProducts(productId);
        setProducts(response.data);
      } catch (error) {
        console.error('Failed to fetch related products:', error);
      }
    };
    fetchRelatedProducts();
  }, [productId]);

  if (products.length === 0) return null;

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        Related Products
      </Typography>
      <Grid container spacing={2}>
        {products.slice(0, 4).map((product) => (
          <Grid item xs={6} sm={4} md={3} key={product.id}>
            <ProductCard product={product} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default RelatedProducts;