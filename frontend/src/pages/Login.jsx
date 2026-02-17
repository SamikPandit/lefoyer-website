import React, { useState } from 'react';
import { Container, Box, Typography, TextField, Button, Grid, Link as MuiLink, CircularProgress, Alert, FormControlLabel, Checkbox, Divider } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { resendVerification } from '../services/api';


const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setEmailNotVerified(false);
    setResendMessage('');

    try {
      // Send email as username for backend compatibility
      const result = await login({ username: email, password });
      if (result === true) {
        navigate('/');
      } else if (result && result.code === 'email_not_verified') {
        setEmailNotVerified(true);
        setError(result.detail || 'Please verify your email address before logging in.');
      } else {
        setError('Failed to login. Please check your credentials.');
      }
    } catch (err) {
      setError('Failed to login. Please check your credentials.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendMessage('');
    try {
      const response = await resendVerification(email);
      setResendMessage(response.data.detail || 'Verification email sent! Check your inbox.');
    } catch (err) {
      setResendMessage('Failed to resend verification email. Please try again.');
    } finally {
      setResendLoading(false);
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
          Sign in
        </Typography>

        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
          {error && (
            <Alert severity={emailNotVerified ? 'warning' : 'error'} sx={{ width: '100%', mb: 2 }}>
              {error}
              {emailNotVerified && (
                <Box sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleResendVerification}
                    disabled={resendLoading}
                    sx={{ borderRadius: '15px', textTransform: 'none' }}
                  >
                    {resendLoading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                    Resend Verification Email
                  </Button>
                </Box>
              )}
            </Alert>
          )}
          {resendMessage && (
            <Alert severity="info" sx={{ width: '100%', mb: 2 }}>
              {resendMessage}
            </Alert>
          )}
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <FormControlLabel
            control={<Checkbox value="remember" color="primary" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />}
            label="Remember me"
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{ mt: 3, mb: 2, py: 1.5, borderRadius: '25px' }}
          >
            {loading ? <CircularProgress size={24} /> : 'Sign In'}
          </Button>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: 'center', mt: 2, gap: 1 }}>
            <MuiLink component={RouterLink} to="/forgot-password" variant="body2" sx={{ textDecoration: 'none', color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
              Forgot password?
            </MuiLink>
            <MuiLink component={RouterLink} to="/signup" variant="body2" sx={{ textDecoration: 'none', color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
              Don't have an account? Sign Up
            </MuiLink>
          </Box>

        </Box>
      </Box>
    </Container>
  );
};

export default Login;