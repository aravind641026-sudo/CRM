import { apiClient } from './client';
import { ApiResponse, Call, CallAnalytics, CallDashboardStats, CallEventPayload, LeadTimelineItem, PageResponse } from '../types';

export interface LogCallPayload {
  leadId: number;
  durationSeconds: number;
  callStatus: string;
  businessOutcome?: string;
  notes?: string;
  scheduledFollowUp?: string;
}

export const callApi = {
  sendCallEvent: async (payload: CallEventPayload): Promise<Call> => {
    const res = await apiClient.post<ApiResponse<Call>>('/calls/events', payload);
    return res.data.data;
  },

  updateCallClassification: async (callId: number, businessClassification: string, notes?: string): Promise<Call> => {
    const res = await apiClient.patch<ApiResponse<Call>>(`/calls/${callId}/classification`, {
      businessClassification,
      notes,
    });
    return res.data.data;
  },

  getLeadTimeline: async (leadId: number): Promise<LeadTimelineItem[]> => {
    const res = await apiClient.get<ApiResponse<LeadTimelineItem[]>>(`/leads/${leadId}/timeline`);
    return res.data.data;
  },

  getCallDashboardStats: async (params?: {
    userId?: number;
    projectId?: number;
    leadId?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<CallDashboardStats> => {
    const res = await apiClient.get<ApiResponse<CallDashboardStats>>('/calls/dashboard-stats', { params });
    return res.data.data;
  },

  logCall: async (payload: LogCallPayload): Promise<Call> => {
    const res = await apiClient.post<ApiResponse<Call>>('/calls', payload);
    return res.data.data;
  },

  getCalls: async (params?: {
    userId?: number;
    leadId?: number;
    projectId?: number;
    status?: string;
    outcome?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    size?: number;
  }): Promise<PageResponse<Call>> => {
    const res = await apiClient.get<ApiResponse<PageResponse<Call>>>('/calls', {
      params: {
        userId: params?.userId,
        page: params?.page ?? 0,
        size: params?.size ?? 15,
        leadId: params?.leadId,
        projectId: params?.projectId,
        status: params?.status,
        outcome: params?.outcome,
        startDate: params?.startDate,
        endDate: params?.endDate,
      },
    });
    return res.data.data;
  },

  getCallsForLead: async (leadId: number): Promise<Call[]> => {
    const res = await apiClient.get<ApiResponse<Call[]>>(`/leads/${leadId}/calls`);
    return res.data.data;
  },

  getCallAnalytics: async (startDate?: string, endDate?: string): Promise<CallAnalytics> => {
    const res = await apiClient.get<ApiResponse<CallAnalytics>>('/calls/analytics', {
      params: {
        startDate,
        endDate,
      },
    });
    return res.data.data;
  },
};
