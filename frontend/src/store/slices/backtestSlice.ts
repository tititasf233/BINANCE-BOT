import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface BacktestConfig {
  strategyId: number;
  symbol: string;
  startDate: string;
  endDate: string;
  initialBalance: number;
  params?: Record<string, any>;
}

export interface BacktestResult {
  id: string;
  config: BacktestConfig;
  results: {
    totalReturn: number;
    totalReturnPercent: number;
    maxDrawdown: number;
    sharpeRatio: number;
    totalTrades: number;
    winRate: number;
    profitFactor: number;
  };
  trades: Array<{
    timestamp: number;
    type: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    pnl?: number;
  }>;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  completedAt?: string;
}

interface BacktestState {
  results: BacktestResult[];
  currentBacktest: BacktestResult | null;
  loading: boolean;
  error: string | null;
}

const initialState: BacktestState = {
  results: [],
  currentBacktest: null,
  loading: false,
  error: null,
};

// Async thunks
export const runBacktest = createAsyncThunk(
  'backtest/run',
  async (config: BacktestConfig, { rejectWithValue }) => {
    try {
      // TODO: Implement API call
      const result: BacktestResult = {
        id: Date.now().toString(),
        config,
        results: {
          totalReturn: 0,
          totalReturnPercent: 0,
          maxDrawdown: 0,
          sharpeRatio: 0,
          totalTrades: 0,
          winRate: 0,
          profitFactor: 0,
        },
        trades: [],
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
      return result;
    } catch (error) {
      return rejectWithValue('Failed to run backtest');
    }
  }
);

export const fetchBacktestResults = createAsyncThunk(
  'backtest/fetchResults',
  async (_, { rejectWithValue }) => {
    try {
      // TODO: Implement API call
      return [];
    } catch (error) {
      return rejectWithValue('Failed to fetch backtest results');
    }
  }
);

const backtestSlice = createSlice({
  name: 'backtest',
  initialState,
  reducers: {
    setCurrentBacktest: (state, action: PayloadAction<BacktestResult | null>) => {
      state.currentBacktest = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(runBacktest.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(runBacktest.fulfilled, (state, action) => {
        state.loading = false;
        state.results.push(action.payload);
        state.currentBacktest = action.payload;
      })
      .addCase(runBacktest.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchBacktestResults.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBacktestResults.fulfilled, (state, action) => {
        state.loading = false;
        state.results = action.payload;
      })
      .addCase(fetchBacktestResults.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setCurrentBacktest, clearError } = backtestSlice.actions;
export default backtestSlice.reducer;