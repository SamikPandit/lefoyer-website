import React from 'react';
import { Box, Typography, Button, Grid, Container } from '@mui/material';
import { Link } from 'react-router-dom';

const Hero = () => {
  return (
    <Box sx={{
      position: 'relative',
      backgroundColor: '#1a1a1a',
      color: 'white',
      overflow: 'hidden',
      minHeight: '90vh',
      display: 'flex',
      alignItems: 'center'
    }}>
      <Container maxWidth="xl" sx={{ height: '100%' }}>
        <Grid container spacing={0} sx={{ height: '100%', alignItems: 'center' }}>

          {/* Left Product Image */}
          <Grid item xs={12} md={4} sx={{
            height: { xs: '40vh', md: '80vh' },
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            zIndex: 1
          }}>
            <Box
              component="img"
              src="/images/products/Spotless_6.png"
              alt="Le Foyer Product"
              sx={{
                maxHeight: '80%',
                maxWidth: '100%',
                objectFit: 'contain',
                filter: 'drop-shadow(0px 20px 30px rgba(0,0,0,0.5))',
                transform: 'rotate(-5deg)',
                transition: 'transform 0.5s ease',
                '&:hover': { transform: 'rotate(0deg) scale(1.05)' }
              }}
            />
          </Grid>

          {/* Center Text Content */}
          <Grid item xs={12} md={4} sx={{
            textAlign: 'center',
            zIndex: 2,
            py: { xs: 4, md: 0 }
          }}>
            <Typography variant="h1" sx={{
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 700,
              fontSize: { xs: '3rem', md: '5rem' },
              lineHeight: 0.9,
              letterSpacing: '0.02em',
              mb: 2,
              textTransform: 'uppercase',
              color: '#FDFBF9'
            }}>
              Don't Chase<br />
              <Box component="span" sx={{ color: '#C9A96E' }}>Perfection.</Box><br />
              Define It.
            </Typography>

            <Typography variant="h6" sx={{
              mb: 4,
              fontWeight: 300,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              opacity: 0.9
            }}>
              Navigate Towards Elegance
            </Typography>

            <Button
              component={Link}
              to="/products"
              variant="contained"
              size="large"
              sx={{
                backgroundColor: '#C9A96E',
                color: '#fff',
                px: 6,
                py: 1.5,
                fontSize: '1.1rem',
                borderRadius: 0,
                letterSpacing: '0.1em',
                '&:hover': {
                  backgroundColor: '#B08D55',
                  transform: 'translateY(-2px)'
                },
                transition: 'all 0.3s ease'
              }}
            >
              Shop Collection
            </Button>
          </Grid>

          {/* Right Product Image */}
          <Grid item xs={12} md={4} sx={{
            height: { xs: '40vh', md: '80vh' },
            display: { xs: 'none', md: 'flex' },
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            zIndex: 1
          }}>
            <Box
              component="img"
              src="/images/products/WhiteWave_8.png"
              alt="Le Foyer Collection"
              sx={{
                maxHeight: '80%',
                maxWidth: '100%',
                objectFit: 'contain',
                filter: 'drop-shadow(0px 20px 30px rgba(0,0,0,0.5))',
                transform: 'rotate(5deg)',
                transition: 'transform 0.5s ease',
                '&:hover': { transform: 'rotate(0deg) scale(1.05)' }
              }}
            />
          </Grid>
        </Grid>
      </Container>

      {/* Background Elements */}
      <Box sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at center, rgba(60,60,60,1) 0%, rgba(26,26,26,1) 100%)',
        zIndex: 0
      }} />
    </Box>
  );
};

export default Hero;