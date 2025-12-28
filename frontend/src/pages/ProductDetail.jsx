import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Grid,
  Box,
  Typography,
  Button,
  IconButton,
  Tabs,
  Tab,
  Rating,
  Divider,
  Chip,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Add,
  Remove,
  FavoriteBorder,
  Favorite,
  LocalShipping,
  Verified,
  Loop
} from '@mui/icons-material';
import { getProductBySlug } from '../services/api';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import RelatedProducts from '../components/product/RelatedProducts';
import ProductReviews from '../components/product/ProductReviews';

const ProductDetail = () => {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedImage, setSelectedImage] = useState('');
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [isWishlisted, setIsWishlisted] = useState(false);

  const { wishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await getProductBySlug(slug);
        setProduct(response.data);
        setSelectedImage(response.data.image_main);
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

  const handleToggleWishlist = async () => {
    let success;
    if (isWishlisted) {
      success = await removeFromWishlist(product.id);
      setSnackbarMessage(success ? 'Removed from wishlist' : 'Failed');
    } else {
      success = await addToWishlist(product.id);
      setSnackbarMessage(success ? 'Added to wishlist' : 'Failed');
    }
    setOpenSnackbar(true);
  };

  const handleAddToCart = async () => {
    const success = await addToCart(product, quantity);
    if (success) {
      setSnackbarMessage('Added to cart');
    } else {
      setSnackbarMessage('Failed to add to cart');
    }
    setOpenSnackbar(true);
  };

  if (!product) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <Typography>Loading...</Typography>
      </Container>
    );
  }

  const images = [
    product.image_main,
    product.image_2,
    product.image_3,
    product.image_4,
    product.image_5,
    product.image_6,
    product.image_7,
    product.image_8,
    product.image_9,
    product.image_10
  ].filter(Boolean);

  return (
    <Box sx={{ backgroundColor: '#FAFAFA', minHeight: '100vh', py: 3 }}>
      <Container maxWidth="lg">
        {/* Breadcrumb */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Home / {product.category?.name} / {product.name}
          </Typography>
        </Box>

        {/* Main Product Section */}
        <Box sx={{ backgroundColor: 'white', p: 3, mb: 3 }}>
          <Grid container spacing={3}>
            {/* Image Gallery - Left */}
            <Grid item xs={12} md={1}>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'row', md: 'column' }, gap: 1, overflowX: { xs: 'auto', md: 'visible' } }}>
                {images.map((image, index) => (
                  <Box
                    key={index}
                    onClick={() => setSelectedImage(image)}
                    sx={{
                      width: { xs: 60, md: 70 },
                      height: { xs: 60, md: 70 },
                      flexShrink: 0,
                      border: selectedImage === image ? '2px solid #C9A96E' : '1px solid #E0E0E0',
                      borderRadius: 1,
                      cursor: 'pointer',
                      overflow: 'hidden',
                      '&:hover': { borderColor: '#C9A96E' },
                    }}
                  >
                    <img
                      src={image}
                      alt={`Product ${index + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </Box>
                ))}
              </Box>
            </Grid>

            {/* Main Image - Center */}
            <Grid item xs={12} md={5}>
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  height: { xs: 350, md: 500 },
                  border: '1px solid #E0E0E0',
                  borderRadius: 1,
                  overflow: 'hidden',
                  backgroundColor: '#F5F5F5',
                }}
              >
                <img
                  src={selectedImage}
                  alt={product.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    padding: '20px'
                  }}
                />
              </Box>
            </Grid>

            {/* Product Info - Right */}
            <Grid item xs={12} md={6}>
              <Box>
                {/* Brand/Category */}
                <Typography variant="body2" sx={{ color: 'primary.main', mb: 0.5, textTransform: 'uppercase', fontSize: '0.813rem' }}>
                  {product.category?.name}
                </Typography>

                {/* Product Name */}
                <Typography variant="h4" sx={{ fontWeight: 500, mb: 1, fontSize: { xs: '1.5rem', md: '1.75rem' } }}>
                  {product.name}
                </Typography>

                {/* Rating & Reviews */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Rating value={parseFloat(product.rating)} precision={0.5} readOnly size="small" />
                  <Typography variant="body2" sx={{ color: 'primary.main', cursor: 'pointer' }}>
                    {product.reviews_count} reviews
                  </Typography>
                  {product.is_bestseller && (
                    <Chip label="Bestseller" size="small" sx={{ backgroundColor: '#C9A96E', color: 'white', fontSize: '0.688rem' }} />
                  )}
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Price */}
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 0.5 }}>
                    <Typography variant="h4" sx={{ color: '#B12704', fontWeight: 500 }}>
                      ₹{product.price}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {product.size}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="success.main" sx={{ fontWeight: 500 }}>
                    In Stock
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Key Benefits - Short */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    About this item
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                    {product.key_benefits?.split(',').slice(0, 4).map((benefit, index) => (
                      <Typography component="li" key={index} variant="body2" sx={{ mb: 0.5, fontSize: '0.875rem' }}>
                        {benefit.trim()}
                      </Typography>
                    ))}
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Suitable For */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    <strong>Suitable For:</strong> {product.suitable_for}
                  </Typography>
                  <Typography variant="body2">
                    <strong>SKU:</strong> {product.sku}
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Quantity Selector */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Quantity
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #D5D9D9', borderRadius: 1 }}>
                      <IconButton size="small" onClick={() => handleQuantityChange(-1)} sx={{ borderRadius: 0 }}>
                        <Remove fontSize="small" />
                      </IconButton>
                      <Typography sx={{ px: 2, minWidth: 40, textAlign: 'center', fontWeight: 500 }}>
                        {quantity}
                      </Typography>
                      <IconButton size="small" onClick={() => handleQuantityChange(1)} sx={{ borderRadius: 0 }}>
                        <Add fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                </Box>

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    onClick={handleAddToCart}
                    sx={{
                      backgroundColor: '#C9A96E',
                      '&:hover': { backgroundColor: '#B08D55' },
                      textTransform: 'none',
                      fontSize: '1rem'
                    }}
                  >
                    Add to Cart
                  </Button>
                  <IconButton
                    onClick={handleToggleWishlist}
                    sx={{
                      border: '1px solid #D5D9D9',
                      borderRadius: 1,
                      '&:hover': { backgroundColor: '#F7F7F7' }
                    }}
                  >
                    {isWishlisted ? <Favorite color="error" /> : <FavoriteBorder />}
                  </IconButton>
                </Box>

                {/* Delivery Info */}
                <Box sx={{ backgroundColor: '#F0F2F2', p: 2, borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
                    <LocalShipping sx={{ color: 'primary.main', fontSize: 20 }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25 }}>
                        Free Delivery
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Enter your postal code for Delivery Availability
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Loop sx={{ color: 'primary.main', fontSize: 20 }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25 }}>
                        Return Delivery
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Free 30 Days Delivery Returns
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* Product Details Tabs */}
        <Box sx={{ backgroundColor: 'white', mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            sx={{
              borderBottom: '1px solid #E0E0E0',
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 500 }
            }}
          >
            <Tab label="Product Details" />
            <Tab label="Ingredients" />
            <Tab label="How to Use" />
          </Tabs>

          <Box sx={{ p: 3 }}>
            {activeTab === 0 && (
              <Box>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Product Information</Typography>
                <Table size="small" sx={{ maxWidth: 800 }}>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, width: 200 }}>Brand</TableCell>
                      <TableCell>Le foyeR.</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                      <TableCell>{product.category?.name}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Suitable For</TableCell>
                      <TableCell>{product.suitable_for}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Size</TableCell>
                      <TableCell>{product.size}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Key Benefits</TableCell>
                      <TableCell>{product.key_benefits}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Key Features</TableCell>
                      <TableCell>{product.key_features}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600 }}>Description</Typography>
                  <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                    {product.description}
                  </Typography>
                </Box>
              </Box>
            )}

            {activeTab === 1 && (
              <Box>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Ingredients</Typography>
                <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                  {product.ingredients}
                </Typography>
              </Box>
            )}

            {activeTab === 2 && (
              <Box>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>How to Use</Typography>
                <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                  {product.how_to_use}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Related Products */}
        <Box sx={{ backgroundColor: 'white', p: 3, mb: 3 }}>
          <RelatedProducts productId={product.id} />
        </Box>

        {/* Reviews */}
        <Box sx={{ backgroundColor: 'white', p: 3 }}>
          <ProductReviews productSlug={product.slug} />
        </Box>

        {/* Snackbar */}
        <Snackbar open={openSnackbar} autoHideDuration={3000} onClose={() => setOpenSnackbar(false)}>
          <Alert severity="success" sx={{ width: '100%' }}>
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
};

export default ProductDetail;