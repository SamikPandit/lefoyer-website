import React, { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Box, IconButton, Badge, Drawer, List, ListItem, ListItemText, useScrollTrigger, Slide, Container } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import SearchIcon from '@mui/icons-material/Search';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { cart } = useCart();
  const { isAuthenticated } = useAuth();
  const isHome = location.pathname === '/';

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const navLinks = [
    { title: 'Products', path: '/products' },
    { title: 'About', path: '/about' },
  ];

  return (
    <>
      <AppBar
        position="fixed"
        sx={{
          backgroundColor: isScrolled ? 'rgba(26, 26, 26, 0.95)' : 'transparent', // Dark background on scroll
          backdropFilter: isScrolled ? 'blur(12px)' : 'none',
          borderBottom: isScrolled ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
          transition: 'all 0.3s ease',
          boxShadow: 'none',
          py: 1,
          color: isScrolled || !isHome ? 'white' : 'white', // Always white text for dark theme
        }}
      >
        <Container maxWidth="xl">
          <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 1, md: 2 } }}>

            {/* Mobile Menu Icon - Left */}
            <Box sx={{ display: { xs: 'flex', md: 'none' }, flex: 1, justifyContent: 'flex-start' }}>
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ color: 'text.primary' }}
              >
                <MenuIcon />
              </IconButton>
            </Box>

            {/* Desktop Left Links */}
            <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 4, flex: 1 }}>
              {navLinks.map((link) => (
                <Typography
                  key={link.title}
                  component={Link}
                  to={link.path}
                  variant="button"
                  sx={{
                    textDecoration: 'none',
                    color: 'inherit', // Inherit from parent (which is set to white)
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    letterSpacing: '0.1em',
                    position: 'relative',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      width: '0%',
                      height: '1px',
                      bottom: -4,
                      left: 0,
                      backgroundColor: 'primary.main',
                      transition: 'width 0.3s ease',
                    },
                    '&:hover::after': {
                      width: '100%',
                    },
                  }}
                >
                  {link.title}
                </Typography>
              ))}
            </Box>

            {/* Logo - Center */}
            <Typography
              variant="h4"
              component={Link}
              to="/"
              sx={{
                flex: 1,
                textAlign: 'center',
                textDecoration: 'none',
                color: 'inherit',
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 600,
                letterSpacing: '0.05em',
                fontSize: { xs: '1.75rem', md: '2.5rem' },
                whiteSpace: 'nowrap',
              }}
            >
              LE FOYER
            </Typography>

            {/* Right Icons */}
            <Box sx={{ display: 'flex', gap: { xs: 0.5, md: 2 }, flex: 1, justifyContent: 'flex-end' }}>
              <IconButton sx={{ color: 'inherit' }}>
                <SearchIcon />
              </IconButton>
              <IconButton component={Link} to={isAuthenticated ? "/profile" : "/login"} sx={{ color: 'inherit', display: { xs: 'none', sm: 'flex' } }}>
                <PersonOutlineIcon />
              </IconButton>
              <IconButton component={Link} to="/cart" sx={{ color: 'inherit' }}>
                <Badge badgeContent={cart?.count || 0} color="primary" sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: 16, minWidth: 16 } }}>
                  <ShoppingBagOutlinedIcon />
                </Badge>
              </IconButton>
            </Box>

          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        anchor="left"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 280, backgroundColor: '#FDFBF9' },
        }}
      >
        <Box sx={{ p: 4, display: 'flex', justifyContent: 'flex-end' }}>
          <IconButton onClick={handleDrawerToggle}>
            <CloseIcon />
          </IconButton>
        </Box>
        <List sx={{ px: 2 }}>
          {navLinks.map((link) => (
            <ListItem key={link.title} disablePadding sx={{ mb: 2 }}>
              <Typography
                component={Link}
                to={link.path}
                onClick={handleDrawerToggle}
                variant="h5"
                sx={{
                  textDecoration: 'none',
                  color: 'text.primary',
                  fontFamily: "'Cormorant Garamond', serif",
                }}
              >
                {link.title}
              </Typography>
            </ListItem>
          ))}
          <ListItem disablePadding sx={{ mt: 4 }}>
            <Typography
              component={Link}
              to="/login"
              onClick={handleDrawerToggle}
              variant="body1"
              sx={{ textDecoration: 'none', color: 'text.secondary' }}
            >
              Sign In
            </Typography>
          </ListItem>
        </List>
      </Drawer>
    </>
  );
};

export default Navbar;
