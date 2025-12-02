import React from 'react';
import { Container, Typography, Box, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const FAQ = () => {
    const faqs = [
        {
            question: "Are your products 100% natural?",
            answer: "Yes, all Le Foyer products are crafted with 100% natural ingredients sourced responsibly from around the globe. We believe in the power of nature to heal and rejuvenate."
        },
        {
            question: "Do you test on animals?",
            answer: "Absolutely not. Le Foyer is a cruelty-free brand. We do not test our products or ingredients on animals."
        },
        {
            question: "What is your shipping policy?",
            answer: "We offer free shipping on all orders over ₹5000. Standard shipping takes 3-5 business days. Expedited shipping options are available at checkout."
        },
        {
            question: "Can I return a product if I'm not satisfied?",
            answer: "We want you to love your Le Foyer experience. If you are not completely satisfied, we accept returns within 30 days of purchase for a full refund, provided the product is gently used."
        },
        {
            question: "Are your packaging materials sustainable?",
            answer: "Yes, we are committed to sustainability. Our packaging is made from recycled materials and is fully recyclable. We strive to minimize our environmental footprint."
        },
        {
            question: "How can I track my order?",
            answer: "Once your order ships, you will receive a confirmation email with a tracking number. You can also view your order status by logging into your account."
        }
    ];

    return (
        <Container maxWidth="md" sx={{ py: 8 }}>
            <Typography variant="h3" component="h1" align="center" gutterBottom sx={{ fontFamily: "'Cormorant Garamond', serif", mb: 6 }}>
                Frequently Asked Questions
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {faqs.map((faq, index) => (
                    <Accordion key={index} elevation={0} sx={{ border: '1px solid #E8E8E8', '&:before': { display: 'none' } }}>
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            aria-controls={`panel${index}-content`}
                            id={`panel${index}-header`}
                        >
                            <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 500 }}>
                                {faq.question}
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                                {faq.answer}
                            </Typography>
                        </AccordionDetails>
                    </Accordion>
                ))}
            </Box>
        </Container>
    );
};

export default FAQ;
