import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { AnimatedNumber } from './AnimatedNumber';
import { CardShine } from './CardShine';
import { CircularProgressWidget } from './CircularProgressWidget';

interface HeroDashboardCardProps {
  totalRevenue?: number;
  totalLeads?: number;
  convertedLeads?: number;
  conversionRate?: number;
  revenueLabel?: string;
  showAttendanceCapsule?: boolean;
  // Attendance metrics
  clockInTime?: string;
  clockOutTime?: string;
  durationMinutes?: number;
  attendanceStatus?: string;
  shiftDisplayName?: string;
  clockedIn?: boolean;
  clockedOut?: boolean;
  onPressAttendance?: () => void;
  onPressRevenue?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const HeroDashboardCard: React.FC<HeroDashboardCardProps> = ({
  totalRevenue = 0,
  totalLeads = 0,
  convertedLeads = 0,
  conversionRate = 0,
  revenueLabel = 'TOTAL CLOSED REVENUE',
  showAttendanceCapsule = true,
  clockInTime,
  clockOutTime,
  durationMinutes = 0,
  attendanceStatus = 'Active',
  shiftDisplayName = '09:00 AM – 06:00 PM',
  clockedIn = false,
  clockedOut = false,
  onPressAttendance,
  onPressRevenue,
  style,
}) => {
  const formatTimeStr = (iso?: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return iso;
    }
  };

  const formatDurationStr = (mins?: number) => {
    if (!mins || mins <= 0) return '0m';
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) {
      return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
    }
    return `${mins}m`;
  };

  const isCompleted = clockedOut || attendanceStatus === 'PRESENT' || attendanceStatus === 'HALF_DAY';
  const statusLabel = isCompleted ? 'Completed' : clockedIn ? 'Checked In' : 'Not Clocked In';

  return (
    <TouchableOpacity
      activeOpacity={onPressRevenue ? 0.92 : 1}
      onPress={onPressRevenue}
      style={[styles.outerCard, style]}
    >
      <LinearGradient
        colors={colors.heroAttendanceGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientCard}
      >
        {/* Subtle shimmer shine sweep */}
        <CardShine interval={5000} />

        {/* Top Section: Revenue & Conversion Gauge */}
        <View style={[styles.topRow, !showAttendanceCapsule && { marginBottom: 0 }]}>
          <View style={styles.revenueCol}>
            <Text style={styles.revenueLabel}>{revenueLabel}</Text>
            <View style={styles.revenueNumberRow}>
              <AnimatedNumber
                value={totalRevenue}
                prefix="₹"
                duration={1000}
                style={styles.revenueValue}
              />
            </View>
            <Text style={styles.convertedSubtext}>
              {convertedLeads} converted of {totalLeads} total leads
            </Text>
          </View>

          {/* Right Circular Gauge */}
          <CircularProgressWidget
            percentage={conversionRate}
            label="CONV."
            size={72}
          />
        </View>

        {/* Inner Glass Capsule: Today's Attendance */}
        {showAttendanceCapsule && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPressAttendance}
            style={styles.attendanceGlassCapsule}
          >
            {/* Attendance Header Row */}
            <View style={styles.attendanceHeaderRow}>
              <View style={styles.attendanceHeaderLeft}>
                <Ionicons name="time-outline" size={15} color="#FFFFFF" />
                <Text style={styles.attendanceTitle}>Today's Attendance</Text>
              </View>

              <View style={[styles.attendanceBadge, isCompleted ? styles.badgeCompleted : styles.badgeActive]}>
                <Ionicons
                  name={isCompleted ? 'checkmark' : clockedIn ? 'radio-button-on' : 'ellipse-outline'}
                  size={11}
                  color={isCompleted ? '#16A34A' : clockedIn ? '#2563EB' : '#D97706'}
                />
                <Text style={[styles.attendanceBadgeText, isCompleted ? styles.badgeTextCompleted : styles.badgeTextActive]}>
                  {statusLabel}
                </Text>
              </View>
            </View>

            {/* 3-Column Metrics: Clock In, Clock Out, Duration */}
            <View style={styles.attendanceMetricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricKey}>CLOCK IN</Text>
                <Text style={styles.metricValue}>{formatTimeStr(clockInTime)}</Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricItem}>
                <Text style={styles.metricKey}>CLOCK OUT</Text>
                <Text style={styles.metricValue}>{formatTimeStr(clockOutOutFallback(clockOutTime, clockedIn))}</Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricItem}>
                <Text style={styles.metricKey}>DURATION</Text>
                <Text style={styles.metricValue}>{formatDurationStr(durationMinutes)}</Text>
              </View>
            </View>

            {/* Shift Time Subtext */}
            <View style={styles.shiftSubtextRow}>
              <Text style={styles.shiftText}>Shift {shiftDisplayName}</Text>
              <Ionicons name="chevron-forward" size={13} color="rgba(255, 255, 255, 0.7)" />
            </View>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

function clockOutOutFallback(clockOutTime?: string, clockedIn?: boolean) {
  if (clockOutTime) return clockOutTime;
  if (clockedIn) return 'In Progress';
  return '—';
}

const styles = StyleSheet.create({
  outerCard: {
    borderRadius: 26,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  gradientCard: {
    padding: 20,
    borderRadius: 26,
    position: 'relative',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  revenueCol: {
    flex: 1,
    marginRight: 12,
  },
  revenueLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  revenueNumberRow: {
    marginTop: 4,
    marginBottom: 4,
  },
  revenueValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  convertedSubtext: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  attendanceGlassCapsule: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  attendanceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  attendanceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attendanceTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  attendanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeCompleted: {
    backgroundColor: '#DCFCE7',
  },
  badgeActive: {
    backgroundColor: '#EFF6FF',
  },
  attendanceBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  badgeTextCompleted: {
    color: '#16A34A',
  },
  badgeTextActive: {
    color: '#2563EB',
  },
  attendanceMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  metricKey: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  shiftSubtextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  shiftText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
  },
});
