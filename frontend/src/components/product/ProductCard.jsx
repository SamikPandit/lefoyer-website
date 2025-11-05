import React, { useState, useEffect } from 'react';
import { Card, CardActionArea, CardMedia, CardContent, CardActions, Typography, IconButton, Box, Snackbar, Alert } from '@mui/material';
import { ShoppingCartOutlined, FavoriteBorder, Favorite } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';

const ProductCard = ({ product, view = 'grid' }) => {
  const { addToCart } = useCart();
  const { wishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [isWishlisted, setIsWishlisted] = useState(false);

  useEffect(() => {
    if (wishlist && product) {
      setIsWishlisted(wishlist.products.some(item => item.id === product.id));
    }
  }, [wishlist, product]);

  // Fallback for missing product data
  if (!product) {
    return null;
  }

  const handleAddToCart = async () => {
    const success = await addToCart(product.id);
    if (success) {
      setSnackbarMessage(`${product.name} added to cart!`);
      setSnackbarSeverity('success');
    } else {
      setSnackbarMessage('Failed to add to cart. Please try again.');
      setSnackbarSeverity('error');
    }
    setOpenSnackbar(true);
  };

  const handleToggleWishlist = async () => {
    let success;
    if (isWishlisted) {
      success = await removeFromWishlist(product.id);
      if (success) {
        setSnackbarMessage(`${product.name} removed from wishlist!`);
        setSnackbarSeverity('info');
      } else {
        setSnackbarMessage('Failed to remove from wishlist.');
        setSnackbarSeverity('error');
      }
    } else {
      success = await addToWishlist(product.id);
      if (success) {
        setSnackbarMessage(`${product.name} added to wishlist!`);
        setSnackbarSeverity('success');
      } else {
        setSnackbarMessage('Failed to add to wishlist. Please try again.');
        setSnackbarSeverity('error');
      }
    }
    setOpenSnackbar(true);
  };

  const handleCloseSnackbar = () => {
    setOpenSnackbar(false);
  };

  return (
    <Card 
      sx={{
        display: view === 'list' ? 'flex' : 'block',
        flexDirection: view === 'list' ? 'row' : 'column',
        maxWidth: view === 'list' ? '100%' : 345,
      }}
    >
      <CardActionArea 
        component={Link} 
        to={`/product/${product.slug}`}
        sx={{ display: view === 'list' ? 'flex' : 'block', flexShrink: 0, width: view === 'list' ? 150 : 'auto' }}
      >
        <CardMedia
          component="img"
          height={view === 'list' ? 150 : 240}
          image={product.image_main || 'https://source.unsplash.com/random/400x400?beauty-product'}
          alt={product.name}
          sx={{ width: view === 'list' ? 150 : '100%', objectFit: 'cover' }}
        />
      </CardActionArea>
      <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <CardContent sx={{ flexGrow: 1, minHeight: view === 'list' ? 'auto' : 100 }}>
          <Typography gutterBottom variant="h6" component="div" sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 600 }}>
            {product.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {product.suitable_for}
          </Typography>
          {view === 'list' && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {product.description.substring(0, 100)}...
            </Typography>
          )}
        </CardContent>
        <CardActions disableSpacing sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
          <Typography variant="h6" color="text.primary" sx={{ fontWeight: 'bold' }}>
            ₹{product.price}
          </Typography>
          <Box>
            <IconButton aria-label="add to wishlist" onClick={handleToggleWishlist}>
              {isWishlisted ? <Favorite color="error" /> : <FavoriteBorder />}
            </IconButton>
            <IconButton 
              aria-label="add to cart" 
              sx={{
                backgroundColor: 'primary.main',
                color: 'white',
                '&:hover': { backgroundColor: 'primary.dark' }
              }}
              onClick={handleAddToCart}
            >
              <ShoppingCartOutlined />
            </IconButton>
          </Box>
        </CardActions>
      </Box>
      <Snackbar open={openSnackbar} autoHideDuration={3000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Card>
  );
};

export default ProductCard;
