import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  autoClose?: boolean;
  duration?: number;
}

export interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  notifications: Notification[];
  loading: {
    global: boolean;
    [key: string]: boolean;
  };
  modals: {
    [key: string]: boolean;
  };
}

const initialState: UIState = {
  sidebarOpen: true,
  theme: 'dark',
  notifications: [],
  loading: {
    global: false,
  },
  modals: {},
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
    },
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'timestamp'>>) => {
      const notification: Notification = {
        ...action.payload,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        autoClose: action.payload.autoClose ?? true,
        duration: action.payload.duration ?? 5000,
      };
      state.notifications.push(notification);
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(
        (notification) => notification.id !== action.payload
      );
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
    setLoading: (state, action: PayloadAction<{ key: string; loading: boolean }>) => {
      state.loading[action.payload.key] = action.payload.loading;
    },
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.global = action.payload;
    },
    openModal: (state, action: PayloadAction<string>) => {
      state.modals[action.payload] = true;
    },
    closeModal: (state, action: PayloadAction<string>) => {
      state.modals[action.payload] = false;
    },
    toggleModal: (state, action: PayloadAction<string>) => {
      state.modals[action.payload] = !state.modals[action.payload];
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  setTheme,
  addNotification,
  removeNotification,
  clearNotifications,
  setLoading,
  setGlobalLoading,
  openModal,
  closeModal,
  toggleModal,
} = uiSlice.actions;

export default uiSlice.reducer;