import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StrategiesPage } from '../../../components/strategies/StrategiesPage';

describe('StrategiesPage', () => {
  it('renders strategies page correctly', () => {
    render(<StrategiesPage />);
    
    expect(screen.getByText('Gerenciamento de Estratégias')).toBeInTheDocument();
    expect(screen.getByText('Configure e monitore suas estratégias de trading automatizado')).toBeInTheDocument();
  });

  it('shows create strategy button in list view', () => {
    render(<StrategiesPage />);
    
    expect(screen.getByText('+ Nova Estratégia')).toBeInTheDocument();
  });

  it('switches to builder view when create strategy is clicked', () => {
    render(<StrategiesPage />);
    
    const createButton = screen.getByText('+ Nova Estratégia');
    fireEvent.click(createButton);
    
    expect(screen.getByText('Construtor de Estratégias')).toBeInTheDocument();
    expect(screen.queryByText('+ Nova Estratégia')).not.toBeInTheDocument();
  });

  it('displays strategy list by default', () => {
    render(<StrategiesPage />);
    
    expect(screen.getByText('Suas Estratégias')).toBeInTheDocument();
  });
});