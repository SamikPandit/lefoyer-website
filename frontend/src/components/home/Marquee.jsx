import React from 'react';
import { Box, Typography } from '@mui/material';
import { keyframes } from '@emotion/react';

const scroll = keyframes`
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
`;

const Marquee = () => {
    const items = [
        "Clinically Tested",
        "Botanical Actives",
        "Cruelty Free",
        "Made in India",
        "Clinically Tested",
        "Botanical Actives",
        "Cruelty Free",
        "Made in India",
        "Clinically Tested",
        "Botanical Actives",
        "Cruelty Free",
        "Made in India",
        "Clinically Tested",
        "Botanical Actives",
        "Cruelty Free",
        "Made in India"
    ];

    return (
        <Box
            sx={{
                width: '100%',
                overflow: 'hidden',
                backgroundColor: '#fff',
                borderBottom: '1px solid rgba(201, 169, 110, 0.2)',
                py: 2,
                whiteSpace: 'nowrap',
                position: 'relative'
            }}
        >
            <Box
                sx={{
                    display: 'inline-flex',
                    animation: `${scroll} 30s linear infinite`,
                    '&:hover': { animationPlayState: 'paused' }
                }}
            >
                {items.map((item, index) => (
                    <Box key={index} sx={{ display: 'flex', alignItems: 'center', mx: 4 }}>
                        <Box
                            sx={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: '#C9A96E',
                                mr: 4
                            }}
                        />
                        <Typography
                            variant="h6"
                            sx={{
                                fontFamily: "'Cormorant Garamond', serif",
                                color: '#5A4A3A',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                fontSize: { xs: '0.9rem', md: '1.1rem' }
                            }}
                        >
                            {item}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

export default Marquee;
