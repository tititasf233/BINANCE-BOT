import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

export interface PortfolioOverview {
  totalBalance: number;
  availableBalance: number;
  totalPnL: number;
  totalPnLPercent: number;
  positions: Position[];
}

interface PortfolioState {
  overview: PortfolioOverview | null;
  loading: boolean;
  error: string | null;
}

const initialState: PortfolioState = {
  overview: null,
  loading: false,
  error: null,
};

// Async thunks
export const fetchPortfolioOverview = createAsyncThunk(
  'portfolio/fetchOverview',
  async (_, { rejectWithValue }) => {
    try {
      // TODO: Implement API call
      return {
        totalBalance: 0,
        availableBalance: 0,
        totalPnL: 0,
        totalPnLPercent: 0,
        positions: [],
      };
    } catch (error) {
      return rejectWithValue('Failed to fetch portfolio overview');
    }
  }
);

const portfolioSlice = createSlice({
  name: 'portfolio',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPortfolioOverview.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPortfolioOverview.fulfilled, (state, action) => {
        state.loading = false;
        state.overview = action.payload;
      })
      .addCase(fetchPortfolioOverview.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = portfolioSlice.actions;
export default portfolioSlice.reducer;