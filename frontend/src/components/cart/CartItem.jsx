import React from 'react';
import { Box, Typography, IconButton, Grid, Paper } from '@mui/material';
import { Add, Remove, DeleteOutline } from '@mui/icons-material';
import { useCart } from '../../context/CartContext';
import { Link } from 'react-router-dom';

const CartItem = ({ item }) => {
  const { updateCartItem, removeCartItem } = useCart();

  const handleQuantityChange = (amount) => {
    updateCartItem(item.id, item.quantity + amount);
  };

  const handleRemoveItem = () => {
    removeCartItem(item.id);
  };

  return (
    <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid #eee', borderRadius: 2 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid xs={3}>
          <Link to={`/product/${item.product.slug}`}>
            <img 
              src={item.product.image_main || 'https://source.unsplash.com/random/100x100?beauty-product'}
              alt={item.product.name}
              style={{ width: '100%', height: 'auto', borderRadius: '8px' }}
            />
          </Link>
        </Grid>
        <Grid xs={5}>
          <Typography variant="h6" component={Link} to={`/product/${item.product.slug}`} sx={{ textDecoration: 'none', color: 'text.primary', fontWeight: 'bold' }}>
            {item.product.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ₹{item.product.price}
          </Typography>
        </Grid>
        <Grid xs={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #ccc', borderRadius: '20px', p: '2px' }}>
            <IconButton size="small" onClick={() => handleQuantityChange(-1)} disabled={item.quantity <= 1}>
              <Remove fontSize="small" />
            </IconButton>
            <Typography sx={{ px: 1, fontWeight: 'bold' }}>{item.quantity}</Typography>
            <IconButton size="small" onClick={() => handleQuantityChange(1)}>
              <Add fontSize="small" />
            </IconButton>
          </Box>
        </Grid>
        <Grid xs={1}>
          <IconButton color="error" onClick={handleRemoveItem}>
            <DeleteOutline />
          </IconButton>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default CartItem;
