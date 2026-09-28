import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../common/Card';
import { StatusBadge } from '../common/StatusBadge';
import { Button } from '../common/Button';
import { GradientView } from '../common/GradientView';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { Attendance } from '../../types';
import { attendanceApi } from '../../api/attendanceApi';
import { useAuth } from '../../context/AuthContext';
import { attendanceEventManager } from '../../utils/attendanceEvents';

interface AttendanceCardProps {
  initialAttendance?: Attendance | null;
  onViewHistory?: () => void;
  onAttendanceUpdated?: (attendance: Attendance) => void;
}

export const AttendanceCard: React.FC<AttendanceCardProps> = ({
  initialAttendance,
  onViewHistory,
  onAttendanceUpdated,
}) => {
  const { isAuthenticated, token, isLoading: authLoading } = useAuth();
  const [attendance, setAttendance] = useState<Attendance | null>(
    initialAttendance !== undefined ? initialAttendance : (attendanceEventManager.getLatestAttendance() || null)
  );
  const [loadingAction, setLoadingAction] = useState<'clockIn' | 'clockOut' | null>(null);
  const [liveDuration, setLiveDuration] = useState<string>('0h 0m');

  const onUpdatedRef = React.useRef(onAttendanceUpdated);
  useEffect(() => {
    onUpdatedRef.current = onAttendanceUpdated;
  });

  const fetchToday = useCallback(async () => {
    if (!isAuthenticated || !token || authLoading) return;
    try {
      const data = await attendanceApi.getTodayAttendance();
      setAttendance(data);
      attendanceEventManager.setLatestAttendance(data);
      onUpdatedRef.current?.(data);
    } catch (e: any) {
      console.warn('Failed to load today attendance:', e?.message || e);
    }
  }, [isAuthenticated, token, authLoading]);

  // Sync when initialAttendance prop changes
  useEffect(() => {
    if (initialAttendance !== undefined) {
      setAttendance(initialAttendance);
    } else {
      fetchToday();
    }
  }, [initialAttendance, fetchToday]);

  // Subscribe to real-time attendance changes across the entire app (e.g., from EmergencyCheckInModal)
  useEffect(() => {
    const unsubscribe = attendanceEventManager.subscribe((latestAtt) => {
      if (latestAtt) {
        setAttendance(latestAtt);
        onUpdatedRef.current?.(latestAtt);
      }
    });
    return unsubscribe;
  }, []);

  // Refetch when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (initialAttendance === undefined) {
        fetchToday();
      }
    }, [initialAttendance, fetchToday])
  );

  // Parse time deterministically from ISO string (e.g. "2026-09-23T11:47:35")
  // Prevents client timezone offsets from altering the recorded time
  const formatAttendanceTime = (timeStr?: string) => {
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

  // Live duration ticker if clocked in and not clocked out; or recorded duration if clocked out
  useEffect(() => {
    if (attendance?.clockInTime && !attendance?.clockOutTime) {
      const updateDuration = () => {
        const start = new Date(attendance.clockInTime!).getTime();
        const now = Date.now();
        const diffMinutes = Math.max(0, Math.floor((now - start) / (1000 * 60)));
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;
        setLiveDuration(`${hours}h ${mins}m`);
      };

      updateDuration();
      const interval = setInterval(updateDuration, 30000); // every 30 seconds
      return () => clearInterval(interval);
    } else if (attendance?.clockInTime && attendance?.clockOutTime) {
      if (attendance.durationMinutes != null && attendance.durationMinutes > 0) {
        const hours = Math.floor(attendance.durationMinutes / 60);
        const mins = attendance.durationMinutes % 60;
        setLiveDuration(`${hours}h ${mins}m`);
      } else {
        const start = new Date(attendance.clockInTime).getTime();
        const end = new Date(attendance.clockOutTime).getTime();
        const diffMinutes = Math.max(0, Math.floor((end - start) / (1000 * 60)));
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;
        setLiveDuration(`${hours}h ${mins}m`);
      }
    } else {
      setLiveDuration('0h 0m');
    }
  }, [attendance]);

  const handleClockIn = async () => {
    setLoadingAction('clockIn');
    try {
      const updated = await attendanceApi.clockIn();
      setAttendance(updated);
      attendanceEventManager.setLatestAttendance(updated);
      attendanceEventManager.clearSnooze();
      if (onAttendanceUpdated) onAttendanceUpdated(updated);
      const timeFormatted = formatAttendanceTime(updated.clockInTime);
      Alert.alert('Clocked In Successfully', `Punch recorded at ${timeFormatted}. Have a productive day!`);
    } catch (err: any) {
      Alert.alert('Clock In Failed', err.message || 'Unable to clock in.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleClockOut = async () => {
    Alert.alert(
      'Confirm Clock Out',
      'Are you sure you want to clock out for today? You will not be able to clock in again today.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clock Out',
          style: 'destructive',
          onPress: async () => {
            setLoadingAction('clockOut');
            try {
              const updated = await attendanceApi.clockOut();
              setAttendance(updated);
              attendanceEventManager.setLatestAttendance(updated);
              attendanceEventManager.clearSnooze();
              if (onAttendanceUpdated) onAttendanceUpdated(updated);
              const timeFormatted = formatAttendanceTime(updated.clockOutTime);
              const hours = Math.floor((updated.durationMinutes || 0) / 60);
              const mins = (updated.durationMinutes || 0) % 60;
              Alert.alert(
                'Clocked Out Successfully',
                `Punch recorded at ${timeFormatted}.\nTotal duration: ${hours}h ${mins}m`
              );
            } catch (err: any) {
              Alert.alert('Clock Out Failed', err.message || 'Unable to clock out.');
            } finally {
              setLoadingAction(null);
            }
          },
        },
      ]
    );
  };

  const isClockedIn = !!attendance?.clockInTime;
  const isClockedOut = !!attendance?.clockOutTime;

  return (
    <GradientView
      colors={colors.heroAttendanceGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* Top Header Row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <Ionicons name="time" size={20} color="#FFFFFF" />
          </View>
          <View>
            <Text style={styles.title}>Today's Attendance</Text>
            <Text style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', marginTop: 1 }}>
              Shift: {attendance?.shiftDisplayName || '10:00 AM – 07:00 PM'}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View
            style={[
              styles.workingBadge,
              isClockedOut
                ? styles.badgeCompleted
                : isClockedIn
                ? styles.badgeWorking
                : styles.badgeNotClocked,
            ]}
          >
            <Text
              style={[
                styles.workingBadgeText,
                isClockedOut
                  ? styles.badgeCompletedText
                  : isClockedIn
                  ? styles.badgeWorkingText
                  : styles.badgeNotClockedText,
              ]}
            >
              {isClockedOut
                ? attendance?.status === 'HALF_DAY'
                  ? 'Half Day'
                  : 'Completed'
                : isClockedIn
                ? 'Working'
                : 'Not Clocked In'}
            </Text>
          </View>

          {onViewHistory && (
            <TouchableOpacity onPress={onViewHistory} style={styles.historyBtn} activeOpacity={0.7}>
              <Ionicons name="calendar-outline" size={15} color="rgba(255, 255, 255, 0.85)" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 3-Column White Punch Strip */}
      <View style={styles.metricsStrip}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Clock In</Text>
          <Text style={styles.metricValue}>{formatAttendanceTime(attendance?.clockInTime)}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Clock Out</Text>
          <Text style={styles.metricValue}>{formatAttendanceTime(attendance?.clockOutTime)}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Duration</Text>
          <Text style={styles.metricValue}>{liveDuration}</Text>
        </View>
      </View>

      {/* Bottom Buttons Row: 3 Strict Attendance States */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[
            styles.checkInBtn,
            isClockedOut
              ? styles.btnLockedFaded
              : isClockedIn
              ? styles.checkInBtnClocked
              : styles.checkInBtnReady,
          ]}
          onPress={handleClockIn}
          disabled={isClockedIn || isClockedOut || loadingAction !== null}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isClockedIn ? 'checkmark-circle' : 'enter-outline'}
            size={16}
            color={
              isClockedOut
                ? 'rgba(255, 255, 255, 0.6)'
                : isClockedIn
                ? colors.attendanceCheckInActiveText
                : '#1E40AF'
            }
          />
          <Text
            style={[
              styles.btnText,
              isClockedOut
                ? styles.btnTextLocked
                : isClockedIn
                ? styles.checkInTextActive
                : styles.checkInTextReady,
            ]}
          >
            {loadingAction === 'clockIn'
              ? 'Clocking In...'
              : isClockedIn
              ? 'Clocked In'
              : 'Clock In'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.checkOutBtn,
            isClockedOut
              ? styles.btnLockedFaded
              : isClockedIn
              ? styles.checkOutBtnActiveReady
              : styles.checkOutBtnDisabled,
          ]}
          onPress={handleClockOut}
          disabled={!isClockedIn || isClockedOut || loadingAction !== null}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isClockedOut ? 'checkmark-circle' : 'exit-outline'}
            size={16}
            color={
              isClockedOut
                ? 'rgba(255, 255, 255, 0.6)'
                : isClockedIn
                ? '#FFFFFF'
                : 'rgba(255, 255, 255, 0.5)'
            }
          />
          <Text
            style={[
              styles.btnText,
              isClockedOut
                ? styles.btnTextLocked
                : isClockedIn
                ? styles.checkOutTextActive
                : styles.checkOutTextDisabled,
            ]}
          >
            {loadingAction === 'clockOut'
              ? 'Clocking Out...'
              : isClockedOut
              ? 'Clocked Out'
              : 'Clock Out'}
          </Text>
        </TouchableOpacity>
      </View>
    </GradientView>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: spacing.borderRadius.pill,
    borderWidth: 1,
  },
  badgeWorking: {
    backgroundColor: colors.attendanceCheckInActiveBg,
    borderColor: colors.attendanceCheckInActiveBorder,
  },
  badgeWorkingText: {
    color: colors.attendanceCheckInActiveText,
  },
  badgeCompleted: {
    backgroundColor: colors.attendanceCheckOutBg,
    borderColor: colors.attendanceCheckOutBorder,
  },
  badgeCompletedText: {
    color: colors.attendanceCheckOutText,
  },
  badgeNotClocked: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  badgeNotClockedText: {
    color: '#FFFFFF',
  },
  workingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  historyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsStrip: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 12,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  checkInBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
  },
  checkOutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
  },
  btnLockedFaded: {
    opacity: 0.45,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  btnTextLocked: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  checkInBtnReady: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  checkInBtnClocked: {
    opacity: 0.6,
    backgroundColor: colors.attendanceCheckInActiveBg,
    borderColor: colors.attendanceCheckInActiveBorder,
  },
  checkInTextReady: {
    color: '#1E40AF',
    fontWeight: '800',
  },
  checkInTextActive: {
    color: colors.attendanceCheckInActiveText,
  },
  checkOutBtnActiveReady: {
    backgroundColor: '#DC2626',
    borderColor: '#EF4444',
    elevation: 3,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  checkOutBtnDisabled: {
    opacity: 0.4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  checkOutTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  checkOutTextDisabled: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  btnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
