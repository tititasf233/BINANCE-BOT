import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '../../services/api/authApi';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// Async thunks
export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await authApi.login(credentials);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async (userData: { name: string; email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await authApi.register(userData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Registration failed');
    }
  }
);

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      const refreshToken = state.auth.refreshToken;
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await authApi.refreshToken(refreshToken);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Token refresh failed');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { getState }) => {
    try {
      const state = getState() as { auth: AuthState };
      const token = state.auth.token;
      
      if (token) {
        await authApi.logout();
      }
    } catch (error) {
      // Ignore logout errors, we'll clear local state anyway
      console.warn('Logout request failed:', error);
    }
  }
);

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.getCurrentUser();
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get user data');
    }
  }
);

export const checkAuthStatus = createAsyncThunk(
  'auth/checkAuthStatus',
  async (_, { dispatch }) => {
    try {
      const token = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (token && refreshToken) {
        // Set tokens in state
        dispatch(setTokens({ accessToken: token, refreshToken }));
        
        // Try to get current user
        const response = await authApi.getCurrentUser();
        return response.data;
      }
      
      throw new Error('No tokens found');
    } catch (error) {
      // Clear any invalid tokens
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      throw error;
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearAuth: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.error = null;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    },
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
      localStorage.setItem('accessToken', action.payload);
    },
    setTokens: (state, action: PayloadAction<{ accessToken: string; refreshToken: string }>) => {
      state.token = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      localStorage.setItem('accessToken', action.payload.accessToken);
      localStorage.setItem('refreshToken', action.payload.refreshToken);
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.error = null;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    },
  },
  extraReducers: (builder) => {
    // Login
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
        state.error = null;
        localStorage.setItem('accessToken', action.payload.token);
        localStorage.setItem('refreshToken', action.payload.refreshToken);
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      });

    // Register
    builder
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
        state.error = null;
        localStorage.setItem('accessToken', action.payload.token);
        localStorage.setItem('refreshToken', action.payload.refreshToken);
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      });

    // Refresh Token
    builder
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        localStorage.setItem('accessToken', action.payload.token);
        localStorage.setItem('refreshToken', action.payload.refreshToken);
      })
      .addCase(refreshToken.rejected, (state) => {
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
      });

    // Logout
    builder.addCase(logoutUser.fulfilled, (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.error = null;
    });

    // Get Current User
    builder
      .addCase(getCurrentUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
      })
      .addCase(getCurrentUser.rejected, (state) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
      });

    // Check Auth Status
    builder
      .addCase(checkAuthStatus.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(checkAuthStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
      })
      .addCase(checkAuthStatus.rejected, (state) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
      });
  },
});

export const { clearError, clearAuth, setToken, setTokens, logout } = authSlice.actions;
export default authSlice.reducer;