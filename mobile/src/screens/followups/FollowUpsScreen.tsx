import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { LoadingState } from '../../components/common/LoadingState';
import { EmptyState } from '../../components/common/EmptyState';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { FilterSheetModal } from '../../components/common/FilterSheetModal';
import { useCollapsibleHeader } from '../../utils/useCollapsibleHeader';
import { followUpApi } from '../../api/followUpApi';
import { FollowUp } from '../../types';

type FollowUpTab = 'today' | 'upcoming' | 'overdue' | 'completed';

export const FollowUpsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { handleScroll, collapsibleStyle } = useCollapsibleHeader(68);

  const initialPeriod = (route.params?.period as FollowUpTab) || 'today';
  const [activeTab, setActiveTab] = useState<FollowUpTab>(initialPeriod);
  const [searchQuery, setSearchQuery] = useState('');
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter Sheet Modal State
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [tempTab, setTempTab] = useState<FollowUpTab>(activeTab);

  const openFilterModal = () => {
    setTempTab(activeTab);
    setFilterModalVisible(true);
  };

  const handleApplyFilters = () => {
    setActiveTab(tempTab);
  };

  const handleResetFilters = () => {
    setActiveTab('today');
  };

  const hasActiveFilters = activeTab !== 'today';
  const activeFilterCount = hasActiveFilters ? 1 : 0;

  const fetchFollowUps = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      let params: any = { size: 50 };
      if (activeTab === 'completed') {
        params.status = 'COMPLETED';
      } else {
        params.period = activeTab;
      }
      const res = await followUpApi.getFollowUps(params);
      setFollowUps(res.content || []);
    } catch (err: any) {
      console.warn('Failed to load follow-ups:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFollowUps(true);
  };

  const handleMarkCompleted = async (fu: FollowUp) => {
    try {
      await followUpApi.toggleStatus(fu.id, 'COMPLETED');
      Alert.alert('Follow-up Completed', 'The callback was marked as completed.');
      fetchFollowUps(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to update follow-up status.');
    }
  };

  const handleQuickCall = (phone?: string) => {
    if (!phone) {
      Alert.alert('No Number', 'No phone number is available for this lead.');
      return;
    }
    Linking.openURL(`tel:${phone.trim()}`);
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const filteredFollowUps = useMemo(() => {
    if (!searchQuery.trim()) return followUps;
    const q = searchQuery.toLowerCase().trim();
    return followUps.filter((item) => {
      const name = (item.leadName || '').toLowerCase();
      const phone = (item.leadPhone || '').toLowerCase();
      const notes = (item.notes || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || notes.includes(q);
    });
  }, [followUps, searchQuery]);

  const renderFollowUpItem = ({ item }: { item: FollowUp }) => {
    const isCompleted = item.status === 'COMPLETED';

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.leadInfo}>
            <Text style={styles.leadName}>{item.leadName || item.leadPhone || 'Scheduled Follow-up'}</Text>
            {item.leadPhone ? (
              <Text style={styles.leadPhone}>{item.leadPhone}</Text>
            ) : null}
          </View>
          <Badge label={item.status} status={item.status} />
        </View>

        <View style={styles.timeRow}>
          <Ionicons
            name="calendar-outline"
            size={14}
            color={activeTab === 'overdue' ? colors.danger : colors.info}
          />
          <Text
            style={[
              styles.timeText,
              activeTab === 'overdue' && { color: colors.danger, fontWeight: '700' },
            ]}
          >
            Scheduled: {formatDateTime(item.scheduledTime || item.followUpDate)}
          </Text>
        </View>

        {item.notes ? (
          <View style={styles.notesContainer}>
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          {item.leadPhone ? (
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => handleQuickCall(item.leadPhone)}
              activeOpacity={0.7}
            >
              <Ionicons name="call" size={13} color="#ffffff" />
              <Text style={styles.callBtnText}>Call Customer</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.viewLeadBtn}
            onPress={() =>
              navigation.navigate('LeadDetails', {
                leadId: item.leadId,
                leadName: item.leadName,
              })
            }
            activeOpacity={0.7}
          >
            <Ionicons name="person-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.viewLeadBtnText}>View Details</Text>
          </TouchableOpacity>

          {!isCompleted && (
            <TouchableOpacity
              style={styles.completeBtn}
              onPress={() => handleMarkCompleted(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-done" size={14} color="#10b981" />
              <Text style={styles.completeBtnText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  };

  return (
    <AmbientBackground variant="leads">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <Header
          title="Follow-ups Console"
          subtitle="Customer callback promises, appointments & scheduled visits"
          onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        />

        {/* Collapsible Search + Filter Bar */}
        <Animated.View style={collapsibleStyle}>
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            placeholder="Search follow-ups by lead, phone or notes..."
            onFilterPress={openFilterModal}
            isFilterActive={hasActiveFilters}
            activeFilterCount={activeFilterCount}
          />
        </Animated.View>

        {/* Filter Sheet Modal */}
        <FilterSheetModal
          visible={filterModalVisible}
          onClose={() => setFilterModalVisible(false)}
          title="Filter Follow-ups"
          hasActiveFilters={hasActiveFilters}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
        >
          <View style={styles.filterGroup}>
            <Text style={styles.filterSectionTitle}>FOLLOW-UP STATUS & TIMING</Text>
            <View style={styles.filterOptionsRow}>
              {(
                [
                  { id: 'today', label: 'Today', icon: 'today-outline' },
                  { id: 'overdue', label: 'Overdue', icon: 'alert-circle-outline' },
                  { id: 'upcoming', label: 'Upcoming', icon: 'calendar-outline' },
                  { id: 'completed', label: 'Completed', icon: 'checkmark-circle-outline' },
                ] as const
              ).map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.filterChip,
                    tempTab === t.id && styles.filterChipActive,
                  ]}
                  onPress={() => setTempTab(t.id)}
                >
                  <Ionicons
                    name={t.icon as any}
                    size={14}
                    color={tempTab === t.id ? '#FFFFFF' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      tempTab === t.id && styles.filterChipTextActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </FilterSheetModal>

        {loading && !refreshing ? (
          <LoadingState message="Loading scheduled follow-ups..." fullScreen />
        ) : filteredFollowUps.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title={`No ${activeTab.toUpperCase()} Follow-ups`}
            description={
              searchQuery
                ? 'No follow-ups match your search query.'
                : `You have no ${activeTab} scheduled callbacks at this time.`
            }
          />
        ) : (
          <FlatList
            data={filteredFollowUps}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderFollowUpItem}
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
  card: {
    padding: spacing.sm + 2,
    marginBottom: spacing.xs + 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leadInfo: {
    flex: 1,
  },
  leadName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  leadPhone: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  timeText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  notesContainer: {
    backgroundColor: colors.surfaceElevated,
    padding: spacing.xs + 2,
    borderRadius: spacing.borderRadius.sm,
    marginTop: spacing.xs,
  },
  notesText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginTop: spacing.xs + 2,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  callBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  viewLeadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewLeadBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.25)',
  },
  completeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
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
