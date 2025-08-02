import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { ProtectedRoute } from '../../../components/common/ProtectedRoute';
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
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
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

const TestComponent = () => <div>Protected Content</div>;
const LoginComponent = () => <div>Login Page</div>;

const renderWithProviders = (component: React.ReactElement, initialState = {}) => {
  const store = createMockStore(initialState);
  return render(
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginComponent />} />
          <Route path="/protected" element={component} />
        </Routes>
      </BrowserRouter>
    </Provider>
  );
};

describe('ProtectedRoute', () => {
  it('shows loading spinner when auth is loading', () => {
    const initialState = {
      auth: {
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: true,
        error: null,
      },
    };

    // Navigate to protected route
    window.history.pushState({}, 'Test page', '/protected');
    
    renderWithProviders(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>,
      initialState
    );
    
    expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to login when user is not authenticated', () => {
    const initialState = {
      auth: {
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      },
    };

    // Navigate to protected route
    window.history.pushState({}, 'Test page', '/protected');
    
    renderWithProviders(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>,
      initialState
    );
    
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders protected content when user is authenticated', () => {
    const initialState = {
      auth: {
        user: { id: '1', email: 'test@example.com' },
        token: 'valid-token',
        refreshToken: 'valid-refresh-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
      },
    };

    // Navigate to protected route
    window.history.pushState({}, 'Test page', '/protected');
    
    renderWithProviders(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>,
      initialState
    );
    
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });
});