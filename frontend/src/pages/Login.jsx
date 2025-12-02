import React, { useState } from 'react';
import { Container, Box, Typography, TextField, Button, Grid, Link as MuiLink, CircularProgress, Alert, FormControlLabel, Checkbox, Divider } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';


const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const success = await login({ username, password });
      if (success) {
        navigate('/');
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

  // Demo credentials helper


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
          {error && <Alert severity="error" sx={{ width: '100%', mb: 2 }}>{error}</Alert>}
          <TextField
            margin="normal"
            required
            fullWidth
            id="username"
            label="Username"
            name="username"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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