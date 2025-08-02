import { apiClient } from './client';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
      name: string;
      createdAt: string;
      updatedAt: string;
    };
    token: string;
    refreshToken: string;
  };
}

export interface RefreshTokenResponse {
  success: boolean;
  data: {
    token: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      name: string;
      createdAt: string;
      updatedAt: string;
    };
  };
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },

  register: async (userData: RegisterData): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/register', userData);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  refreshToken: async (refreshToken: string): Promise<RefreshTokenResponse> => {
    const response = await apiClient.post('/auth/refresh', { refreshToken });
    return response.data;
  },

  getCurrentUser: async (): Promise<{ data: { user: any } }> => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  forgotPassword: async (email: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (token: string, password: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post('/auth/reset-password', { token, password });
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },
};