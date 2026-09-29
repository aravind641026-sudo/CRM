import { apiClient } from './client';
import { ApiResponse, User, JwtAuthResponse } from '../types';

export const authApi = {
  login: async (email: string, password: string): Promise<JwtAuthResponse> => {
    const res = await apiClient.post<any>('/auth/login', {
      email: email.toLowerCase().trim(),
      password,
    });
    const payload = res.data?.data || res.data;
    return payload;
  },

  signup: async (data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
  }): Promise<{ message: string; user?: User }> => {
    const res = await apiClient.post<any>('/auth/signup', {
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      phone: data.phone?.trim() || undefined,
      password: data.password,
    });
    return {
      message: res.data?.message || 'Your signup request has been submitted successfully. Please wait for admin approval.',
      user: res.data?.data,
    };
  },

  checkSignupStatus: async (email: string): Promise<{ status: string; message: string }> => {
    const res = await apiClient.get<any>(`/auth/signup-status?email=${encodeURIComponent(email.toLowerCase().trim())}`);
    return res.data?.data || res.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const res = await apiClient.get<ApiResponse<User>>('/auth/me');
    return res.data.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<string> => {
    const res = await apiClient.post<ApiResponse<string>>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return res.data.message || 'Password changed successfully';
  },

  updateProfile: async (data: { name: string; phone?: string }): Promise<User> => {
    const res = await apiClient.put<ApiResponse<User>>('/auth/profile', data);
    return res.data.data;
  },
};
