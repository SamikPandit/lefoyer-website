/**
 * Session state for the whole app — IMPL_SPEC §3 WP-07.
 *
 * What changed and why:
 *  - `login()` consumes the `user` object the token endpoint now returns (§2b #28)
 *    instead of fabricating `{ username: <whatever was typed> }`, so the header,
 *    the profile page and the review author name all show the real account.
 *  - `getMe()` runs on mount when a token exists, so a stale cached `user` (an
 *    email verified in another tab, a name changed in the admin) is corrected.
 *  - `isEmailVerified` is exposed, because a verified-email gate is the one piece
 *    of account state several pages need and none of them can derive.
 *  - `logout()` clears `refreshToken` as well. Leaving it behind was a real defect:
 *    api.js's interceptor would happily use the orphaned refresh token to mint a
 *    new session for the user who just signed out, on the next protected call.
 *  - It listens for `lefoyer:auth-expired` from api.js, so an unrecoverable 401
 *    resets this context instead of hard-navigating the browser to /login.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AUTH_EXPIRED_EVENT,
  clearAuthStorage,
  getApiErrorMessage,
  getMe,
  getStoredAccessToken,
  loginUser,
  storeTokens,
} from '../services/api';

const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeStoredUser = (user) => {
  try {
    if (user) localStorage.setItem('user', JSON.stringify(user));
    else localStorage.removeItem('user');
  } catch {
    /* non-fatal */
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Clears every trace of the session. Shared by logout() and the expiry listener. */
  const resetSession = useCallback(() => {
    setUser(null);
    setToken(null);
    clearAuthStorage();
    // Not in api.js's list (§2a) because the 401 path does not own it, but a
    // signed-out browser must not keep the previous shopper's saved items.
    try {
      localStorage.removeItem('wishlist');
    } catch {
      /* non-fatal */
    }
  }, []);

  /* Boot: adopt the stored session optimistically, then confirm it against the
     server. The cached user renders immediately (no logged-out flash), and
     `getMe()` corrects it a moment later. `loading` must settle either way —
     ProtectedRoute blocks on it, so a hung request would mean a permanent spinner. */
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const savedToken = getStoredAccessToken();
      if (!savedToken) {
        setLoading(false);
        return;
      }

      setToken(savedToken);
      const cachedUser = readStoredUser();
      if (cachedUser) setUser(cachedUser);

      try {
        const me = await getMe();
        if (cancelled) return;
        if (me) {
          setUser(me);
          writeStoredUser(me);
        }
      } catch {
        // Deliberately swallowed. A 401 has already been handled by api.js: it
        // tried one refresh and, on failure, cleared storage and dispatched
        // `lefoyer:auth-expired`, which the listener below turns into a reset.
        // Every other outcome — offline, a 500, or `auth/me/` not deployed yet —
        // is NOT a reason to sign someone out, so the cached user is kept.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [resetSession]);

  /* api.js could not refresh the session. */
  useEffect(() => {
    const handleExpiry = () => {
      if (mounted.current) resetSession();
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpiry);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiry);
  }, [resetSession]);

  /**
   * @param {{username: string, password: string}} credentials  `username` is the email.
   * @returns {true | {ok: false, code: string, detail: string, email?: string}}
   *   `true` on success. On failure a structured reason, so the sign-in page can
   *   print the server's own words instead of a blanket "check your credentials":
   *   `code` is one of 'email_not_verified' | 'invalid_credentials' | 'throttled'
   *   | 'network' | 'error', and `email_not_verified` additionally carries `email`
   *   so the page can offer "resend verification".
   */
  const login = useCallback(async (credentials) => {
    try {
      const data = await loginUser(credentials);
      const { access, refresh, user: userData } = data || {};

      if (!access) {
        return { ok: false, code: 'error', detail: 'The server did not return a session token.' };
      }

      storeTokens({ access, refresh });
      setToken(access);

      // §2b #28 returns the user inline. Older deployments do not; rather than
      // invent a user object from the typed email, ask the server.
      let resolvedUser = userData || null;
      if (!resolvedUser) {
        try {
          resolvedUser = await getMe();
        } catch {
          resolvedUser = null;
        }
      }
      setUser(resolvedUser);
      writeStoredUser(resolvedUser);

      return true;
    } catch (error) {
      const data = error?.response?.data || {};
      const status = error?.status ?? error?.response?.status ?? null;

      if (status === 403 && data.code === 'email_not_verified') {
        return {
          ok: false,
          code: 'email_not_verified',
          detail: data.detail || 'Please verify your email address before signing in.',
          email: data.email || credentials?.username,
        };
      }
      if (error?.isThrottled) {
        return { ok: false, code: 'throttled', detail: getApiErrorMessage(error) };
      }
      if (error?.isNetwork) {
        return { ok: false, code: 'network', detail: getApiErrorMessage(error) };
      }
      if (status === 400 || status === 401) {
        return {
          ok: false,
          code: data.code || 'invalid_credentials',
          detail: getApiErrorMessage(error, 'That email and password do not match an account.'),
        };
      }
      return { ok: false, code: 'error', detail: getApiErrorMessage(error) };
    }
  }, []);

  const logout = useCallback(() => {
    resetSession();
  }, [resetSession]);

  /** Re-reads the account from the server, e.g. after email verification. */
  const refreshUser = useCallback(async () => {
    if (!getStoredAccessToken()) return null;
    try {
      const me = await getMe();
      if (me) {
        setUser(me);
        writeStoredUser(me);
      }
      return me;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(token),
      // `true`/`false` only when the server has told us; `null` means "not known
      // yet", which a gate must not read as "unverified".
      isEmailVerified: user ? user.is_email_verified === true : null,
      login,
      logout,
      refreshUser,
    }),
    [user, token, loading, login, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;
