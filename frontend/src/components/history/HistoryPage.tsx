import React, { useState } from 'react';
import { TradeHistory } from './TradeHistory';
import { PerformanceReports } from './PerformanceReports';
import { DataExporter } from './DataExporter';

export type HistoryView = 'trades' | 'reports' | 'export';

export const HistoryPage: React.FC = () => {
  const [currentView, setCurrentView] = useState<HistoryView>('trades');

  const renderCurrentView = () => {
    switch (currentView) {
      case 'reports':
        return <PerformanceReports />;
      case 'export':
        return <DataExporter />;
      default:
        return <TradeHistory />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Histórico e Relatórios
            </h1>
            <p className="text-gray-600 mt-1">
              Analise o desempenho histórico e gere relatórios detalhados
            </p>
          </div>
          
          {/* Navigation Tabs */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {[
              { id: 'trades', label: 'Histórico', icon: '📊' },
              { id: 'reports', label: 'Relatórios', icon: '📈' },
              { id: 'export', label: 'Exportar', icon: '📤' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentView(tab.id as HistoryView)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  currentView === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Current View */}
      {renderCurrentView()}
    </div>
  );
};