import React from 'react';
import { render, screen } from '@testing-library/react';
import { ActivePositions } from '../../../components/dashboard/ActivePositions';

describe('ActivePositions', () => {
  it('renders active positions table correctly', () => {
    render(<ActivePositions />);
    
    expect(screen.getByText('Posições Ativas')).toBeInTheDocument();
    expect(screen.getByText('3 posições')).toBeInTheDocument();
  });

  it('displays table headers', () => {
    render(<ActivePositions />);
    
    expect(screen.getByText('Símbolo')).toBeInTheDocument();
    expect(screen.getByText('Lado')).toBeInTheDocument();
    expect(screen.getByText('Quantidade')).toBeInTheDocument();
    expect(screen.getByText('Preço Entrada')).toBeInTheDocument();
    expect(screen.getByText('Preço Atual')).toBeInTheDocument();
    expect(screen.getByText('P&L')).toBeInTheDocument();
    expect(screen.getByText('Estratégia')).toBeInTheDocument();
  });

  it('displays position data', () => {
    render(<ActivePositions />);
    
    expect(screen.getByText('BTCUSDT')).toBeInTheDocument();
    expect(screen.getByText('ETHUSDT')).toBeInTheDocument();
    expect(screen.getByText('ADAUSDT')).toBeInTheDocument();
  });

  it('displays buy and sell badges with correct colors', () => {
    render(<ActivePositions />);
    
    const buyBadges = screen.getAllByText('BUY');
    const sellBadge = screen.getByText('SELL');
    
    buyBadges.forEach(badge => {
      expect(badge).toHaveClass('bg-green-100', 'text-green-800');
    });
    
    expect(sellBadge).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('displays formatted currency values', () => {
    render(<ActivePositions />);
    
    expect(screen.getByText('$42,000.00')).toBeInTheDocument();
    expect(screen.getByText('$43,500.00')).toBeInTheDocument();
    expect(screen.getByText('$750.00')).toBeInTheDocument();
  });

  it('displays percentage values with correct signs', () => {
    render(<ActivePositions />);
    
    expect(screen.getByText('+3.57%')).toBeInTheDocument();
    expect(screen.getByText('+3.20%')).toBeInTheDocument();
    expect(screen.getByText('+6.67%')).toBeInTheDocument();
  });

  it('displays strategy names', () => {
    render(<ActivePositions />);
    
    expect(screen.getByText('RSI Strategy')).toBeInTheDocument();
    expect(screen.getByText('MACD Strategy')).toBeInTheDocument();
    expect(screen.getByText('Bollinger Bands')).toBeInTheDocument();
  });

  it('applies correct color classes for positive P&L', () => {
    render(<ActivePositions />);
    
    const pnlElements = screen.getAllByText(/\$\d+\.00/);
    const positivePnlElements = pnlElements.filter(el => 
      el.textContent?.includes('$750.00') || 
      el.textContent?.includes('$160.00') || 
      el.textContent?.includes('$30.00')
    );
    
    positivePnlElements.forEach(element => {
      expect(element).toHaveClass('text-green-600');
    });
  });
});