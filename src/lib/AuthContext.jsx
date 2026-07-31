import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44, tokenStore } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const setSession = useCallback((token, u) => {
    tokenStore.set(token);
    setUser(u);
    setIsAuthenticated(true);
    setAuthError(null);
  }, []);

  const checkUserAuth = useCallback(async () => {
    const token = tokenStore.get();
    if (!token) {
      setIsAuthenticated(false);
      setUser(null);
      setIsLoadingAuth(false);
      return;
    }
    try {
      const me = await base44.auth.me();
      setUser(me);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (e) {
      tokenStore.clear();
      setIsAuthenticated(false);
      setUser(null);
      if (e.status && e.status !== 401) {
        setAuthError({ type: 'unknown', message: e.message });
      }
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => { checkUserAuth(); }, [checkUserAuth]);

  // Step 1 of login — returns { requires_2fa, challenge } or sets the session.
  const login = useCallback(async (email, password, remember = true) => {
    const res = await base44.auth.login(email, password, remember);
    if (res.requires_2fa) return res;
    setSession(res.token, res.user);
    return res;
  }, [setSession]);

  // Step 2 — only when 2FA is enabled.
  const verify2FA = useCallback(async (challenge, code) => {
    const res = await base44.auth.verify2FA(challenge, code);
    setSession(res.token, res.user);
    return res;
  }, [setSession]);

  const refreshUser = useCallback(async () => {
    const me = await base44.auth.me();
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(() => {
    base44.auth.logout();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const navigateToLogin = useCallback(() => {
    tokenStore.clear();
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  // Access control helper — admins can see everything.
  const canAccess = useCallback((pageKey) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return Array.isArray(user.permissions) && user.permissions.includes(pageKey);
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      setUser,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false, // kept for backward compatibility
      authChecked: !isLoadingAuth,
      authError,
      login,
      verify2FA,
      refreshUser,
      logout,
      navigateToLogin,
      checkUserAuth,
      canAccess,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
