import { apiClient } from './client';
import { ApiResponse, User, PageResponse } from '../types';

export const usersApi = {
  getUsers: async (params?: {
    role?: string;
    status?: string;
    search?: string;
    page?: number;
    size?: number;
  }): Promise<PageResponse<User>> => {
    const res = await apiClient.get<ApiResponse<PageResponse<User>>>('/users', { params });
    return res.data.data;
  },

  getActiveUsers: async (): Promise<User[]> => {
    const res = await apiClient.get<ApiResponse<User[]>>('/users/active');
    return res.data.data;
  },

  createUser: async (data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role: string;
    shift?: string;
  }): Promise<User> => {
    const res = await apiClient.post<ApiResponse<User>>('/users', data);
    return res.data.data;
  },

  updateUser: async (
    id: number,
    data: { name: string; phone?: string; role?: string; shift?: string }
  ): Promise<User> => {
    const res = await apiClient.put<ApiResponse<User>>(`/users/${id}`, data);
    return res.data.data;
  },

  toggleStatus: async (id: number, status?: string): Promise<User> => {
    const res = await apiClient.patch<ApiResponse<User>>(
      `/users/${id}/status`,
      status ? { status } : undefined
    );
    return res.data.data;
  },

  deleteUser: async (id: number): Promise<string> => {
    const res = await apiClient.delete<ApiResponse<string>>(`/users/${id}`);
    return res.data.message || res.data.data || 'User deleted successfully.';
  },
};
