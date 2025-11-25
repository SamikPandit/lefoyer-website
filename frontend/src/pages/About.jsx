import React from 'react';
import { Box, Container, Typography, Grid, Divider, Paper } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SpaIcon from '@mui/icons-material/Spa';
import Diversity1Icon from '@mui/icons-material/Diversity1';

const About = () => {
    return (
        <Box sx={{ backgroundColor: '#FDFBF9' }}>
            {/* Hero Section - Softer & More Spacious */}
            <Box
                sx={{
                    py: { xs: 12, md: 20 },
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'radial-gradient(circle at 50% 50%, rgba(201, 169, 110, 0.08) 0%, rgba(253, 251, 249, 0) 70%)',
                }}
            >
                <Container maxWidth="md">
                    <Typography
                        variant="caption"
                        sx={{
                            color: 'primary.main',
                            fontWeight: 500,
                            letterSpacing: '0.3em',
                            textTransform: 'uppercase',
                            mb: 3,
                            display: 'block',
                            opacity: 0.8,
                        }}
                    >
                        Our Story
                    </Typography>
                    <Typography
                        variant="h1"
                        sx={{
                            fontFamily: "'Cormorant Garamond', serif",
                            mb: 4,
                            color: 'text.primary',
                            fontSize: { xs: '2.5rem', md: '4rem' },
                            fontWeight: 300,
                        }}
                    >
                        The Art of the Everyday Ritual
                    </Typography>
                    <Typography
                        variant="h5"
                        sx={{
                            fontFamily: "'Cormorant Garamond', serif",
                            color: 'text.secondary',
                            fontStyle: 'italic',
                            maxWidth: '600px',
                            mx: 'auto',
                            fontWeight: 400,
                            lineHeight: 1.6,
                        }}
                    >
                        "Your beauty routine should feel like coming home."
                    </Typography>
                </Container>
            </Box>

            {/* The Hearth Section - Organic Layout */}
            <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
                <Grid container spacing={{ xs: 6, md: 12 }} alignItems="center">
                    <Grid item xs={12} md={6}>
                        <Typography
                            variant="h3"
                            gutterBottom
                            sx={{
                                fontFamily: "'Cormorant Garamond', serif",
                                mb: 4,
                                fontWeight: 400
                            }}
                        >
                            Welcome to the Hearth
                        </Typography>
                        <Typography
                            variant="body1"
                            paragraph
                            sx={{
                                lineHeight: 2,
                                color: 'text.secondary',
                                fontSize: '1.05rem',
                                mb: 3
                            }}
                        >
                            In French, <strong>'Le foyeR.'</strong> means 'the hearth' – the heart of the home, a place of warmth, comfort, and belonging. We founded this company with a simple, yet profound belief: that true luxury is found not in extravagance, but in the small, consistent moments of self-care we create for ourselves every day.
                        </Typography>
                        <Typography
                            variant="body1"
                            paragraph
                            sx={{
                                lineHeight: 2,
                                color: 'text.secondary',
                                fontSize: '1.05rem'
                            }}
                        >
                            We are a modern cosmetic company dedicated to elevating your personal beauty space into a sanctuary. Our products are designed not just to enhance your natural beauty, but to nurture your spirit, creating a sense of peace and grounded luxury in your own space.
                        </Typography>
                    </Grid>
                </Grid>
            </Container>

            {/* Science & Nature Section - Cards with soft shadows */}
            <Box sx={{ py: { xs: 10, md: 16 }, position: 'relative' }}>
                {/* Decorative background element */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '100%',
                        height: '80%',
                        background: 'linear-gradient(90deg, transparent 0%, rgba(201, 169, 110, 0.03) 50%, transparent 100%)',
                        zIndex: 0,
                    }}
                />

                <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
                    <Box sx={{ textAlign: 'center', mb: 10 }}>
                        <Typography
                            variant="h3"
                            gutterBottom
                            sx={{
                                fontFamily: "'Cormorant Garamond', serif",
                                mb: 3,
                                fontWeight: 400
                            }}
                        >
                            Nature Meets Modern Science
                        </Typography>
                        <Typography
                            variant="body1"
                            sx={{
                                maxWidth: '600px',
                                mx: 'auto',
                                color: 'text.secondary',
                                lineHeight: 1.8,
                                fontSize: '1.1rem'
                            }}
                        >
                            We blend timeless elegance with contemporary innovation to bring you formulations that are as effective as they are indulgent.
                        </Typography>
                    </Box>

                    <Grid container spacing={4}>
                        {[
                            {
                                icon: <SpaIcon sx={{ fontSize: 32 }} />,
                                title: "Natural-Inspired",
                                desc: "Enriched with powerful botanicals, Vitamin C, Vitamin E, and antioxidants to nourish and rejuvenate."
                            },
                            {
                                icon: <AutoAwesomeIcon sx={{ fontSize: 32 }} />,
                                title: "Effective Formulations",
                                desc: "Derma-tested, non-greasy textures designed to address concerns like pigmentation, dryness, and sun damage."
                            },
                            {
                                icon: <Diversity1Icon sx={{ fontSize: 32 }} />,
                                title: "For Every You",
                                desc: "Inclusive care suitable for all skin and hair types—sensitive, oily, acne-prone, or dry."
                            }
                        ].map((item, index) => (
                            <Grid item xs={12} md={4} key={index}>
                                <Paper
                                    elevation={0}
                                    sx={{
                                        p: 5,
                                        height: '100%',
                                        textAlign: 'center',
                                        backgroundColor: 'rgba(255, 255, 255, 0.6)',
                                        backdropFilter: 'blur(10px)',
                                        border: '1px solid rgba(255, 255, 255, 0.8)',
                                        borderRadius: '16px',
                                        transition: 'all 0.4s ease',
                                        '&:hover': {
                                            transform: 'translateY(-10px)',
                                            backgroundColor: 'white',
                                            boxShadow: '0 15px 30px rgba(201, 169, 110, 0.1)',
                                        }
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 64,
                                            height: 64,
                                            borderRadius: '50%',
                                            backgroundColor: 'rgba(201, 169, 110, 0.1)',
                                            color: 'primary.main',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            mx: 'auto',
                                            mb: 3
                                        }}
                                    >
                                        {item.icon}
                                    </Box>
                                    <Typography variant="h5" gutterBottom sx={{ fontFamily: "'Cormorant Garamond', serif", mb: 2 }}>
                                        {item.title}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                                        {item.desc}
                                    </Typography>
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </Box>

            {/* Footer Note - Minimalist */}
            <Box sx={{ py: 12, textAlign: 'center', backgroundColor: '#F5F5F5' }}>
                <Container maxWidth="md">
                    <Typography
                        variant="h3"
                        gutterBottom
                        sx={{
                            fontFamily: "'Cormorant Garamond', serif",
                            color: 'text.primary',
                            fontStyle: 'italic',
                            fontWeight: 300
                        }}
                    >
                        "Welcome to our hearth. Welcome home."
                    </Typography>
                </Container>
            </Box>
        </Box>
    );
};

export default About;
