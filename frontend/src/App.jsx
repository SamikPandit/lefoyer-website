import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import Home from './pages/Home';
import ProductListing from './pages/ProductListing';
import ProductDetail from './pages/ProductDetail';
import Search from './pages/Search';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Wishlist from './pages/Wishlist';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Profile from './pages/Profile';
import About from './pages/About';
import Contact from './pages/Contact';
import ShippingPolicy from './pages/ShippingPolicy';
import TermsAndConditions from './pages/TermsAndConditions';
import PrivacyPolicy from './pages/PrivacyPolicy';
import FAQ from './pages/FAQ';
import NotFound from './pages/NotFound';

import Layout from './components/layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/common/ScrollToTop';
import LegacyHashRedirect from './components/common/LegacyHashRedirect';
import { AuthProvider } from './context/AuthContext';
import { WishlistProvider } from './context/WishlistContext';
import { CartProvider } from './context/CartContext';
import { usePageViewTracking } from './services/analytics';

/* ============================================================================
 * ErrorBoundary
 * A render error used to blank the whole document. Two instances are mounted:
 * one outside the Router (a provider or the router itself throwing) and one
 * around <Routes>, keyed on the pathname so navigating away clears it and the
 * shell survives a single bad page.
 * ========================================================================== */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // No analytics event: §2g defines the event list and does not include one.
    console.error('[LeFoyer] Unhandled render error', error, info?.componentStack);
  }

  handleReload() {
    window.location.reload();
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <Box
        role="alert"
        sx={{
          minHeight: '60dvh',
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--lf-canvas)',
          py: 8,
        }}
      >
        <Container maxWidth="sm">
          <Stack spacing={2} alignItems="flex-start">
            <Typography variant="h3" component="h1">
              This page didn&apos;t load
            </Typography>
            <Typography variant="body1" sx={{ color: 'var(--lf-ink-2)' }}>
              Something went wrong on our side. Your cart and your account are
              untouched — reloading usually fixes it.
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{ width: { xs: '100%', sm: 'auto' }, pt: 1 }}
            >
              <Button onClick={this.handleReload}>Reload the page</Button>
              <Button variant="outlined" href="/">
                Go to the homepage
              </Button>
            </Stack>
            {import.meta.env.DEV && (
              <Typography
                component="pre"
                variant="caption"
                sx={{
                  mt: 2,
                  p: 2,
                  width: '100%',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  backgroundColor: 'var(--lf-mat)',
                  borderRadius: 'var(--lf-r-field)',
                  color: 'var(--lf-err-ink)',
                }}
              >
                {String(error?.stack || error)}
              </Typography>
            )}
          </Stack>
        </Container>
      </Box>
    );
  }
}

/* The §2g PageView hook has to sit inside the Router to see location changes. */
function RouteAnalytics() {
  usePageViewTracking();
  return null;
}

function AppRoutes() {
  const location = useLocation();

  return (
    <ErrorBoundary key={location.pathname}>
      <Routes>
        {/* --- Catalogue --- */}
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<ProductListing />} />
        <Route path="/product/:slug" element={<ProductDetail />} />
        <Route path="/search" element={<Search />} />

        {/* --- Account / auth --- */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wishlist"
          element={
            <ProtectedRoute>
              <Wishlist />
            </ProtectedRoute>
          }
        />

        {/* --- Purchase --- */}
        <Route path="/cart" element={<Cart />} />
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          }
        />
        <Route
          path="/order-confirmation/:id"
          element={
            <ProtectedRoute>
              <OrderConfirmation />
            </ProtectedRoute>
          }
        />
        {/* Kept: the id-less form is what the pre-switch build navigated to and
            what already exists in customers' history and inboxes. */}
        <Route
          path="/order-confirmation"
          element={
            <ProtectedRoute>
              <OrderConfirmation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <ProtectedRoute>
              <OrderDetail />
            </ProtectedRoute>
          }
        />

        {/* --- Content / support --- */}
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/shipping-returns" element={<ShippingPolicy />} />
        <Route path="/terms" element={<TermsAndConditions />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/faq" element={<FAQ />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <HelmetProvider>
      <ErrorBoundary>
        <AuthProvider>
          <WishlistProvider>
            <CartProvider>
              <Router>
                <LegacyHashRedirect />
                <ScrollToTop />
                <RouteAnalytics />
                <Layout>
                  <AppRoutes />
                </Layout>
              </Router>
            </CartProvider>
          </WishlistProvider>
        </AuthProvider>
      </ErrorBoundary>
    </HelmetProvider>
  );
}

export default App;
