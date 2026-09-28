import { Attendance } from '../types';

type AttendanceListener = (attendance: Attendance | null) => void;
type RefreshRequestListener = () => void;

const listeners = new Set<AttendanceListener>();
const refreshListeners = new Set<RefreshRequestListener>();

let cachedTodayAttendance: Attendance | null = null;
let snoozedUntilTimestamp: number | null = null;

export const attendanceEventManager = {
  getLatestAttendance: (): Attendance | null => cachedTodayAttendance,

  setLatestAttendance: (att: Attendance | null) => {
    const prev = cachedTodayAttendance;
    cachedTodayAttendance = att;

    // Compare signature to prevent duplicate broadcasts and render loops
    const prevKey = prev
      ? `${prev.id}_${prev.clockInTime}_${prev.clockOutTime}_${prev.status}_${prev.clockedIn}_${prev.clockedOut}`
      : 'null';
    const newKey = att
      ? `${att.id}_${att.clockInTime}_${att.clockOutTime}_${att.status}_${att.clockedIn}_${att.clockedOut}`
      : 'null';

    if (prevKey !== newKey) {
      listeners.forEach((fn) => {
        try {
          fn(att);
        } catch (e) {
          console.warn('Error in attendance listener:', e);
        }
      });
    }
  },

  subscribe: (fn: AttendanceListener) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },

  triggerRefresh: () => {
    refreshListeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.warn('Error in refresh listener:', e);
      }
    });
  },

  onRefreshRequested: (fn: RefreshRequestListener) => {
    refreshListeners.add(fn);
    return () => {
      refreshListeners.delete(fn);
    };
  },

  // Snooze (Skip for 5 minutes) Management
  snoozeAlarm: (minutes: number = 5) => {
    snoozedUntilTimestamp = Date.now() + minutes * 60 * 1000;
  },

  clearSnooze: () => {
    snoozedUntilTimestamp = null;
  },

  isSnoozed: (): boolean => {
    if (!snoozedUntilTimestamp) return false;
    if (Date.now() >= snoozedUntilTimestamp) {
      snoozedUntilTimestamp = null;
      return false;
    }
    return true;
  },

  getSnoozedUntil: (): number | null => snoozedUntilTimestamp,
};
