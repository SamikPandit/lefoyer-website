import React from 'react';
import { Box, Container, Typography } from '@mui/material';
import Hero from '../components/home/Hero';
import FeaturedProducts from '../components/home/FeaturedProducts';
import ProductCategories from '../components/home/ProductCategories';
import Benefits from '../components/home/Benefits';
import CustomerTestimonials from '../components/home/CustomerTestimonials';
import NewsletterSignup from '../components/home/NewsletterSignup';
import InstagramFeed from '../components/home/InstagramFeed';

const Home = () => {
  return (
    <Box>
      <Hero />
      <Container maxWidth="lg" sx={{ py: 6 }}>
        {/* Featured Products Section */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" component="h2" gutterBottom sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700 }}>
            Featured Products
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Discover our most loved products.
          </Typography>
        </Box>
        <FeaturedProducts />

        {/* Categories Section */}
        <Box sx={{ textAlign: 'center', my: 6 }}>
          <Typography variant="h4" component="h2" gutterBottom sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700 }}>
            Shop by Category
          </Typography>
        </Box>
        <ProductCategories />

        {/* Benefits/USP Section */}
        <Box sx={{ textAlign: 'center', my: 6 }}>
          <Typography variant="h4" component="h2" gutterBottom sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700 }}>
            Why Le Foyer?
          </Typography>
        </Box>
        <Benefits />

        {/* Customer Testimonials Section */}
        <CustomerTestimonials />
      </Container>
      {/* Newsletter Signup Section */}
      <NewsletterSignup />
      {/* Instagram Feed Section */}
      <InstagramFeed />
    </Box>
  );
};

export default Home;
