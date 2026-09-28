import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { MeqHeader } from '../../components/common/MeqHeader';
import { IconTile } from '../../components/common/IconTile';
import { AnimatedCard } from '../../components/common/AnimatedCard';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../types';

export const AdminHubScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { user, logout } = useAuth();
  const [animKey, setAnimKey] = useState<number>(0);

  useEffect(() => {
    if (isFocused) {
      setAnimKey((prev: number) => prev + 1);
    }
  }, [isFocused]);

  const executeLogout = async () => {
    try {
      await logout();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' ? window.confirm('Are you sure you want to sign out?') : true;
      if (confirmed) {
        executeLogout();
      }
    } else {
      Alert.alert('Confirm Sign Out', 'Are you sure you want to sign out of your account?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: executeLogout,
        },
      ]);
    }
  };

  const menuSections = [
    {
      title: 'Management & Control',
      items: [
        {
          title: 'User Management',
          subtitle: 'Create, edit & manage agent privileges',
          icon: 'people',
          variant: 'blue' as const,
          onPress: () => navigation.navigate('AdminUsers'),
        },
        {
          title: 'Project Campaigns',
          subtitle: 'Manage projects, pipelines & status',
          icon: 'briefcase',
          variant: 'purple' as const,
          onPress: () => navigation.navigate('AdminProjects'),
        },
        {
          title: 'Lead Assignments',
          subtitle: 'Distribute & reassign leads to agents',
          icon: 'shuffle',
          variant: 'orange' as const,
          onPress: () => navigation.navigate('Assignments'),
        },
      ],
    },
    {
      title: 'Intelligence & Operations',
      items: [
        {
          title: 'Reports & Analytics',
          subtitle: 'Pipeline, employee ROI & sales revenue',
          icon: 'bar-chart',
          variant: 'purple' as const,
          onPress: () => navigation.navigate('Reports'),
        },
        {
          title: 'Follow-ups Console',
          subtitle: 'Review team callback promises & schedules',
          icon: 'calendar-outline',
          variant: 'pink' as const,
          onPress: () => navigation.navigate('FollowUps', {}),
        },
        {
          title: 'Organization Call Logs',
          subtitle: 'Audit telemetry, duration & recordings',
          icon: 'call',
          variant: 'green' as const,
          onPress: () => navigation.navigate('CallLogs', {}),
        },
        {
          title: 'Google Sync History',
          subtitle: 'View Google Sheets synchronization history',
          icon: 'document-text',
          variant: 'green' as const,
          onPress: () => navigation.navigate('GoogleSheets'),
        },
        {
          title: 'System Audit Trail',
          subtitle: 'Immutable record modifications log',
          icon: 'shield-checkmark',
          variant: 'orange' as const,
          onPress: () => navigation.navigate('AuditLogs'),
        },
      ],
    },
    {
      title: 'Preferences & Session',
      items: [
        {
          title: 'Settings & Security',
          subtitle: 'Account details, server URL & password',
          icon: 'settings-outline',
          variant: 'blue' as const,
          onPress: () => navigation.navigate('Settings'),
        },
        {
          title: 'Sign Out',
          subtitle: 'End current administrative session',
          icon: 'log-out-outline',
          variant: 'red' as const,
          onPress: handleLogout,
        },
      ],
    },
  ];

  const sectionIcons: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
    'Management & Control': {
      icon: 'radio-button-on',
      color: '#3B82F6',
      bg: 'rgba(59, 130, 246, 0.15)',
    },
    'Intelligence & Operations': {
      icon: 'bar-chart',
      color: '#7C3AED',
      bg: 'rgba(124, 58, 237, 0.15)',
    },
    'Preferences & Session': {
      icon: 'settings',
      color: '#6366F1',
      bg: 'rgba(99, 102, 241, 0.15)',
    },
  };

  return (
    <AmbientBackground variant="admin">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        {/* Custom Header matching Screenshot 1 */}
        <View style={styles.headerRow}>
          <View style={styles.headerTextCol}>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitleDark}>Admin </Text>
              <Text style={styles.headerTitlePurple}>Hub</Text>
            </View>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              Welcome, {user?.name || 'System Administrator'} (Role: {user?.role || 'ROLE_ADMIN'})
            </Text>
          </View>

          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.8}
          >
            <Ionicons name="settings-sharp" size={20} color="#6366F1" />
          </TouchableOpacity>
        </View>

        <ScrollView
          key={animKey}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
          showsVerticalScrollIndicator={false}
        >
          {menuSections.map((sec, secIdx) => {
            const secMeta = sectionIcons[sec.title] || {
              icon: 'apps',
              color: '#4F46E5',
              bg: 'rgba(79, 70, 229, 0.12)',
            };

            return (
              <AnimatedCard key={secIdx} delay={60 + secIdx * 100} style={styles.section}>
                {/* Section Header with Glowing Pill Badge */}
                <View style={styles.sectionHeaderRow}>
                  <View style={[styles.sectionIconBadge, { backgroundColor: secMeta.bg }]}>
                    <Ionicons name={secMeta.icon} size={13} color={secMeta.color} />
                  </View>
                  <Text style={styles.sectionTitle}>{sec.title}</Text>
                </View>

                {/* Glassmorphic Menu Card */}
                <View style={styles.menuCard}>
                  {sec.items.map((item, itemIdx) => (
                    <TouchableOpacity
                      key={itemIdx}
                      style={[
                        styles.menuRow,
                        itemIdx < sec.items.length - 1 && styles.menuRowBorder,
                      ]}
                      onPress={item.onPress}
                      activeOpacity={0.7}
                    >
                      <IconTile
                        name={item.icon}
                        variant={item.variant}
                        size={42}
                        iconSize={20}
                      />
                      <View style={styles.menuInfo}>
                        <Text style={styles.menuTitle}>{item.title}</Text>
                        <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#818CF8" />
                    </TouchableOpacity>
                  ))}
                </View>
              </AnimatedCard>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </AmbientBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerTextCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitleDark: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.6,
  },
  headerTitlePurple: {
    fontSize: 26,
    fontWeight: '900',
    color: '#7C3AED',
    letterSpacing: -0.6,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '500',
  },
  settingsButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  section: {
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginLeft: 4,
  },
  sectionIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6366F1',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  menuCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    overflow: 'hidden',
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241, 245, 249, 0.85)',
  },
  menuInfo: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2.5,
    fontWeight: '500',
  },
});

