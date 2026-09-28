import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { MeqHeader } from '../../components/common/MeqHeader';
import { HeroDashboardCard } from '../../components/common/HeroDashboardCard';
import { StatCard } from '../../components/common/StatCard';
import { IconTile } from '../../components/common/IconTile';
import { AnimatedCard } from '../../components/common/AnimatedCard';
import { AnimatedProgressBar } from '../../components/common/AnimatedProgressBar';
import { LoadingState } from '../../components/common/LoadingState';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { dashboardApi } from '../../api/dashboardApi';
import { projectsApi } from '../../api/projectsApi';
import { attendanceApi } from '../../api/attendanceApi';
import { useAuth } from '../../context/AuthContext';
import { AdminDashboardSummary, Project, Attendance, RootStackParamList } from '../../types';

export const AdminDashboardScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { isAuthenticated, token, isLoading: authLoading, user } = useAuth();

  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (isFocused) {
      setAnimKey((prev) => prev + 1);
    }
  }, [isFocused]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isAuthenticated || !token || authLoading) return;
    if (!isRefresh) setLoading(true);
    try {
      const [sumData, projData, attData] = await Promise.allSettled([
        dashboardApi.getAdminDashboard(),
        projectsApi.getProjects(),
        attendanceApi.getTodayAttendance(),
      ]);

      if (sumData.status === 'fulfilled') setSummary(sumData.value);
      if (projData.status === 'fulfilled') setProjects(projData.value);
      if (attData.status === 'fulfilled') setTodayAttendance(attData.value);
    } catch (err) {
      console.warn('Failed to load admin dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, token, authLoading]);

  useEffect(() => {
    if (isAuthenticated && token && !authLoading) {
      loadData();
    }
  }, [isAuthenticated, token, authLoading, loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const conversionRate = summary?.totalLeads
    ? Math.round((summary.convertedLeads / summary.totalLeads) * 100)
    : 0;

  if (loading && !refreshing) {
    return <LoadingState message="Aggregating executive metrics..." fullScreen />;
  }

  const avatarInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'A';
  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <AmbientBackground variant="home">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <MeqHeader
          rightMode="home"
          avatarInitial={avatarInitial}
          onPressAvatar={() => navigation.navigate('Settings')}
          onPressBell={() => navigation.navigate('Notifications' as any)}
        />

        <ScrollView
          key={animKey}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting Sub-Header Row */}
        <AnimatedCard delay={50} style={styles.greetingRow}>
          <View style={styles.greetingLeft}>
            <Text style={styles.greetingTitle}>Hello, {user?.name || 'System Administrator'} 👋</Text>
            <Text style={styles.greetingSubtitle}>Admin Dashboard · {todayFormatted}</Text>
          </View>
        </AnimatedCard>

        {/* Dashboard Hero Card matching Reference Image */}
        <AnimatedCard delay={100}>
          <HeroDashboardCard
            totalRevenue={summary?.totalRevenue ?? 55000}
            totalLeads={summary?.totalLeads ?? 8}
            convertedLeads={summary?.convertedLeads ?? 2}
            conversionRate={conversionRate || 25}
            revenueLabel="TOTAL CLOSED REVENUE"
            clockInTime={todayAttendance?.clockInTime}
            clockOutTime={todayAttendance?.clockOutTime}
            durationMinutes={todayAttendance?.durationMinutes ?? 347}
            attendanceStatus={todayAttendance?.status}
            shiftDisplayName={todayAttendance?.shiftDisplayName || '09:00 AM – 06:00 PM'}
            clockedIn={!!todayAttendance?.clockInTime}
            clockedOut={!!todayAttendance?.clockOutTime}
            onPressAttendance={() => navigation.navigate('AttendanceHistory')}
          />
        </AnimatedCard>

        {/* 4 Stat Cards Row */}
        <View style={styles.statCardsRow}>
          <StatCard
            label="Leads"
            value={summary?.totalLeads ?? 0}
            iconName="person"
            iconVariant="blue"
            delay={150}
            onPress={() =>
              navigation.navigate('Main' as any, {
                screen: 'Leads',
                params: {
                  screen: 'LeadsList',
                  params: { projectId: undefined, projectName: 'All Leads' },
                },
              } as any)
            }
          />
          <StatCard
            label="Converted"
            value={summary?.convertedLeads ?? 0}
            iconName="checkmark-circle"
            iconVariant="green"
            delay={200}
            onPress={() => navigation.navigate('ConvertedLeads')}
          />
          <StatCard
            label="Users"
            value={summary?.activeAgents ?? 0}
            iconName="people"
            iconVariant="purple"
            delay={250}
            onPress={() => navigation.navigate('AdminUsers')}
          />
          <StatCard
            label="Projects"
            value={summary?.activeProjects ?? (projects.length || 0)}
            iconName="folder"
            iconVariant="orange"
            delay={300}
            onPress={() => navigation.navigate('AdminProjects')}
          />
        </View>

        {/* Executive Management Section */}
        <AnimatedCard delay={350} style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Executive management</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('AdminHub' as any)}
            activeOpacity={0.7}
            style={styles.seeAllBtn}
          >
            <Text style={styles.seeAllText}>See all</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.primary} />
          </TouchableOpacity>
        </AnimatedCard>

        <AnimatedCard delay={400} style={styles.execRow}>
          <TouchableOpacity
            style={styles.execTile}
            onPress={() => navigation.navigate('Reports' as any)}
            activeOpacity={0.8}
          >
            <IconTile name="bar-chart" variant="blue" size={44} iconSize={20} />
            <Text style={styles.execLabel} numberOfLines={1}>Reports & Analytics</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.execTile}
            onPress={() => navigation.navigate('AdminUsers')}
            activeOpacity={0.8}
          >
            <IconTile name="people" variant="purple" size={44} iconSize={20} />
            <Text style={styles.execLabel}>Team</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.execTile}
            onPress={() => navigation.navigate('FollowUps', { period: 'today' })}
            activeOpacity={0.8}
          >
            <IconTile name="calendar" variant="pink" size={44} iconSize={20} />
            <Text style={styles.execLabel}>Follow-ups</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.execTile}
            onPress={() => navigation.navigate('Reports' as any)}
            activeOpacity={0.8}
          >
            <IconTile name="share" variant="green" size={44} iconSize={20} />
            <Text style={styles.execLabel}>Export</Text>
          </TouchableOpacity>
        </AnimatedCard>

        {/* Projects Pipeline Breakdown Section */}
        <AnimatedCard delay={450} style={styles.projectsHeaderRow}>
          <Text style={styles.sectionTitle}>Active Projects</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('AdminProjects')}
            activeOpacity={0.7}
            style={styles.seeAllBtn}
          >
            <Text style={styles.seeAllText}>Manage All</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.primary} />
          </TouchableOpacity>
        </AnimatedCard>

        {projects.length === 0 ? (
          <AnimatedCard delay={500} style={styles.emptyCard}>
            <Text style={styles.emptyText}>No projects active currently.</Text>
          </AnimatedCard>
        ) : (
          projects.slice(0, 4).map((p, idx) => {
            const leadCount = p.assignedLeadsCount ?? p.totalLeads ?? 0;
            const progress = Math.min(100, leadCount > 0 ? Math.round((leadCount / 10) * 100) : 15);
            return (
              <AnimatedCard key={p.id} delay={500 + idx * 60} style={styles.projectCard}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() =>
                    navigation.navigate('Main' as any, {
                      screen: 'Leads',
                      params: {
                        screen: 'LeadsList',
                        params: { projectId: p.id, projectName: p.name },
                      },
                    } as any)
                  }
                >
                  <View style={styles.projectCardTop}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={styles.projectName}>{p.name}</Text>
                      <Text style={styles.projectLeadsSub}>{leadCount} leads</Text>
                    </View>
                    <View style={styles.activeBadge}>
                      <View style={styles.activeDot} />
                      <Text style={styles.activeBadgeText}>{p.status || 'ACTIVE'}</Text>
                    </View>
                  </View>

                  {/* Animated Progress Bar */}
                  <AnimatedProgressBar
                    percentage={progress}
                    style={styles.projectProgressBar}
                  />

                  <View style={styles.viewRow}>
                    <Text style={styles.viewLeadsText}>View</Text>
                    <Ionicons name="chevron-forward" size={13} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              </AnimatedCard>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  </AmbientBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  greetingLeft: {
    flex: 1,
  },
  greetingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  greetingSubtitle: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  statCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  seeAllText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.primary,
  },
  execRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(238, 242, 246, 0.9)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  execTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  execLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  projectsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  projectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(238, 242, 246, 0.9)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  projectCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  projectLeadsSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
  },
  projectProgressBar: {
    marginVertical: 12,
  },
  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  viewLeadsText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
});
