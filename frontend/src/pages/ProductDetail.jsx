import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Loop,
  AttachMoney
} from '@mui/icons-material';
import { getProductBySlug } from '../services/api';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import RelatedProducts from '../components/product/RelatedProducts';
import ProductReviews from '../components/product/ProductReviews';

const ProductDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedImage, setSelectedImage] = useState('');
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [isWishlisted, setIsWishlisted] = useState(false);

  const { wishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();

  // Scroll to top on product change  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

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
    setQuantity((prev) => {
      const next = prev + amount;
      const maxQty = product?.available_quantity || product?.stock_quantity || 99;
      return Math.max(1, Math.min(next, maxQty));
    });
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setOpenSnackbar(true);
  };

  const handleToggleWishlist = async () => {
    let success;
    if (isWishlisted) {
      success = await removeFromWishlist(product.id);
      showSnackbar(success ? 'Removed from wishlist' : 'Failed', success ? 'success' : 'error');
    } else {
      success = await addToWishlist(product.id);
      showSnackbar(success ? 'Added to wishlist' : 'Failed', success ? 'success' : 'error');
    }
  };

  const handleAddToCart = async () => {
    if (!product.in_stock) {
      showSnackbar('This product is currently out of stock', 'error');
      return;
    }
    const result = await addToCart(product, quantity);
    if (result === true) {
      showSnackbar('Added to cart');
    } else if (typeof result === 'string') {
      showSnackbar(result, 'error');
    } else {
      showSnackbar('Failed to add to cart', 'error');
    }
  };

  const handleBuyNow = async () => {
    if (!product.in_stock) {
      showSnackbar('This product is currently out of stock', 'error');
      return;
    }
    const result = await addToCart(product, quantity);
    if (result === true) {
      await new Promise(resolve => setTimeout(resolve, 100));
      navigate('/checkout');
    } else if (typeof result === 'string') {
      showSnackbar(result, 'error');
    } else {
      showSnackbar('Failed to add to cart', 'error');
    }
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

  const isInStock = product.in_stock !== undefined ? product.in_stock : (product.stock_quantity > 0);
  const availableQty = product.available_quantity || product.stock_quantity || 0;
  const effectivePrice = product.discount_price && product.discount_price > 0 ? product.discount_price : product.price;
  const hasDiscount = product.discount_price && product.discount_price > 0 && product.discount_price < product.price;

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
        <Box sx={{ backgroundColor: 'white', p: { xs: 1, md: 3 }, mb: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: { xs: 2, md: 4 } }}>

            {/* Left Side: Image Gallery (50% Width) */}
            <Box sx={{ width: '50%', flexShrink: 0 }}>
              <Box sx={{ display: 'flex', gap: { xs: 1, md: 2 }, flexDirection: { xs: 'column', sm: 'row' } }}>
                {/* Thumbnail Images */}
                <Box sx={{
                  display: { xs: 'flex', sm: 'flex' },
                  flexDirection: { xs: 'row', sm: 'column' },
                  gap: 1,
                  maxHeight: { xs: 60, sm: 500 },
                  overflowX: { xs: 'auto', sm: 'visible' },
                  overflowY: { xs: 'visible', sm: 'auto' },
                  pr: { sm: 1 },
                  mb: { xs: 1, sm: 0 },
                  order: { xs: 2, sm: 1 }
                }}>
                  {images.slice(0, 4).map((image, index) => (
                    <Box
                      key={index}
                      onClick={() => setSelectedImage(image)}
                      sx={{
                        width: { xs: 50, sm: 70 },
                        height: { xs: 50, sm: 70 },
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

                {/* Main Image */}
                <Box
                  sx={{
                    flex: 1,
                    position: 'relative',
                    height: { xs: 250, sm: 400, md: 500 },
                    border: '1px solid #E0E0E0',
                    borderRadius: 1,
                    overflow: 'hidden',
                    backgroundColor: '#F5F5F5',
                    order: { xs: 1, sm: 2 }
                  }}
                >
                  <img
                    src={selectedImage}
                    alt={product.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      padding: '10px'
                    }}
                  />
                </Box>
              </Box>
            </Box>

            {/* Right Side: Product Info (50% Width) */}
            <Box sx={{ width: '50%', flexShrink: 0 }}>
              <Box>
                {/* Brand/Category */}
                <Typography variant="body2" sx={{ color: 'primary.main', mb: 0.5, textTransform: 'uppercase', fontSize: { xs: '0.6rem', md: '0.813rem' } }}>
                  {product.category?.name}
                </Typography>

                {/* Product Name */}
                <Typography variant="h4" sx={{ fontWeight: 500, mb: 1, fontSize: { xs: '1rem', sm: '1.5rem', md: '1.75rem' } }}>
                  {product.name}
                </Typography>

                {/* Rating & Reviews */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  <Rating value={parseFloat(product.rating)} precision={0.5} readOnly size="small" />
                  <Typography variant="body2" sx={{ color: 'primary.main', cursor: 'pointer', fontSize: { xs: '0.7rem', md: '0.875rem' } }}>
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
                    <Typography variant="h4" sx={{ color: '#B12704', fontWeight: 500, fontSize: { xs: '1.25rem', md: '2rem' } }}>
                      ₹{effectivePrice}
                    </Typography>
                    {hasDiscount && (
                      <Typography variant="body1" sx={{ textDecoration: 'line-through', color: '#999', fontSize: { xs: '0.9rem', md: '1.1rem' } }}>
                        ₹{product.price}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' } }}>
                      {product.size}
                    </Typography>
                  </Box>
                  {hasDiscount && (
                    <Typography variant="body2" sx={{ color: '#28a745', fontWeight: 600, mb: 0.5 }}>
                      Save {Math.round((1 - product.discount_price / product.price) * 100)}%
                    </Typography>
                  )}
                  {/* Real stock status */}
                  {isInStock ? (
                    <Typography variant="body2" color="success.main" sx={{ fontWeight: 500, fontSize: { xs: '0.7rem', md: '0.875rem' } }}>
                      In Stock {availableQty <= 5 && availableQty > 0 ? `(Only ${availableQty} left)` : ''}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="error.main" sx={{ fontWeight: 500, fontSize: { xs: '0.7rem', md: '0.875rem' } }}>
                      Out of Stock
                    </Typography>
                  )}
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
                      <IconButton size="small" onClick={() => handleQuantityChange(-1)} disabled={!isInStock} sx={{ borderRadius: 0 }}>
                        <Remove fontSize="small" />
                      </IconButton>
                      <Typography sx={{ px: 2, minWidth: 40, textAlign: 'center', fontWeight: 500 }}>
                        {quantity}
                      </Typography>
                      <IconButton size="small" onClick={() => handleQuantityChange(1)} disabled={!isInStock || quantity >= availableQty} sx={{ borderRadius: 0 }}>
                        <Add fontSize="small" />
                      </IconButton>
                    </Box>
                    {isInStock && availableQty <= 10 && (
                      <Typography variant="caption" color="text.secondary">
                        Max: {availableQty}
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Button
                      variant="contained"
                      fullWidth
                      size="large"
                      onClick={handleBuyNow}
                      disabled={!isInStock}
                      sx={{
                        backgroundColor: '#FF9900',
                        '&:hover': { backgroundColor: '#FA8900' },
                        textTransform: 'none',
                        fontSize: '1rem',
                        fontWeight: 600,
                        '&.Mui-disabled': { backgroundColor: '#ccc' }
                      }}
                    >
                      {isInStock ? 'Buy Now' : 'Out of Stock'}
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

                  <Button
                    variant="outlined"
                    fullWidth
                    size="large"
                    onClick={handleAddToCart}
                    disabled={!isInStock}
                    sx={{
                      borderColor: '#C9A96E',
                      color: '#C9A96E',
                      '&:hover': {
                        borderColor: '#B08D55',
                        backgroundColor: 'rgba(201, 169, 110, 0.05)'
                      },
                      textTransform: 'none',
                      fontSize: '1rem'
                    }}
                  >
                    Add to Cart
                  </Button>
                </Box>

                {/* Cash on Delivery Badge */}
                <Box sx={{
                  backgroundColor: '#E7F6E7',
                  p: 1.5,
                  borderRadius: 1,
                  mb: 2,
                  border: '1px solid #4CAF50'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AttachMoney sx={{ color: '#4CAF50', fontSize: 20 }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#2E7D32' }}>
                      Cash on Delivery Available
                    </Typography>
                  </Box>
                </Box>

                {/* Amazon Link - from model field */}
                {product.amazon_link && (
                  <Button
                    variant="outlined"
                    fullWidth
                    size="large"
                    href={product.amazon_link}
                    target="_blank"
                    sx={{
                      mb: 2,
                      borderColor: '#C9A96E',
                      color: '#C9A96E',
                      '&:hover': { borderColor: '#B08D55', color: '#B08D55', backgroundColor: 'rgba(201, 169, 110, 0.05)' },
                      textTransform: 'none',
                      fontSize: '1rem'
                    }}
                  >
                    Buy on Amazon
                  </Button>
                )}

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
            </Box>
          </Box>
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
          <Alert severity={snackbarSeverity} sx={{ width: '100%' }}>
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </Container >
    </Box >
  );
};

export default ProductDetail;