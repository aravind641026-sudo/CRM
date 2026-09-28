import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { MeqHeader } from '../../components/common/MeqHeader';
import { Card } from '../../components/common/Card';
import { LoadingState } from '../../components/common/LoadingState';
import { EmptyState } from '../../components/common/EmptyState';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { FilterSheetModal } from '../../components/common/FilterSheetModal';
import { useCollapsibleHeader } from '../../utils/useCollapsibleHeader';
import { auditApi } from '../../api/auditApi';
import { AuditLog } from '../../types';

export const AuditLogsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { handleScroll, collapsibleStyle } = useCollapsibleHeader(68);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [entityFilter, setEntityFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  // Filter Sheet Modal State
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [tempEntity, setTempEntity] = useState<string>(entityFilter);
  const [tempAction, setTempAction] = useState<string>(actionFilter);

  const openFilterModal = () => {
    setTempEntity(entityFilter);
    setTempAction(actionFilter);
    setFilterModalVisible(true);
  };

  const handleApplyFilters = () => {
    setEntityFilter(tempEntity);
    setActionFilter(tempAction);
  };

  const handleResetFilters = () => {
    setEntityFilter('');
    setActionFilter('ALL');
  };

  const hasActiveFilters = entityFilter !== '' || actionFilter !== 'ALL';
  const activeFilterCount = (entityFilter !== '' ? 1 : 0) + (actionFilter !== 'ALL' ? 1 : 0);

  const fetchLogs = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await auditApi.getAuditLogs({
        entityName: entityFilter || undefined,
        size: 50,
      });
      setLogs(res.content || []);
    } catch (err) {
      console.warn('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [entityFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLogs(true);
  };

  const filteredLogs = useMemo(() => {
    let list = logs;

    if (actionFilter !== 'ALL') {
      list = list.filter((l) => (l.action || '').toUpperCase() === actionFilter.toUpperCase());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((l) => {
        const ent = (l.entityName || '').toLowerCase();
        const usr = (l.userName || '').toLowerCase();
        const det = (l.details || '').toLowerCase();
        const act = (l.action || '').toLowerCase();
        const id = String(l.entityId || '');
        return ent.includes(q) || usr.includes(q) || det.includes(q) || act.includes(q) || id.includes(q);
      });
    }

    return list;
  }, [logs, searchQuery, actionFilter]);

  const getActionColor = (action: string) => {
    switch (action.toUpperCase()) {
      case 'CREATE':
        return '#10b981';
      case 'UPDATE':
      case 'OUTCOME_CHANGE':
        return '#3b82f6';
      case 'DELETE':
        return '#ef4444';
      case 'ASSIGN':
      case 'REASSIGN':
        return '#f59e0b';
      case 'STATUS_CHANGE':
        return '#8b5cf6';
      default:
        return colors.textSecondary;
    }
  };

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return '';
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

  const renderLogItem = ({ item }: { item: AuditLog }) => {
    const actionColor = getActionColor(item.action);

    return (
      <View style={styles.logCard}>
        <View style={styles.logHeader}>
          <View style={styles.logLeft}>
            <View style={[styles.actionTag, { backgroundColor: `${actionColor}18`, borderColor: `${actionColor}40` }]}>
              <Text style={[styles.actionTagText, { color: actionColor }]}>
                {item.action}
              </Text>
            </View>
            <Text style={styles.entityText}>{item.entityName}</Text>
          </View>
          <Text style={styles.timeText}>{formatTimestamp(item.createdAt)}</Text>
        </View>

        {item.details ? (
          <Text style={styles.detailsText} numberOfLines={2}>
            {item.details}
          </Text>
        ) : null}

        <View style={styles.userFooter}>
          <Ionicons name="person-circle-outline" size={14} color={colors.textMuted} />
          <Text style={styles.userNameText}>
            By: {item.userName || 'System Administrator'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <AmbientBackground variant="admin">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <MeqHeader
          showLogo={false}
          title="System Audit Trail"
          subtitle="Immutable stream of record modifications"
          onBack={() => navigation.goBack()}
        />

        {/* Collapsible Search + Filter Bar */}
        <Animated.View style={collapsibleStyle}>
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            placeholder="Search audit trail by entity, user or action..."
            onFilterPress={openFilterModal}
            isFilterActive={hasActiveFilters}
            activeFilterCount={activeFilterCount}
          />
        </Animated.View>

        {/* Filter Sheet Modal */}
        <FilterSheetModal
          visible={filterModalVisible}
          onClose={() => setFilterModalVisible(false)}
          title="Filter Audit Trail"
          hasActiveFilters={hasActiveFilters}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
        >
          {/* Entity Filter */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterSectionTitle}>SYSTEM ENTITY</Text>
            <View style={styles.filterOptionsRow}>
              {[
                { id: '', label: 'All Entities' },
                { id: 'Lead', label: 'Lead' },
                { id: 'User', label: 'User' },
                { id: 'Call', label: 'Call Log' },
                { id: 'Project', label: 'Project' },
                { id: 'Sale', label: 'Sale' },
              ].map((ent) => (
                <TouchableOpacity
                  key={ent.id}
                  style={[
                    styles.filterChip,
                    tempEntity === ent.id && styles.filterChipActive,
                  ]}
                  onPress={() => setTempEntity(ent.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      tempEntity === ent.id && styles.filterChipTextActive,
                    ]}
                  >
                    {ent.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Action Filter */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterSectionTitle}>ACTION TYPE</Text>
            <View style={styles.filterOptionsRow}>
              {[
                { id: 'ALL', label: 'All Actions' },
                { id: 'CREATE', label: 'Create' },
                { id: 'UPDATE', label: 'Update' },
                { id: 'DELETE', label: 'Delete' },
                { id: 'STATUS_CHANGE', label: 'Status Change' },
                { id: 'ASSIGN', label: 'Assign / Reassign' },
              ].map((act) => (
                <TouchableOpacity
                  key={act.id}
                  style={[
                    styles.filterChip,
                    tempAction === act.id && styles.filterChipActive,
                  ]}
                  onPress={() => setTempAction(act.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      tempAction === act.id && styles.filterChipTextActive,
                    ]}
                  >
                    {act.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </FilterSheetModal>

        {loading && !refreshing ? (
          <LoadingState message="Loading audit history..." fullScreen />
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title="No Audit Logs"
            message={
              searchQuery || hasActiveFilters
                ? 'No activity records match your current search and filters.'
                : 'Activity records will appear here as changes occur in the CRM.'
            }
            actionLabel={searchQuery || hasActiveFilters ? 'Reset Filters' : undefined}
            onAction={searchQuery || hasActiveFilters ? handleResetFilters : undefined}
          />
        ) : (
          <FlatList
            data={filteredLogs}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderLogItem}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  },
  logCard: {
    padding: spacing.sm + 2,
    marginBottom: spacing.xs + 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  actionTagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  entityText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  timeText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  detailsText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  userFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs + 2,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  userNameText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  filterGroup: {
    marginBottom: 8,
  },
  filterSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  filterOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#6D28D9',
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
