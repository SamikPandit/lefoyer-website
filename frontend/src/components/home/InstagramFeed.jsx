import React from 'react';
import { Box, Typography, Grid, Paper, Button } from '@mui/material';
import InstagramIcon from '@mui/icons-material/Instagram';

const instagramPosts = [
  { id: 1, image: 'https://source.unsplash.com/random/300x300?skincare-instagram1' },
  { id: 2, image: 'https://source.unsplash.com/random/300x300?skincare-instagram2' },
  { id: 3, image: 'https://source.unsplash.com/random/300x300?skincare-instagram3' },
  { id: 4, image: 'https://source.unsplash.com/random/300x300?skincare-instagram4' },
  { id: 5, image: 'https://source.unsplash.com/random/300x300?skincare-instagram5' },
  { id: 6, image: 'https://source.unsplash.com/random/300x300?skincare-instagram6' },
];

const InstagramFeed = () => {
  return (
    <Box sx={{ my: 8, py: 4, backgroundColor: '#f8f8f8', textAlign: 'center' }}>
      <Typography variant="h4" component="h2" gutterBottom sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, mb: 2 }}>
        #LeFoyerBeauty
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 5 }}>
        Follow us on Instagram for daily inspiration and updates.
      </Typography>
      <Grid container spacing={2} justifyContent="center">
        {instagramPosts.map((post) => (
          <Grid xs={6} sm={4} md={2} key={post.id}>
            <Paper 
              elevation={0}
              sx={{
                borderRadius: 2,
                overflow: 'hidden',
                position: 'relative',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  opacity: 0,
                  transition: 'opacity 0.3s ease-in-out',
                },
                '&:hover::before': {
                  opacity: 1,
                },
                '&:hover .instagram-icon': {
                  opacity: 1,
                },
              }}
            >
              <img 
                src={post.image} 
                alt="Instagram Post" 
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
              <InstagramIcon 
                className="instagram-icon"
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: 50,
                  color: 'white',
                  opacity: 0,
                  transition: 'opacity 0.3s ease-in-out',
                  zIndex: 1,
                }}
              />
            </Paper>
          </Grid>
        ))}
      </Grid>
      <Button 
        variant="contained" 
        color="primary" 
        startIcon={<InstagramIcon />} 
        sx={{ mt: 5, borderRadius: '25px', px: 4, py: 1.5 }}
        href="https://instagram.com/lefoyerglobal" 
        target="_blank"
      >
        Follow on Instagram
      </Button>
    </Box>
  );
};

export default InstagramFeed;
