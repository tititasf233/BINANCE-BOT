import React, { useState } from 'react';
import { BacktestConfiguration } from './BacktestConfiguration';
import { BacktestResults } from './BacktestResults';
import { BacktestHistory } from './BacktestHistory';
import { StrategyComparison } from './StrategyComparison';

export type BacktestView = 'configure' | 'results' | 'history' | 'comparison';

export interface BacktestConfig {
  strategyId: string;
  symbol: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  parameters: Record<string, any>;
}

export interface BacktestResult {
  id: string;
  strategyName: string;
  symbol: string;
  period: string;
  totalReturn: number;
  totalReturnPercent: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  trades: any[];
  equityCurve: any[];
  createdAt: string;
}

export const BacktestPage: React.FC = () => {
  const [currentView, setCurrentView] = useState<BacktestView>('configure');
  const [currentResult, setCurrentResult] = useState<BacktestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRunBacktest = async (config: BacktestConfig) => {
    setIsRunning(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Mock result
      const result: BacktestResult = {
        id: Date.now().toString(),
        strategyName: 'RSI Strategy',
        symbol: config.symbol,
        period: `${config.startDate} - ${config.endDate}`,
        totalReturn: 2450.75,
        totalReturnPercent: 24.51,
        totalTrades: 156,
        winRate: 68.5,
        profitFactor: 1.85,
        maxDrawdown: -8.2,
        sharpeRatio: 1.42,
        sortinoRatio: 1.89,
        calmarRatio: 2.99,
        trades: [],
        equityCurve: [],
        createdAt: new Date().toISOString(),
      };
      
      setCurrentResult(result);
      setCurrentView('results');
    } catch (error) {
      console.error('Backtest failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const handleViewResults = (result: BacktestResult) => {
    setCurrentResult(result);
    setCurrentView('results');
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'results':
        return (
          <BacktestResults
            result={currentResult}
            onBack={() => setCurrentView('configure')}
            onNewBacktest={() => setCurrentView('configure')}
          />
        );
      case 'history':
        return (
          <BacktestHistory
            onViewResult={handleViewResults}
            onNewBacktest={() => setCurrentView('configure')}
          />
        );
      case 'comparison':
        return (
          <StrategyComparison
            onBack={() => setCurrentView('configure')}
          />
        );
      default:
        return (
          <BacktestConfiguration
            onRunBacktest={handleRunBacktest}
            isRunning={isRunning}
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
              Sistema de Backtesting
            </h1>
            <p className="text-gray-600 mt-1">
              Teste suas estratégias com dados históricos
            </p>
          </div>
          
          {/* Navigation Tabs */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {[
              { id: 'configure', label: 'Configurar', icon: '⚙️' },
              { id: 'history', label: 'Histórico', icon: '📊' },
              { id: 'comparison', label: 'Comparar', icon: '📈' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentView(tab.id as BacktestView)}
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