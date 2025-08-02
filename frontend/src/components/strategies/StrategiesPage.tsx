import React, { useState } from 'react';
import { StrategyList } from './StrategyList';
import { StrategyEditor } from './StrategyEditor';
import { StrategyBuilder } from './StrategyBuilder';

export type ViewMode = 'list' | 'editor' | 'builder';

export const StrategiesPage: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>('list');
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);

  const handleCreateStrategy = () => {
    setSelectedStrategyId(null);
    setCurrentView('builder');
  };

  const handleEditStrategy = (strategyId: string) => {
    setSelectedStrategyId(strategyId);
    setCurrentView('editor');
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedStrategyId(null);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'editor':
        return (
          <StrategyEditor
            strategyId={selectedStrategyId}
            onBack={handleBackToList}
          />
        );
      case 'builder':
        return (
          <StrategyBuilder
            onBack={handleBackToList}
          />
        );
      default:
        return (
          <StrategyList
            onCreateStrategy={handleCreateStrategy}
            onEditStrategy={handleEditStrategy}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Gerenciamento de Estratégias
            </h1>
            <p className="text-gray-600 mt-1">
              Configure e monitore suas estratégias de trading automatizado
            </p>
          </div>
          
          {currentView === 'list' && (
            <button
              onClick={handleCreateStrategy}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
            >
              + Nova Estratégia
            </button>
          )}
        </div>
      </div>

      {/* Current View */}
      {renderCurrentView()}
    </div>
  );
};