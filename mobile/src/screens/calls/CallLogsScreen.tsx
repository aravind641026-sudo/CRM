import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
  RefreshControl,
  TextInput,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Header } from '../../components/common/Header';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { FilterSheetModal } from '../../components/common/FilterSheetModal';
import { useCollapsibleHeader } from '../../utils/useCollapsibleHeader';
import { callApi } from '../../api/callApi';
import { followUpApi } from '../../api/followUpApi';
import { useAuth } from '../../context/AuthContext';
import { Call, FollowUp } from '../../types';
import { isCallMissed } from '../../utils/callGrouping';
import { openSystemDialer } from '../../utils/phoneDialer';

type CallLogTab = 'HISTORY' | 'TODAY' | 'UPCOMING' | 'MISSED';
type AdminScope = 'MY_CALLS' | 'ALL_CALLS';
type DatePreset = 'ALL' | 'TODAY' | 'TOMORROW' | 'WEEK' | 'MONTH' | 'CUSTOM';
type StatusCategoryFilter = 'ALL' | 'PROSPECT' | 'CONNECTED' | 'JUNK' | 'MISSED';

export const CallLogsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user, isAdmin } = useAuth();
  const { handleScroll, collapsibleStyle } = useCollapsibleHeader(68);

  const initialTabParam = route.params?.initialTab;
  const initialTab: CallLogTab =
    initialTabParam === 'TODAY' || initialTabParam === 'UPCOMING' || initialTabParam === 'MISSED'
      ? initialTabParam
      : 'HISTORY';

  // Admin Scope: "MY_CALLS" is the first and default selection for Admins
  const [adminScope, setAdminScope] = useState<AdminScope>('MY_CALLS');
  const [activeTab, setActiveTab] = useState<CallLogTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState<string>('ALL'); // ALL, OUTBOUND, INBOUND
  const [statusFilterVal, setStatusFilterVal] = useState<string>('ALL'); // ALL, CONNECTED, MISSED, BUSY, FAILED
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [durationFilter, setDurationFilter] = useState<'ALL' | 'UNDER_1' | '1_TO_5' | 'OVER_5'>('ALL');
  const [statusCategoryFilter, setStatusCategoryFilter] = useState<StatusCategoryFilter>('ALL');

  // Filter Sheet Modal State
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [tempScope, setTempScope] = useState<AdminScope>(adminScope);
  const [tempTab, setTempTab] = useState<CallLogTab>(activeTab);
  const [tempDirection, setTempDirection] = useState<string>(directionFilter);
  const [tempStatus, setTempStatus] = useState<string>(statusFilterVal);
  const [tempDatePreset, setTempDatePreset] = useState<DatePreset>(datePreset);
  const [tempStartDate, setTempStartDate] = useState(customStartDate);
  const [tempEndDate, setTempEndDate] = useState(customEndDate);
  const [tempDuration, setTempDuration] = useState(durationFilter);

  const [calls, setCalls] = useState<Call[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openFilterModal = () => {
    setTempScope(adminScope);
    setTempTab(activeTab);
    setTempDirection(directionFilter);
    setTempStatus(statusFilterVal);
    setTempDatePreset(datePreset);
    setTempStartDate(customStartDate);
    setTempEndDate(customEndDate);
    setTempDuration(durationFilter);
    setFilterModalVisible(true);
  };

  const handleApplyFilters = () => {
    setAdminScope(tempScope);
    setActiveTab(tempTab);
    setDirectionFilter(tempDirection);
    setStatusFilterVal(tempStatus);
    setDatePreset(tempDatePreset);
    setCustomStartDate(tempStartDate);
    setCustomEndDate(tempEndDate);
    setDurationFilter(tempDuration);
    setStatusCategoryFilter('ALL');
  };

  const handleResetFilters = () => {
    setAdminScope('MY_CALLS');
    setActiveTab('HISTORY');
    setDirectionFilter('ALL');
    setStatusFilterVal('ALL');
    setDatePreset('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    setDurationFilter('ALL');
    setStatusCategoryFilter('ALL');
  };

  const hasActiveFilters = useMemo(() => {
    return (
      (isAdmin && adminScope !== 'MY_CALLS') ||
      activeTab !== 'HISTORY' ||
      directionFilter !== 'ALL' ||
      statusFilterVal !== 'ALL' ||
      datePreset !== 'ALL' ||
      durationFilter !== 'ALL' ||
      statusCategoryFilter !== 'ALL'
    );
  }, [isAdmin, adminScope, activeTab, directionFilter, statusFilterVal, datePreset, durationFilter, statusCategoryFilter]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (isAdmin && adminScope !== 'MY_CALLS') count++;
    if (activeTab !== 'HISTORY') count++;
    if (directionFilter !== 'ALL') count++;
    if (statusFilterVal !== 'ALL') count++;
    if (datePreset !== 'ALL') count++;
    if (durationFilter !== 'ALL') count++;
    if (statusCategoryFilter !== 'ALL') count++;
    return count;
  }, [isAdmin, adminScope, activeTab, directionFilter, statusFilterVal, datePreset, durationFilter, statusCategoryFilter]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      if (activeTab === 'UPCOMING') {
        const res = await followUpApi.getUpcomingFollowUps();
        setFollowUps(res || []);
      } else {
        let statusParam = statusFilterVal !== 'ALL' ? statusFilterVal : undefined;
        let startDate: string | undefined = undefined;
        let endDate: string | undefined = undefined;

        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');

        if (activeTab === 'TODAY' || datePreset === 'TODAY') {
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
          const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
          startDate = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T00:00:00`;
          endDate = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T23:59:59`;
        } else if (datePreset === 'TOMORROW') {
          const tom = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          const start = new Date(tom.getFullYear(), tom.getMonth(), tom.getDate(), 0, 0, 0);
          const end = new Date(tom.getFullYear(), tom.getMonth(), tom.getDate(), 23, 59, 59);
          startDate = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T00:00:00`;
          endDate = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T23:59:59`;
        } else if (datePreset === 'WEEK') {
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1);
          const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0);
          startDate = `${startOfWeek.getFullYear()}-${pad(startOfWeek.getMonth() + 1)}-${pad(startOfWeek.getDate())}T00:00:00`;
          endDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T23:59:59`;
        } else if (datePreset === 'MONTH') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
          startDate = `${startOfMonth.getFullYear()}-${pad(startOfMonth.getMonth() + 1)}-${pad(startOfMonth.getDate())}T00:00:00`;
          endDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T23:59:59`;
        } else if (datePreset === 'CUSTOM') {
          if (customStartDate) startDate = `${customStartDate.slice(0, 10)}T00:00:00`;
          if (customEndDate) endDate = `${customEndDate.slice(0, 10)}T23:59:59`;
        }

        if (activeTab === 'MISSED' || statusCategoryFilter === 'MISSED') {
          statusParam = 'MISSED';
        }

        // If Admin selects MY_CALLS, pass admin's userId
        const targetUserId = isAdmin && adminScope === 'MY_CALLS' ? user?.id : undefined;

        const res = await callApi.getCalls({
          userId: targetUserId,
          status: statusParam,
          startDate,
          endDate,
          size: 300,
        });

        let list = res.content || [];

        // Apply client-side filters if direction or duration thresholds are specified
        if (directionFilter !== 'ALL') {
          list = list.filter((c) => (c.callDirection || 'OUTBOUND').toUpperCase() === directionFilter.toUpperCase());
        }

        // Analytics Category Filters
        if (statusCategoryFilter === 'PROSPECT') {
          list = list.filter((c) => {
            const rawStatus = (c.callStatus || '').toUpperCase();
            const duration = c.durationSeconds || 0;
            const isMissed = isCallMissed(c) || rawStatus === 'MISSED' || c.isConnected === false;
            return !isMissed && (rawStatus === 'PROSPECT' || duration > 300);
          });
        } else if (statusCategoryFilter === 'CONNECTED') {
          list = list.filter((c) => {
            const rawStatus = (c.callStatus || '').toUpperCase();
            const duration = c.durationSeconds || 0;
            const isMissed = isCallMissed(c) || rawStatus === 'MISSED' || c.isConnected === false;
            return !isMissed && rawStatus !== 'PROSPECT' && rawStatus !== 'JUNK' && duration >= 30 && duration <= 300;
          });
        } else if (statusCategoryFilter === 'JUNK') {
          list = list.filter((c) => {
            const rawStatus = (c.callStatus || '').toUpperCase();
            const duration = c.durationSeconds || 0;
            const isMissed = isCallMissed(c) || rawStatus === 'MISSED' || c.isConnected === false;
            return !isMissed && (rawStatus === 'JUNK' || duration < 30);
          });
        } else if (statusCategoryFilter === 'MISSED') {
          list = list.filter((c) => {
            const rawStatus = (c.callStatus || '').toUpperCase();
            return isCallMissed(c) || rawStatus === 'MISSED' || c.isConnected === false;
          });
        } else {
          if (durationFilter === 'UNDER_1') {
            list = list.filter((c) => (c.durationSeconds || 0) < 60);
          } else if (durationFilter === '1_TO_5') {
            list = list.filter((c) => (c.durationSeconds || 0) >= 60 && (c.durationSeconds || 0) <= 300);
          } else if (durationFilter === 'OVER_5') {
            list = list.filter((c) => (c.durationSeconds || 0) > 300);
          }
        }

        setCalls(list);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to fetch call logs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    activeTab,
    adminScope,
    isAdmin,
    user?.id,
    directionFilter,
    statusFilterVal,
    datePreset,
    customStartDate,
    customEndDate,
    durationFilter,
    statusCategoryFilter,
  ]);

  useFocusEffect(
    useCallback(() => {
      const sf = route.params?.statusFilter;
      const dp = route.params?.datePreset;
      const cs = route.params?.customStartDate;
      const ce = route.params?.customEndDate;

      if (sf !== undefined) {
        if (sf === 'PROSPECT') {
          setStatusCategoryFilter('PROSPECT');
          setActiveTab('HISTORY');
        } else if (sf === 'CONNECTED') {
          setStatusCategoryFilter('CONNECTED');
          setActiveTab('HISTORY');
        } else if (sf === 'JUNK') {
          setStatusCategoryFilter('JUNK');
          setActiveTab('HISTORY');
        } else if (sf === 'MISSED') {
          setStatusCategoryFilter('MISSED');
          setActiveTab('MISSED');
        } else {
          setStatusCategoryFilter('ALL');
          setActiveTab('HISTORY');
        }
      }

      if (dp !== undefined) {
        setDatePreset(dp);
      }
      if (cs !== undefined) {
        setCustomStartDate(cs);
      }
      if (ce !== undefined) {
        setCustomEndDate(ce);
      }
      loadData(true);
    }, [
      route.params?.statusFilter,
      route.params?.datePreset,
      route.params?.customStartDate,
      route.params?.customEndDate,
      loadData,
    ])
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handleDirectCall = (phone?: string) => {
    openSystemDialer(phone);
  };

  const handleOpenGroupDetails = (group: any) => {
    navigation.navigate('CallHistoryDetail', {
      phoneNumber: group.phoneNumber,
      leadId: group.leadId,
      leadName: group.leadName,
      groupedLog: group,
    });
  };

  const handleOpenLead = (leadId: number, leadName?: string) => {
    navigation.navigate('LeadDetails', { leadId, leadName });
  };

  const handleClearFilter = () => {
    handleResetFilters();
  };

  const formatCallDateTime = (iso?: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = d.getDate();
      const month = months[d.getMonth()];
      const hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const h12 = hours % 12 || 12;
      const m = minutes.toString().padStart(2, '0');
      return `${day} ${month}, ${h12}:${m} ${ampm}`;
    } catch {
      return iso;
    }
  };

  // Filter raw calls directly (Each call is a separate record, no grouping by phone)
  const filteredCalls = useMemo(() => {
    if (!searchQuery.trim()) return calls;
    const q = searchQuery.toLowerCase().trim();
    return calls.filter((c) => {
      const name = (c.leadName || '').toLowerCase();
      const phone = (c.leadPhone || (c as any).phoneNumber || '').toLowerCase();
      const project = ((c as any).project?.name || (c as any).projectName || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || project.includes(q);
    });
  }, [calls, searchQuery]);

  return (
    <AmbientBackground variant="dial">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        {/* Top Header Row with Back Button + QMEX Logo */}
        <View style={styles.topHeaderBar}>
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#1E293B" />
          </TouchableOpacity>
          <View style={styles.headerLogoContainer}>
            <Image
              source={require('../../../assets/qmex-logo.png')}
              style={styles.headerLogoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Collapsible Search + Filter Bar */}
        <Animated.View style={collapsibleStyle}>
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            placeholder="Search by phone, name or project..."
            onFilterPress={openFilterModal}
            isFilterActive={hasActiveFilters}
            activeFilterCount={activeFilterCount}
          />
        </Animated.View>

        {/* Filter Sheet Modal */}
        <FilterSheetModal
          visible={filterModalVisible}
          onClose={() => setFilterModalVisible(false)}
          title="Filter Calls"
          hasActiveFilters={hasActiveFilters}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
        >
          {/* Admin Scope Filter */}
          {isAdmin && (
            <View style={styles.filterGroup}>
              <Text style={styles.filterSectionTitle}>CALL SCOPE</Text>
              <View style={styles.filterOptionsRow}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    tempScope === 'MY_CALLS' && styles.filterChipActive,
                  ]}
                  onPress={() => setTempScope('MY_CALLS')}
                >
                  <Ionicons
                    name="person"
                    size={13}
                    color={tempScope === 'MY_CALLS' ? '#FFFFFF' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      tempScope === 'MY_CALLS' && styles.filterChipTextActive,
                    ]}
                  >
                    My Calls
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    tempScope === 'ALL_CALLS' && styles.filterChipActive,
                  ]}
                  onPress={() => setTempScope('ALL_CALLS')}
                >
                  <Ionicons
                    name="people"
                    size={13}
                    color={tempScope === 'ALL_CALLS' ? '#FFFFFF' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      tempScope === 'ALL_CALLS' && styles.filterChipTextActive,
                    ]}
                  >
                    All Team Calls
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Period / Category */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterSectionTitle}>CATEGORY / PERIOD</Text>
            <View style={styles.filterOptionsRow}>
              {(
                [
                  { id: 'HISTORY', label: 'All History' },
                  { id: 'TODAY', label: 'Today' },
                  { id: 'UPCOMING', label: 'Follow-ups' },
                  { id: 'MISSED', label: 'Missed' },
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

          {/* Date Filter */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterSectionTitle}>DATE RANGE</Text>
            <View style={styles.filterOptionsRow}>
              {(
                [
                  { id: 'ALL', label: 'All Time' },
                  { id: 'TODAY', label: 'Today' },
                  { id: 'TOMORROW', label: 'Tomorrow' },
                  { id: 'CUSTOM', label: 'Custom' },
                ] as const
              ).map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[
                    styles.filterChip,
                    tempDatePreset === d.id && styles.filterChipActive,
                  ]}
                  onPress={() => setTempDatePreset(d.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      tempDatePreset === d.id && styles.filterChipTextActive,
                    ]}
                  >
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {tempDatePreset === 'CUSTOM' && (
              <View style={styles.customDateInputs}>
                <View style={styles.dateInputCol}>
                  <Text style={styles.dateInputLabel}>From (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="2026-09-26"
                    placeholderTextColor="#94A3B8"
                    value={tempStartDate}
                    onChangeText={setTempStartDate}
                  />
                </View>
                <View style={styles.dateInputCol}>
                  <Text style={styles.dateInputLabel}>To (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="2026-09-30"
                    placeholderTextColor="#94A3B8"
                    value={tempEndDate}
                    onChangeText={setTempEndDate}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Call Direction */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterSectionTitle}>CALL DIRECTION</Text>
            <View style={styles.filterOptionsRow}>
              {(
                [
                  { id: 'ALL', label: 'All Directions' },
                  { id: 'OUTBOUND', label: 'Outbound' },
                  { id: 'INBOUND', label: 'Inbound' },
                ] as const
              ).map((dir) => (
                <TouchableOpacity
                  key={dir.id}
                  style={[
                    styles.filterChip,
                    tempDirection === dir.id && styles.filterChipActive,
                  ]}
                  onPress={() => setTempDirection(dir.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      tempDirection === dir.id && styles.filterChipTextActive,
                    ]}
                  >
                    {dir.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Call Duration */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterSectionTitle}>DURATION</Text>
            <View style={styles.filterOptionsRow}>
              {(
                [
                  { id: 'ALL', label: 'Any Duration' },
                  { id: 'UNDER_1', label: '< 1 min' },
                  { id: '1_TO_5', label: '1 – 5 mins' },
                  { id: 'OVER_5', label: '> 5 mins' },
                ] as const
              ).map((dur) => (
                <TouchableOpacity
                  key={dur.id}
                  style={[
                    styles.filterChip,
                    tempDuration === dur.id && styles.filterChipActive,
                  ]}
                  onPress={() => setTempDuration(dur.id as any)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      tempDuration === dur.id && styles.filterChipTextActive,
                    ]}
                  >
                    {dur.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </FilterSheetModal>

        {/* Active Category Filter Pill */}
        {statusCategoryFilter !== 'ALL' && (
          <View style={styles.activeCategoryPillRow}>
            <View style={styles.activeCategoryPill}>
              <Ionicons
                name={
                  statusCategoryFilter === 'PROSPECT'
                    ? 'star'
                    : statusCategoryFilter === 'CONNECTED'
                    ? 'checkmark'
                    : statusCategoryFilter === 'JUNK'
                    ? 'time'
                    : 'call'
                }
                size={14}
                color={
                  statusCategoryFilter === 'PROSPECT'
                    ? '#8B5CF6'
                    : statusCategoryFilter === 'CONNECTED'
                    ? '#10B981'
                    : statusCategoryFilter === 'JUNK'
                    ? '#F97316'
                    : '#EF4444'
                }
              />
              <Text style={styles.activeCategoryPillText}>
                Filter: {statusCategoryFilter} ({filteredCalls.length} calls)
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setStatusCategoryFilter('ALL');
                  loadData(true);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.activeCategoryClearBtn}
              >
                <Ionicons name="close-circle" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>
        )}

      {loading && !refreshing ? (
        <LoadingState message="Loading call records..." fullScreen />
      ) : error ? (
        <ErrorState message={error} onRetry={() => loadData()} fullScreen />
      ) : activeTab === 'UPCOMING' ? (
        <FlatList
          data={followUps}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
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
          renderItem={({ item }) => (
            <Card
              style={styles.logCard}
              onPress={() => handleOpenLead(item.leadId, item.leadName)}
            >
              <View style={styles.cardTop}>
                <View style={styles.leadHeaderLeft}>
                  <View style={[styles.iconBox, { backgroundColor: colors.warningLight }]}>
                    <Ionicons name="alarm-outline" size={18} color={colors.warning} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leadName} numberOfLines={1}>
                      {item.leadName || item.leadPhone || 'Follow-up Contact'}
                    </Text>
                    <Text style={styles.scheduledTimeText}>
                      Scheduled: {formatCallDateTime(item.scheduledTime)}
                    </Text>
                  </View>
                </View>

                {item.leadPhone ? (
                  <TouchableOpacity
                    style={styles.quickCallBtn}
                    onPress={() => handleDirectCall(item.leadPhone)}
                  >
                    <Ionicons name="call" size={16} color="#ffffff" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {item.notes ? (
                <Text style={styles.notesText} numberOfLines={2}>
                  {item.notes}
                </Text>
              ) : null}

              <View style={styles.cardFooter}>
                <Badge label={item.status} status={item.status} />
                <View style={styles.viewDetailsLink}>
                  <Text style={styles.viewDetailsText}>View Lead</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                </View>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title="No Upcoming Follow-ups"
              description="You have no scheduled follow-ups pending."
            />
          }
        />
      ) : (
        /* Call Logs FlatList (Separate individual records, no grouping by phone) */
        <FlatList
          data={filteredCalls}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
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
          renderItem={({ item }) => {
            const missed = isCallMissed(item);
            const isIncoming = item.callDirection === 'INBOUND' || item.callStatus === 'INCOMING';

            let directionIcon: keyof typeof Ionicons.glyphMap = 'arrow-up-outline';
            let directionColor = '#2563EB';
            let directionLabel = 'Outbound';

            if (missed) {
              directionIcon = 'close-circle';
              directionColor = '#DC2626';
              directionLabel = 'Missed';
            } else if (isIncoming) {
              directionIcon = 'arrow-down-outline';
              directionColor = '#0284C7';
              directionLabel = 'Inbound';
            }

            const displayName =
              item.leadName ||
              item.leadPhone ||
              (item as any).phoneNumber ||
              'Caller';
            const displayPhone = item.leadPhone || (item as any).phoneNumber || '';
            const timestamp = formatCallDateTime(item.startTime || item.startedAt || item.createdAt);

            let statusLabel = 'CONNECTED';
            let statusBg = '#DCFCE7';
            let statusColor = '#16A34A';
            let statusBorder = '#BBF7D0';

            const rawStatus = (item.callStatus || '').toUpperCase();

            if (missed || rawStatus === 'MISSED') {
              statusLabel = 'MISSED';
              statusBg = '#FEE2E2';
              statusColor = '#DC2626';
              statusBorder = '#FECACA';
            } else if (rawStatus === 'JUNK' || (item.durationSeconds != null && item.durationSeconds < 30 && rawStatus !== 'CONNECTED')) {
              statusLabel = 'JUNK';
              statusBg = '#FFEDD5';
              statusColor = '#EA580C';
              statusBorder = '#FED7AA';
            } else if (rawStatus === 'CONNECTED' || (item.durationSeconds != null && item.durationSeconds >= 30)) {
              statusLabel = 'CONNECTED';
              statusBg = '#DCFCE7';
              statusColor = '#16A34A';
              statusBorder = '#BBF7D0';
            } else if (rawStatus === 'NOT_ATTENDED' || rawStatus === 'NO_ANSWER') {
              statusLabel = 'NOT ATTENDED';
              statusBg = '#FEF3C7';
              statusColor = '#D97706';
              statusBorder = '#FDE68A';
            } else if (rawStatus === 'REJECTED') {
              statusLabel = 'REJECTED';
              statusBg = '#FFE4E6';
              statusColor = '#E11D48';
              statusBorder = '#FECDD3';
            } else if (rawStatus === 'BUSY') {
              statusLabel = 'BUSY';
              statusBg = '#F3F4F6';
              statusColor = '#4B5563';
              statusBorder = '#E5E7EB';
            } else if (rawStatus) {
              statusLabel = rawStatus.replace('_', ' ');
              statusBg = '#EFF6FF';
              statusColor = '#2563EB';
              statusBorder = '#BFDBFE';
            }

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.compactCallCard}
                activeOpacity={0.7}
                onPress={() => {
                  navigation.navigate('CallHistoryDetail', {
                    callId: item.id,
                    phoneNumber: displayPhone,
                    leadId: item.leadId,
                    leadName: item.leadName,
                    call: item,
                  });
                }}
              >
                {/* Line 1: Lead Name (Left) + Status Badge (Right) */}
                <View style={styles.cardRow1}>
                  <View style={styles.nameLeadRow}>
                    <Text style={styles.cardLeadName} numberOfLines={1}>
                      {displayName}
                    </Text>
                    {item.leadId ? (
                      <View style={styles.miniCrmTag}>
                        <Text style={styles.miniCrmTagText}>CRM</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={[styles.compactStatusPill, { backgroundColor: statusBg, borderColor: statusBorder }]}>
                    <Text style={[styles.compactStatusText, { color: statusColor }]}>
                      {statusLabel}
                    </Text>
                  </View>
                </View>

                {/* Line 2: Phone number */}
                <Text style={styles.cardPhoneText}>{displayPhone}</Text>

                {/* Line 3: Direction indicator + Date/Time (Left) + Direct Call Button (Right) */}
                <View style={styles.cardRow3}>
                  <View style={styles.cardMetaLeft}>
                    <Ionicons name={directionIcon} size={12} color={directionColor} style={{ marginRight: 4 }} />
                    <Text style={[styles.cardMetaText, missed && { color: '#DC2626' }]}>
                      {directionLabel} • {timestamp}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.miniCallActionBtn}
                    activeOpacity={0.75}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => handleDirectCall(displayPhone)}
                  >
                    <Ionicons name="call" size={11} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="call-outline"
              title="No Call Records"
              description={
                searchQuery
                  ? `No call records matching "${searchQuery}".`
                  : 'No calls found for the selected period or filter.'
              }
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
    backgroundColor: colors.background,
  },
  topHeaderBar: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogoContainer: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerLogoImage: {
    width: 90,
    height: 36,
  },
  adminScopeContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  adminScopeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
  },
  adminScopeBtnActive: {
    backgroundColor: colors.primary,
  },
  adminScopeBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  adminScopeBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  topSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 34,
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topSearchInput: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    marginLeft: 6,
    paddingVertical: 0,
  },
  filterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginHorizontal: 16,
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  filterBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  filterBannerText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.primary,
    flex: 1,
  },
  clearFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  clearFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 4,
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 2,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#ffffff',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 2,
  },
  compactCallCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 1,
  },
  nameLeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
    gap: 5,
  },
  cardLeadName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  miniCrmTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#C7D2FE',
  },
  miniCrmTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4F46E5',
  },
  compactStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 0.8,
  },
  compactStatusText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  cardPhoneText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 2,
  },
  cardRow3: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardMetaText: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '500',
  },
  miniCallActionBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  // Upcoming Follow-up Card Styles (if viewed in Follow-ups tab)
  logCard: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    marginBottom: 6,
    borderRadius: 10,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  leadHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leadName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  phoneText: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 1,
  },
  scheduledTimeText: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '500',
    marginTop: 1,
  },
  quickCallBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.callGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesText: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  viewDetailsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailsText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
  },
  filterGroup: {
    marginBottom: 6,
  },
  filterSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
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
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  customDateInputs: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  dateInputCol: {
    flex: 1,
  },
  dateInputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  modalTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12.5,
    color: '#0F172A',
  },
  activeCategoryPillRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  activeCategoryPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#6D28D9',
  },
  activeCategoryClearBtn: {
    marginLeft: 4,
  },
});
