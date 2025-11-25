import React from 'react';
import { Grid, Card, CardActionArea, Box, Typography, Container } from '@mui/material';
import { Link } from 'react-router-dom';

const categories = [
  {
    name: 'Skincare',
    subtitle: 'Radiant Complexion',
    image: 'https://images.unsplash.com/photo-1556228852-6d45a7ae2c43?q=80&w=1887',
    link: '/products?category=skincare',
    description: 'Nourish & protect',
  },
  {
    name: 'Haircare',
    subtitle: 'Lustrous Locks',
    image: 'https://images.unsplash.com/photo-1629198735660-e39ea93f5a87?q=80&w=1887',
    link: '/products?category=haircare',
    description: 'Strengthen & shine',
  },
  {
    name: 'Body Care',
    subtitle: 'Total Wellness',
    image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=1887',
    link: '/products?category=body-care',
    description: 'Hydrate & revitalize',
  },
];

const ProductCategories = () => {
  return (
    <Box sx={{ py: { xs: 5, md: 6 }, backgroundColor: 'background.default' }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 600, letterSpacing: '0.15em', fontSize: '0.688rem' }}>
            Discover
          </Typography>
          <Typography variant="h3" sx={{ fontSize: { xs: '1.5rem', md: '2rem' }, fontWeight: 400, color: 'text.primary', mt: 0.5, mb: 0.75 }}>
            Shop by Category
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '550px', mx: 'auto', fontSize: '0.875rem' }}>
            Curated collections for your complete beauty ritual
          </Typography>
        </Box>

        <Grid container spacing={2}>
          {categories.map((category) => (
            <Grid item xs={12} md={4} key={category.name}>
              <Card
                sx={{
                  height: '320px',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: 'none',
                  border: '1px solid',
                  borderColor: 'grey.200',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
                    '& .category-image': { transform: 'scale(1.03)' },
                    '& .category-overlay': { opacity: 0.95 },
                  },
                }}
              >
                <CardActionArea component={Link} to={category.link} sx={{ height: '100%' }}>
                  <Box
                    component="img"
                    src={category.image}
                    alt={category.name}
                    className="category-image"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'transform 0.3s ease',
                    }}
                  />

                  <Box
                    className="category-overlay"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
                      opacity: 0.85,
                      transition: 'opacity 0.2s ease',
                    }}
                  />

                  <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 2.5, color: 'white' }}>
                    <Typography variant="caption" sx={{ mb: 0.25, display: 'block', fontSize: '0.688rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      {category.subtitle}
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 400, mb: 0.25, fontSize: '1.5rem' }}>
                      {category.name}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.813rem', opacity: 0.9 }}>
                      {category.description}
                    </Typography>
                  </Box>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default ProductCategories;