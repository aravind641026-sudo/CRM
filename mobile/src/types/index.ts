export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string; // 'ROLE_ADMIN' | 'ROLE_USER'
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'REJECTED' | 'APPROVED' | string;
  shift?: string;
  shiftDisplayName?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShiftOption {
  id: string;
  displayName: string;
  startTime: string;
  endTime: string;
  isDefault: boolean;
}

export interface ShiftChangeRequest {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  currentShift: string;
  currentShiftDisplayName: string;
  requestedShift: string;
  requestedShiftDisplayName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string;
  adminNotes?: string;
  requestedAt: string;
  reviewedAt?: string;
  reviewedById?: number;
  reviewedByName?: string;
}

export interface JwtAuthResponse {
  token: string;
  type: string;
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'ACTIVE' | 'INACTIVE';
  user?: User;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  status: string; // 'ACTIVE' | 'INACTIVE'
  createdAt?: string;
  updatedAt?: string;
  totalLeads?: number;
  assignedLeads?: number;
  assignedLeadsCount?: number;
  convertedLeads?: number;
}

export interface LeadOwner {
  id: number;
  name: string;
  email: string;
  phone?: string;
}

export interface LeadAssignment {
  id: number;
  leadId: number;
  userId?: number;
  userName?: string;
  userEmail?: string;
  assignedById?: number;
  assignedByName?: string;
  assignedTo?: LeadOwner;
  assignedBy?: LeadOwner;
  assignedAt: string;
  unassignedAt?: string;
  isActive?: boolean;
  reason?: string;
}

