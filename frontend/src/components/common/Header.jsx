import React from 'react';
import { AppBar, Toolbar, Typography, Box, Button, Link as MuiLink } from '@mui/material';
import { Link } from 'react-router-dom';

const Header = () => {
  return (
    <AppBar position="sticky" sx={{ backgroundColor: '#000000', color: '#ffffff' }} elevation={0}>
      <Toolbar sx={{ justifyContent: 'space-between', py: 1 }}>
        <Typography
          variant="h5"
          component={Link}
          to="/"
          sx={{
            fontWeight: 700,
            textDecoration: 'none',
            color: 'inherit'
          }}
        >
          Le foyeR.
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <MuiLink component={Link} to="/products" color="inherit" underline="hover" sx={{ fontWeight: 500 }}>
            Products
          </MuiLink>
          <MuiLink component={Link} to="/about" color="inherit" underline="hover" sx={{ fontWeight: 500 }}>
            About
          </MuiLink>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <MuiLink component={Link} to="/login" color="inherit" underline="hover" sx={{ fontWeight: 500 }}>
            Sign In
          </MuiLink>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;