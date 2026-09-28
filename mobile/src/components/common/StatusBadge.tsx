import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export interface StatusBadgeProps {
  label: string;
  status?: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  showDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  status,
  variant,
  style,
  textStyle,
  showDot = true,
}) => {
  const key = (status || label || '').toUpperCase().trim();

  const getCleanLabel = () => {
    // Remove any raw emojis like 🔴
    const clean = label.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
    if (key === 'NOT_ATTENDED') return 'Not Attended';
    if (key === 'HALF_DAY') return 'Half Day';
    if (key === 'NOT_CLOCKED_IN') return 'Not Clocked In';
    if (key === 'CLOCKED_IN') return 'Clocked In';
    if (key === 'CHECKED_IN') return 'Checked In';
    if (key === 'CLOCKED_OUT') return 'Clocked Out';
    if (key === 'CHECKED_OUT') return 'Checked Out';
    if (key === 'FOLLOW_UP') return 'Follow-up';
    if (key === 'IN_PROGRESS') return 'In Progress';
    return clean || label;
  };

  const getPalette = () => {
    if (key === 'CLOCKED_IN' || key === 'CHECKED_IN') {
      return { bg: colors.attendanceCheckInActiveBg, text: colors.attendanceCheckInActiveText, dot: colors.attendanceCheckInActiveText, border: colors.attendanceCheckInActiveBorder };
    }

    if (key === 'CLOCKED_OUT' || key === 'CHECKED_OUT') {
      return { bg: colors.attendanceCheckOutBg, text: colors.attendanceCheckOutText, dot: colors.attendanceCheckOutText, border: colors.attendanceCheckOutBorder };
    }

    if (key === 'NOT_CLOCKED_IN') {
      return { bg: colors.surfaceMuted, text: colors.textSecondary, dot: colors.textMuted, border: colors.border };
    }

    if (
      variant === 'danger' ||
      key === 'NOT_ATTENDED' ||
      key === 'MISSED' ||
      key.includes('MISSED') ||
      key === 'FAILED' ||
      key === 'NO_ANSWER' ||
      key === 'LEAVE' ||
      key === 'NOT_INTERESTED' ||
      key === 'INACTIVE' ||
      key === 'OVERDUE' ||
      key === 'REJECTED'
    ) {
      return { bg: '#FEE2E2', text: '#DC2626', dot: '#DC2626', border: '#FECACA' };
    }

    if (
      variant === 'success' ||
      key === 'PROSPECT' ||
      key === 'CONNECTED' ||
      key === 'PRESENT' ||
      key === 'CONVERTED' ||
      key === 'INTERESTED' ||
      key === 'ACTIVE' ||
      key === 'WORKING' ||
      key === 'APPROVED' ||
      key === 'SUCCESS' ||
      key === 'COMPLETED'
    ) {
      return { bg: colors.successLight, text: colors.success, dot: colors.success, border: 'rgba(22, 163, 74, 0.2)' };
    }

    if (
      variant === 'warning' ||
      key === 'JUNK' ||
      key === 'HALF_DAY' ||
      key === 'FOLLOW_UP' ||
      key === 'IN_PROGRESS' ||
      key === 'PENDING' ||
      key === 'BUSY'
    ) {
      return { bg: colors.warningLight, text: colors.warning, dot: colors.warning, border: 'rgba(217, 119, 6, 0.2)' };
    }

    if (
      variant === 'info' ||
      key === 'HOLIDAY' ||
      key === 'NEW' ||
      key === 'CONTACTED' ||
      key === 'AGENT' ||
      key === 'UPCOMING'
    ) {
      return { bg: colors.infoLight, text: colors.info, dot: colors.info, border: 'rgba(37, 99, 235, 0.2)' };
    }

    if (
      variant === 'primary' ||
      key === 'ACCEPTANCE' ||
      key === 'ACCEPTABLE' ||
      key === 'ADMIN' ||
      key === 'ROLE_ADMIN' ||
      key === 'INITIATED'
    ) {
      return { bg: colors.primaryLight, text: colors.primary, dot: colors.primary, border: 'rgba(79, 70, 229, 0.2)' };
    }

    return { bg: colors.surfaceMuted, text: colors.textSecondary, dot: colors.textMuted, border: colors.border };
  };

  const palette = getPalette();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: palette.bg, borderColor: palette.border },
        style,
      ]}
    >
      {showDot && <View style={[styles.dot, { backgroundColor: palette.dot }]} />}
      <Text style={[styles.text, { color: palette.text }, textStyle]}>
        {getCleanLabel()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: spacing.borderRadius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