export interface Lead {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  source?: string;
  project?: {
    id: number;
    name: string;
  };
  projectId?: number;
  projectName?: string;
  currentOwner?: LeadOwner;
  currentOwnerId?: number;
  currentOwnerName?: string;
  assignedTo?: LeadOwner;
  status: string; // 'NEW' | 'CONTACTED' | 'IN_PROGRESS' | 'FOLLOW_UP' | 'CONVERTED' | 'CLOSED'
  businessOutcome?: string | null; // 'INTERESTED' | 'NOT_INTERESTED' | 'FOLLOW_UP' | 'WRONG_NUMBER' | 'JUNK' | 'CONVERTED'
  notes?: string;
  scheduledFollowUp?: string;
  lastContactedAt?: string;
  lastCallId?: number;
  lastCallStatus?: string;
  lastCallDuration?: number;
  totalCallCount?: number;
  connectedCallCount?: number;
  missedCallCount?: number;
  rejectedCallCount?: number;
  failedCallCount?: number;
  shortCallCount?: number;
  junkCallCount?: number;
  followUpRequired?: boolean;
  nextFollowUpAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeadDetailResponse extends Lead {
  additionalInfo?: string;
  previousOwners?: LeadOwner[];
  assignmentHistory?: LeadAssignment[];
  assignments?: LeadAssignment[];
  callSummary?: any;
  callHistory?: Call[];
  followUps?: FollowUp[];
  notesList?: Note[];
  sale?: Sale;
  callsCount?: number;
  notesCount?: number;
  followUpsCount?: number;
}

export interface Call {
  id: number;
  telephonyCallId?: string;
  leadId: number;
  leadName?: string;
  leadPhone?: string;
  projectId?: number;
  projectName?: string;
  userId: number;
  userName?: string;
  user?: LeadOwner;
  callDirection?: string;
  callLifecycleStatus?: string;
  startTime?: string;
  endTime?: string;
  startedAt?: string;
  connectedAt?: string;
  endedAt?: string;
  durationSeconds: number;
  formattedDuration?: string;
  isConnected?: boolean;
  callStatus: string; // 'CONNECTED' | 'MISSED' | 'NO_ANSWER' | 'BUSY' | 'FAILED' | 'REJECTED' | 'CANCELLED'
  businessOutcome?: string;
  automaticClassification?: string;
  finalClassification?: string;
  classificationChangedManually?: boolean;
  classificationChangedByName?: string;
  classificationChangedAt?: string;
  followUpRequired?: boolean;
  followUpDate?: string;
  followUpId?: number;
  notes?: string;
  createdAt?: string;
}

export interface CallEventPayload {
  eventType: string; // 'CALL_INITIATED' | 'CALL_RINGING' | 'CALL_CONNECTED' | 'CALL_ENDED' | 'CALL_MISSED' | 'CALL_REJECTED' | 'CALL_FAILED' | 'CALL_CANCELLED'
  telephonyCallId?: string;
  eventId?: string;
  leadId?: number;
  customerPhone?: string;
  projectId?: number;
  callDirection?: string;
  timestamp?: string;
  durationSeconds?: number;
  isConnected?: boolean;
  technicalStatus?: string;
  businessClassification?: string;
  notes?: string;
  followUpRequired?: boolean;
  followUpDate?: string;
  followUpNotes?: string;
}

export interface LeadTimelineItem {
  type: 'CALL' | 'FOLLOW_UP' | 'NOTE' | 'STATUS_CHANGE' | 'ASSIGNMENT' | 'CONVERT' | 'LEAD_CREATED' | 'AUDIT' | string;
  id: number;
  leadId: number;
  userId?: number;
  userName?: string;
  timestamp: string;
  durationSeconds?: number;
  callDirection?: string;
  technicalStatus?: string;
  businessClassification?: string;
  classificationChangedManually?: boolean;
  scheduledTime?: string;
  followUpStatus?: string;
  title: string;
  notes?: string;
  followUpRequired?: boolean;
  nextFollowUpAt?: string;
}

export interface CallDashboardStats {
  totalCalls: number;
  connectedCalls: number;
  missedCalls: number;
  rejectedCalls: number;
  failedCalls: number;
  cancelledCalls: number;
  shortCalls: number;
  junkCalls: number;
  followUpCalls: number;
  totalDurationSeconds: number;
  averageDurationSeconds: number;
  upcomingFollowUps: number;
  todayFollowUps: number;
  missedFollowUps: number;
  completedFollowUps: number;
  totalLeads: number;
  contactedLeads: number;
  notContactedLeads: number;
  interestedLeads: number;
  notInterestedLeads: number;
  followUpLeads: number;
  convertedLeads: number;
  junkLeads: number;
  callsByLifecycleStatus: Record<string, number>;
  callsByBusinessClassification: Record<string, number>;
  leadsByStatus: Record<string, number>;
}

export interface FollowUp {
  id: number;
  leadId: number;
  leadName?: string;
  leadPhone?: string;
  userId: number;
  userName?: string;
  user?: LeadOwner;
  scheduledTime: string;
  followUpDate?: string;
  status: string; // 'PENDING' | 'COMPLETED' | 'CANCELLED'
  notes?: string;
  createdAt?: string;
}

export interface Note {
  id: number;
  leadId: number;
  userId: number;
  userName?: string;
  user?: LeadOwner;
  content: string;
  createdAt: string;
}

export interface Attendance {
  id?: number;
  userId: number;
  userName?: string;
  date: string;
  clockInTime?: string;
  clockOutTime?: string;
  durationMinutes: number;
  status: 'PRESENT' | 'HALF_DAY' | 'LEAVE' | 'HOLIDAY' | 'NOT_CLOCKED_IN' | string;
  notes?: string;
  clockedIn: boolean;
  clockedOut: boolean;
  shift?: string;
  shiftDisplayName?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  checkInOverdue?: boolean;
  serverTime?: string;
}

export interface AttendanceMonthlyResponse {
  year: number;
  month: number;
  totalDays?: number;
  presentDays: number;
  fullDays?: number;
  halfDays: number;
  offDays?: number;
  leaveDays: number;
  holidayDays: number;
  totalWorkingHours: number;
  records: Attendance[];
}

export interface Sale {
  id: number;
  leadId: number;
  leadName?: string;
  leadPhone?: string;
  projectId?: number;
  projectName?: string;
  userId: number;
  userName?: string;
  assignedAgentName?: string;
  status?: string;
  dealValue: number;
  notes?: string;
  convertedAt: string;
  createdAt?: string;
}

export interface UserDashboardSummary {
  myAssignedLeads: number;
  myCallsToday: number;
  myConnectedCallsToday: number;
  myPendingFollowUpsToday: number;
  myOverdueFollowUps: number;
  interestedLeads: number;
  myConversions: number;
  totalRevenue?: number;
  upcomingFollowUps?: FollowUp[];
  recentCalls?: Call[];
}

export interface AdminDashboardSummary {
  totalLeads: number;
  activeProjects: number;
  convertedLeads: number;
  activeAgents: number;
  totalCalls: number;
  callsToday: number;
  connectedCalls: number;
  pendingFollowUps: number;
  totalRevenue: number;
  projectBreakdown?: {
    projectId: number;
    projectName: string;
    totalLeads: number;
    convertedLeads: number;
  }[];
  recentActivity?: any[];
}

export interface AuditLog {
  id: number;
  userId?: number;
  userName?: string;
  entityName: string;
  entityId?: number;
  action: string; // 'CREATE' | 'UPDATE' | 'ASSIGN' | 'REASSIGN' | 'CONVERT' | 'DELETE' | 'PASSWORD_CHANGE'
  oldValue?: string;
  newValue?: string;
  details?: string;
  createdAt: string;
}

export interface GoogleSheetsSyncLog {
  id: number;
  syncId?: number | string;
  syncCode?: string;
  syncTimestamp?: string;
  status: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS' | 'STARTED' | 'PARTIAL';
  recordsSynced: number;
  usersCount?: number;
  projectsCount?: number;
  leadsCount?: number;
  assignmentsCount?: number;
  callsCount?: number;
  followupsCount?: number;
  salesCount?: number;
  errorMessage?: string;
  triggeredBy?: any;
  startedAt?: string;
  completedAt?: string;
  summary?: {
    users: number;
    projects: number;
    leads: number;
    assignments: number;
    calls: number;
    followUps: number;
    sales: number;
  };
  createdAt?: string;
}

export interface CallAnalytics {
  startDate: string;
  endDate: string;
  totalCalls: number;
  uniqueCalls: number;
  notAttendedCalls: number;
  freshCalls: number;
  prospectCalls: number;
  junkCalls: number;
  acceptableCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  missedCalls: number;
  shortCalls?: number;
  totalTalkTimeSeconds?: number;
  averageDurationSeconds?: number;
  connectedCalls?: number;
  todayCalls?: number;
  upcomingFollowUps?: number;
  missedFollowUps?: number;
}

export interface AdminAccessRequest {
  id?: number;
  userId: number;
  userName?: string;
  userEmail?: string;
  status: 'NOT_REQUESTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string;
  requestedAt?: string;
  reviewedAt?: string;
  adminNotes?: string;
}

export interface PageResponse<T> {
  content: T[];
  pageNumber?: number;
  pageSize?: number;
  page?: number;
  size?: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface AdminNotification {
  id: string;
  type: 'PERMISSION_REQUEST' | 'LEAD_ASSIGNMENT' | 'LEAD_REASSIGNMENT' | 'PROJECT_EVENT' | 'SYSTEM_EVENT' | 'PROMOTION_APPROVED' | 'PROMOTION_REJECTED' | string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  referenceId?: number;
  referenceType?: string;
  status?: string;
  leadId?: number;
  leadName?: string;
  projectName?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  timestamp?: string;
}

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Main: undefined;
  LeadDetails: { leadId: number; leadName?: string };
  LeadTimeline: { leadId: number; leadName?: string };
  LeadFollowUps: { leadId: number; leadName?: string };
  LeadAssignments: { leadId: number; leadName?: string };
  AttendanceHistory: { userId?: number; userName?: string } | undefined;
  CallLogs: {
    initialTab?: string;
    status?: string;
    callDirection?: string;
    minDuration?: number;
    maxDuration?: number;
    startDate?: string;
    endDate?: string;
    filterTitle?: string;
  } | undefined;
  CallHistoryDetail: {
    callId?: number;
    phoneNumber?: string;
    leadId?: number;
    leadName?: string;
    groupedLog?: any;
    call?: any;
  };
  Sales: undefined;
  ConvertedLeads: undefined;
  AdminProjects: undefined;
  AdminUsers: undefined;
  Assignments: undefined;
  Reports: undefined;
  AuditLogs: undefined;
  GoogleSheets: undefined;
  FollowUps: { period?: 'overdue' | 'today' | 'upcoming' | 'completed' };
  Settings: undefined;
  Notifications: undefined;
  Analytics: undefined;
};

export type MainTabParamList = {
  // Common / Role specific
  Home: undefined;
  AdminDashboard: undefined;
  Dial: { initialPhone?: string };
  Leads: { projectId?: number; projectName?: string; mode?: string };
  FollowUps: undefined;
  Reports: undefined;
  AdminHub: undefined;
  Settings: undefined;
  Analytics: undefined;
};
