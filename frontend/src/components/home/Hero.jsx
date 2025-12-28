import React from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { Link } from 'react-router-dom';

const Hero = () => {
  return (
    <Box sx={{
      position: 'relative',
      backgroundColor: '#1a1a1a',
      color: 'white',
      overflow: 'hidden',
      height: '90vh', // Fixed height
      width: '100vw', // Full viewport width
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>

      {/* Main Content Container - Flexbox Row */}
      <Box sx={{
        display: 'flex',
        width: '100%',
        height: '100%',
        maxWidth: '1800px', // Max width constraint
        mx: 'auto',
        alignItems: 'center'
      }}>

        {/* Left Column - Image */}
        <Box sx={{
          width: '33.33%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
          overflow: 'hidden'
        }}>
          <Box
            component="img"
            src="/images/products/Spotless_6.png"
            alt="Le Foyer Product"
            sx={{
              maxWidth: '90%', // Leave some breathing room
              maxHeight: '80%',
              objectFit: 'contain',
              filter: 'drop-shadow(0px 20px 30px rgba(0,0,0,0.5))',
              transform: 'rotate(-5deg)',
              transition: 'transform 0.5s ease',
              '&:hover': { transform: 'rotate(0deg) scale(1.05)' }
            }}
          />
        </Box>

        {/* Center Column - Text */}
        <Box sx={{
          width: '33.33%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          zIndex: 2,
          px: 2
        }}>
          <Typography variant="h1" sx={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: 'clamp(2rem, 5vw, 6rem)', // Fluid typography
            lineHeight: 0.9,
            letterSpacing: '0.02em',
            mb: 2,
            textTransform: 'uppercase',
            color: '#FDFBF9',
            whiteSpace: 'nowrap'
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
            opacity: 0.9,
            fontSize: 'clamp(0.8rem, 1.5vw, 1.5rem)'
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
              fontSize: 'clamp(0.8rem, 1.2vw, 1.2rem)',
              borderRadius: 0,
              letterSpacing: '0.1em',
              whiteSpace: 'nowrap',
              '&:hover': {
                backgroundColor: '#B08D55',
                transform: 'translateY(-2px)'
              },
              transition: 'all 0.3s ease'
            }}
          >
            Shop Collection
          </Button>
        </Box>

        {/* Right Column - Image */}
        <Box sx={{
          width: '33.33%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
          overflow: 'hidden'
        }}>
          <Box
            component="img"
            src="/images/products/WhiteWave_8.png"
            alt="Le Foyer Collection"
            sx={{
              maxWidth: '90%',
              maxHeight: '80%',
              objectFit: 'contain',
              filter: 'drop-shadow(0px 20px 30px rgba(0,0,0,0.5))',
              transform: 'rotate(5deg)',
              transition: 'transform 0.5s ease',
              '&:hover': { transform: 'rotate(0deg) scale(1.05)' }
            }}
          />
        </Box>

      </Box>

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