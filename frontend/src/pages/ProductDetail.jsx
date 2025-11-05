import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Grid, Box, Typography, Button, IconButton, Tabs, Tab, Paper, Rating, Snackbar, Alert } from '@mui/material';
import { Add, Remove, ShoppingCartOutlined, FavoriteBorder, Favorite } from '@mui/icons-material';
import { getProductBySlug } from '../services/api';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import RelatedProducts from '../components/product/RelatedProducts';
import ProductReviews from '../components/product/ProductReviews';

const ProductDetail = () => {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState(0);
  const [mainImage, setMainImage] = useState('');
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [isWishlisted, setIsWishlisted] = useState(false);
  const { addToCart } = useCart();
  const { wishlist, addToWishlist, removeFromWishlist } = useWishlist();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await getProductBySlug(slug);
        setProduct(response.data);
        setMainImage(response.data.image_main);
      } catch (error) {
        console.error('Failed to fetch product:', error);
      }
    };
    fetchProduct();
  }, [slug]);

  useEffect(() => {
    if (wishlist && product) {
      setIsWishlisted(wishlist.products.some(item => item.id === product.id));
    }
  }, [wishlist, product]);

  const handleQuantityChange = (amount) => {
    setQuantity((prev) => Math.max(1, prev + amount));
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleAddToCart = async () => {
    const success = await addToCart(product.id, quantity);
    if (success) {
      setSnackbarMessage(`${quantity} x ${product.name} added to cart!`);
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

  if (!product) {
    return <Typography>Loading...</Typography>;
  }

  const images = [product.image_main, product.image_2, product.image_3, product.image_4].filter(Boolean);

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Grid container spacing={5}>
        {/* Image Gallery */}
        <Grid xs={12} md={6}>
          <Box 
            sx={{
              mb: 2, 
              border: '1px solid #eee', 
              borderRadius: 2, 
              overflow: 'hidden',
              position: 'relative',
              cursor: 'zoom-in',
              '&:hover img': {
                transform: 'scale(1.2)',
              },
            }}
          >
            <img 
              src={mainImage} 
              alt={product.name} 
              style={{
                width: '100%', 
                height: 'auto', 
                display: 'block',
                transition: 'transform 0.3s ease-in-out',
              }}
            />
          </Box>
          <Grid container spacing={1}>
            {images.map((image, index) => (
              <Grid xs={3} key={index}>
                <Paper 
                  elevation={0}
                  sx={{ border: mainImage === image ? '2px solid' : '1px solid #eee', borderColor: 'primary.main', cursor: 'pointer', overflow: 'hidden' }}
                  onClick={() => setMainImage(image)}
                >
                  <img src={image} alt={`${product.name} thumbnail ${index + 1}`} style={{ width: '100%', display: 'block' }} />
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Product Info */}
        <Grid xs={12} md={6}>
          <Typography variant="h4" gutterBottom sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700 }}>
            {product.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Rating value={parseFloat(product.rating)} precision={0.5} readOnly />
            <Typography sx={{ ml: 1 }}>({product.reviews_count} reviews)</Typography>
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
            ₹{product.price}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {product.description}
          </Typography>

          {/* Quantity & Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #ccc', borderRadius: '25px', p: '2px' }}>
              <IconButton onClick={() => handleQuantityChange(-1)}>
                <Remove />
              </IconButton>
              <Typography sx={{ px: 2, fontWeight: 'bold' }}>{quantity}</Typography>
              <IconButton onClick={() => handleQuantityChange(1)}>
                <Add />
              </IconButton>
            </Box>
            <Button 
              variant="contained" 
              size="large" 
              startIcon={<ShoppingCartOutlined />} 
              sx={{ flexGrow: 1, borderRadius: '25px', py: 1.5 }}
              onClick={handleAddToCart}
            >
              Add to Cart
            </Button>
            <IconButton onClick={handleToggleWishlist}>
              {isWishlisted ? <Favorite color="error" /> : <FavoriteBorder />}
            </IconButton>
          </Box>
          
          <Typography variant="body2">SKU: {product.sku}</Typography>
          <Typography variant="body2">Category: {product.category.name}</Typography>
        </Grid>
      </Grid>

      {/* Details Tabs */}
      <Box sx={{ mt: 6, borderTop: '1px solid #eee', pt: 4 }}>
        <Tabs value={activeTab} onChange={handleTabChange} centered>
          <Tab label="Description" />
          <Tab label="Key Benefits" />
          <Tab label="Key Features" />
          <Tab label="Ingredients" />
          <Tab label="How to Use" />
          <Tab label="Suitable For" />
        </Tabs>
        <Box sx={{ p: 3, mt: 2 }}>
          {activeTab === 0 && <Typography>{product.description}</Typography>}
          {activeTab === 1 && <Typography>{product.key_benefits}</Typography>}
          {activeTab === 2 && <Typography>{product.key_features}</Typography>}
          {activeTab === 3 && <Typography>{product.ingredients}</Typography>}
          {activeTab === 4 && <Typography>{product.how_to_use}</Typography>}
          {activeTab === 5 && <Typography>{product.suitable_for}</Typography>}
        </Box>
      </Box>

      {/* Related Products Section */}
      <RelatedProducts productId={product.id} />

      {/* Reviews and Ratings Section */}
      <ProductReviews productSlug={product.slug} />

      <Snackbar open={openSnackbar} autoHideDuration={3000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ProductDetail;