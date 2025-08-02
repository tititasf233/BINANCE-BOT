import { AxiosResponse, AxiosError } from 'axios';
import { apiClient } from './client';
import { store } from '../../store';
import { logout, setTokens } from '../../store/slices/authSlice';

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const state = store.getState();
    const token = state.auth.token;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const state = store.getState();
      const refreshToken = state.auth.refreshToken;
      
      if (refreshToken) {
        try {
          const response = await apiClient.post('/auth/refresh', {
            refreshToken
          });
          
          const { token, refreshToken: newRefreshToken } = response.data;
          
          store.dispatch(setTokens({
            accessToken: token,
            refreshToken: newRefreshToken
          }));
          
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        } catch (refreshError) {
          // Refresh failed, logout user
          store.dispatch(logout());
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token, logout user
        store.dispatch(logout());
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);