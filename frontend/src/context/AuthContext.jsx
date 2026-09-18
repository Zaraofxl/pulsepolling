import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api/client';

// ============================================================================
// AUTHENTICATION CONTEXT & PROVIDER
// Manages global user authentication state, token storage, and session sync.
// ============================================================================

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('pulsepoll_token'));
  const [isLoading, setIsLoading] = useState(true);

  // Synchronize authenticated session on initial page mount
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('pulsepoll_token');
      const storedUser = localStorage.getItem('pulsepoll_user');

      if (storedToken && storedUser) {
        try {
          setUser(JSON.parse(storedUser));
          // Validate token with backend
          const res = await authAPI.getMe();
          if (res.data) {
            setUser(res.data);
            localStorage.setItem('pulsepoll_user', JSON.stringify(res.data));
          }
        } catch (err) {
          console.warn('[AuthContext] Session invalid or expired, logging out');
          logout();
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  // Login handler
  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    const { token, user } = res.data;

    localStorage.setItem('pulsepoll_token', token);
    localStorage.setItem('pulsepoll_user', JSON.stringify(user));
    setToken(token);
    setUser(user);
    return user;
  };

  // Register handler
  const register = async (name, email, password) => {
    const res = await authAPI.register({ name, email, password });
    const { token, user } = res.data;

    localStorage.setItem('pulsepoll_token', token);
    localStorage.setItem('pulsepoll_user', JSON.stringify(user));
    setToken(token);
    setUser(user);
    return user;
  };

  // Logout handler
  const logout = () => {
    localStorage.removeItem('pulsepoll_token');
    localStorage.removeItem('pulsepoll_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for consuming auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
