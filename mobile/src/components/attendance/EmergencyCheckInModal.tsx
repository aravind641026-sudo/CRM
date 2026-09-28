import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useAttendance } from '../../context/AttendanceContext';
import { startMobileEmergencyAlarm, stopMobileEmergencyAlarm } from '../../utils/alarmSound';

export const EmergencyCheckInModal: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const {
    attendance,
    isOverdue,
    isSnoozed,
    isClockedIn,
    isClockedOut,
    isSubmitting,
    clockIn,
    snoozeAlarm,
  } = useAttendance();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [localError, setLocalError] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const clockIntervalRef = useRef<any>(null);

  const shiftDisplayName =
    attendance?.shiftDisplayName || user?.shiftDisplayName || '10:00 AM – 07:00 PM';

  const isVisible =
    isAuthenticated && isOverdue && !isSnoozed && !isClockedIn && !isClockedOut;

  // Pulse animation loop
  useEffect(() => {
    if (isVisible) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isVisible, pulseAnim]);

  // Alarm sound controller
  useEffect(() => {
    if (isVisible) {
      startMobileEmergencyAlarm();
    } else {
      stopMobileEmergencyAlarm();
    }
    return () => {
      stopMobileEmergencyAlarm();
    };
  }, [isVisible]);

  // Clock ticker every second
  useEffect(() => {
    clockIntervalRef.current = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    };
  }, []);

  // Handle Clock In Action from the Alarm modal
  const handleClockIn = async () => {
    setLocalError(null);
    stopMobileEmergencyAlarm();
    try {
      await clockIn();
      stopMobileEmergencyAlarm();
    } catch (err: any) {
      setLocalError(err.message || 'Unable to record check-in. Please try again.');
      startMobileEmergencyAlarm();
    }
  };

  // Handle "Skip for Now" Action (Snoozes the alarm for exactly 5 minutes)
  const handleSkip = () => {
    stopMobileEmergencyAlarm();
    setLocalError(null);
    snoozeAlarm(5);
  };

  if (!isVisible) {
    return null;
  }

  const formattedCurrentTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <Modal
      visible={isVisible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#120204" />
      <View style={styles.container}>
        {/* Glow backdrop circle */}
        <View style={styles.glowCircle} />

        {/* Warning Icon with Pulse */}
        <Animated.View style={[styles.iconWrapper, { transform: [{ scale: pulseAnim }] }]}>
          <Ionicons name="warning" size={54} color="#EF4444" />
        </Animated.View>

        {/* Header Badge */}
        <View style={styles.badgeRow}>
          <Ionicons name="alert-circle" size={15} color="#FCA5A5" />
          <Text style={styles.badgeText}>MANDATORY ATTENDANCE ALERT</Text>
        </View>

        {/* Urgent Titles */}
        <Text style={styles.mainTitle}>CHECK-IN REQUIRED</Text>
        <Text style={styles.subTitle}>
          You have not checked in for today's shift. Check-in is required to continue using the application.
        </Text>

        {localError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{localError}</Text>
          </View>
        ) : null}

        {/* Shift Details Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>YOUR ASSIGNED SHIFT</Text>
            <Text style={styles.infoValue}>{shiftDisplayName}</Text>
          </View>

          <View style={styles.dividerVertical} />

          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>CURRENT TIME</Text>
            <View style={styles.timeRow}>
              <Ionicons name="time" size={14} color="#EF4444" />
              <Text style={styles.timeValue}>{formattedCurrentTime}</Text>
            </View>
          </View>
        </View>

        {/* Button 1: Check In Action Button */}
        <TouchableOpacity
          style={[styles.checkInBtn, isSubmitting && styles.checkInBtnDisabled]}
          onPress={handleClockIn}
          disabled={isSubmitting !== null}
          activeOpacity={0.85}
        >
          {isSubmitting === 'clockIn' ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.checkInBtnText}>RECORDING CHECK-IN...</Text>
            </View>
          ) : (
            <View style={styles.loadingRow}>
              <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
              <Text style={styles.checkInBtnText}>CHECK IN NOW</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Button 2: Skip for Now Action Button */}
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={handleSkip}
          disabled={isSubmitting !== null}
          activeOpacity={0.85}
        >
          <View style={styles.loadingRow}>
            <Ionicons name="play-forward" size={18} color="#EF4444" style={{ marginRight: 2 }} />
            <Text style={styles.skipBtnText}>SKIP FOR NOW</Text>
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#120204',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  glowCircle: {
    position: 'absolute',
    top: '15%',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
  },
  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  badgeText: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  subTitle: {
    fontSize: 13,
    color: '#FECACA',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  errorBox: {
    width: '100%',
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    marginBottom: 16,
  },
  errorText: {
    color: '#FEE2E2',
    fontSize: 12,
    textAlign: 'center',
  },
  infoCard: {
    width: '100%',
    backgroundColor: 'rgba(26, 7, 10, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 26,
  },
  infoCol: {
    flex: 1,
  },
  dividerVertical: {
    width: 1,
    height: '80%',
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    marginHorizontal: 12,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EF4444',
  },
  checkInBtn: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 14,
  },
  checkInBtnDisabled: {
    opacity: 0.7,
  },
  skipBtn: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: '#120204',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  checkInBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  skipBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
