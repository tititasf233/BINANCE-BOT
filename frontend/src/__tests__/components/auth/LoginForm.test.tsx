import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import LoginForm from '../../../components/auth/LoginForm';
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

const renderWithProviders = (component: React.ReactElement, initialState = {}) => {
  const store = createMockStore(initialState);
  return render(
    <Provider store={store}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </Provider>
  );
};

describe('LoginForm', () => {
  it('renders login form correctly', () => {
    renderWithProviders(<LoginForm />);
    
    expect(screen.getByText('Login - Sistema AURA')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByText('Não tem uma conta? Registre-se')).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    renderWithProviders(<LoginForm />);
    
    const submitButton = screen.getByRole('button', { name: 'Entrar' });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Email é obrigatório')).toBeInTheDocument();
      expect(screen.getByText('Senha é obrigatória')).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid email', async () => {
    renderWithProviders(<LoginForm />);
    
    const emailInput = screen.getByLabelText('Email');
    const submitButton = screen.getByRole('button', { name: 'Entrar' });
    
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Email inválido')).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    renderWithProviders(<LoginForm />);
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Senha');
    const submitButton = screen.getByRole('button', { name: 'Entrar' });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);
    
    // Form should be submitted without validation errors
    await waitFor(() => {
      expect(screen.queryByText('Email é obrigatório')).not.toBeInTheDocument();
      expect(screen.queryByText('Senha é obrigatória')).not.toBeInTheDocument();
    });
  });

  it('shows loading state during authentication', () => {
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
    
    renderWithProviders(<LoginForm />, initialState);
    
    expect(screen.getByText('Entrando...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrando...' })).toBeDisabled();
  });

  it('shows error message when authentication fails', () => {
    const initialState = {
      auth: {
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Credenciais inválidas',
      },
    };
    
    renderWithProviders(<LoginForm />, initialState);
    
    expect(screen.getByText('Credenciais inválidas')).toBeInTheDocument();
  });
});