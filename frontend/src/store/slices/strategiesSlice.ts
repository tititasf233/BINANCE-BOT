import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface Strategy {
  id: number;
  name: string;
  description?: string;
  symbol: string;
  interval: string;
  isActive: boolean;
  createdAt: string;
  params?: Record<string, any>;
}

interface StrategiesState {
  strategies: Strategy[];
  loading: boolean;
  error: string | null;
  selectedStrategy: Strategy | null;
}

const initialState: StrategiesState = {
  strategies: [],
  loading: false,
  error: null,
  selectedStrategy: null,
};

// Async thunks
export const fetchStrategies = createAsyncThunk(
  'strategies/fetchStrategies',
  async (_, { rejectWithValue }) => {
    try {
      // TODO: Implement API call
      return [];
    } catch (error) {
      return rejectWithValue('Failed to fetch strategies');
    }
  }
);

export const createStrategy = createAsyncThunk(
  'strategies/createStrategy',
  async (strategyData: Omit<Strategy, 'id' | 'createdAt'>, { rejectWithValue }) => {
    try {
      // TODO: Implement API call
      return { ...strategyData, id: Date.now(), createdAt: new Date().toISOString() };
    } catch (error) {
      return rejectWithValue('Failed to create strategy');
    }
  }
);

const strategiesSlice = createSlice({
  name: 'strategies',
  initialState,
  reducers: {
    setSelectedStrategy: (state, action: PayloadAction<Strategy | null>) => {
      state.selectedStrategy = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStrategies.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStrategies.fulfilled, (state, action) => {
        state.loading = false;
        state.strategies = action.payload;
      })
      .addCase(fetchStrategies.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createStrategy.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createStrategy.fulfilled, (state, action) => {
        state.loading = false;
        state.strategies.push(action.payload);
      })
      .addCase(createStrategy.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSelectedStrategy, clearError } = strategiesSlice.actions;
export default strategiesSlice.reducer;