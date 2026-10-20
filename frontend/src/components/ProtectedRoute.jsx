import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CircularProgress, Box } from '@mui/material';

/**
 * Gate for authenticated routes. Reviewed against IMPL_SPEC §3 WP-07 and left
 * behaviourally unchanged — it was already correct.
 *
 * THE RETURN-PATH CONTRACT (LF-13), confirmed here so the sign-in page and the
 * navbar agree with it:
 *
 *   state = { from: <the full react-router `location` object> }
 *
 * `from` is the whole location, not a string, so `from.pathname`, `from.search`
 * and `from.hash` are all available. After a successful sign-in, send the shopper
 * back with:
 *
 *   const from = location.state?.from;
 *   navigate(from ? `${from.pathname}${from.search || ''}` : '/', { replace: true });
 *
 * or, equivalently, `<Navigate to={from} replace />`, which react-router accepts
 * for a location object. Anything that forwards this state onward (the navbar's
 * Sign In links) must pass the object through unchanged rather than re-wrapping it.
 *
 * The `loading` branch matters: AuthContext starts with `loading: true` while it
 * adopts the stored token and confirms it with `getMe()`. Without this branch a
 * signed-in shopper who reloads a protected page would be bounced to /login for
 * the duration of that request.
 */
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
};

export default ProtectedRoute;
