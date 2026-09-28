import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { ToastProvider } from './src/context/ToastContext';
import { AttendanceProvider } from './src/context/AttendanceContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { EmergencyCheckInModal } from './src/components/attendance/EmergencyCheckInModal';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <ToastProvider>
          <AttendanceProvider>
            <EmergencyCheckInModal />
            <AppNavigator />
          </AttendanceProvider>
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

