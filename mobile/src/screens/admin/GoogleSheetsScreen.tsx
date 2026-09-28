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
import { MeqHeader } from '../../components/common/MeqHeader';
import { Card } from '../../components/common/Card';
import { LoadingState } from '../../components/common/LoadingState';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { sheetsApi } from '../../api/sheetsApi';
import { GoogleSheetsSyncLog } from '../../types';

export const GoogleSheetsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [history, setHistory] = useState<GoogleSheetsSyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const historyRes = await sheetsApi.getSyncHistory({ size: 50 });
      setHistory(historyRes.content || []);
    } catch (err: any) {
      console.warn('Failed to load Google Sync history data:', err);
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

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const renderHistoryItem = ({ item }: { item: GoogleSheetsSyncLog }) => {
    const isSuccess = item.status === 'SUCCESS';
    const isFailed = item.status === 'FAILED';
    const timeStr = formatTimestamp(item.completedAt || item.startedAt || item.syncTimestamp || item.createdAt);
    const triggeredName =
      typeof item.triggeredBy === 'object' && item.triggeredBy?.name
        ? item.triggeredBy.name
        : (item.triggeredBy || 'System Administrator');

    return (
      <View style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <View style={styles.historyLeft}>
            <View
              style={[
                styles.statusBadge,
                isSuccess ? styles.statusSuccess : isFailed ? styles.statusFailed : styles.statusPending,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: isSuccess ? '#16A34A' : isFailed ? '#DC2626' : '#D97706' },
                ]}
              >
                {item.status}
              </Text>
            </View>
          </View>
          <Text style={styles.historyTime}>{timeStr}</Text>
        </View>

        <View style={styles.historyMetaRow}>
          <Text style={styles.recordsText}>
            Records Synced: <Text style={styles.recordsNum}>{item.recordsSynced ?? 0}</Text>
          </Text>
          <Text style={styles.triggeredByText}>By: {triggeredName}</Text>
        </View>

        {/* Category breakdown snippet */}
        {(item.usersCount !== undefined ||
          item.projectsCount !== undefined ||
          item.leadsCount !== undefined ||
          item.callsCount !== undefined) && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownText}>
              {item.usersCount ?? 0} users • {item.projectsCount ?? 0} projects • {item.leadsCount ?? 0} leads • {item.callsCount ?? 0} calls
            </Text>
          </View>
        )}

        {item.errorMessage ? (
          <Text style={styles.errorText} numberOfLines={2}>
            {item.errorMessage}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <AmbientBackground variant="admin">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <MeqHeader
        showLogo={false}
        title="Google Sync History"
        subtitle="View Google Sheets synchronization history"
        onBack={() => navigation.goBack()}
      />

      {loading && !refreshing ? (
        <LoadingState message="Loading sync history..." fullScreen />
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderHistoryItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            <View style={styles.headerSection}>
              <Text style={styles.sectionTitle}>Synchronization Records</Text>
            </View>
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyCard}>
                <Ionicons name="time-outline" size={44} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No Sync History Found</Text>
                <Text style={styles.emptySubtitle}>
                  No Google Sheets synchronization records have been logged yet.
                </Text>
              </View>
            ) : null
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  },
  headerSection: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.8)',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusSuccess: {
    backgroundColor: '#DCFCE7',
  },
  statusFailed: {
    backgroundColor: '#FEE2E2',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  historyTime: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  historyMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  recordsText: {
    fontSize: 12,
    color: '#4B5563',
  },
  recordsNum: {
    fontWeight: '800',
    color: '#111827',
  },
  triggeredByText: {
    fontSize: 11,
    color: '#6B7280',
  },
  breakdownRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  breakdownText: {
    fontSize: 11,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 6,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
