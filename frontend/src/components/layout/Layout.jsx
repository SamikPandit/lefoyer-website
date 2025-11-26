import React from 'react';
import { Box, Toolbar } from '@mui/material';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from '../common/Footer';

const Layout = ({ children }) => {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      {/* Add Toolbar spacer for non-home pages to prevent content from being hidden behind fixed Navbar */}
      {!isHome && <Toolbar />}
      <Box component="main" sx={{ flexGrow: 1 }}>
        {children}
      </Box>
      <Footer />
    </Box>
  );
};

export default Layout;
