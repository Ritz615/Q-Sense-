/**
 * Authentication context and provider.
 * Manages login state, user info, and JWT persistence.
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../services/api';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'operator';
  full_name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('qsense_token');
    const savedUser = localStorage.getItem('qsense_user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('qsense_token');
        localStorage.removeItem('qsense_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const res = await authApi.login(username, password);
    const data = res.data;
    localStorage.setItem('qsense_token', data.access_token);
    const userObj: User = {
      id: data.user_id,
      username: data.username,
      role: data.role,
      full_name: data.full_name,
      email: '',
    };
    localStorage.setItem('qsense_user', JSON.stringify(userObj));
    setToken(data.access_token);
    setUser(userObj);
  };

  const logout = () => {
    authApi.logout().catch(() => {});
    localStorage.removeItem('qsense_token');
    localStorage.removeItem('qsense_user');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      login,
      logout,
      isAdmin: user?.role === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
