import React from 'react';
import { Box, Stepper, Step, StepLabel, Typography, StepConnector, styled } from '@mui/material';
import {
    CheckCircle,
    Payment as PaymentIcon,
    Inventory,
    LocalShipping,
    Verified
} from '@mui/icons-material';

const ColorlibConnector = styled(StepConnector)(({ theme }) => ({
    alternativeLabel: {
        top: 22,
    },
    active: {
        '& $line': {
            backgroundImage: 'linear-gradient(95deg, rgb(34,193,195) 0%, rgb(253,187,45) 100%)',
        },
    },
    completed: {
        '& $line': {
            backgroundImage: 'linear-gradient(95deg, rgb(34,193,195) 0%, rgb(253,187,45) 100%)',
        },
    },
    line: {
        height: 3,
        border: 0,
        backgroundColor: theme.palette.divider,
        borderRadius: 1,
    },
}));

const OrderTimeline = ({ order }) => {
    const steps = [
        {
            label: 'Order Placed',
            icon: CheckCircle,
            date: order.created_at,
            completed: true,
        },
        {
            label: 'Payment Confirmed',
            icon: PaymentIcon,
            date: order.payment_status === 'COMPLETED' ? order.updated_at : null,
            completed: order.payment_status === 'COMPLETED',
        },
        {
            label: 'Processing',
            icon: Inventory,
            date: order.shipment ? order.shipment.created_at : null,
            completed: !!order.shipment,
        },
        {
            label: 'Shipped',
            icon: LocalShipping,
            date: ['shipped', 'out_for_delivery', 'delivered'].includes(order.shipment?.status?.toLowerCase())
                ? order.shipment.updated_at
                : null,
            completed: ['shipped', 'out_for_delivery', 'delivered'].includes(order.shipment?.status?.toLowerCase()),
        },
        {
            label: 'Delivered',
            icon: Verified,
            date: order.status === 'delivered' ? order.updated_at : null,
            completed: order.status === 'delivered',
        },
    ];

    const activeStep = steps.filter(step => step.completed).length - 1;

    const formatDate = (dateString) => {
        if (!dateString) return null;
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <Box sx={{ width: '100%', py: 4 }}>
            <Stepper activeStep={activeStep} alternativeLabel connector={<ColorlibConnector />}>
                {steps.map((step, index) => {
                    const StepIcon = step.icon;
                    return (
                        <Step key={step.label} completed={step.completed}>
                            <StepLabel
                                icon={
                                    <Box
                                        sx={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            bgcolor: step.completed ? 'primary.main' : 'action.disabledBackground',
                                            color: step.completed ? 'white' : 'text.disabled',
                                            transition: 'all 0.3s ease',
                                        }}
                                    >
                                        <StepIcon />
                                    </Box>
                                }
                            >
                                <Typography variant="subtitle2" fontWeight={600}>
                                    {step.label}
                                </Typography>
                                {step.date && (
                                    <Typography variant="caption" color="text.secondary">
                                        {formatDate(step.date)}
                                    </Typography>
                                )}
                            </StepLabel>
                        </Step>
                    );
                })}
            </Stepper>
        </Box>
    );
};

export default OrderTimeline;
