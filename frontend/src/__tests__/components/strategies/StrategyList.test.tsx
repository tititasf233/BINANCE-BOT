import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StrategyList } from '../../../components/strategies/StrategyList';

const mockOnCreateStrategy = jest.fn();
const mockOnEditStrategy = jest.fn();

describe('StrategyList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders strategy list correctly', () => {
    render(
      <StrategyList
        onCreateStrategy={mockOnCreateStrategy}
        onEditStrategy={mockOnEditStrategy}
      />
    );
    
    expect(screen.getByText('Suas Estratégias')).toBeInTheDocument();
  });

  it('displays summary cards', () => {
    render(
      <StrategyList
        onCreateStrategy={mockOnCreateStrategy}
        onEditStrategy={mockOnEditStrategy}
      />
    );
    
    expect(screen.getByText('Total de Estratégias')).toBeInTheDocument();
    expect(screen.getByText('Estratégias Ativas')).toBeInTheDocument();
    expect(screen.getByText('P&L Total')).toBeInTheDocument();
    expect(screen.getByText('Total de Trades')).toBeInTheDocument();
  });

  it('displays strategy data in table', () => {
    render(
      <StrategyList
        onCreateStrategy={mockOnCreateStrategy}
        onEditStrategy={mockOnEditStrategy}
      />
    );
    
    expect(screen.getByText('RSI Oversold/Overbought')).toBeInTheDocument();
    expect(screen.getByText('MACD Crossover')).toBeInTheDocument();
    expect(screen.getByText('Bollinger Bands Mean Reversion')).toBeInTheDocument();
  });

  it('displays strategy status with correct colors', () => {
    render(
      <StrategyList
        onCreateStrategy={mockOnCreateStrategy}
        onEditStrategy={mockOnEditStrategy}
      />
    );
    
    const activeStatuses = screen.getAllByText('ACTIVE');
    const pausedStatus = screen.getByText('PAUSED');
    const inactiveStatus = screen.getByText('INACTIVE');
    
    activeStatuses.forEach(status => {
      expect(status).toHaveClass('bg-green-100', 'text-green-800');
    });
    
    expect(pausedStatus).toHaveClass('bg-yellow-100', 'text-yellow-800');
    expect(inactiveStatus).toHaveClass('bg-gray-100', 'text-gray-800');
  });

  it('calls onEditStrategy when edit button is clicked', () => {
    render(
      <StrategyList
        onCreateStrategy={mockOnCreateStrategy}
        onEditStrategy={mockOnEditStrategy}
      />
    );
    
    const editButtons = screen.getAllByText('Editar');
    fireEvent.click(editButtons[0]);
    
    expect(mockOnEditStrategy).toHaveBeenCalledWith('1');
  });

  it('displays formatted currency values', () => {
    render(
      <StrategyList
        onCreateStrategy={mockOnCreateStrategy}
        onEditStrategy={mockOnEditStrategy}
      />
    );
    
    expect(screen.getByText('$1,250.50')).toBeInTheDocument();
    expect(screen.getByText('$890.25')).toBeInTheDocument();
    expect(screen.getByText('-$125.75')).toBeInTheDocument();
  });

  it('displays win rates correctly', () => {
    render(
      <StrategyList
        onCreateStrategy={mockOnCreateStrategy}
        onEditStrategy={mockOnEditStrategy}
      />
    );
    
    expect(screen.getByText('73.3%')).toBeInTheDocument();
    expect(screen.getByText('68.8%')).toBeInTheDocument();
    expect(screen.getByText('44.4%')).toBeInTheDocument();
  });
});