import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Header } from '../../components/common/Header';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { AmbientBackground } from '../../components/common/AmbientBackground';
import { attendanceApi } from '../../api/attendanceApi';
import { AttendanceMonthlyResponse, Attendance } from '../../types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const YEARS = [2024, 2025, 2026, 2027, 2028];

export const AttendanceHistoryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const targetUserId = route.params?.userId as number | undefined;
  const targetUserName = route.params?.userName as string | undefined;

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1-indexed

  const [monthlyData, setMonthlyData] = useState<AttendanceMonthlyResponse | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);
  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(today.getDate());

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMonthly = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      let data: AttendanceMonthlyResponse;
      if (targetUserId) {
        data = await attendanceApi.getUserMonthlyAttendance(targetUserId, currentYear, currentMonth);
      } else {
        data = await attendanceApi.getMonthlyAttendance(currentYear, currentMonth);
      }
      setMonthlyData(data);

      // Auto-select today's record if in current month
      const match = data.records?.find((r) => {
        const d = new Date(r.date).getDate();
        return d === selectedDayNumber;
      });
      setSelectedRecord(match || null);
    } catch (err: any) {
      setError(err.message || 'Unable to fetch monthly attendance.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetUserId, currentYear, currentMonth, selectedDayNumber]);

  useEffect(() => {
    fetchMonthly();
  }, [fetchMonthly]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMonthly(true);
  };

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  // Calendar computation
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay();

  // Elapsed days calculation:
  // If current month: elapsed days = today.getDate()
  // If past month: elapsed days = daysInMonth
  // If future month: elapsed days = 0
  const isCurrentMonth = today.getFullYear() === currentYear && (today.getMonth() + 1) === currentMonth;
  const isPastMonth = currentYear < today.getFullYear() || (currentYear === today.getFullYear() && currentMonth < (today.getMonth() + 1));
  const isFutureMonth = currentYear > today.getFullYear() || (currentYear === today.getFullYear() && currentMonth > (today.getMonth() + 1));

  const elapsedDays = isFutureMonth ? 0 : isCurrentMonth ? today.getDate() : daysInMonth;

  // KPIs
  const totalDays = monthlyData?.totalDays || daysInMonth;
  const presentDays = monthlyData?.presentDays || 0;
  const fullDays = monthlyData?.fullDays ?? 0;
  const halfDays = monthlyData?.halfDays ?? 0;
  // Off Days = Elapsed days in month minus Present days (future dates NOT counted)
  const computedOffDays = Math.max(0, elapsedDays - presentDays);
  const offDays = monthlyData?.offDays !== undefined ? monthlyData.offDays : computedOffDays;

  // Format time deterministically to avoid client timezone offset
  const formatAttendanceTime = (timeStr?: string | null) => {
    if (!timeStr) return '--:--';
    const timePart = timeStr.includes('T')
      ? timeStr.split('T')[1]
      : timeStr.includes(' ')
      ? timeStr.split(' ')[1]
      : timeStr;
    const parts = timePart.split(':');
    if (parts.length >= 2) {
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1].slice(0, 2);
      if (!isNaN(hours)) {
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours === 0 ? 12 : hours;
        return `${hours}:${minutes} ${ampm}`;
      }
    }
    try {
      const d = new Date(timeStr);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return timeStr.slice(11, 16);
    }
  };

  const formatDurationDisplay = (minutes?: number | null) => {
    if (minutes == null || minutes === undefined || isNaN(minutes) || minutes <= 0) return '--';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h`;
    return `${mins}m`;
  };

  const handleSelectDay = (day: number) => {
    setSelectedDayNumber(day);
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const record = monthlyData?.records?.find((r) => r.date === dateStr);
    setSelectedRecord(record || null);
  };

  // Day-by-day descending list items for elapsed days
  const dailyHistoryList = useMemo(() => {
    if (isFutureMonth || elapsedDays === 0) return [];
    const items = [];
    for (let day = elapsedDays; day >= 1; day--) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const record = monthlyData?.records?.find((r) => r.date === dateStr);
      const dateObj = new Date(currentYear, currentMonth - 1, day);
      const weekdayName = WEEKDAYS[dateObj.getDay()];
      const isToday = isCurrentMonth && day === today.getDate();

      items.push({
        day,
        dateStr,
        weekdayName,
        isToday,
        record: record || null,
      });
    }
    return items;
  }, [currentYear, currentMonth, elapsedDays, isFutureMonth, isCurrentMonth, monthlyData]);

  return (
    <AmbientBackground variant="home">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <Header
        title={targetUserName ? `${targetUserName}'s Attendance` : 'Attendance History'}
        subtitle={
          targetUserName
            ? `Monthly logs & records for ${targetUserName}`
            : 'Monthly logs & performance summary'
        }
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.contentContainer}
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
        {/* User Banner (when viewing another employee's attendance as Admin) */}
        {targetUserName && (
          <View style={styles.userBanner}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>{targetUserName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userBannerName}>{targetUserName}</Text>
              <Text style={styles.userBannerSub}>Viewing employee attendance logs</Text>
            </View>
            <View style={styles.adminViewingBadge}>
              <Ionicons name="shield-checkmark" size={12} color={colors.primary} />
              <Text style={styles.adminViewingText}>Admin View</Text>
            </View>
          </View>
        )}

        {/* Filter Row: [ Month ▼ ] [ Year ▼ ] with Prev/Next Quick Steppers */}
        <View style={styles.filterSection}>
          <View style={styles.dropdownsRow}>
            {/* Month Dropdown Button */}
            <TouchableOpacity
              style={styles.filterDropdown}
              onPress={() => setMonthPickerVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.filterDropdownLabel}>Month</Text>
              <View style={styles.filterDropdownValueRow}>
                <Text style={styles.filterDropdownValue}>{MONTH_NAMES[currentMonth - 1]}</Text>
                <Ionicons name="chevron-down" size={14} color={colors.primary} />
              </View>
            </TouchableOpacity>

            {/* Year Dropdown Button */}
            <TouchableOpacity
              style={styles.filterDropdown}
              onPress={() => setYearPickerVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.filterDropdownLabel}>Year</Text>
              <View style={styles.filterDropdownValueRow}>
                <Text style={styles.filterDropdownValue}>{currentYear}</Text>
                <Ionicons name="chevron-down" size={14} color={colors.primary} />
              </View>
            </TouchableOpacity>

            {/* Quick Prev / Next Month Stepper */}
            <View style={styles.stepperContainer}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.stepperBtn} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
              <View style={styles.stepperDivider} />
              <TouchableOpacity onPress={handleNextMonth} style={styles.stepperBtn} activeOpacity={0.7}>
                <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {loading && !refreshing ? (
          <LoadingState message="Loading attendance history..." fullScreen />
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchMonthly()} />
        ) : (
          <>
            {/* Summary KPI Cards Grid (5 Metrics Required) */}
            <View style={styles.summaryContainer}>
              <Text style={styles.sectionHeaderTitle}>MONTHLY SUMMARY</Text>

              {/* Row 1: Total Days, Present Days, Off Days */}
              <View style={styles.kpiRow}>
                <Card style={styles.kpiCard}>
                  <View style={[styles.kpiIconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                    <Ionicons name="calendar-outline" size={15} color={colors.primary} />
                  </View>
                  <Text style={[styles.kpiCount, { color: colors.textPrimary }]}>{totalDays}</Text>
                  <Text style={styles.kpiLabel}>Total Days</Text>
                </Card>

                <Card style={styles.kpiCard}>
                  <View style={[styles.kpiIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                    <Ionicons name="checkmark-circle-outline" size={15} color={colors.success} />
                  </View>
                  <Text style={[styles.kpiCount, { color: colors.success }]}>{presentDays}</Text>
                  <Text style={styles.kpiLabel}>Present Days</Text>
                </Card>

                <Card style={styles.kpiCard}>
                  <View style={[styles.kpiIconCircle, { backgroundColor: 'rgba(148, 163, 184, 0.15)' }]}>
                    <Ionicons name="close-circle-outline" size={15} color="#64748B" />
                  </View>
                  <Text style={[styles.kpiCount, { color: '#64748B' }]}>{offDays}</Text>
                  <Text style={styles.kpiLabel}>Off / Absent</Text>
                </Card>
              </View>

              {/* Row 2: Full Days (>=4h), Half Days (<4h), Total Working Hours */}
              <View style={styles.kpiRow}>
                <Card style={styles.kpiCard}>
                  <View style={[styles.kpiIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                    <Ionicons name="sunny-outline" size={15} color={colors.success} />
                  </View>
                  <Text style={[styles.kpiCount, { color: colors.success }]}>{fullDays}</Text>
                  <Text style={styles.kpiLabel}>Full Days (≥4h)</Text>
                </Card>

                <Card style={styles.kpiCard}>
                  <View style={[styles.kpiIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                    <Ionicons name="partly-sunny-outline" size={15} color={colors.warning} />
                  </View>
                  <Text style={[styles.kpiCount, { color: colors.warning }]}>{halfDays}</Text>
                  <Text style={styles.kpiLabel}>Half Days (&lt;4h)</Text>
                </Card>

                <Card style={styles.kpiCard}>
                  <View style={[styles.kpiIconCircle, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
                    <Ionicons name="time-outline" size={15} color="#6366F1" />
                  </View>
                  <Text style={[styles.kpiCount, { color: '#6366F1' }]}>
                    {monthlyData?.totalWorkingHours || 0}h
                  </Text>
                  <Text style={styles.kpiLabel}>Total Hours</Text>
                </Card>
              </View>
            </View>

            {/* View Mode Toggle: Day-by-Day List vs Calendar Grid */}
            <View style={styles.viewToggleRow}>
              <TouchableOpacity
                style={styles.toggleBtnTouchable}
                onPress={() => setViewMode('list')}
                activeOpacity={0.8}
              >
                {viewMode === 'list' ? (
                  <LinearGradient
                    colors={colors.primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.toggleBtnGradient}
                  >
                    <Ionicons name="list-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.toggleBtnTextActive}>Daily History List</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.toggleBtnInactive}>
                    <Ionicons name="list-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.toggleBtnTextInactive}>Daily History List</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleBtnTouchable}
                onPress={() => setViewMode('calendar')}
                activeOpacity={0.8}
              >
                {viewMode === 'calendar' ? (
                  <LinearGradient
                    colors={colors.primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.toggleBtnGradient}
                  >
                    <Ionicons name="grid-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.toggleBtnTextActive}>Calendar Grid</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.toggleBtnInactive}>
                    <Ionicons name="grid-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.toggleBtnTextInactive}>Calendar Grid</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* VIEW MODE 1: DAY-BY-DAY ATTENDANCE HISTORY LIST */}
            {viewMode === 'list' && (
              <View style={styles.historyListSection}>
                <View style={styles.historySectionHeader}>
                  <Text style={styles.historySectionTitle}>
                    {MONTH_NAMES[currentMonth - 1]} {currentYear} Logs
                  </Text>
                  <Text style={styles.historySectionSub}>
                    {isFutureMonth
                      ? 'Upcoming month'
                      : `Showing ${dailyHistoryList.length} elapsed days`}
                  </Text>
                </View>

                {isFutureMonth ? (
                  <Card style={styles.emptyCard}>
                    <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
                    <Text style={styles.emptyTitle}>Upcoming Month</Text>
                    <Text style={styles.emptyMessage}>
                      No attendance has been recorded for future months.
                    </Text>
                  </Card>
                ) : dailyHistoryList.length === 0 ? (
                  <Card style={styles.emptyCard}>
                    <Ionicons name="calendar-clear-outline" size={32} color={colors.textMuted} />
                    <Text style={styles.emptyTitle}>No Days Elapsed</Text>
                    <Text style={styles.emptyMessage}>No logs recorded for this period.</Text>
                  </Card>
                ) : (
                  dailyHistoryList.map(({ day, dateStr, weekdayName, isToday, record }) => {
                    const isPresent = record?.status === 'PRESENT';
                    const isHalfDay = record?.status === 'HALF_DAY';
                    const isLeave = record?.status === 'LEAVE';
                    const isHoliday = record?.status === 'HOLIDAY';

                    if (isPresent || isHalfDay) {
                      const isFull = (record?.durationMinutes || 0) >= 240;
                      return (
                        <Card key={dateStr} style={[styles.dayCard, isToday && styles.dayCardToday]}>
                          <View style={styles.dayCardHeader}>
                            <View style={styles.dateBlock}>
                              <Text style={styles.dateDayNumber}>
                                {day} {MONTH_NAMES[currentMonth - 1].slice(0, 3)} {currentYear}
                              </Text>
                              <View style={styles.weekdayBadge}>
                                <Text style={styles.weekdayText}>{weekdayName}</Text>
                                {isToday && <Text style={styles.todayPill}>TODAY</Text>}
                              </View>
                            </View>

                            <View
                              style={[
                                styles.statusPill,
                                isFull ? styles.statusPillPresent : styles.statusPillHalfDay,
                              ]}
                            >
                              <Ionicons
                                name={isFull ? 'checkmark-circle' : 'time'}
                                size={13}
                                color={isFull ? '#10B981' : '#F59E0B'}
                              />
                              <Text
                                style={[
                                  styles.statusPillText,
                                  isFull ? styles.statusTextPresent : styles.statusTextHalfDay,
                                ]}
                              >
                                {isFull ? 'Present' : 'Half Day'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.dayCardBody}>
                            <View style={styles.timeCol}>
                              <Text style={styles.timeColLabel}>Clock In</Text>
                              <View style={styles.timeValRow}>
                                <Ionicons name="enter-outline" size={13} color="#10B981" />
                                <Text style={styles.timeValText}>
                                  {formatAttendanceTime(record?.clockInTime)}
                                </Text>
                              </View>
                            </View>

                            <Ionicons
                              name="arrow-forward"
                              size={14}
                              color={colors.textMuted}
                              style={styles.timeArrow}
                            />

                            <View style={styles.timeCol}>
                              <Text style={styles.timeColLabel}>Clock Out</Text>
                              <View style={styles.timeValRow}>
                                <Ionicons
                                  name="exit-outline"
                                  size={13}
                                  color={record?.clockOutTime ? '#EF4444' : colors.textMuted}
                                />
                                <Text style={styles.timeValText}>
                                  {record?.clockOutTime
                                    ? formatAttendanceTime(record.clockOutTime)
                                    : 'Ongoing'}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.durationCol}>
                              <Text style={styles.timeColLabel}>Duration</Text>
                              <View style={styles.durationBadge}>
                                <Ionicons name="hourglass-outline" size={12} color={colors.primary} />
                                <Text style={styles.durationBadgeText}>
                                  {formatDurationDisplay(record?.durationMinutes)}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </Card>
                      );
                    }

                    if (isLeave || isHoliday) {
                      return (
                        <Card key={dateStr} style={[styles.dayCard, styles.dayCardOff]}>
                          <View style={styles.dayCardHeader}>
                            <View style={styles.dateBlock}>
                              <Text style={styles.dateDayNumber}>
                                {day} {MONTH_NAMES[currentMonth - 1].slice(0, 3)} {currentYear}
                              </Text>
                              <View style={styles.weekdayBadge}>
                                <Text style={styles.weekdayText}>{weekdayName}</Text>
                                {isToday && <Text style={styles.todayPill}>TODAY</Text>}
                              </View>
                            </View>

                            <View
                              style={[
                                styles.statusPill,
                                isLeave ? styles.statusPillLeave : styles.statusPillHoliday,
                              ]}
                            >
                              <Ionicons
                                name={isLeave ? 'calendar-outline' : 'sparkles-outline'}
                                size={13}
                                color={isLeave ? colors.danger : colors.info}
                              />
                              <Text
                                style={[
                                  styles.statusPillText,
                                  isLeave ? styles.statusTextLeave : styles.statusTextHoliday,
                                ]}
                              >
                                {isLeave ? 'Leave' : 'Holiday'}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.offDayFooter}>
                            <Text style={styles.offDayNote}>
                              {isLeave ? 'Approved leave' : 'Public holiday'}
                            </Text>
                          </View>
                        </Card>
                      );
                    }

                    // User did not attend (Off Day)
                    return (
                      <Card key={dateStr} style={[styles.dayCard, styles.dayCardOff]}>
                        <View style={styles.dayCardHeader}>
                          <View style={styles.dateBlock}>
                            <Text style={styles.dateDayNumber}>
                              {day} {MONTH_NAMES[currentMonth - 1].slice(0, 3)} {currentYear}
                            </Text>
                            <View style={styles.weekdayBadge}>
                              <Text style={styles.weekdayText}>{weekdayName}</Text>
                              {isToday && <Text style={styles.todayPill}>TODAY</Text>}
                            </View>
                          </View>

                          <View style={styles.statusPillOff}>
                            <Ionicons name="close-circle-outline" size={13} color="#94A3B8" />
                            <Text style={styles.statusPillTextOff}>Off Day</Text>
                          </View>
                        </View>
                        <View style={styles.offDayFooter}>
                          <Ionicons name="moon-outline" size={13} color={colors.textMuted} />
                          <Text style={styles.offDayNote}>No attendance logged for this day</Text>
                        </View>
                      </Card>
                    );
                  })
                )}
              </View>
            )}

            {/* VIEW MODE 2: CALENDAR GRID */}
            {viewMode === 'calendar' && (
              <>
                <Card style={styles.calendarCard}>
                  {/* Day Headers (Sun - Sat) */}
                  <View style={styles.weekdaysRow}>
                    {WEEKDAYS.map((d) => (
                      <Text key={d} style={styles.weekdayHeader}>
                        {d}
                      </Text>
                    ))}
                  </View>

                  {/* Day Cells Grid */}
                  <View style={styles.daysGrid}>
                    {/* Empty cells before month start */}
                    {Array.from({ length: firstDayIndex }).map((_, i) => (
                      <View key={`empty-${i}`} style={styles.dayCell} />
                    ))}

                    {/* Days of current month */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const record = monthlyData?.records?.find((r) => r.date === dateStr);
                      const isSelected = selectedDayNumber === day;

                      let statusDotColor: string | null = null;
                      if (record) {
                        if (record.status === 'PRESENT') statusDotColor = colors.success;
                        else if (record.status === 'HALF_DAY') statusDotColor = colors.warning;
                        else if (record.status === 'LEAVE') statusDotColor = colors.danger;
                        else if (record.status === 'HOLIDAY') statusDotColor = colors.info;
                      }

                      if (isSelected) {
                        return (
                          <TouchableOpacity
                            key={`day-${day}`}
                            onPress={() => handleSelectDay(day)}
                            activeOpacity={0.85}
                            style={styles.dayCellTouchable}
                          >
                            <LinearGradient
                              colors={['#2563EB', '#7C3AED']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.dayCellSelectedGradient}
                            >
                              <Text style={styles.dayTextSelected}>{day}</Text>
                              {statusDotColor ? (
                                <View style={[styles.statusDot, { backgroundColor: '#FFFFFF' }]} />
                              ) : null}
                            </LinearGradient>
                          </TouchableOpacity>
                        );
                      }

                      return (
                        <TouchableOpacity
                          key={`day-${day}`}
                          style={styles.dayCell}
                          onPress={() => handleSelectDay(day)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.dayText}>
                            {day}
                          </Text>
                          {statusDotColor && (
                            <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Status Legend */}
                  <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                      <Text style={styles.legendText}>Present</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
                      <Text style={styles.legendText}>Half Day</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
                      <Text style={styles.legendText}>Leave</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: colors.info }]} />
                      <Text style={styles.legendText}>Holiday</Text>
                    </View>
                  </View>
                </Card>

                {/* Selected Date Detail Drawer */}
                <Card style={styles.detailCard}>
                  <View style={styles.detailHeader}>
                    <View>
                      <Text style={styles.detailDateText}>
                        {MONTH_NAMES[currentMonth - 1]} {selectedDayNumber}, {currentYear}
                      </Text>
                      <Text style={styles.detailSubText}>Daily Attendance Breakdown</Text>
                    </View>
                    <Badge
                      label={selectedRecord ? selectedRecord.status : 'No Record'}
                      status={selectedRecord ? selectedRecord.status : 'neutral'}
                    />
                  </View>

                  {selectedRecord ? (
                    <View style={styles.detailMetricsRow}>
                      <View style={styles.detailMetric}>
                        <Text style={styles.detailMetricLabel}>Clock In</Text>
                        <Text style={styles.detailMetricValue}>
                          {formatAttendanceTime(selectedRecord.clockInTime)}
                        </Text>
                      </View>
                      <View style={styles.metricDivider} />
                      <View style={styles.detailMetric}>
                        <Text style={styles.detailMetricLabel}>Clock Out</Text>
                        <Text style={styles.detailMetricValue}>
                          {formatAttendanceTime(selectedRecord.clockOutTime)}
                        </Text>
                      </View>
                      <View style={styles.metricDivider} />
                      <View style={styles.detailMetric}>
                        <Text style={styles.detailMetricLabel}>Duration</Text>
                        <Text style={[styles.detailMetricValue, { color: colors.primary }]}>
                          {formatDurationDisplay(selectedRecord.durationMinutes)}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.noRecordContainer}>
                      <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
                      <Text style={styles.noRecordText}>No attendance logged for this date.</Text>
                    </View>
                  )}
                </Card>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* MONTH PICKER MODAL */}
      <Modal
        visible={monthPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMonthPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMonthPickerVisible(false)}
        >
          <View style={styles.pickerModalCard}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Month</Text>
              <TouchableOpacity onPress={() => setMonthPickerVisible(false)}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.monthsGrid}>
              {MONTH_NAMES.map((name, index) => {
                const monthNum = index + 1;
                const isSelected = currentMonth === monthNum;
                return (
                  <TouchableOpacity
                    key={name}
                    style={[styles.monthOption, isSelected && styles.monthOptionSelected]}
                    onPress={() => {
                      setCurrentMonth(monthNum);
                      setMonthPickerVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.monthOptionText, isSelected && styles.monthOptionTextSelected]}
                    >
                      {name.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* YEAR PICKER MODAL */}
      <Modal
        visible={yearPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setYearPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setYearPickerVisible(false)}
        >
          <View style={styles.pickerModalCard}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Year</Text>
              <TouchableOpacity onPress={() => setYearPickerVisible(false)}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.yearsGrid}>
              {YEARS.map((y) => {
                const isSelected = currentYear === y;
                return (
                  <TouchableOpacity
                    key={y}
                    style={[styles.yearOption, isSelected && styles.yearOptionSelected]}
                    onPress={() => {
                      setCurrentYear(y);
                      setYearPickerVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.yearOptionText, isSelected && styles.yearOptionTextSelected]}>
                      {y}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
      </SafeAreaView>
    </AmbientBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xxl + 20,
  },
  userBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.surfaceCard,
    padding: spacing.sm + 2,
    borderRadius: spacing.borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  userBannerName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  userBannerSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  adminViewingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  adminViewingText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  filterSection: {
    marginBottom: spacing.md,
  },
  dropdownsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  filterDropdown: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.borderRadius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  filterDropdownLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  filterDropdownValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  filterDropdownValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  stepperContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.borderRadius.md,
    overflow: 'hidden',
  },
  stepperBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: spacing.xs + 2,
  },
  summaryContainer: {
    marginBottom: spacing.md,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
    marginBottom: spacing.xs + 2,
  },
  kpiCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 0,
  },
  kpiIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  kpiCount: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  kpiLabel: {
    fontSize: 10.5,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
    textAlign: 'center',
  },
  viewToggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 18,
    padding: 4,
    marginBottom: spacing.md,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  toggleBtnTouchable: {
    flex: 1,
  },
  toggleBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: colors.primaryViolet,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3,
  },
  toggleBtnInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
  },
  toggleBtnTextInactive: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: -0.2,
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: -0.2,
  },
  dayCellTouchable: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayCellSelectedGradient: {
    width: 38,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  historyListSection: {
    marginBottom: spacing.md,
  },
  historySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  historySectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  historySectionSub: {
    fontSize: 11,
    color: colors.textMuted,
  },
  dayCard: {
    padding: spacing.sm + 2,
    marginBottom: spacing.xs + 3,
    backgroundColor: colors.surfaceCard,
  },
  dayCardToday: {
    borderColor: 'rgba(59, 130, 246, 0.4)',
    borderWidth: 1.5,
  },
  dayCardOff: {
    opacity: 0.85,
    backgroundColor: colors.surface,
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 2,
  },
  dateBlock: {
    flexDirection: 'column',
  },
  dateDayNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  weekdayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1,
  },
  weekdayText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  todayPill: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillPresent: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  statusPillHalfDay: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  statusPillLeave: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  statusPillHoliday: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  statusPillOff: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextPresent: {
    color: '#10B981',
  },
  statusTextHalfDay: {
    color: '#F59E0B',
  },
  statusTextLeave: {
    color: colors.danger,
  },
  statusTextHoliday: {
    color: colors.info,
  },
  statusPillTextOff: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  dayCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    marginTop: 2,
  },
  timeCol: {
    flex: 1,
  },
  timeColLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  timeValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  timeValText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  timeArrow: {
    marginHorizontal: 4,
    marginTop: 10,
  },
  durationCol: {
    alignItems: 'flex-end',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  durationBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  offDayFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: spacing.borderRadius.sm,
    marginTop: 2,
  },
  offDayNote: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surfaceCard,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  emptyMessage: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  calendarCard: {
    padding: spacing.md,
    backgroundColor: colors.surfaceCard,
    marginBottom: spacing.md,
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.xs,
  },
  weekdayHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    width: 40,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  dayCell: {
    width: 40,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    borderRadius: spacing.borderRadius.sm,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dayTextSelected: {
    color: '#ffffff',
    fontWeight: '800',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  detailCard: {
    padding: spacing.md,
    backgroundColor: colors.surfaceCard,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  detailDateText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  detailSubText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  detailMetricsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.borderRadius.md,
    padding: spacing.md,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  detailMetric: {
    alignItems: 'center',
    flex: 1,
  },
  detailMetricLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  detailMetricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  noRecordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.borderRadius.md,
  },
  noRecordText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  pickerModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surfaceCard,
    borderRadius: spacing.borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  monthOption: {
    width: '30%',
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: spacing.borderRadius.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  monthOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  monthOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  yearsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  yearOption: {
    width: '30%',
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: spacing.borderRadius.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  yearOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  yearOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  yearOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
