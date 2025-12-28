import React from 'react';
import Hero from '../components/home/Hero';
import FeaturedProducts from '../components/home/FeaturedProducts';
import ProductCategories from '../components/home/ProductCategories';
import ShopByConcern from '../components/home/ShopByConcern';
import Benefits from '../components/home/Benefits';
import CustomerTestimonials from '../components/home/CustomerTestimonials';
import NewsletterSignup from '../components/home/NewsletterSignup';

import NewYearBanner from '../components/home/NewYearBanner';

const Home = () => {
  return (
    <>
      <Hero />
      <FeaturedProducts />
      <NewYearBanner />
      <Benefits />
      <CustomerTestimonials />
      <NewsletterSignup />
    </>
  );
};

export default Home;