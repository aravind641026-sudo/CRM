import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../api/authApi';
import { setApiAuthToken, setLogoutHandler } from '../api/client';
import { STORAGE_KEYS } from '../config/constants';
import { resetToLogin } from '../navigation/navigationService';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const clearSession = async () => {
    setToken(null);
    setUser(null);
    setApiAuthToken(null);
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
      await AsyncStorage.removeItem(STORAGE_KEYS.ATTENDANCE_DATA);
    } catch (e) {
      console.warn('Error clearing stored session data:', e);
    }
    resetToLogin();
  };

  useEffect(() => {
    // Register auto-logout handler on 401 Unauthorized
    setLogoutHandler(() => {
      clearSession();
    });

    const initAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);

        if (storedToken) {
          setApiAuthToken(storedToken);
          setToken(storedToken);

          if (storedUser) {
            try {
              setUser(JSON.parse(storedUser));
            } catch {
              // ignore json parse error
            }
          }

          // Verify session live with Spring Boot backend
          try {
            const freshUser = await authApi.getCurrentUser();
            if (freshUser.status === 'INACTIVE') {
              await clearSession();
            } else {
              setUser(freshUser);
              await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(freshUser));
            }
          } catch (apiErr) {
            console.warn('Session verification failed, clearing session:', apiErr);
            await clearSession();
          }
        }
      } catch (err) {
        console.warn('Error reading stored auth state:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (emailInput: string, passwordInput: string): Promise<User> => {
    setIsLoading(true);
    try {
      const cleanEmail = emailInput.toLowerCase().trim();

      // 1. Direct Spring Boot JWT Authentication
      const authData = await authApi.login(cleanEmail, passwordInput);
      const jwtToken =
        authData?.token ||
        (authData as any)?.accessToken ||
        (authData as any)?.jwt ||
        (authData as any)?.data?.token ||
        (authData as any)?.data?.accessToken;

      if (!jwtToken) {
        throw new Error('Authentication failed: No JWT token found in server response.');
      }

      setApiAuthToken(jwtToken);
      setToken(jwtToken);
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, jwtToken);

      // 2. Fetch full User Profile from Spring Boot Backend
      let userProfile: User;
      try {
        userProfile = await authApi.getCurrentUser();
      } catch {
        userProfile = authData.user || {
          id: authData.id,
          name: authData.name,
          email: authData.email,
          role: authData.role,
          status: authData.status,
        };
      }

      if (userProfile.status === 'INACTIVE') {
        await clearSession();
        throw new Error('Your account is deactivated. Please contact your administrator.');
      }

      setUser(userProfile);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userProfile));
      return userProfile;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    await clearSession();
    setIsLoading(false);
  };

  const refreshProfile = async (): Promise<void> => {
    try {
      const updated = await authApi.getCurrentUser();
      if (updated.status === 'INACTIVE') {
        await logout();
        return;
      }
      setUser(updated);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to refresh user profile:', e);
    }
  };

  const isAuthenticated = !!token && !!user && user.status === 'ACTIVE';
  const isAdmin = user?.role === 'ROLE_ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isAdmin,
        isLoading,
        login,
        logout,
        refreshProfile,
      }}
    >
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
