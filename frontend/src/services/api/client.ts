import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { store } from '../../store';
import { setToken, clearAuth } from '../../store/slices/authSlice';
import { addNotification } from '../../store/slices/uiSlice';

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const state = store.getState();
    const token = state.auth.token;

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh and errors
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const state = store.getState();
      const refreshToken = state.auth.refreshToken;

      if (refreshToken) {
        try {
          // Try to refresh the token
          const response = await axios.post(
            `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/refresh`,
            { refreshToken }
          );

          const newToken = response.data.data.token;
          store.dispatch(setToken(newToken));

          // Retry the original request with new token
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        } catch (refreshError) {
          // Refresh failed, clear auth and redirect to login
          store.dispatch(clearAuth());
          store.dispatch(
            addNotification({
              type: 'error',
              title: 'Session Expired',
              message: 'Please log in again.',
            })
          );
          
          // Redirect to login page
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token, clear auth and redirect to login
        store.dispatch(clearAuth());
        window.location.href = '/login';
      }
    }

    // Handle other HTTP errors
    if (error.response) {
      const { status, data } = error.response;
      
      // Don't show notifications for certain status codes
      const silentErrors = [401, 403];
      
      if (!silentErrors.includes(status)) {
        let message = 'An error occurred';
        
        if (data?.message) {
          message = data.message;
        } else if (data?.error) {
          message = data.error;
        } else {
          switch (status) {
            case 400:
              message = 'Bad request';
              break;
            case 404:
              message = 'Resource not found';
              break;
            case 500:
              message = 'Internal server error';
              break;
            case 503:
              message = 'Service unavailable';
              break;
            default:
              message = `HTTP Error ${status}`;
          }
        }

        store.dispatch(
          addNotification({
            type: 'error',
            title: 'Request Failed',
            message,
          })
        );
      }
    } else if (error.request) {
      // Network error
      store.dispatch(
        addNotification({
          type: 'error',
          title: 'Network Error',
          message: 'Unable to connect to the server. Please check your internet connection.',
        })
      );
    }

    return Promise.reject(error);
  }
);

// Helper function to handle API errors consistently
export const handleApiError = (error: any): string => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  
  if (error.message) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
};

// Helper function to create request config with custom timeout
export const createRequestConfig = (timeout?: number): AxiosRequestConfig => ({
  timeout: timeout || 30000,
});

export default apiClient;