import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { MeqHeader } from '../../components/common/MeqHeader';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { FilterSheetModal } from '../../components/common/FilterSheetModal';
import { callApi } from '../../api/callApi';
import { usersApi } from '../../api/usersApi';
import { useAuth } from '../../context/AuthContext';
import { Call, User } from '../../types';
import { isCallMissed } from '../../utils/callGrouping';

type DateFilterOption = 'TODAY' | 'TOMORROW' | 'WEEK' | 'MONTH' | 'CUSTOM';

// Smooth number counter component for loaded analytics values
const AnimatedCounter: React.FC<{ value: number; style: any }> = ({ value, style }) => {
  const [displayVal, setDisplayVal] = useState(value);
  const animVal = useRef(new Animated.Value(value)).current;

  useEffect(() => {
    const listenerId = animVal.addListener(({ value: v }) => {
      setDisplayVal(Math.round(v));
    });
    Animated.timing(animVal, {
      toValue: value,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    return () => {
      animVal.removeListener(listenerId);
    };
  }, [value]);

  return <Text style={style}>{displayVal}</Text>;
};

// Premium Reference 2x2 Grid Analytics Card
interface StatCardProps {
  title: string;
  subtitle: string;
  value: number;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBgColor: string;
  arrowBgColor: string;
  arrowColor: string;
  waveGradient: [string, string];
  onPress: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  subtitle,
  value,
  iconName,
  iconColor,
  iconBgColor,
  arrowBgColor,
  arrowColor,
  waveGradient,
  onPress,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  };

  return (
    <Animated.View style={[styles.gridCardWrapper, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={styles.gridCardContainer}
      >
        {/* Ambient Corner Accent Wave */}
        <View style={styles.cardCornerWaveWrap} pointerEvents="none">
          <LinearGradient
            colors={waveGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardCornerWave}
          />
        </View>

        {/* Top Row: Circular Icon on Left + Small Circle Arrow on Right */}
        <View style={styles.gridCardTopRow}>
          <View style={[styles.gridIconCircle, { backgroundColor: iconBgColor }]}>
            <Ionicons name={iconName} size={22} color={iconColor} />
          </View>

          <View style={[styles.gridArrowCircle, { backgroundColor: arrowBgColor }]}>
            <Ionicons name="chevron-forward" size={14} color={arrowColor} />
          </View>
        </View>

        {/* Number Display */}
        <AnimatedCounter value={value} style={styles.gridCardNumber} />

        {/* Status Title */}
        <Text style={styles.gridCardTitle}>{title}</Text>

        {/* Description / Subtitle */}
        <Text style={styles.gridCardSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const AnalyticsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { isAdmin } = useAuth();

  const [selectedRange, setSelectedRange] = useState<DateFilterOption>('WEEK');
  const [rawCalls, setRawCalls] = useState<Call[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<{ id?: number; name: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom Date Range Modal State
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [activeCustomRange, setActiveCustomRange] = useState<{ start: string; end: string } | null>(null);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      setError(null);
      try {
        const [res, activeUsers] = await Promise.all([
          callApi.getCalls({
            userId: isAdmin && selectedUser ? selectedUser.id : undefined,
            size: 300,
          }),
          isAdmin ? usersApi.getActiveUsers().catch(() => []) : Promise.resolve([]),
        ]);
        setRawCalls(res.content || []);
        if (activeUsers && activeUsers.length > 0) {
          setUsersList(activeUsers);
        }
      } catch (err: any) {
        setError(err.message || 'Unable to load analytics.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAdmin, selectedUser]
  );

  useEffect(() => {
    loadData();
  }, [loadData, isFocused]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  // Filter raw call records by chosen Date Range
  const filteredRawCalls = useMemo(() => {
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDateNum = now.getDate();

    return rawCalls.filter((c) => {
      const callTime = new Date(c.startTime || c.startedAt || c.createdAt || 0);
      const cYear = callTime.getFullYear();
      const cMonth = callTime.getMonth();
      const cDateNum = callTime.getDate();

      if (selectedRange === 'TODAY') {
        return cYear === todayYear && cMonth === todayMonth && cDateNum === todayDateNum;
      }

      if (selectedRange === 'TOMORROW') {
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        return (
          cYear === tomorrow.getFullYear() &&
          cMonth === tomorrow.getMonth() &&
          cDateNum === tomorrow.getDate()
        );
      }

      if (selectedRange === 'WEEK') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0);
        return callTime >= startOfWeek;
      }

      if (selectedRange === 'MONTH') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        return callTime >= startOfMonth;
      }

      if (selectedRange === 'CUSTOM' && activeCustomRange) {
        const start = new Date(`${activeCustomRange.start.slice(0, 10)}T00:00:00`).getTime();
        const end = new Date(`${activeCustomRange.end.slice(0, 10)}T23:59:59`).getTime();
        const callTimestamp = callTime.getTime();
        return callTimestamp >= start && callTimestamp <= end;
      }

      return true;
    });
  }, [rawCalls, selectedRange, activeCustomRange]);

  // Compute strictly the 4 call status counts from raw individual call records
  const statusStats = useMemo(() => {
    let prospectCount = 0;
    let connectedCount = 0;
    let junkCount = 0;
    let missedCount = 0;

    for (const c of filteredRawCalls) {
      const rawStatus = (c.callStatus || '').toUpperCase();
      const duration = c.durationSeconds || 0;
      const isMissed = isCallMissed(c) || rawStatus === 'MISSED' || c.isConnected === false;

      if (isMissed) {
        missedCount++;
      } else if (rawStatus === 'PROSPECT' || duration > 300) {
        prospectCount++;
      } else if (rawStatus === 'JUNK' || duration < 30) {
        junkCount++;
      } else {
        connectedCount++;
      }
    }

    const totalCalls = prospectCount + connectedCount + junkCount + missedCount;

    return {
      totalCalls,
      prospectCount,
      connectedCount,
      junkCount,
      missedCount,
    };
  }, [filteredRawCalls]);

  // Filter Sheet Modal State
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [tempRange, setTempRange] = useState<DateFilterOption>(selectedRange);
  const [tempFromDate, setTempFromDate] = useState(customFromDate);
  const [tempToDate, setTempToDate] = useState(customToDate);
  const [tempSelectedUser, setTempSelectedUser] = useState<{ id?: number; name: string } | null>(selectedUser);

  const openFilterModal = () => {
    setTempRange(selectedRange);
    setTempFromDate(customFromDate);
    setTempToDate(customToDate);
    setTempSelectedUser(selectedUser);
    setFilterModalVisible(true);
  };

  const handleApplyFilters = () => {
    setSelectedRange(tempRange);
    if (tempRange === 'CUSTOM') {
      if (tempFromDate.trim() && tempToDate.trim()) {
        setActiveCustomRange({ start: tempFromDate.trim(), end: tempToDate.trim() });
        setCustomFromDate(tempFromDate.trim());
        setCustomToDate(tempToDate.trim());
      }
    } else {
      setActiveCustomRange(null);
    }
    setSelectedUser(tempSelectedUser);
    setFilterModalVisible(false);
  };

  const handleResetFilters = () => {
    setSelectedRange('WEEK');
    setActiveCustomRange(null);
    setCustomFromDate('');
    setCustomToDate('');
    setSelectedUser(null);
    setTempRange('WEEK');
    setTempFromDate('');
    setTempToDate('');
    setTempSelectedUser(null);
    setFilterModalVisible(false);
  };

  const hasActiveFilters = selectedRange !== 'WEEK' || selectedUser !== null || activeCustomRange !== null;

  const headerTitle = useMemo(() => {
    if (selectedRange === 'TODAY') return 'Today';
    if (selectedRange === 'TOMORROW') return 'Tomorrow';
    if (selectedRange === 'WEEK') return 'This Week';
    if (selectedRange === 'MONTH') return 'This Month';
    if (selectedRange === 'CUSTOM' && activeCustomRange) {
      return `${activeCustomRange.start.slice(0, 10)} to ${activeCustomRange.end.slice(0, 10)}`;
    }
    return 'This Week';
  }, [selectedRange, activeCustomRange]);

  const handleCardClick = (statusFilter?: string) => {
    navigation.navigate('Dial', {
      statusFilter: statusFilter || 'ALL',
      datePreset: selectedRange,
      customStartDate: activeCustomRange?.start,
      customEndDate: activeCustomRange?.end,
      filterUserId: selectedUser?.id,
    });
  };

  return (
    <AmbientBackground variant="analytics">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        {/* Top Header: QMEX Logo on left, Pill Filter Button on right */}
        <MeqHeader
          showLogo={true}
          showAdminBadge={false}
          rightMode="custom"
          rightElement={
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={openFilterModal}
              style={[
                styles.headerFilterBtn,
                hasActiveFilters && styles.headerFilterBtnActive,
              ]}
            >
              <Ionicons
                name="options-outline"
                size={16}
                color={hasActiveFilters ? '#FFFFFF' : '#7C3AED'}
              />
              <Text
                style={[
                  styles.headerFilterBtnText,
                  hasActiveFilters && styles.headerFilterBtnTextActive,
                ]}
              >
                Filter
              </Text>
              {hasActiveFilters && <View style={styles.headerActiveDot} />}
            </TouchableOpacity>
          }
        />

        {/* Date Filter Selection Banner: [ 📅 This Week                     Change > ] */}
        <View style={styles.dateSelectorContainer}>
          <TouchableOpacity
            style={styles.dateSelectorBanner}
            onPress={openFilterModal}
            activeOpacity={0.85}
          >
            <View style={styles.dateSelectorLeft}>
              <Ionicons name="calendar" size={17} color="#7C3AED" />
              <Text style={styles.dateSelectorText}>{headerTitle}</Text>
              {selectedUser && (
                <>
                  <Text style={styles.dateSelectorDot}>•</Text>
                  <Ionicons name="person" size={13} color="#6366F1" />
                  <Text style={styles.dateSelectorUser} numberOfLines={1}>
                    {selectedUser.name}
                  </Text>
                </>
              )}
            </View>
            <View style={styles.dateSelectorRight}>
              <Text style={styles.changeBtnText}>Change</Text>
              <Ionicons name="chevron-forward" size={14} color="#7C3AED" />
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView
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
          {/* Title Section */}
          <View style={styles.titleSection}>
            <Text style={styles.mainTitle}>Call Analytics</Text>
            <Text style={styles.mainSubtitle}>
              Calculated from raw call records ({statusStats.totalCalls} Total Calls)
            </Text>
          </View>

          {loading && !refreshing ? (
            <LoadingState message="Fetching call analytics..." />
          ) : error ? (
            <ErrorState message={error} onRetry={() => loadData()} />
          ) : (
            <View style={styles.cardsGrid}>
              {/* Main Hero Card: TOTAL CALLS */}
              <TouchableOpacity
                style={styles.totalHeroCard}
                activeOpacity={0.88}
                onPress={() => handleCardClick(undefined)}
              >
                <LinearGradient
                  colors={['#4F46E5', '#7C3AED', '#9333EA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.totalHeroGradient}
                >
                  <View style={styles.totalHeroLeft}>
                    <Text style={styles.totalHeroLabel}>TOTAL CALLS</Text>
                    <AnimatedCounter
                      value={statusStats.totalCalls}
                      style={styles.totalHeroCount}
                    />
                    <Text style={styles.totalHeroDesc}>
                      PROSPECT + CONNECTED + JUNK + MISSED
                    </Text>
                  </View>

                  {/* Frosted Circle with stylized 3 bar chart lines */}
                  <View style={styles.totalHeroIconPill}>
                    <View style={styles.barChartContainer}>
                      <View style={[styles.barChartBar, { height: 14 }]} />
                      <View style={[styles.barChartBar, { height: 26 }]} />
                      <View style={[styles.barChartBar, { height: 19 }]} />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* 2x2 Grid of 4 Status Cards */}
              <View style={styles.gridContainer}>
                {/* 1. PROSPECT Card (Top Left) */}
                <StatCard
                  title="PROSPECT"
                  subtitle={'Calls over 5 minutes\n(> 300s)'}
                  value={statusStats.prospectCount}
                  iconName="star"
                  iconColor="#FFFFFF"
                  iconBgColor="#8B5CF6"
                  arrowBgColor="#F3E8FF"
                  arrowColor="#8B5CF6"
                  waveGradient={['rgba(243, 232, 255, 0.4)', 'rgba(233, 213, 255, 0.95)']}
                  onPress={() => handleCardClick('PROSPECT')}
                />

                {/* 2. CONNECTED Card (Top Right) */}
                <StatCard
                  title="CONNECTED"
                  subtitle={'Active conversation\n(30s – 5 mins)'}
                  value={statusStats.connectedCount}
                  iconName="checkmark"
                  iconColor="#FFFFFF"
                  iconBgColor="#10B981"
                  arrowBgColor="#D1FAE5"
                  arrowColor="#10B981"
                  waveGradient={['rgba(209, 250, 229, 0.4)', 'rgba(167, 243, 208, 0.95)']}
                  onPress={() => handleCardClick('CONNECTED')}
                />

                {/* 3. JUNK Card (Bottom Left) */}
                <StatCard
                  title="JUNK"
                  subtitle={'Short call under 30s\n(< 30s)'}
                  value={statusStats.junkCount}
                  iconName="time"
                  iconColor="#FFFFFF"
                  iconBgColor="#F97316"
                  arrowBgColor="#FFEDD5"
                  arrowColor="#F97316"
                  waveGradient={['rgba(254, 243, 199, 0.4)', 'rgba(253, 230, 138, 0.95)']}
                  onPress={() => handleCardClick('JUNK')}
                />

                {/* 4. MISSED Card (Bottom Right) */}
                <StatCard
                  title="MISSED"
                  subtitle="Customer did not answer"
                  value={statusStats.missedCount}
                  iconName="call"
                  iconColor="#FFFFFF"
                  iconBgColor="#EF4444"
                  arrowBgColor="#FEE2E2"
                  arrowColor="#EF4444"
                  waveGradient={['rgba(254, 226, 226, 0.4)', 'rgba(254, 202, 202, 0.95)']}
                  onPress={() => handleCardClick('MISSED')}
                />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Unified Filter Sheet Modal */}
        <FilterSheetModal
          visible={filterModalVisible}
          onClose={() => setFilterModalVisible(false)}
          title="Filter Analytics"
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
          hasActiveFilters={hasActiveFilters}
          applyText="Apply Filter"
          resetText="Clear / Reset"
        >
          {/* Section 1: Date Range */}
          <View style={styles.sheetSection}>
            <Text style={styles.sheetSectionTitle}>DATE RANGE</Text>
            <View style={styles.optionsWrap}>
              {(['TODAY', 'TOMORROW', 'WEEK', 'MONTH', 'CUSTOM'] as DateFilterOption[]).map(
                (range) => {
                  const isSel = tempRange === range;
                  const label =
                    range === 'TODAY'
                      ? 'Today'
                      : range === 'TOMORROW'
                      ? 'Tomorrow'
                      : range === 'WEEK'
                      ? 'This Week'
                      : range === 'MONTH'
                      ? 'This Month'
                      : 'Custom';
                  return (
                    <TouchableOpacity
                      key={range}
                      style={[styles.sheetOptionChip, isSel && styles.sheetOptionChipActive]}
                      onPress={() => setTempRange(range)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.sheetOptionChipText,
                          isSel && styles.sheetOptionChipTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                      {isSel && (
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color="#7C3AED"
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </TouchableOpacity>
                  );
                }
              )}
            </View>

            {/* Custom Date Range Fields (Only visible when Custom selected) */}
            {tempRange === 'CUSTOM' && (
              <View style={styles.customDateFieldsBox}>
                <View style={styles.customFieldRow}>
                  <Text style={styles.customFieldLabel}>From Date</Text>
                  <View style={styles.customInputContainer}>
                    <Ionicons name="calendar-outline" size={16} color="#7C3AED" />
                    <TextInput
                      style={styles.customFieldInput}
                      value={tempFromDate}
                      onChangeText={setTempFromDate}
                      placeholder="YYYY-MM-DD (e.g. 2026-09-01)"
                      placeholderTextColor="#94A3B8"
                      maxLength={10}
                    />
                  </View>
                </View>

                <View style={styles.customFieldRow}>
                  <Text style={styles.customFieldLabel}>To Date</Text>
                  <View style={styles.customInputContainer}>
                    <Ionicons name="calendar-outline" size={16} color="#7C3AED" />
                    <TextInput
                      style={styles.customFieldInput}
                      value={tempToDate}
                      onChangeText={setTempToDate}
                      placeholder="YYYY-MM-DD (e.g. 2026-09-30)"
                      placeholderTextColor="#94A3B8"
                      maxLength={10}
                    />
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Section 2: Team Member (Admin Only) */}
          {isAdmin && usersList.length > 0 && (
            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>TEAM MEMBER</Text>
              <View style={styles.optionsWrap}>
                <TouchableOpacity
                  style={[
                    styles.sheetOptionChip,
                    tempSelectedUser === null && styles.sheetOptionChipActive,
                  ]}
                  onPress={() => setTempSelectedUser(null)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.sheetOptionChipText,
                      tempSelectedUser === null && styles.sheetOptionChipTextActive,
                    ]}
                  >
                    All Users
                  </Text>
                  {tempSelectedUser === null && (
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color="#7C3AED"
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </TouchableOpacity>

                {usersList.map((u) => {
                  const isSel = tempSelectedUser?.id === u.id;
                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={[styles.sheetOptionChip, isSel && styles.sheetOptionChipActive]}
                      onPress={() => setTempSelectedUser({ id: u.id, name: u.name })}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.sheetOptionChipText,
                          isSel && styles.sheetOptionChipTextActive,
                        ]}
                      >
                        {u.name}
                      </Text>
                      {isSel && (
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color="#7C3AED"
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </FilterSheetModal>
      </SafeAreaView>
    </AmbientBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1.2,
    borderColor: 'rgba(238, 242, 246, 0.95)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    position: 'relative',
  },
  headerFilterBtnActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#6D28D9',
  },
  headerFilterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C3AED',
  },
  headerFilterBtnTextActive: {
    color: '#FFFFFF',
  },
  headerActiveDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EC4899',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },

  // Date Filter Selection Banner
  dateSelectorContainer: {
    paddingHorizontal: 16,
    marginTop: 2,
    marginBottom: 8,
  },
  dateSelectorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(238, 242, 246, 0.95)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1.5,
  },
  dateSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dateSelectorText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  dateSelectorDot: {
    fontSize: 12,
    color: '#94A3B8',
    marginHorizontal: 2,
  },
  dateSelectorUser: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#6366F1',
    maxWidth: 120,
  },
  dateSelectorRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  changeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C3AED',
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  titleSection: {
    marginBottom: 14,
    marginTop: 2,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  mainSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '500',
  },
  cardsGrid: {
    gap: 12,
  },

  // Main Hero Card
  totalHeroCard: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 4,
  },
  totalHeroGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  totalHeroLeft: {
    flex: 1,
  },
  totalHeroLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.8,
  },
  totalHeroCount: {
    fontSize: 44,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginVertical: 2,
  },
  totalHeroDesc: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.4,
  },
  totalHeroIconPill: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4.5,
  },
  barChartBar: {
    width: 4.5,
    backgroundColor: '#FFFFFF',
    borderRadius: 2.5,
  },

  // 2x2 Grid of Status Cards
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  gridCardWrapper: {
    width: '48%',
  },
  gridCardContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(238, 242, 246, 0.95)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 172,
  },
  cardCornerWaveWrap: {
    position: 'absolute',
    bottom: -32,
    right: -32,
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    opacity: 0.75,
  },
  cardCornerWave: {
    flex: 1,
  },
  gridCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  gridIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  gridArrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCardNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  gridCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  gridCardSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    lineHeight: 15,
    marginTop: 2,
  },

  // Sheet Modal Content Styles
  sheetSection: {
    gap: 8,
  },
  sheetSectionTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetOptionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
  },
  sheetOptionChipActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  sheetOptionChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  sheetOptionChipTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  customDateFieldsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 10,
    marginTop: 6,
  },
  customFieldRow: {
    gap: 4,
  },
  customFieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    gap: 8,
  },
  customFieldInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
});
