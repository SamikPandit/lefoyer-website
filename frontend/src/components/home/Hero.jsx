import React from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { Link } from 'react-router-dom';

const Hero = () => {
  return (
    <Box
      sx={{
        position: 'relative',
        height: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#4E4E4E',
        textAlign: 'center',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'url(https://source.unsplash.com/random/1600x900?skincare-products)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'brightness(0.8)',
          zIndex: -1,
        },
      }}
    >
      <Container maxWidth="md">
        <Typography 
          variant="h2" 
          component="h1" 
          gutterBottom
          sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700 }}
        >
          Rejuvenate Your Natural Beauty
        </Typography>
        <Typography variant="h6" component="p" sx={{ mb: 4 }}>
          Gentle, effective formulations with natural-inspired ingredients suitable for all skin types.
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          size="large"
          component={Link}
          to="/products"
          sx={{ borderRadius: '25px', px: 5, py: 1.5 }}
        >
          Shop Now
        </Button>
      </Container>
    </Box>
  );
};

export default Hero;
