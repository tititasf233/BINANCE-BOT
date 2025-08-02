import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BacktestPage } from '../../../components/backtest/BacktestPage';

describe('BacktestPage', () => {
  it('renders backtest page correctly', () => {
    render(<BacktestPage />);
    
    expect(screen.getByText('Sistema de Backtesting')).toBeInTheDocument();
    expect(screen.getByText('Teste suas estratégias com dados históricos')).toBeInTheDocument();
  });

  it('shows navigation tabs', () => {
    render(<BacktestPage />);
    
    expect(screen.getByText('Configurar')).toBeInTheDocument();
    expect(screen.getByText('Histórico')).toBeInTheDocument();
    expect(screen.getByText('Comparar')).toBeInTheDocument();
  });

  it('shows configuration view by default', () => {
    render(<BacktestPage />);
    
    expect(screen.getByText('Configuração do Backtest')).toBeInTheDocument();
  });

  it('switches to history view when history tab is clicked', () => {
    render(<BacktestPage />);
    
    const historyTab = screen.getByText('Histórico');
    fireEvent.click(historyTab);
    
    expect(screen.getByText('Histórico de Backtests')).toBeInTheDocument();
  });

  it('switches to comparison view when comparison tab is clicked', () => {
    render(<BacktestPage />);
    
    const comparisonTab = screen.getByText('Comparar');
    fireEvent.click(comparisonTab);
    
    expect(screen.getByText('Comparação de Estratégias')).toBeInTheDocument();
  });
});