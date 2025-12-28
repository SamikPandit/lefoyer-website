import React, { useState } from 'react';
import { Container, Box, Typography, TextField, Button, Grid, Link as MuiLink, CircularProgress, Alert, FormControlLabel, Checkbox } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { registerUser } from '../services/api';

const SignUp = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    phone_number: '',
    agreeToTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value, checked, type } = event.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!formData.agreeToTerms) {
      setError('You must agree to the terms and conditions.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await registerUser({
        email: formData.email,
        password: formData.password,
        phone_number: formData.phone_number,
      });
      setSuccess('Registration successful! Please log in.');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      if (err.response && err.response.data) {
        // Handle specific field errors
        if (err.response.data.email) {
          setError(err.response.data.email[0]);
        } else if (err.response.data.detail) {
          setError(err.response.data.detail);
        } else {
          // Fallback for other errors
          const firstError = Object.values(err.response.data)[0];
          if (Array.isArray(firstError)) {
            setError(firstError[0]);
          } else {
            setError('Failed to register. Please try again.');
          }
        }
      } else {
        setError('Failed to register. Please try again.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography component="h1" variant="h4" sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700 }}>
          Sign up
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 3 }}>
          {error && <Alert severity="error" sx={{ width: '100%', mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ width: '100%', mb: 2 }}>{success}</Alert>}
          <Grid container spacing={2}>
            <Grid xs={12}>
              <TextField
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
              />
            </Grid>
            <Grid xs={12}>
              <TextField
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete="new-password"
                value={formData.password}
                onChange={handleChange}
              />
            </Grid>
            <Grid xs={12}>
              <TextField
                required
                fullWidth
                name="confirmPassword"
                label="Confirm Password"
                type="password"
                id="confirmPassword"
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={handleChange}
              />
            </Grid>
            <Grid xs={12}>
              <TextField
                fullWidth
                id="phone_number"
                label="Phone Number (Optional)"
                name="phone_number"
                autoComplete="tel"
                value={formData.phone_number}
                onChange={handleChange}
              />
            </Grid>
            <Grid xs={12}>
              <FormControlLabel
                control={<Checkbox name="agreeToTerms" checked={formData.agreeToTerms} onChange={handleChange} color="primary" />}
                label={
                  <Typography variant="body2">
                    I agree to the <MuiLink component={RouterLink} to="/terms" target="_blank">Terms & Conditions</MuiLink>
                  </Typography>
                }
              />
            </Grid>
          </Grid>
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{ mt: 3, mb: 2, py: 1.5, borderRadius: '25px' }}
          >
            {loading ? <CircularProgress size={24} /> : 'Sign Up'}
          </Button>
          <Grid container justifyContent="flex-end">
            <Grid>
              <MuiLink component={RouterLink} to="/login" variant="body2">
                Already have an account? Sign in
              </MuiLink>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </Container>
  );
};

export default SignUp;