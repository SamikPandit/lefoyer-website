import React from 'react';
import { Grid, Card, CardActionArea, CardMedia, CardContent, Typography, Box } from '@mui/material';
import { Link } from 'react-router-dom';

const categories = [
  {
    name: 'Skincare',
    image: 'https://source.unsplash.com/random/400x400?skincare-products',
    link: '/products?category=skincare',
  },
  {
    name: 'Haircare',
    image: 'https://source.unsplash.com/random/400x400?hair-products',
    link: '/products?category=haircare',
  },
  {
    name: 'Body & Lip Care',
    image: 'https://source.unsplash.com/random/400x400?body-lotion',
    link: '/products?category=body-lip-care',
  },
];

const ProductCategories = () => {
  return (
    <Box sx={{ my: 6 }}>
      <Grid container spacing={4}>
        {categories.map((category) => (
          <Grid xs={12} sm={4} key={category.name}>
            <Card sx={{ borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
              <CardActionArea component={Link} to={category.link}>
                <CardMedia
                  component="img"
                  height="300"
                  image={category.image}
                  alt={category.name}
                  sx={{ 
                    transition: 'transform 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'scale(1.05)',
                    },
                  }}
                />
                <CardContent 
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    color: 'white',
                    py: 2,
                  }}
                >
                  <Typography variant="h5" component="div" sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 600 }}>
                    {category.name}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default ProductCategories;
