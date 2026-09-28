import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GradientView } from '../common/GradientView';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { useAttendance } from '../../context/AttendanceContext';
import { Attendance } from '../../types';

interface AttendanceCardProps {
  initialAttendance?: Attendance | null;
  onViewHistory?: () => void;
  onAttendanceUpdated?: (attendance: Attendance) => void;
}

export const AttendanceCard: React.FC<AttendanceCardProps> = ({
  onViewHistory,
}) => {
  const {
    attendance,
    isLoading,
    isSubmitting,
    isClockedIn,
    isClockedOut,
    isCompleted,
    liveDuration,
    clockIn,
    clockOut,
    formatAttendanceTime,
  } = useAttendance();

  const handleClockIn = async () => {
    if (isSubmitting) return;
    try {
      await clockIn();
    } catch (err: any) {
      // Error toast already displayed by context
    }
  };

  const handleClockOut = async () => {
    if (isSubmitting) return;
    Alert.alert(
      'Confirm Clock Out',
      'Are you sure you want to clock out for today? Only one attendance session is permitted per calendar day.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clock Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await clockOut();
            } catch (err: any) {
              // Error toast already displayed by context
            }
          },
        },
      ]
    );
  };

  const shiftLabel = attendance?.shiftDisplayName || '10:00 AM – 07:00 PM';

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
            <Text style={styles.shiftText}>
              Shift: {shiftLabel}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View
            style={[
              styles.workingBadge,
              isCompleted
                ? styles.badgeCompleted
                : isClockedIn
                ? styles.badgeWorking
                : styles.badgeNotClocked,
            ]}
          >
            <Text
              style={[
                styles.workingBadgeText,
                isCompleted
                  ? styles.badgeCompletedText
                  : isClockedIn
                  ? styles.badgeWorkingText
                  : styles.badgeNotClockedText,
              ]}
            >
              {isCompleted
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
          <Text style={styles.metricValue}>
            {isLoading && !attendance ? '...' : formatAttendanceTime(attendance?.clockInTime)}
          </Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Clock Out</Text>
          <Text style={styles.metricValue}>
            {isLoading && !attendance ? '...' : formatAttendanceTime(attendance?.clockOutTime)}
          </Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Duration</Text>
          <Text style={styles.metricValue}>
            {isLoading && !attendance ? '...' : liveDuration}
          </Text>
        </View>
      </View>

      {/* Action Button: Derived strictly from attendance state */}
      <View style={styles.actionRow}>
        {isLoading && !attendance ? (
          /* Loading Status Placeholder */
          <View style={styles.loadingPlaceholder}>
            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.loadingPlaceholderText}>Checking attendance status...</Text>
          </View>
        ) : isCompleted ? (
          /* Session Completed State */
          <View style={styles.completedBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginRight: 6 }} />
            <Text style={styles.completedBannerText}>
              {attendance?.status === 'HALF_DAY'
                ? 'Half Day Session Recorded'
                : 'Attendance Session Completed'}
            </Text>
          </View>
        ) : isClockedIn ? (
          /* Checked In State -> Primary [ CHECK OUT ] Button */
          <TouchableOpacity
            style={[styles.actionBtn, styles.checkOutBtn, isSubmitting && styles.btnSubmitting]}
            onPress={handleClockOut}
            disabled={isSubmitting !== null}
            activeOpacity={0.85}
          >
            {isSubmitting === 'clockOut' ? (
              <View style={styles.btnInnerRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.btnText}>Clocking Out...</Text>
              </View>
            ) : (
              <View style={styles.btnInnerRow}>
                <Ionicons name="exit-outline" size={18} color="#FFFFFF" />
                <Text style={styles.btnText}>Clock Out</Text>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          /* Not Checked In State -> Primary [ CHECK IN ] Button (Emerald Green) */
          <TouchableOpacity
            style={[styles.actionBtn, styles.checkInBtn, isSubmitting && styles.btnSubmitting]}
            onPress={handleClockIn}
            disabled={isSubmitting !== null}
            activeOpacity={0.85}
          >
            {isSubmitting === 'clockIn' ? (
              <View style={styles.btnInnerRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={[styles.btnText, styles.checkInBtnText]}>Clocking In...</Text>
              </View>
            ) : (
              <View style={styles.btnInnerRow}>
                <Ionicons name="enter-outline" size={18} color="#FFFFFF" />
                <Text style={[styles.btnText, styles.checkInBtnText]}>Clock In</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
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
  shiftText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
    marginTop: 1,
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
    width: '100%',
  },
  actionBtn: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  checkInBtn: {
    backgroundColor: '#059669',
    borderWidth: 1,
    borderColor: '#10B981',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  checkInBtnText: {
    color: '#FFFFFF',
  },
  checkOutBtn: {
    backgroundColor: '#DC2626',
    borderWidth: 1,
    borderColor: '#EF4444',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  btnSubmitting: {
    opacity: 0.75,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  loadingPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  loadingPlaceholderText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  completedBannerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
