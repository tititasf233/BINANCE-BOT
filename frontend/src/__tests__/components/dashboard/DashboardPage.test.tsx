import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { DashboardPage } from '../../../components/dashboard/DashboardPage';
import authSlice from '../../../store/slices/authSlice';
import uiSlice from '../../../store/slices/uiSlice';

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authSlice,
      ui: uiSlice,
    },
    preloadedState: {
      auth: {
        user: { id: '1', email: 'test@example.com', name: 'Test User', createdAt: '', updatedAt: '' },
        token: 'valid-token',
        refreshToken: 'valid-refresh-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
      },
      ui: {
        theme: 'light',
        sidebarOpen: true,
        notifications: [],
      },
      ...initialState,
    },
  });
};

const renderWithProviders = (component: React.ReactElement, initialState = {}) => {
  const store = createMockStore(initialState);
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe('DashboardPage', () => {
  it('renders dashboard correctly', () => {
    renderWithProviders(<DashboardPage />);
    
    expect(screen.getByText('Dashboard - Sistema AURA')).toBeInTheDocument();
    expect(screen.getByText('Bem-vindo de volta, test@example.com')).toBeInTheDocument();
  });

  it('displays system status section', () => {
    renderWithProviders(<DashboardPage />);
    
    expect(screen.getByText('Status do Sistema')).toBeInTheDocument();
  });

  it('displays portfolio overview section', () => {
    renderWithProviders(<DashboardPage />);
    
    expect(screen.getByText('Visão Geral do Portfolio')).toBeInTheDocument();
  });

  it('displays performance chart section', () => {
    renderWithProviders(<DashboardPage />);
    
    expect(screen.getByText('Performance do Portfolio')).toBeInTheDocument();
  });

  it('displays quick metrics', () => {
    renderWithProviders(<DashboardPage />);
    
    expect(screen.getByText('Métricas Rápidas')).toBeInTheDocument();
    expect(screen.getByText('Retorno Mensal')).toBeInTheDocument();
    expect(screen.getByText('Win Rate')).toBeInTheDocument();
    expect(screen.getByText('Sharpe Ratio')).toBeInTheDocument();
    expect(screen.getByText('Max Drawdown')).toBeInTheDocument();
  });

  it('displays active positions section', () => {
    renderWithProviders(<DashboardPage />);
    
    expect(screen.getByText('Posições Ativas')).toBeInTheDocument();
  });

  it('displays logs feed section', () => {
    renderWithProviders(<DashboardPage />);
    
    expect(screen.getByText('Logs do Sistema')).toBeInTheDocument();
  });
});