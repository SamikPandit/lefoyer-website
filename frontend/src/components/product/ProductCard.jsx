import React, { useState } from 'react';
import { Card, CardMedia, CardContent, Typography, Box, IconButton, Button, Rating, Chip, Snackbar, Alert } from '@mui/material';
import { useCart } from '../../context/CartContext';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import { Link } from 'react-router-dom';

const ProductCard = ({ product }) => {
  const [isHovered, setIsHovered] = useState(false);
  const { addToCart } = useCart();
  const [openSnackbar, setOpenSnackbar] = useState(false);

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const success = await addToCart(product, 1);
    // Optional: Add toast/snackbar here if needed, or rely on global notification
  };

  // Fallback if product is undefined or missing properties
  if (!product) return null;

  const {
    id,
    name,
    price,
    image_main,
    image_2,
    category,
    rating = 0,
    reviews_count = 0,
    is_new,
    coming_soon
  } = product;

  return (
    <Card
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'transparent',
        opacity: coming_soon ? 0.8 : 1,
        pointerEvents: coming_soon ? 'none' : 'auto',
      }}
    >
      {/* Image Container */}
      <Box sx={{ position: 'relative', paddingTop: '125%', overflow: 'hidden', bgcolor: '#F9F9F9' }}>

        {/* Coming Soon Overlay */}
        {coming_soon && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(255, 255, 255, 0.4)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <Chip
              label="COMING SOON"
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                fontWeight: 600,
                letterSpacing: '0.1em',
                borderRadius: 0,
              }}
            />
          </Box>
        )}

        {/* Badges */}
        {is_new && !coming_soon && (
          <Chip
            label="NEW"
            size="small"
            sx={{
              position: 'absolute',
              top: 12,
              left: 12,
              zIndex: 2,
              bgcolor: 'white',
              borderRadius: 0,
              fontSize: '0.7rem',
              height: 24
            }}
          />
        )}

        {/* Wishlist Button */}
        {!coming_soon && (
          <IconButton
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 2,
              bgcolor: 'rgba(255,255,255,0.8)',
              opacity: isHovered ? 1 : 0,
              transform: isHovered ? 'translateY(0)' : 'translateY(-10px)',
              transition: 'all 0.3s ease',
              '&:hover': { bgcolor: 'white' }
            }}
          >
            <FavoriteBorderIcon fontSize="small" />
          </IconButton>
        )}

        {/* Main Image */}
        <CardMedia
          component="img"
          image={image_main}
          alt={name}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'opacity 0.5s ease',
            opacity: isHovered && image_2 && !coming_soon ? 0 : 1,
            filter: coming_soon ? 'grayscale(0.5)' : 'none',
          }}
        />

        {/* Secondary Image (on hover) */}
        {image_2 && !coming_soon && (
          <CardMedia
            component="img"
            image={image_2}
            alt={name}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'opacity 0.5s ease',
              opacity: isHovered ? 1 : 0,
            }}
          />
        )}

        {/* Quick Add Button */}
        {!coming_soon && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              p: 2,
              transform: isHovered ? 'translateY(0)' : 'translateY(100%)',
              transition: 'transform 0.3s ease',
              zIndex: 2,
            }}
          >
            <Button
              variant="contained"
              fullWidth
              startIcon={<ShoppingBagOutlinedIcon />}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.95)',
                color: 'text.primary',
                backdropFilter: 'blur(4px)',
                '&:hover': {
                  bgcolor: 'primary.main',
                  color: 'white',
                }
              }}
              onClick={handleAddToCart}
            >
              Quick Add
            </Button>
          </Box>
        )}
      </Box>

      {/* Content */}
      <CardContent sx={{ px: 1, py: 2, flexGrow: 1 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mb: 0.5, letterSpacing: '0.05em' }}
        >
          {category?.name || 'Skincare'}
        </Typography>

        {coming_soon ? (
          <Typography
            variant="h6"
            sx={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '1.25rem',
              mb: 1,
              lineHeight: 1.2,
              color: 'text.secondary',
            }}
          >
            {name}
          </Typography>
        ) : (
          <Link to={`/product/${product.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <Typography
              variant="h6"
              sx={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '1.25rem',
                mb: 1,
                lineHeight: 1.2,
                '&:hover': { color: 'primary.main' }
              }}
            >
              {name}
            </Typography>
          </Link>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Rating value={Number(rating)} readOnly size="small" sx={{ fontSize: '0.9rem', color: '#C9A96E', opacity: coming_soon ? 0.5 : 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
            ({reviews_count})
          </Typography>
        </Box>

        <Typography variant="body1" fontWeight={500} color={coming_soon ? 'text.secondary' : 'text.primary'}>
          ₹{price}
        </Typography>
      </CardContent>
      <Snackbar
        open={openSnackbar}
        autoHideDuration={2000}
        onClose={() => setOpenSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          Added to cart
        </Alert>
      </Snackbar>
    </Card>
  );
};

export default ProductCard;