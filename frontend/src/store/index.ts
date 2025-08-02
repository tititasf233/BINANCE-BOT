import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { combineReducers } from '@reduxjs/toolkit';

// Import reducers
import authReducer from './slices/authSlice';
import uiReducer from './slices/uiSlice';
import strategiesReducer from './slices/strategiesSlice';
import portfolioReducer from './slices/portfolioSlice';
import backtestReducer from './slices/backtestSlice';
import monitoringReducer from './slices/monitoringSlice';

// Persist configuration
const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth'], // Only persist auth state
};

const rootReducer = combineReducers({
  auth: authReducer,
  ui: uiReducer,
  strategies: strategiesReducer,
  portfolio: portfolioReducer,
  backtest: backtestReducer,
  monitoring: monitoringReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;