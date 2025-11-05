import React from 'react';
import { AppBar, Toolbar, Typography, IconButton, Box } from '@mui/material';
import { Search, PersonOutline, ShoppingCartOutlined } from '@mui/icons-material';
import { Link } from 'react-router-dom';

const Header = () => {
  return (
    <AppBar position="sticky" color="background" elevation={1}>
      <Toolbar>
        <Typography 
          variant="h4" 
          component={Link}
          to="/"
          sx={{ 
            flexGrow: 1, 
            fontFamily: 'Playfair Display, serif', 
            fontWeight: 700,
            textDecoration: 'none',
            color: 'text.primary'
          }}
        >
          Le Foyer
        </Typography>
        <Box>
          <IconButton color="inherit">
            <Search />
          </IconButton>
          <IconButton color="inherit" component={Link} to="/login">
            <PersonOutline />
          </IconButton>
          <IconButton color="inherit" component={Link} to="/cart">
            <ShoppingCartOutlined />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
