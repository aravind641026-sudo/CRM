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
    // 1. If leadId is explicitly provided, fetch directly from working /leads/{id}/calls endpoint
    if (params?.leadId) {
      try {
        const leadCalls = await callApi.getCallsForLead(params.leadId);
        const calls = leadCalls || [];
        return {
          content: calls,
          page: 0,
          size: calls.length,
          totalElements: calls.length,
          totalPages: 1,
          last: true,
        };
      } catch (leadCallsErr) {
        console.warn(`[callApi] getCallsForLead failed for leadId ${params.leadId}:`, leadCallsErr);
      }
    }

    // 2. Attempt primary /calls endpoint
    try {
      const res = await apiClient.get<ApiResponse<PageResponse<Call>>>('/calls', {
        params: {
          userId: params?.userId,
          page: params?.page ?? 0,
          size: params?.size ?? 50,
          leadId: params?.leadId,
          projectId: params?.projectId,
          status: params?.status,
          outcome: params?.outcome,
          startDate: params?.startDate,
          endDate: params?.endDate,
        },
      });
      if (res.data?.data?.content) {
        return res.data.data;
      }
    } catch (primaryErr: any) {
      console.warn('[callApi] /calls primary endpoint returned error, activating lead calls fallback:', primaryErr?.message);
    }

    // 3. Fallback: Aggregate calls across CRM leads via working /leads/{id}/calls endpoint
    try {
      const leadsRes = await apiClient.get<ApiResponse<PageResponse<any>>>('/leads', {
        params: { page: 0, size: 100 },
      });
      const leads = leadsRes.data?.data?.content || [];

      // Fetch calls for all leads concurrently
      const callPromises = leads.map(async (l: any) => {
        try {
          const cRes = await apiClient.get<ApiResponse<Call[]>>(`/leads/${l.id}/calls`);
          const calls = cRes.data?.data || [];
          return calls.map((c: any) => ({
            ...c,
            leadId: c.leadId || l.id,
            leadName: c.leadName || l.name,
            leadPhone: c.leadPhone || l.phone,
            projectName: c.projectName || l.project?.name,
          }));
        } catch {
          return [] as Call[];
        }
      });

      const callBatches = await Promise.all(callPromises);
      let aggregatedCalls: Call[] = callBatches.flat();

      // Deduplicate by call id
      const seen = new Set<number>();
      aggregatedCalls = aggregatedCalls.filter((c) => {
        if (!c.id || seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });

      // Filter by userId if requested
      if (params?.userId) {
        aggregatedCalls = aggregatedCalls.filter((c) => c.userId === params.userId);
      }

      // Filter by status if requested
      if (params?.status) {
        const targetStatus = params.status.toUpperCase();
        aggregatedCalls = aggregatedCalls.filter(
          (c) => (c.callStatus || '').toUpperCase() === targetStatus
        );
      }

      // Filter by outcome if requested
      if (params?.outcome) {
        const targetOutcome = params.outcome.toUpperCase();
        aggregatedCalls = aggregatedCalls.filter(
          (c) => (c.businessOutcome || '').toUpperCase() === targetOutcome
        );
      }

      // Filter by date range if requested
      if (params?.startDate) {
        const startTs = new Date(params.startDate).getTime();
        aggregatedCalls = aggregatedCalls.filter((c) => {
          const t = new Date(c.startTime || c.startedAt || c.createdAt || 0).getTime();
          return t >= startTs;
        });
      }
      if (params?.endDate) {
        const endTs = new Date(params.endDate).getTime();
        aggregatedCalls = aggregatedCalls.filter((c) => {
          const t = new Date(c.startTime || c.startedAt || c.createdAt || 0).getTime();
          return t <= endTs;
        });
      }

      // Sort newest first
      aggregatedCalls.sort((a, b) => {
        const tA = new Date(a.startTime || a.startedAt || a.createdAt || 0).getTime();
        const tB = new Date(b.startTime || b.startedAt || b.createdAt || 0).getTime();
        return tB - tA;
      });

      const page = params?.page ?? 0;
      const size = params?.size ?? 150;
      const paginatedContent = aggregatedCalls.slice(page * size, (page + 1) * size);

      return {
        content: paginatedContent,
        page,
        size,
        totalElements: aggregatedCalls.length,
        totalPages: Math.max(1, Math.ceil(aggregatedCalls.length / size)),
        last: (page + 1) * size >= aggregatedCalls.length,
      };
    } catch (fallbackErr: any) {
      console.error('[callApi] Fallback call aggregation failed:', fallbackErr);
      return {
        content: [],
        page: 0,
        size: 0,
        totalElements: 0,
        totalPages: 0,
        last: true,
      };
    }
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
