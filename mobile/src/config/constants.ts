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
const getRawEnvBaseUrl = (): string => {
  // If running in a web browser (npm run web)
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const { hostname } = window.location;
    // When running on localhost / 127.0.0.1 in the browser, always use localhost:8080
    // so it never breaks even when switching Wi-Fi networks or if .env has a different LAN IP
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8080';
    }
    if (hostname) {
      return `http://${hostname}:8080`;
    }
  }

  // On physical mobile devices running in Expo Go, extract the Metro bundler host IP.
  // This guarantees that if the computer's Wi-Fi IP changes, the mobile device automatically
  // connects to the backend on the exact same host machine without manual configuration.
  const expoHostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any)?.manifest?.debuggerHost;

  if (expoHostUri && typeof expoHostUri === 'string') {
    const host = expoHostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:8080`;
    }
  }

  const envUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    Constants.expoConfig?.extra?.apiBaseUrl ||
    (Constants as any)?.manifest2?.extra?.expoClient?.extra?.apiBaseUrl ||
    (Constants.manifest as any)?.extra?.apiBaseUrl;

  if (!envUrl) {
    return 'http://192.168.1.43:8080';
  }
  return envUrl;
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
