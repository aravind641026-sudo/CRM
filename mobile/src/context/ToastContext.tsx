import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  type?: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastOptions | null>(null);

  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<any>(null);

  const hideToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(null);
    });
  }, [translateY, opacity]);

  const showToast = useCallback(
    ({ type = 'success', title, message, duration = 3800 }: ToastOptions) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      setToast({ type, title, message, duration });

      translateY.setValue(-100);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 70,
          friction: 9,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    },
    [translateY, opacity, hideToast]
  );

  const showSuccess = useCallback(
    (title: string, message?: string) => {
      showToast({ type: 'success', title, message });
    },
    [showToast]
  );

  const showError = useCallback(
    (title: string, message?: string) => {
      showToast({ type: 'error', title, message });
    },
    [showToast]
  );

  const showInfo = useCallback(
    (title: string, message?: string) => {
      showToast({ type: 'info', title, message });
    },
    [showToast]
  );

  const showWarning = useCallback(
    (title: string, message?: string) => {
      showToast({ type: 'warning', title, message });
    },
    [showToast]
  );

  const getToastConfig = (type: ToastType = 'success') => {
    switch (type) {
      case 'success':
        return {
          icon: 'checkmark-circle' as const,
          iconColor: '#10B981',
          bgColor: '#FFFFFF',
          borderColor: 'rgba(16, 185, 129, 0.25)',
          badgeBg: '#ECFDF5',
          accentColor: '#059669',
        };
      case 'error':
        return {
          icon: 'alert-circle' as const,
          iconColor: '#EF4444',
          bgColor: '#FFFFFF',
          borderColor: 'rgba(239, 68, 68, 0.25)',
          badgeBg: '#FEF2F2',
          accentColor: '#DC2626',
        };
      case 'warning':
        return {
          icon: 'warning' as const,
          iconColor: '#F59E0B',
          bgColor: '#FFFFFF',
          borderColor: 'rgba(245, 158, 11, 0.25)',
          badgeBg: '#FFFBEB',
          accentColor: '#D97706',
        };
      case 'info':
      default:
        return {
          icon: 'information-circle' as const,
          iconColor: '#3B82F6',
          bgColor: '#FFFFFF',
          borderColor: 'rgba(59, 130, 246, 0.25)',
          badgeBg: '#EFF6FF',
          accentColor: '#2563EB',
        };
    }
  };

  const config = toast ? getToastConfig(toast.type) : null;

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showInfo,
        showWarning,
        hideToast,
      }}
    >
      {children}

      {toast && config && (
        <Animated.View
          style={[
            styles.toastWrapper,
            {
              top: Math.max(insets.top + 8, 16),
              transform: [{ translateY }],
              opacity,
            },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={[
              styles.toastContainer,
              {
                backgroundColor: config.bgColor,
                borderColor: config.borderColor,
              },
            ]}
            onPress={hideToast}
            activeOpacity={0.9}
          >
            {/* Left Accent Bar */}
            <View style={[styles.accentBar, { backgroundColor: config.accentColor }]} />

            {/* Icon Pill */}
            <View style={[styles.iconPill, { backgroundColor: config.badgeBg }]}>
              <Ionicons name={config.icon} size={22} color={config.iconColor} />
            </View>

            {/* Text Content */}
            <View style={styles.textContainer}>
              <Text style={styles.titleText} numberOfLines={1}>
                {toast.title}
              </Text>
              {toast.message ? (
                <Text style={styles.messageText} numberOfLines={2}>
                  {toast.message}
                </Text>
              ) : null}
            </View>

            {/* Dismiss Cross */}
            <TouchableOpacity onPress={hideToast} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color="#94A3B8" />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
    alignItems: 'center',
    elevation: 100,
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 480,
    borderRadius: 18,
    borderWidth: 1.2,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
  },
  iconPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginLeft: 4,
  },
  textContainer: {
    flex: 1,
    paddingRight: 8,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  messageText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#475569',
    marginTop: 2,
    lineHeight: 16.5,
  },
  closeBtn: {
    padding: 4,
  },
});
