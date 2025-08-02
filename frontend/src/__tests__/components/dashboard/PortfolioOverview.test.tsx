import React from 'react';
import { render, screen } from '@testing-library/react';
import { PortfolioOverview } from '../../../components/dashboard/PortfolioOverview';

describe('PortfolioOverview', () => {
  it('renders portfolio overview correctly', () => {
    render(<PortfolioOverview />);
    
    expect(screen.getByText('Visão Geral do Portfolio')).toBeInTheDocument();
  });

  it('displays portfolio metrics', () => {
    render(<PortfolioOverview />);
    
    expect(screen.getByText('Valor Total')).toBeInTheDocument();
    expect(screen.getByText('P&L Total')).toBeInTheDocument();
    expect(screen.getByText('Saldo Disponível')).toBeInTheDocument();
    expect(screen.getByText('Valor Investido')).toBeInTheDocument();
  });

  it('displays formatted currency values', () => {
    render(<PortfolioOverview />);
    
    // Check if currency values are displayed (using regex to match currency format)
    expect(screen.getByText(/\$125,000\.50/)).toBeInTheDocument();
    expect(screen.getByText(/\$15,000\.25/)).toBeInTheDocument();
    expect(screen.getByText(/\$25,000\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$100,000\.25/)).toBeInTheDocument();
  });

  it('displays percentage values', () => {
    render(<PortfolioOverview />);
    
    expect(screen.getByText('+13.60%')).toBeInTheDocument();
  });

  it('displays allocation progress bar', () => {
    render(<PortfolioOverview />);
    
    expect(screen.getByText('Alocação do Portfolio')).toBeInTheDocument();
    expect(screen.getByText(/80\.0% investido/)).toBeInTheDocument();
  });

  it('applies correct color classes for positive P&L', () => {
    render(<PortfolioOverview />);
    
    const pnlElement = screen.getByText(/\$15,000\.25/);
    expect(pnlElement).toHaveClass('text-green-600');
  });
});