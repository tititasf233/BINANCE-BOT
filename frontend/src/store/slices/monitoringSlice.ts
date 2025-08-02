import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: {
    bytesIn: number;
    bytesOut: number;
  };
}

export interface TradingMetrics {
  activeStrategies: number;
  totalTrades: number;
  successRate: number;
  totalPnL: number;
  dailyPnL: number;
}

export interface Alert {
  id: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

interface MonitoringState {
  systemMetrics: SystemMetrics | null;
  tradingMetrics: TradingMetrics | null;
  alerts: Alert[];
  loading: boolean;
  error: string | null;
}

const initialState: MonitoringState = {
  systemMetrics: null,
  tradingMetrics: null,
  alerts: [],
  loading: false,
  error: null,
};

// Async thunks
export const fetchSystemMetrics = createAsyncThunk(
  'monitoring/fetchSystemMetrics',
  async (_, { rejectWithValue }) => {
    try {
      // TODO: Implement API call
      return {
        cpu: 0,
        memory: 0,
        disk: 0,
        network: {
          bytesIn: 0,
          bytesOut: 0,
        },
      };
    } catch (error) {
      return rejectWithValue('Failed to fetch system metrics');
    }
  }
);

export const fetchTradingMetrics = createAsyncThunk(
  'monitoring/fetchTradingMetrics',
  async (_, { rejectWithValue }) => {
    try {
      // TODO: Implement API call
      return {
        activeStrategies: 0,
        totalTrades: 0,
        successRate: 0,
        totalPnL: 0,
        dailyPnL: 0,
      };
    } catch (error) {
      return rejectWithValue('Failed to fetch trading metrics');
    }
  }
);

export const fetchAlerts = createAsyncThunk(
  'monitoring/fetchAlerts',
  async (_, { rejectWithValue }) => {
    try {
      // TODO: Implement API call
      return [];
    } catch (error) {
      return rejectWithValue('Failed to fetch alerts');
    }
  }
);

const monitoringSlice = createSlice({
  name: 'monitoring',
  initialState,
  reducers: {
    acknowledgeAlert: (state, action: PayloadAction<string>) => {
      const alert = state.alerts.find(a => a.id === action.payload);
      if (alert) {
        alert.acknowledged = true;
      }
    },
    addAlert: (state, action: PayloadAction<Omit<Alert, 'id'>>) => {
      const alert: Alert = {
        ...action.payload,
        id: Date.now().toString(),
      };
      state.alerts.unshift(alert);
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSystemMetrics.fulfilled, (state, action) => {
        state.systemMetrics = action.payload;
      })
      .addCase(fetchTradingMetrics.fulfilled, (state, action) => {
        state.tradingMetrics = action.payload;
      })
      .addCase(fetchAlerts.fulfilled, (state, action) => {
        state.alerts = action.payload;
      });
  },
});

export const { acknowledgeAlert, addAlert, clearError } = monitoringSlice.actions;
export default monitoringSlice.reducer;