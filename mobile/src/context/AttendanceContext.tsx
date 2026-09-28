import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Attendance } from '../types';
import { attendanceApi } from '../api/attendanceApi';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { STORAGE_KEYS } from '../config/constants';
import { attendanceEventManager } from '../utils/attendanceEvents';
import { stopMobileEmergencyAlarm } from '../utils/alarmSound';

interface AttendanceContextType {
  attendance: Attendance | null;
  isLoading: boolean;
  isSubmitting: 'clockIn' | 'clockOut' | null;
  isOverdue: boolean;
  isSnoozed: boolean;
  error: string | null;
  liveDuration: string;
  isClockedIn: boolean;
  isClockedOut: boolean;
  isCompleted: boolean;
  clockIn: () => Promise<Attendance>;
  clockOut: () => Promise<Attendance>;
  refreshAttendance: (silent?: boolean) => Promise<Attendance | null>;
  snoozeAlarm: (minutes?: number) => void;
  clearSnooze: () => void;
  formatAttendanceTime: (timeStr?: string | null) => string;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

// Helper to get today's date string in YYYY-MM-DD
const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token, user, isLoading: authLoading } = useAuth();
  const { showSuccess, showError } = useToast();

  const [attendance, setAttendance] = useState<Attendance | null>(() => {
    return attendanceEventManager.getLatestAttendance() || null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<'clockIn' | 'clockOut' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveDuration, setLiveDuration] = useState<string>('0h 0m');
  const [isSnoozedState, setIsSnoozedState] = useState<boolean>(false);

  const snoozeTimerRef = useRef<any>(null);
  const submittingRef = useRef<'clockIn' | 'clockOut' | null>(null);
  submittingRef.current = isSubmitting;

  const isClockedIn = !!attendance?.clockInTime;
  const isClockedOut = !!attendance?.clockOutTime;
  const isCompleted = isClockedOut;

  // Format time deterministically (e.g., "10:30 AM")
  const formatAttendanceTime = useCallback((timeStr?: string | null): string => {
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
  }, []);

  // Update cached state and storage
  const commitAttendanceState = useCallback(async (data: Attendance | null) => {
    setAttendance(data);
    attendanceEventManager.setLatestAttendance(data);
    if (data) {
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.ATTENDANCE_DATA, JSON.stringify(data));
      } catch (e) {
        console.warn('Error caching attendance data:', e);
      }
    } else {
      try {
        await AsyncStorage.removeItem(STORAGE_KEYS.ATTENDANCE_DATA);
      } catch (e) {
        console.warn('Error clearing cached attendance data:', e);
      }
    }
  }, []);

  // Fetch today's attendance from backend
  const refreshAttendance = useCallback(
    async (silent: boolean = false): Promise<Attendance | null> => {
      if (!isAuthenticated || !token || authLoading) {
        return null;
      }
      if (!silent) {
        setIsLoading(true);
      }
      try {
        const data = await attendanceApi.getTodayAttendance();
        await commitAttendanceState(data);
        setError(null);
        return data;
      } catch (err: any) {
        console.warn('Failed to fetch today attendance:', err?.message || err);
        setError(err?.message || 'Unable to sync attendance status.');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated, token, authLoading, commitAttendanceState]
  );

  // Initial mount: Hydrate from AsyncStorage first, then sync with backend
  useEffect(() => {
    let isMounted = true;

    const initializeAttendance = async () => {
      if (!isAuthenticated || !token || authLoading) {
        if (isMounted) {
          setAttendance(null);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      // 1. Fast Hydration from AsyncStorage
      try {
        const cachedRaw = await AsyncStorage.getItem(STORAGE_KEYS.ATTENDANCE_DATA);
        if (cachedRaw && isMounted) {
          const parsed = JSON.parse(cachedRaw) as Attendance;
          const todayStr = getTodayDateString();
          // Only use cache if it belongs to today's date
          if (parsed && (parsed.date === todayStr || !parsed.date)) {
            setAttendance(parsed);
            attendanceEventManager.setLatestAttendance(parsed);
          }
        }
      } catch (e) {
        console.warn('Error reading stored attendance cache:', e);
      }

      // 2. Fetch fresh status from backend to guarantee truth
      try {
        const fresh = await attendanceApi.getTodayAttendance();
        if (isMounted) {
          await commitAttendanceState(fresh);
          setError(null);
        }
      } catch (err: any) {
        console.warn('Backend attendance sync failed:', err?.message || err);
        if (isMounted) {
          setError(err?.message || 'Failed to sync attendance.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAttendance();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, token, authLoading, commitAttendanceState]);

  // AppState listener (re-sync attendance when app resumes from background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isAuthenticated && token && !authLoading) {
        setIsSnoozedState(attendanceEventManager.isSnoozed());
        refreshAttendance(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, token, authLoading, refreshAttendance]);

  // Live duration ticker
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
      const interval = setInterval(updateDuration, 15000); // every 15s
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

  // Clock In Action
  const clockIn = useCallback(async (): Promise<Attendance> => {
    if (submittingRef.current) {
      throw new Error('An attendance request is already in progress.');
    }
    if (attendance?.clockInTime) {
      const formatted = formatAttendanceTime(attendance.clockInTime);
      throw new Error(`You have already checked in today at ${formatted}.`);
    }

    setIsSubmitting('clockIn');
    setError(null);

    try {
      const updated = await attendanceApi.clockIn();
      await commitAttendanceState(updated);
      attendanceEventManager.clearSnooze();
      setIsSnoozedState(false);
      stopMobileEmergencyAlarm();

      const timeFormatted = formatAttendanceTime(updated.clockInTime);
      showSuccess('Checked In Successfully', `Punch recorded at ${timeFormatted}. Have a great day!`);
      return updated;
    } catch (err: any) {
      const msg = err?.message || 'Unable to record Check-In. Please try again.';
      setError(msg);
      showError('Check-In Failed', msg);
      throw err;
    } finally {
      setIsSubmitting(null);
    }
  }, [attendance, commitAttendanceState, formatAttendanceTime, showSuccess, showError]);

  // Clock Out Action
  const clockOut = useCallback(async (): Promise<Attendance> => {
    if (submittingRef.current) {
      throw new Error('An attendance request is already in progress.');
    }
    if (!attendance?.clockInTime) {
      throw new Error('You must check in before checking out.');
    }
    if (attendance?.clockOutTime) {
      throw new Error('You have already checked out for today.');
    }

    setIsSubmitting('clockOut');
    setError(null);

    try {
      const updated = await attendanceApi.clockOut();
      await commitAttendanceState(updated);
      attendanceEventManager.clearSnooze();
      setIsSnoozedState(false);
      stopMobileEmergencyAlarm();

      const timeFormatted = formatAttendanceTime(updated.clockOutTime);
      const hours = Math.floor((updated.durationMinutes || 0) / 60);
      const mins = (updated.durationMinutes || 0) % 60;
      showSuccess('Checked Out Successfully', `Punch recorded at ${timeFormatted}. Total duration: ${hours}h ${mins}m`);
      return updated;
    } catch (err: any) {
      const msg = err?.message || 'Unable to record Check-Out. Please try again.';
      setError(msg);
      showError('Check-Out Failed', msg);
      throw err;
    } finally {
      setIsSubmitting(null);
    }
  }, [attendance, commitAttendanceState, formatAttendanceTime, showSuccess, showError]);

  // Snooze Alarm
  const snoozeAlarm = useCallback((minutes: number = 5) => {
    stopMobileEmergencyAlarm();
    attendanceEventManager.snoozeAlarm(minutes);
    setIsSnoozedState(true);

    if (snoozeTimerRef.current) {
      clearTimeout(snoozeTimerRef.current);
    }

    snoozeTimerRef.current = setTimeout(() => {
      attendanceEventManager.clearSnooze();
      setIsSnoozedState(false);
    }, minutes * 60 * 1000);
  }, []);

  const clearSnooze = useCallback(() => {
    if (snoozeTimerRef.current) {
      clearTimeout(snoozeTimerRef.current);
      snoozeTimerRef.current = null;
    }
    attendanceEventManager.clearSnooze();
    setIsSnoozedState(false);
  }, []);

  // Determine overdue status
  const shiftStartTime = user?.shiftStartTime || attendance?.shiftStartTime || '10:00:00';
  const now = new Date();
  const [startHours, startMinutes] = shiftStartTime.split(':').map(Number);
  const shiftStartDate = new Date();
  shiftStartDate.setHours(startHours || 10, startMinutes || 0, 0, 0);

  const isPastShiftStart = now.getTime() >= shiftStartDate.getTime();
  const isOverdue =
    isAuthenticated &&
    !isClockedIn &&
    !isClockedOut &&
    isPastShiftStart;

  return (
    <AttendanceContext.Provider
      value={{
        attendance,
        isLoading,
        isSubmitting,
        isOverdue,
        isSnoozed: isSnoozedState,
        error,
        liveDuration,
        isClockedIn,
        isClockedOut,
        isCompleted,
        clockIn,
        clockOut,
        refreshAttendance,
        snoozeAlarm,
        clearSnooze,
        formatAttendanceTime,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
};

export const useAttendance = () => {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error('useAttendance must be used within an AttendanceProvider');
  }
  return context;
};
