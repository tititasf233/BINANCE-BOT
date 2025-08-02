import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TradeHistory } from '../../../components/history/TradeHistory';

describe('TradeHistory', () => {
  it('renders trade history correctly', () => {
    render(<TradeHistory />);
    
    expect(screen.getByText('Total de Trades')).toBeInTheDocument();
    expect(screen.getByText('P&L Total')).toBeInTheDocument();
    expect(screen.getByText('Win Rate')).toBeInTheDocument();
    expect(screen.getByText('P&L Médio')).toBeInTheDocument();
  });

  it('displays summary cards with data', () => {
    render(<TradeHistory />);
    
    // Check if summary cards show numbers
    const summaryCards = screen.getAllByText(/\d+/);
    expect(summaryCards.length).toBeGreaterThan(0);
  });

  it('shows advanced filters when filter button is clicked', () => {
    render(<TradeHistory />);
    
    const filterButton = screen.getByText('🔍 Filtros Avançados');
    fireEvent.click(filterButton);
    
    expect(screen.getByText('Filtros Avançados')).toBeInTheDocument();
  });

  it('displays trade table with headers', () => {
    render(<TradeHistory />);
    
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText(/Símbolo/)).toBeInTheDocument();
    expect(screen.getByText('Lado')).toBeInTheDocument();
    expect(screen.getByText('Estratégia')).toBeInTheDocument();
    expect(screen.getByText(/P&L/)).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('shows pagination controls', () => {
    render(<TradeHistory />);
    
    expect(screen.getByText('25 por página')).toBeInTheDocument();
    expect(screen.getByText(/Mostrando \d+-\d+ de \d+/)).toBeInTheDocument();
  });

  it('allows sorting by clicking column headers', () => {
    render(<TradeHistory />);
    
    const symbolHeader = screen.getByText(/Símbolo/);
    fireEvent.click(symbolHeader);
    
    // Should show sort indicator
    expect(screen.getByText(/Símbolo.*[↑↓]/)).toBeInTheDocument();
  });
});