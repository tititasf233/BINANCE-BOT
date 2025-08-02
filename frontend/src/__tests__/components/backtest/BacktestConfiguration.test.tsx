import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BacktestConfiguration } from '../../../components/backtest/BacktestConfiguration';

const mockOnRunBacktest = jest.fn();

describe('BacktestConfiguration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders configuration form correctly', () => {
    render(
      <BacktestConfiguration
        onRunBacktest={mockOnRunBacktest}
        isRunning={false}
      />
    );
    
    expect(screen.getByText('Configuração do Backtest')).toBeInTheDocument();
    expect(screen.getByLabelText('Estratégia')).toBeInTheDocument();
    expect(screen.getByLabelText('Símbolo')).toBeInTheDocument();
    expect(screen.getByLabelText('Data Inicial')).toBeInTheDocument();
    expect(screen.getByLabelText('Data Final')).toBeInTheDocument();
    expect(screen.getByLabelText('Capital Inicial (USD)')).toBeInTheDocument();
  });

  it('shows strategy parameters when strategy is selected', () => {
    render(
      <BacktestConfiguration
        onRunBacktest={mockOnRunBacktest}
        isRunning={false}
      />
    );
    
    const strategySelect = screen.getByLabelText('Estratégia');
    fireEvent.change(strategySelect, { target: { value: '1' } });
    
    expect(screen.getByText('Parâmetros da Estratégia')).toBeInTheDocument();
  });

  it('shows validation error for invalid date range', () => {
    render(
      <BacktestConfiguration
        onRunBacktest={mockOnRunBacktest}
        isRunning={false}
      />
    );
    
    const startDateInput = screen.getByLabelText('Data Inicial');
    const endDateInput = screen.getByLabelText('Data Final');
    
    fireEvent.change(startDateInput, { target: { value: '2023-12-31' } });
    fireEvent.change(endDateInput, { target: { value: '2023-01-01' } });
    
    expect(screen.getByText(/Período inválido/)).toBeInTheDocument();
  });

  it('shows backtest info for valid configuration', () => {
    render(
      <BacktestConfiguration
        onRunBacktest={mockOnRunBacktest}
        isRunning={false}
      />
    );
    
    const strategySelect = screen.getByLabelText('Estratégia');
    const startDateInput = screen.getByLabelText('Data Inicial');
    const endDateInput = screen.getByLabelText('Data Final');
    
    fireEvent.change(strategySelect, { target: { value: '1' } });
    fireEvent.change(startDateInput, { target: { value: '2023-01-01' } });
    fireEvent.change(endDateInput, { target: { value: '2023-12-31' } });
    
    expect(screen.getByText('Informações do Backtest')).toBeInTheDocument();
  });

  it('calls onRunBacktest when form is submitted with valid data', async () => {
    render(
      <BacktestConfiguration
        onRunBacktest={mockOnRunBacktest}
        isRunning={false}
      />
    );
    
    const strategySelect = screen.getByLabelText('Estratégia');
    const submitButton = screen.getByText('🚀 Executar Backtest');
    
    fireEvent.change(strategySelect, { target: { value: '1' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnRunBacktest).toHaveBeenCalled();
    });
  });

  it('shows loading state when backtest is running', () => {
    render(
      <BacktestConfiguration
        onRunBacktest={mockOnRunBacktest}
        isRunning={true}
      />
    );
    
    expect(screen.getByText('Executando Backtest...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });
});