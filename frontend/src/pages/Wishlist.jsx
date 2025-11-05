import React, { useState } from 'react';
import { Container, Grid, Box, Typography, Button, CircularProgress, Alert, Snackbar } from '@mui/material';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import ProductCard from '../components/product/ProductCard';
import { Link } from 'react-router-dom';

const Wishlist = () => {
  const { wishlist, loading, error, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const handleAddToCartFromWishlist = async (product) => {
    const success = await addToCart(product.id);
    if (success) {
      setSnackbarMessage(`${product.name} added to cart!`);
      setSnackbarSeverity('success');
      await removeFromWishlist(product.id); // Optionally remove from wishlist after adding to cart
    } else {
      setSnackbarMessage('Failed to add to cart. Please try again.');
      setSnackbarSeverity('error');
    }
    setOpenSnackbar(true);
  };

  const handleMoveAllToCart = async () => {
    if (!wishlist || wishlist.products.length === 0) return;

    let allSuccess = true;
    for (const product of wishlist.products) {
      const success = await addToCart(product.id);
      if (!success) {
        allSuccess = false;
        break;
      }
    }

    if (allSuccess) {
      setSnackbarMessage('All items moved to cart!');
      setSnackbarSeverity('success');
      // Clear wishlist after moving all to cart
      for (const product of wishlist.products) {
        await removeFromWishlist(product.id);
      }
    } else {
      setSnackbarMessage('Failed to move all items to cart. Please try again.');
      setSnackbarSeverity('error');
    }
    setOpenSnackbar(true);
  };

  const handleCloseSnackbar = () => {
    setOpenSnackbar(false);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 5, textAlign: 'center' }}>
        <CircularProgress />
        <Typography>Loading wishlist...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 5, textAlign: 'center' }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!wishlist || wishlist.products.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ py: 5, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700 }}>
          Your wishlist is empty
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Save your favorite products here to easily find them later.
        </Typography>
        <Button variant="contained" color="primary" component={Link} to="/products" sx={{ borderRadius: '25px', px: 4, py: 1.5 }}>
          Browse Products
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Typography variant="h4" gutterBottom sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, mb: 4 }}>
        My Wishlist
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleMoveAllToCart} 
          disabled={wishlist.products.length === 0}
          sx={{ borderRadius: '25px', px: 4, py: 1.5 }}
        >
          Move All to Cart
        </Button>
      </Box>
      <Grid container spacing={4}>
        {wishlist.products.map((product) => (
          <Grid key={product.id} xs={12} sm={6} md={4} lg={3}>
            <ProductCard product={product} />
          </Grid>
        ))}
      </Grid>
      <Snackbar open={openSnackbar} autoHideDuration={3000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Wishlist;
