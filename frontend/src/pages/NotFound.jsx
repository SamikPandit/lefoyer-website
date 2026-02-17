import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
    const navigate = useNavigate();

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '60vh',
                textAlign: 'center',
                px: 3,
            }}
        >
            <Typography
                variant="h1"
                sx={{
                    fontSize: { xs: '5rem', md: '8rem' },
                    fontWeight: 700,
                    color: '#1a1a1a',
                    lineHeight: 1,
                    mb: 1,
                }}
            >
                404
            </Typography>
            <Typography
                variant="h5"
                sx={{ color: '#555', mb: 1, fontWeight: 500 }}
            >
                Page Not Found
            </Typography>
            <Typography
                sx={{ color: '#999', mb: 4, maxWidth: 400 }}
            >
                The page you're looking for doesn't exist or has been moved.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                    variant="contained"
                    onClick={() => navigate('/')}
                    sx={{
                        bgcolor: '#1a1a1a',
                        color: '#fff',
                        borderRadius: '25px',
                        px: 4,
                        py: 1.2,
                        textTransform: 'none',
                        fontWeight: 600,
                        '&:hover': { bgcolor: '#333' },
                    }}
                >
                    Go Home
                </Button>
                <Button
                    variant="outlined"
                    onClick={() => navigate('/products')}
                    sx={{
                        borderColor: '#1a1a1a',
                        color: '#1a1a1a',
                        borderRadius: '25px',
                        px: 4,
                        py: 1.2,
                        textTransform: 'none',
                        fontWeight: 600,
                        '&:hover': { borderColor: '#333', bgcolor: '#f5f5f5' },
                    }}
                >
                    Browse Products
                </Button>
            </Box>
        </Box>
    );
}
