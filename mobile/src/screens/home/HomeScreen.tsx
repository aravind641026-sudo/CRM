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
import { AttendanceCard } from '../../components/attendance/AttendanceCard';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { useAuth } from '../../context/AuthContext';
import { useAttendance } from '../../context/AttendanceContext';
import { dashboardApi } from '../../api/dashboardApi';
import { salesApi } from '../../api/salesApi';
import { UserDashboardSummary, Sale, RootStackParamList } from '../../types';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth();
  const { refreshAttendance } = useAttendance();

  const [dashboard, setDashboard] = useState<UserDashboardSummary | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (isFocused) {
      setAnimKey((prev) => prev + 1);
    }
  }, [isFocused]);

  const monthlyTargetAmount = 100000;

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isAuthenticated || !token || authLoading) return;
    if (!isRefresh) setLoading(true);

    try {
      const [dashData, salesData] = await Promise.allSettled([
        dashboardApi.getUserDashboard(),
        salesApi.getMySales(),
        refreshAttendance(true),
      ]);

      if (dashData.status === 'fulfilled') setDashboard(dashData.value);
      if (salesData.status === 'fulfilled') setSales(salesData.value);
    } catch (err: any) {
      console.warn('Failed to load dashboard data:', err?.message || err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, token, authLoading, refreshAttendance]);

  useEffect(() => {
    if (isAuthenticated && token && !authLoading) {
      loadData();
    }
  }, [isAuthenticated, token, authLoading, loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const thisMonthSales = sales.filter((s) => {
    if (!s.convertedAt) return false;
    const d = new Date(s.convertedAt);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const monthRevenue = thisMonthSales.reduce((sum, s) => sum + (Number(s.dealValue) || 0), 0);
  const revenueToUse = dashboard?.totalRevenue ? Number(dashboard.totalRevenue) : monthRevenue;
  const progressPercent = Math.min(100, Math.round((revenueToUse / monthlyTargetAmount) * 100));

  const totalAssigned = dashboard?.myAssignedLeads ?? 0;
  const conversions = dashboard?.myConversions ?? thisMonthSales.length;
  const conversionRate = totalAssigned > 0 ? Math.round((conversions / totalAssigned) * 100) : 0;

  if ((loading || authLoading) && !refreshing && !dashboard) {
    return <LoadingState message="Loading dashboard..." fullScreen />;
  }

  const avatarInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';
  const todayDateFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <AmbientBackground variant="home">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <MeqHeader
          rightMode="home"
          avatarInitial={avatarInitial}
          onPressAvatar={() => navigation.navigate('Settings')}
          onPressBell={() => navigation.navigate('Notifications')}
        />

        <ScrollView
          key={animKey}
          style={styles.container}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 90 }]}
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
        {/* Section: Greeting & Date Row */}
        <AnimatedCard delay={50} style={styles.greetingRow}>
          <View style={styles.greetingLeft}>
            <Text style={styles.greetingTitle}>Hello, {user?.name || 'User'} 👋</Text>
            <Text style={styles.greetingSubtitle}>Great to see you back · {todayDateFormatted}</Text>
          </View>
        </AnimatedCard>

        {/* Section: Hero Dashboard Card (Revenue & Conversion) */}
        <AnimatedCard delay={100} style={styles.sectionMargin}>
          <HeroDashboardCard
            totalRevenue={revenueToUse}
            totalLeads={totalAssigned}
            convertedLeads={conversions}
            conversionRate={conversionRate}
            revenueLabel="MY CLOSED REVENUE"
            showAttendanceCapsule={false}
          />
        </AnimatedCard>

        {/* Attendance Punch In/Out Actions */}
        <AnimatedCard delay={150} style={styles.sectionMargin}>
          <AttendanceCard
            onViewHistory={() => navigation.navigate('AttendanceHistory')}
          />
        </AnimatedCard>

        {/* 2 Top Stat Cards Row: My Leads & Converted */}
        <View style={styles.statCardsRow}>
          <StatCard
            label="My Leads"
            value={dashboard?.myAssignedLeads ?? 0}
            iconName="people"
            iconVariant="purple"
            delay={200}
            onPress={() => (navigation as any).navigate('Leads')}
          />
          <StatCard
            label="Converted"
            value={conversions}
            iconName="checkmark-circle"
            iconVariant="green"
            delay={240}
            onPress={() => navigation.navigate('Sales')}
          />
        </View>

        {/* Section: Monthly Sales Target Card */}
        <AnimatedCard delay={400} style={styles.targetCard}>
          <View style={styles.targetHeader}>
            <View style={styles.targetLeft}>
              <IconTile name="trophy" variant="purple" size={38} iconSize={18} />
              <View>
                <Text style={styles.targetTitle}>Monthly Target</Text>
                <Text style={styles.targetSub}>₹{monthlyTargetAmount.toLocaleString()} Goal</Text>
              </View>
            </View>
            <View style={styles.percentPill}>
              <Text style={styles.percentText}>{progressPercent}%</Text>
            </View>
          </View>

          <AnimatedProgressBar percentage={progressPercent} height={7} style={{ marginVertical: 12 }} />

          <View style={styles.targetMetaRow}>
            <Text style={styles.achievedText}>₹{revenueToUse.toLocaleString()} Achieved</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Sales')}>
              <Text style={styles.viewSalesText}>View Sales ›</Text>
            </TouchableOpacity>
          </View>
        </AnimatedCard>

        {/* Quick Action Tiles */}
        <AnimatedCard delay={450} style={styles.quickGrid}>
          <TouchableOpacity
            style={styles.quickTile}
            onPress={() => navigation.navigate('Sales')}
            activeOpacity={0.8}
          >
            <IconTile name="cart" variant="pink" size={40} iconSize={18} />
            <Text style={styles.quickTileLabel}>My Sales</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickTile}
            onPress={() => (navigation as any).navigate('Analytics')}
            activeOpacity={0.8}
          >
            <IconTile name="bar-chart" variant="blue" size={40} iconSize={18} />
            <Text style={styles.quickTileLabel}>Analytics</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickTile}
            onPress={() => navigation.navigate('FollowUps', { period: 'upcoming' })}
            activeOpacity={0.8}
          >
            <IconTile name="calendar" variant="purple" size={40} iconSize={18} />
            <Text style={styles.quickTileLabel}>Follow-ups</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickTile}
            onPress={() => navigation.navigate('AttendanceHistory')}
            activeOpacity={0.8}
          >
            <IconTile name="time" variant="green" size={40} iconSize={18} />
            <Text style={styles.quickTileLabel}>Attendance</Text>
          </TouchableOpacity>
        </AnimatedCard>
      </ScrollView>
    </SafeAreaView>
  </AmbientBackground>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
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
  sectionMargin: {
    marginBottom: 14,
  },
  statCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  targetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(238, 242, 246, 0.9)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  targetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  targetTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  targetSub: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 1,
  },
  percentPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  percentText: {
    color: '#D97706',
    fontWeight: '800',
    fontSize: 12,
  },
  targetMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  achievedText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  viewSalesText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  quickGrid: {
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
  quickTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quickTileLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
