import React from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { Link } from 'react-router-dom';

const Hero = () => {
  return (
    <Box sx={{
      position: 'relative',
      backgroundColor: '#fff', // White background as per reference
      color: 'text.primary',
      py: { xs: 8, md: 12 },
      textAlign: 'center',
      overflow: 'hidden'
    }}>
      <Container maxWidth="lg">
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: '900px',
          mx: 'auto'
        }}>
          <Typography variant="h1" sx={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: { xs: '2.5rem', md: '4.5rem' },
            lineHeight: 1.1,
            letterSpacing: '0.02em',
            mb: 3,
            textTransform: 'uppercase',
            color: '#1a1a1a'
          }}>
            India's First<br />
            <Box component="span" sx={{ color: '#C9A96E' }}>Luxury Family Skincare</Box>
          </Typography>

          <Typography variant="h6" sx={{
            mb: 5,
            fontWeight: 400,
            color: 'text.secondary',
            fontSize: { xs: '1rem', md: '1.25rem' },
            maxWidth: '600px',
            lineHeight: 1.6
          }}>
            Exclusively made in India. Nature meets modern science to create a sanctuary for your skin. No fuss, just results.
          </Typography>

          {/* Optional: Add a subtle decorative element or button if needed, 
              but the reference image is very clean. We can keep the button for conversion. */}
          {/* 
          <Button
            component={Link}
            to="/products"
            variant="outlined"
            size="large"
            sx={{
              borderColor: '#C9A96E',
              color: '#C9A96E',
              px: 5,
              py: 1.5,
              borderRadius: 0,
              '&:hover': {
                borderColor: '#B08D55',
                color: '#B08D55',
                backgroundColor: 'rgba(201, 169, 110, 0.05)'
              }
            }}
          >
            Discover More
          </Button>
          */}
        </Box>
      </Container>
    </Box>
  );
};

export default Hero;