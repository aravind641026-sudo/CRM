import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Resolves the backend API base URL strictly from environment configuration (.env).
 *
 * Supports:
 * 1. Web browser intelligent host detection (if accessed via localhost, uses localhost:8080)
 * 2. process.env.EXPO_PUBLIC_API_BASE_URL (Metro / Expo standard inlining from .env)
 * 3. process.env.API_BASE_URL (standard environment variable from .env)
 * 4. Constants.expoConfig?.extra?.apiBaseUrl (dynamic app.config.js injection)
 * 5. (Constants.manifest as any)?.extra?.apiBaseUrl (Expo manifest fallback)
 */
const DEFAULT_PROD_URL = 'https://procedures-anderson-importance-drivers.trycloudflare.com';

const getRawEnvBaseUrl = (): string => {
  // 1. Explicit environment variable (.env) takes highest priority
  const envUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    Constants.expoConfig?.extra?.apiBaseUrl ||
    (Constants as any)?.manifest2?.extra?.expoClient?.extra?.apiBaseUrl ||
    (Constants.manifest as any)?.extra?.apiBaseUrl;

  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim();
  }

  // 2. If running in a web browser without env var
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8080';
    }
  }

  // 3. Fallback to production Render URL
  return DEFAULT_PROD_URL;
};

// Normalize base URL to ensure clean /api/v1 prefix
const normalizeApiUrl = (url: string): string => {
  const trimmed = url.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
};

export const API_BASE_URL = normalizeApiUrl(getRawEnvBaseUrl());

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'crm_mobile_token',
  USER_DATA: 'crm_mobile_user',
  ATTENDANCE_DATA: 'crm_mobile_attendance',
  CUSTOM_API_URL: 'crm_custom_api_url',
};
