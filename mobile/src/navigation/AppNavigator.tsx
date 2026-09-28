import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { SplashScreen } from '../screens/splash/SplashScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { TabNavigator } from './TabNavigator';
import { LeadDetailsScreen } from '../screens/leads/LeadDetailsScreen';
import { LeadTimelineScreen } from '../screens/leads/LeadTimelineScreen';
import { LeadFollowUpsScreen } from '../screens/leads/LeadFollowUpsScreen';
import { LeadAssignmentsScreen } from '../screens/leads/LeadAssignmentsScreen';
import { AttendanceHistoryScreen } from '../screens/attendance/AttendanceHistoryScreen';
import { CallLogsScreen } from '../screens/calls/CallLogsScreen';
import { CallHistoryDetailScreen } from '../screens/calls/CallHistoryDetailScreen';
import { SalesScreen } from '../screens/sales/SalesScreen';
import { ConvertedLeadsScreen } from '../screens/sales/ConvertedLeadsScreen';
import { AdminProjectsScreen } from '../screens/admin/AdminProjectsScreen';
import { AdminUsersScreen } from '../screens/admin/AdminUsersScreen';
import { AssignmentsScreen } from '../screens/admin/AssignmentsScreen';
import { ReportsScreen } from '../screens/admin/ReportsScreen';
import { AuditLogsScreen } from '../screens/admin/AuditLogsScreen';
import { GoogleSheetsScreen } from '../screens/admin/GoogleSheetsScreen';
import { FollowUpsScreen } from '../screens/followups/FollowUpsScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { AnalyticsScreen } from '../screens/analytics/AnalyticsScreen';
import { AdminNotificationsScreen } from '../screens/admin/AdminNotificationsScreen';
import { UserNotificationsScreen } from '../screens/home/UserNotificationsScreen';
import { RootStackParamList } from '../types';
import { navigationRef, resetToLogin, resetToMain } from './navigationService';
export { navigationRef, resetToLogin, resetToMain };

const Stack = createNativeStackNavigator<RootStackParamList>();

const appNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.primary,
  },
};

const NotificationsRouterScreen: React.FC = () => {
  const { isAdmin } = useAuth();
  if (isAdmin) {
    return <AdminNotificationsScreen />;
  }
  return <UserNotificationsScreen />;
};

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer ref={navigationRef} theme={appNavTheme}>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen
          name="LeadDetails"
          component={LeadDetailsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="LeadTimeline"
          component={LeadTimelineScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="LeadFollowUps"
          component={LeadFollowUpsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="LeadAssignments"
          component={LeadAssignmentsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="AttendanceHistory"
          component={AttendanceHistoryScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="CallLogs"
          component={CallLogsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="CallHistoryDetail"
          component={CallHistoryDetailScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Sales"
          component={SalesScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="ConvertedLeads"
          component={ConvertedLeadsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="AdminProjects"
          component={AdminProjectsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="AdminUsers"
          component={AdminUsersScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Assignments"
          component={AssignmentsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Reports"
          component={ReportsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="AuditLogs"
          component={AuditLogsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="GoogleSheets"
          component={GoogleSheetsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="FollowUps"
          component={FollowUpsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Analytics"
          component={AnalyticsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsRouterScreen}
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
