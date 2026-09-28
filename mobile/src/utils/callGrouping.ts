import { Call } from '../types';

export interface GroupedCallLog {
  id: string;
  phoneNumber: string;
  normalizedPhone: string;
  leadId?: number;
  leadName?: string;
  projectName?: string;
  assignedUserName?: string;
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  totalDurationSeconds: number;
  averageDurationSeconds: number;
  firstCallDate?: string;
  lastCallDate?: string;
  latestCall: Call;
  allCalls: Call[];
  latestStatus: string;
  latestOutcome?: string;
  hasMissed: boolean;
  notes?: string;
  followUpDate?: string;
  followUpRequired?: boolean;
}

/**
 * Normalizes phone numbers for accurate grouping.
 * Handles prefixes (+91, 0, whitespace, hyphens) and returns the standard 10-digit number.
 */
export function normalizePhoneNumber(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/[^0-9]/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

export function formatDisplayPhone(rawPhone?: string | null): string {
  if (!rawPhone) return 'No Phone';
  const clean = rawPhone.trim();
  const digits = clean.replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return clean;
}

export function isCallMissed(call: Call): boolean {
  if (call.isConnected === false) return true;
  const status = (call.callStatus || '').toUpperCase();
  return (
    status === 'MISSED' ||
    status === 'NOT_ATTENDED' ||
    status === 'NO_ANSWER' ||
    status === 'FAILED' ||
    status === 'REJECTED' ||
    status === 'CANCELLED' ||
    (call.durationSeconds != null && call.durationSeconds === 0)
  );
}

export function isCallAnswered(call: Call): boolean {
  return !isCallMissed(call) && (call.durationSeconds != null ? call.durationSeconds > 0 : true);
}

/**
 * Groups a list of Call records by normalized phone number.
 * If phone number is missing, groups by leadId.
 * Retains all historical records chronologically.
 */
export function groupCallsByPhoneNumber(calls: Call[]): GroupedCallLog[] {
  if (!calls || calls.length === 0) return [];

  const groupsMap = new Map<string, Call[]>();

  for (const call of calls) {
    const rawPhone = call.leadPhone || (call as any).phoneNumber || (call as any).customerPhone || '';
    const normalized = normalizePhoneNumber(rawPhone);

    // Group key: normalized phone number, or lead ID fallback, or call ID fallback
    const key = normalized.length > 0 ? `phone_${normalized}` : call.leadId ? `lead_${call.leadId}` : `call_${call.id}`;

    const existing = groupsMap.get(key) || [];
    existing.push(call);
    groupsMap.set(key, existing);
  }

  const groupedLogs: GroupedCallLog[] = [];

  for (const [key, callList] of groupsMap.entries()) {
    // Sort calls descending (newest first)
    callList.sort((a, b) => {
      const timeA = new Date(a.startTime || a.startedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.startTime || b.startedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    const latestCall = callList[0];
    const oldestCall = callList[callList.length - 1];

    let totalDuration = 0;
    let answeredCount = 0;
    let missedCount = 0;
    let leadId: number | undefined;
    let leadName: string | undefined;
    let projectName: string | undefined;
    let assignedUserName: string | undefined;
    let followUpDate: string | undefined;
    let followUpRequired: boolean | undefined;
    let notes: string | undefined;

    for (const c of callList) {
      const dur = c.durationSeconds || 0;
      totalDuration += dur;
      if (isCallMissed(c)) {
        missedCount++;
      } else {
        answeredCount++;
      }

      if (!leadId && c.leadId) leadId = c.leadId;
      if (!leadName && c.leadName) leadName = c.leadName;
      if (!projectName && c.projectName) projectName = c.projectName;
      if (!assignedUserName && (c.userName || c.user?.name)) {
        assignedUserName = c.userName || c.user?.name;
      }
      if (!followUpDate && (c.followUpDate || (c as any).scheduledFollowUp)) {
        followUpDate = c.followUpDate || (c as any).scheduledFollowUp;
      }
      if (c.followUpRequired) {
        followUpRequired = true;
      }
      if (!notes && c.notes && c.notes.trim().length > 0) {
        notes = c.notes;
      }
    }

    const rawPhone = latestCall.leadPhone || (latestCall as any).phoneNumber || (latestCall as any).customerPhone || '';
    const normalizedPhone = normalizePhoneNumber(rawPhone);
    const displayPhone = formatDisplayPhone(rawPhone);

    const latestMissed = isCallMissed(latestCall);
    const averageDuration = answeredCount > 0 ? Math.round(totalDuration / answeredCount) : 0;

    groupedLogs.push({
      id: key,
      phoneNumber: displayPhone || (leadName ? `Lead #${leadId}` : 'Unknown Phone'),
      normalizedPhone,
      leadId,
      leadName,
      projectName,
      assignedUserName,
      totalCalls: callList.length,
      answeredCalls: answeredCount,
      missedCalls: missedCount,
      totalDurationSeconds: totalDuration,
      averageDurationSeconds: averageDuration,
      firstCallDate: oldestCall.startTime || oldestCall.startedAt || oldestCall.createdAt,
      lastCallDate: latestCall.startTime || latestCall.startedAt || latestCall.createdAt,
      latestCall,
      allCalls: callList,
      latestStatus: latestCall.callStatus || (latestMissed ? 'MISSED' : 'CONNECTED'),
      latestOutcome: latestCall.businessOutcome || latestCall.finalClassification,
      hasMissed: latestMissed,
      notes,
      followUpDate,
      followUpRequired,
    });
  }

  // Sort groups by latest call date descending
  groupedLogs.sort((a, b) => {
    const timeA = new Date(a.lastCallDate || 0).getTime();
    const timeB = new Date(b.lastCallDate || 0).getTime();
    return timeB - timeA;
  });

  return groupedLogs;
}
