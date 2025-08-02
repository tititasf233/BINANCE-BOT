import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryPage } from '../../../components/history/HistoryPage';

describe('HistoryPage', () => {
  it('renders history page correctly', () => {
    render(<HistoryPage />);
    
    expect(screen.getByText('Histórico e Relatórios')).toBeInTheDocument();
    expect(screen.getByText('Analise o desempenho histórico e gere relatórios detalhados')).toBeInTheDocument();
  });

  it('shows navigation tabs', () => {
    render(<HistoryPage />);
    
    expect(screen.getByText('Histórico')).toBeInTheDocument();
    expect(screen.getByText('Relatórios')).toBeInTheDocument();
    expect(screen.getByText('Exportar')).toBeInTheDocument();
  });

  it('shows trade history view by default', () => {
    render(<HistoryPage />);
    
    expect(screen.getByText('Total de Trades')).toBeInTheDocument();
  });

  it('switches to reports view when reports tab is clicked', () => {
    render(<HistoryPage />);
    
    const reportsTab = screen.getByText('Relatórios');
    fireEvent.click(reportsTab);
    
    expect(screen.getByText('Relatórios de Performance')).toBeInTheDocument();
  });

  it('switches to export view when export tab is clicked', () => {
    render(<HistoryPage />);
    
    const exportTab = screen.getByText('Exportar');
    fireEvent.click(exportTab);
    
    expect(screen.getByText('Configuração de Exportação')).toBeInTheDocument();
  });
});