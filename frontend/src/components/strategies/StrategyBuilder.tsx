import React, { useState } from 'react';
import { ConditionBuilder } from './ConditionBuilder';
import { RiskParametersForm } from './RiskParametersForm';

interface StrategyBuilderProps {
  onBack: () => void;
}

interface StrategyConfig {
  name: string;
  description: string;
  symbol: string;
  timeframe: string;
  entryConditions: any[];
  exitConditions: any[];
  riskParameters: {
    maxPositionSize: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    maxDailyLoss: number;
    maxOpenPositions: number;
  };
}

export const StrategyBuilder: React.FC<StrategyBuilderProps> = ({ onBack }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [strategyConfig, setStrategyConfig] = useState<StrategyConfig>({
    name: '',
    description: '',
    symbol: 'BTCUSDT',
    timeframe: '1h',
    entryConditions: [],
    exitConditions: [],
    riskParameters: {
      maxPositionSize: 1000,
      stopLossPercent: 2,
      takeProfitPercent: 4,
      maxDailyLoss: 500,
      maxOpenPositions: 3,
    },
  });

  const steps = [
    { id: 1, name: 'Configuração Básica', description: 'Nome, símbolo e timeframe' },
    { id: 2, name: 'Condições de Entrada', description: 'Quando abrir posições' },
    { id: 3, name: 'Condições de Saída', description: 'Quando fechar posições' },
    { id: 4, name: 'Parâmetros de Risco', description: 'Limites e proteções' },
    { id: 5, name: 'Revisão', description: 'Confirmar configurações' },
  ];

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = () => {
    // TODO: Implement strategy saving logic
    console.log('Saving strategy:', strategyConfig);
    onBack();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome da Estratégia
              </label>
              <input
                type="text"
                value={strategyConfig.name}
                onChange={(e) => setStrategyConfig(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: RSI Oversold Strategy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição
              </label>
              <textarea
                value={strategyConfig.description}
                onChange={(e) => setStrategyConfig(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Descreva como sua estratégia funciona..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Símbolo
                </label>
                <select
                  value={strategyConfig.symbol}
                  onChange={(e) => setStrategyConfig(prev => ({ ...prev, symbol: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="BTCUSDT">BTCUSDT</option>
                  <option value="ETHUSDT">ETHUSDT</option>
                  <option value="ADAUSDT">ADAUSDT</option>
                  <option value="BNBUSDT">BNBUSDT</option>
                  <option value="SOLUSDT">SOLUSDT</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timeframe
                </label>
                <select
                  value={strategyConfig.timeframe}
                  onChange={(e) => setStrategyConfig(prev => ({ ...prev, timeframe: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="1m">1 minuto</option>
                  <option value="5m">5 minutos</option>
                  <option value="15m">15 minutos</option>
                  <option value="1h">1 hora</option>
                  <option value="4h">4 horas</option>
                  <option value="1d">1 dia</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <ConditionBuilder
            title="Condições de Entrada"
            description="Configure quando a estratégia deve abrir uma posição"
            conditions={strategyConfig.entryConditions}
            onChange={(conditions) => setStrategyConfig(prev => ({ ...prev, entryConditions: conditions }))}
          />
        );

      case 3:
        return (
          <ConditionBuilder
            title="Condições de Saída"
            description="Configure quando a estratégia deve fechar uma posição"
            conditions={strategyConfig.exitConditions}
            onChange={(conditions) => setStrategyConfig(prev => ({ ...prev, exitConditions: conditions }))}
          />
        );

      case 4:
        return (
          <RiskParametersForm
            parameters={strategyConfig.riskParameters}
            onChange={(parameters) => setStrategyConfig(prev => ({ ...prev, riskParameters: parameters }))}
          />
        );

      case 5:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Revisão da Estratégia</h3>
            
            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              <div>
                <h4 className="font-medium text-gray-900">Configuração Básica</h4>
                <p className="text-sm text-gray-600">Nome: {strategyConfig.name}</p>
                <p className="text-sm text-gray-600">Símbolo: {strategyConfig.symbol}</p>
                <p className="text-sm text-gray-600">Timeframe: {strategyConfig.timeframe}</p>
              </div>

              <div>
                <h4 className="font-medium text-gray-900">Condições</h4>
                <p className="text-sm text-gray-600">
                  Entrada: {strategyConfig.entryConditions.length} condições configuradas
                </p>
                <p className="text-sm text-gray-600">
                  Saída: {strategyConfig.exitConditions.length} condições configuradas
                </p>
              </div>

              <div>
                <h4 className="font-medium text-gray-900">Parâmetros de Risco</h4>
                <p className="text-sm text-gray-600">
                  Tamanho máximo da posição: ${strategyConfig.riskParameters.maxPositionSize}
                </p>
                <p className="text-sm text-gray-600">
                  Stop Loss: {strategyConfig.riskParameters.stopLossPercent}%
                </p>
                <p className="text-sm text-gray-600">
                  Take Profit: {strategyConfig.riskParameters.takeProfitPercent}%
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Construtor de Estratégias
            </h2>
            <p className="text-gray-600 mt-1">
              Crie sua estratégia de trading personalizada
            </p>
          </div>
          <button
            onClick={onBack}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Voltar
          </button>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                currentStep >= step.id 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {step.id}
              </div>
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900">{step.name}</div>
                <div className="text-xs text-gray-500">{step.description}</div>
              </div>
              {index < steps.length - 1 && (
                <div className={`ml-6 w-16 h-0.5 ${
                  currentStep > step.id ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="p-6">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="p-6 border-t border-gray-200 flex justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentStep === 1}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Anterior
        </button>

        <div className="flex space-x-2">
          {currentStep < steps.length ? (
            <button
              onClick={handleNext}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Próximo
            </button>
          ) : (
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
            >
              Salvar Estratégia
            </button>
          )}
        </div>
      </div>
    </div>
  );
};