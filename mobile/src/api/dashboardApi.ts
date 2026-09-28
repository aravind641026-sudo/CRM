import { apiClient } from './client';
import { ApiResponse, UserDashboardSummary, AdminDashboardSummary } from '../types';

export const dashboardApi = {
  getUserDashboard: async (): Promise<UserDashboardSummary> => {
    const res = await apiClient.get<ApiResponse<UserDashboardSummary>>('/dashboard/user');
    return res.data.data;
  },

  getAdminDashboard: async (): Promise<AdminDashboardSummary> => {
    const res = await apiClient.get<ApiResponse<any>>('/dashboard/admin');
    const data = res.data.data;
    return {
      ...data,
      activeAgents: data?.activeAgents ?? data?.activeUsers ?? 0,
    };
  },
};
