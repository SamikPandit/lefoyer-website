import React, { useState, useEffect } from 'react';
import { Container, Box, Typography, Button, Paper, CircularProgress, Alert } from '@mui/material';
import { CheckCircleOutline, ErrorOutline } from '@mui/icons-material';
import { Link, useParams } from 'react-router-dom';
import { verifyEmail } from '../services/api';

const VerifyEmail = () => {
    const { token } = useParams();
    const [loading, setLoading] = useState(true);
    const [success, setSuccess] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const verify = async () => {
            try {
                const response = await verifyEmail(token);
                setSuccess(true);
                setMessage(response.data.detail || 'Email verified successfully! You can now log in.');
            } catch (err) {
                setSuccess(false);
                if (err.response && err.response.data && err.response.data.detail) {
                    setMessage(err.response.data.detail);
                } else {
                    setMessage('Invalid or expired verification link.');
                }
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            verify();
        } else {
            setLoading(false);
            setMessage('No verification token provided.');
        }
    }, [token]);

    if (loading) {
        return (
            <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
                <CircularProgress />
                <Typography variant="h6" sx={{ mt: 2 }}>
                    Verifying your email...
                </Typography>
            </Container>
        );
    }

    return (
        <Container maxWidth="sm" sx={{ py: 5, textAlign: 'center' }}>
            <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
                {success ? (
                    <CheckCircleOutline sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
                ) : (
                    <ErrorOutline sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
                )}

                <Typography variant="h4" gutterBottom sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700 }}>
                    {success ? 'Email Verified!' : 'Verification Failed'}
                </Typography>

                <Alert severity={success ? 'success' : 'error'} sx={{ mb: 3, textAlign: 'left' }}>
                    {message}
                </Alert>

                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                    {success ? (
                        <Button
                            variant="contained"
                            color="primary"
                            component={Link}
                            to="/login"
                            sx={{ borderRadius: '25px', px: 4, py: 1.5 }}
                        >
                            Sign In
                        </Button>
                    ) : (
                        <Button
                            variant="contained"
                            color="primary"
                            component={Link}
                            to="/signup"
                            sx={{ borderRadius: '25px', px: 4, py: 1.5 }}
                        >
                            Sign Up Again
                        </Button>
                    )}
                </Box>
            </Paper>
        </Container>
    );
};

export default VerifyEmail;
