import { apiClient } from './client';
import { ApiResponse, Lead, LeadDetailResponse, PageResponse, Project } from '../types';

export const leadApi = {
  getActiveProjects: async (): Promise<Project[]> => {
    const res = await apiClient.get<ApiResponse<Project[]>>('/projects/active');
    return res.data.data;
  },

  getMyProjects: async (): Promise<Project[]> => {
    const res = await apiClient.get<ApiResponse<Project[]>>('/projects/my-projects');
    return res.data.data;
  },

  getLeads: async (params?: {
    projectId?: number;
    status?: string;
    outcome?: string;
    search?: string;
    assignedToMe?: boolean;
    assignedUserId?: number;
    page?: number;
    size?: number;
  }): Promise<PageResponse<Lead>> => {
    const res = await apiClient.get<ApiResponse<PageResponse<Lead>>>('/leads', {
      params: {
        page: params?.page ?? 0,
        size: params?.size ?? 50,
        projectId: params?.projectId,
        status: params?.status,
        outcome: params?.outcome,
        search: params?.search,
        assignedToMe: params?.assignedToMe,
        assignedUserId: params?.assignedUserId,
      },
    });
    return res.data.data;
  },

  getLeadDetails: async (id: number): Promise<LeadDetailResponse> => {
    const res = await apiClient.get<ApiResponse<LeadDetailResponse>>(`/leads/${id}`);
    return res.data.data;
  },

  createLead: async (data: {
    projectId: number;
    name: string;
    phone: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    source?: string;
    status?: string;
    businessOutcome?: string;
    assignedUserId?: number;
    additionalInfo?: string;
  }): Promise<Lead> => {
    const res = await apiClient.post<ApiResponse<Lead>>('/leads', data);
    return res.data.data;
  },

  updateLeadStatus: async (id: number, status: string, notes?: string): Promise<Lead> => {
    const res = await apiClient.patch<ApiResponse<Lead>>(`/leads/${id}/status`, {
      status,
      notes,
    });
    return res.data.data;
  },

  updateLeadOutcome: async (id: number, outcome: string, notes?: string): Promise<Lead> => {
    const res = await apiClient.patch<ApiResponse<Lead>>(`/leads/${id}/outcome`, {
      businessOutcome: outcome,
      notes,
    });
    return res.data.data;
  },

  updateLead: async (
    id: number,
    data: {
      name: string;
      phone: string;
      email?: string;
      address?: string;
      city?: string;
      state?: string;
      source?: string;
      additionalInfo?: string;
    }
  ): Promise<Lead> => {
    const res = await apiClient.put<ApiResponse<Lead>>(`/leads/${id}`, data);
    return res.data.data;
  },

  deleteLead: async (id: number): Promise<void> => {
    await apiClient.delete(`/leads/${id}`);
  },

  assignLead: async (leadId: number, userId: number): Promise<void> => {
    await apiClient.post(`/leads/${leadId}/assign`, { userId });
  },

  bulkAssignLeads: async (leadIds: number[], userId: number): Promise<void> => {
    await apiClient.post('/leads/assign-bulk', { leadIds, userId });
  },

  reassignLead: async (leadId: number, userId: number, reason?: string): Promise<void> => {
    await apiClient.post(`/leads/${leadId}/reassign`, { userId, reason });
  },
};
