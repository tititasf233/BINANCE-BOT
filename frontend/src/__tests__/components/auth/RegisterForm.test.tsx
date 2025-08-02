import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import RegisterForm from '../../../components/auth/RegisterForm';
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

describe('RegisterForm', () => {
  it('renders register form correctly', () => {
    renderWithProviders(<RegisterForm />);
    
    expect(screen.getByText('Registro - Sistema AURA')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmar Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar' })).toBeInTheDocument();
    expect(screen.getByText('Já tem uma conta? Faça login')).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    renderWithProviders(<RegisterForm />);
    
    const submitButton = screen.getByRole('button', { name: 'Registrar' });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Email é obrigatório')).toBeInTheDocument();
      expect(screen.getByText('Senha é obrigatória')).toBeInTheDocument();
      expect(screen.getByText('Confirmação de senha é obrigatória')).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid email', async () => {
    renderWithProviders(<RegisterForm />);
    
    const emailInput = screen.getByLabelText('Email');
    const submitButton = screen.getByRole('button', { name: 'Registrar' });
    
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Email inválido')).toBeInTheDocument();
    });
  });

  it('shows validation error for short password', async () => {
    renderWithProviders(<RegisterForm />);
    
    const passwordInput = screen.getByLabelText('Senha');
    const submitButton = screen.getByRole('button', { name: 'Registrar' });
    
    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Senha deve ter pelo menos 6 caracteres')).toBeInTheDocument();
    });
  });

  it('shows validation error when passwords do not match', async () => {
    renderWithProviders(<RegisterForm />);
    
    const passwordInput = screen.getByLabelText('Senha');
    const confirmPasswordInput = screen.getByLabelText('Confirmar Senha');
    const submitButton = screen.getByRole('button', { name: 'Registrar' });
    
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'different123' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Senhas não coincidem')).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    renderWithProviders(<RegisterForm />);
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Senha');
    const confirmPasswordInput = screen.getByLabelText('Confirmar Senha');
    const submitButton = screen.getByRole('button', { name: 'Registrar' });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);
    
    // Form should be submitted without validation errors
    await waitFor(() => {
      expect(screen.queryByText('Email é obrigatório')).not.toBeInTheDocument();
      expect(screen.queryByText('Senha é obrigatória')).not.toBeInTheDocument();
      expect(screen.queryByText('Senhas não coincidem')).not.toBeInTheDocument();
    });
  });

  it('shows loading state during registration', () => {
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
    
    renderWithProviders(<RegisterForm />, initialState);
    
    expect(screen.getByText('Registrando...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrando...' })).toBeDisabled();
  });

  it('shows error message when registration fails', () => {
    const initialState = {
      auth: {
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Email já está em uso',
      },
    };
    
    renderWithProviders(<RegisterForm />, initialState);
    
    expect(screen.getByText('Email já está em uso')).toBeInTheDocument();
  });
});