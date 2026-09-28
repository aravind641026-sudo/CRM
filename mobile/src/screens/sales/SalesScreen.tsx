import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Header } from '../../components/common/Header';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { salesApi } from '../../api/salesApi';
import { dashboardApi } from '../../api/dashboardApi';
import { Sale, UserDashboardSummary } from '../../types';

export const SalesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [sales, setSales] = useState<Sale[]>([]);
  const [dashboard, setDashboard] = useState<UserDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthlyTarget = 100000;

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const [salesData, dashData] = await Promise.all([
        salesApi.getMySales(),
        dashboardApi.getUserDashboard(),
      ]);
      setSales(salesData);
      setDashboard(dashData);
    } catch (err: any) {
      setError(err.message || 'Unable to load sales performance.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.dealValue) || 0), 0);
  const percentAchieved = Math.min(100, Math.round((totalRevenue / monthlyTarget) * 100));

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return 'N/A';
    try {
      return new Date(isoStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoStr.slice(0, 10);
    }
  };

  return (
    <AmbientBackground variant="leads">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <Header
        title="My Sales"
        subtitle="Individual sales performance & closed deals"
        onBack={() => navigation.goBack()}
      />

      {loading && !refreshing ? (
        <LoadingState message="Loading sales performance..." fullScreen />
      ) : error ? (
        <ErrorState message={error} onRetry={() => loadData()} fullScreen />
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            <View>
              {/* Performance Target Card */}
              <Card style={styles.performanceCard}>
                <View style={styles.performanceHeader}>
                  <View style={styles.targetIconCircle}>
                    <Ionicons name="trending-up" size={20} color={colors.warning} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.performanceTitle}>Sales Target Progress</Text>
                    <Text style={styles.performanceSub}>Current Month Performance</Text>
                  </View>
                  <Badge label={`${percentAchieved}% Achieved`} variant="warning" />
                </View>

                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${percentAchieved}%` }]} />
                </View>

                <View style={styles.performanceMetaRow}>
                  <View>
                    <Text style={styles.metaLabel}>Total Revenue</Text>
                    <Text style={styles.revenueValue}>₹{totalRevenue.toLocaleString()}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.metaLabel}>Target</Text>
                    <Text style={styles.targetValue}>₹{monthlyTarget.toLocaleString()}</Text>
                  </View>
                </View>
              </Card>

              {/* Counts Grid */}
              <View style={styles.statsGrid}>
                <Card style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: colors.successLight }]}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  </View>
                  <Text style={styles.statNumber}>{sales.length}</Text>
                  <Text style={styles.statLabel}>Total Conversions</Text>
                </Card>

                <Card style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="cash-outline" size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.statNumber}>
                    {sales.length > 0 ? `₹${Math.round(totalRevenue / sales.length).toLocaleString()}` : '₹0'}
                  </Text>
                  <Text style={styles.statLabel}>Avg Deal Size</Text>
                </Card>
              </View>

              <Text style={styles.sectionHeading}>Closed Transactions</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={styles.dealCard}>
              <View style={styles.dealHeader}>
                <View style={styles.dealLeft}>
                  <View style={styles.dealIconCircle}>
                    <Ionicons name="cart" size={18} color={colors.success} />
                  </View>
                  <View>
                    <Text style={styles.dealLeadName}>
                      {item.leadName || 'Direct Sale'}
                    </Text>
                    <Text style={styles.dealDate}>
                      Converted on {formatDate(item.convertedAt)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.dealAmount}>
                  ₹{(Number(item.dealValue) || 0).toLocaleString()}
                </Text>
              </View>

              {item.notes ? (
                <Text style={styles.dealNotes} numberOfLines={2}>
                  {item.notes}
                </Text>
              ) : null}
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="cart-outline"
              title="No Sales Converted Yet"
              description="Convert assigned leads into sales from the Lead Details screen."
            />
          }
        />
      )}
      </SafeAreaView>
    </AmbientBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  performanceCard: {
    padding: spacing.md,
    backgroundColor: colors.surfaceCard,
    marginBottom: spacing.md,
  },
  performanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  targetIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  performanceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  performanceSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.warning,
    borderRadius: 4,
  },
  performanceMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  revenueValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.success,
    marginTop: 1,
  },
  targetValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.surfaceCard,
    marginBottom: 0,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  dealCard: {
    padding: spacing.md,
    backgroundColor: colors.surfaceCard,
    marginBottom: spacing.sm,
  },
  dealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dealLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  dealIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealLeadName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dealDate: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  dealAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.success,
  },
  dealNotes: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontStyle: 'italic',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs + 2,
  },
});
