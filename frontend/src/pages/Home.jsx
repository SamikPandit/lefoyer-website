import React from 'react';
import Hero from '../components/home/Hero';
import FeaturedProducts from '../components/home/FeaturedProducts';
import ProductCategories from '../components/home/ProductCategories';
import ShopByConcern from '../components/home/ShopByConcern';
import Benefits from '../components/home/Benefits';
import CustomerTestimonials from '../components/home/CustomerTestimonials';
import NewsletterSignup from '../components/home/NewsletterSignup';

const Home = () => {
  return (
    <>
      <Hero />
      <FeaturedProducts />
      <Benefits />
      <CustomerTestimonials />
      <NewsletterSignup />
    </>
  );
};

export default Home;