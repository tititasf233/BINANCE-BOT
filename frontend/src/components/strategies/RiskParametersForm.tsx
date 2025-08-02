import React from 'react';

interface RiskParameters {
  maxPositionSize: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  maxDailyLoss: number;
  maxOpenPositions: number;
}

interface RiskParametersFormProps {
  parameters: RiskParameters;
  onChange: (parameters: RiskParameters) => void;
}

export const RiskParametersForm: React.FC<RiskParametersFormProps> = ({
  parameters,
  onChange,
}) => {
  const updateParameter = (key: keyof RiskParameters, value: number) => {
    onChange({
      ...parameters,
      [key]: value,
    });
  };

  const riskLevel = () => {
    const score = 
      (parameters.stopLossPercent < 1 ? 3 : parameters.stopLossPercent < 3 ? 2 : 1) +
      (parameters.maxDailyLoss > 1000 ? 3 : parameters.maxDailyLoss > 500 ? 2 : 1) +
      (parameters.maxOpenPositions > 5 ? 3 : parameters.maxOpenPositions > 3 ? 2 : 1);
    
    if (score <= 4) return { level: 'Baixo', color: 'text-green-600', bg: 'bg-green-100' };
    if (score <= 7) return { level: 'Médio', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { level: 'Alto', color: 'text-red-600', bg: 'bg-red-100' };
  };

  const risk = riskLevel();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Parâmetros de Risco</h3>
        <p className="text-gray-600 mt-1">
          Configure os limites de risco para proteger seu capital
        </p>
      </div>

      {/* Risk Level Indicator */}
      <div className={`p-4 rounded-lg ${risk.bg}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">Nível de Risco</div>
            <div className={`text-lg font-bold ${risk.color}`}>{risk.level}</div>
          </div>
          <div className="text-2xl">
            {risk.level === 'Baixo' ? '🟢' : risk.level === 'Médio' ? '🟡' : '🔴'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Position Size */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tamanho Máximo da Posição (USD)
          </label>
          <input
            type="number"
            value={parameters.maxPositionSize}
            onChange={(e) => updateParameter('maxPositionSize', parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="100"
            step="100"
          />
          <p className="text-xs text-gray-500 mt-1">
            Valor máximo que pode ser investido em uma única posição
          </p>
        </div>

        {/* Stop Loss */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Stop Loss (%)
          </label>
          <input
            type="number"
            value={parameters.stopLossPercent}
            onChange={(e) => updateParameter('stopLossPercent', parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="0.1"
            max="20"
            step="0.1"
          />
          <p className="text-xs text-gray-500 mt-1">
            Percentual de perda máxima antes de fechar a posição
          </p>
        </div>

        {/* Take Profit */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Take Profit (%)
          </label>
          <input
            type="number"
            value={parameters.takeProfitPercent}
            onChange={(e) => updateParameter('takeProfitPercent', parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="0.1"
            max="50"
            step="0.1"
          />
          <p className="text-xs text-gray-500 mt-1">
            Percentual de lucro alvo antes de fechar a posição
          </p>
        </div>

        {/* Max Daily Loss */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Perda Máxima Diária (USD)
          </label>
          <input
            type="number"
            value={parameters.maxDailyLoss}
            onChange={(e) => updateParameter('maxDailyLoss', parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="50"
            step="50"
          />
          <p className="text-xs text-gray-500 mt-1">
            Limite de perda diária - estratégia será pausada se atingido
          </p>
        </div>

        {/* Max Open Positions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Máximo de Posições Abertas
          </label>
          <input
            type="number"
            value={parameters.maxOpenPositions}
            onChange={(e) => updateParameter('maxOpenPositions', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="1"
            max="10"
          />
          <p className="text-xs text-gray-500 mt-1">
            Número máximo de posições que podem estar abertas simultaneamente
          </p>
        </div>
      </div>

      {/* Risk Calculations */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Cálculos de Risco</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Risco por Trade</div>
            <div className="font-medium">
              ${(parameters.maxPositionSize * parameters.stopLossPercent / 100).toFixed(2)}
            </div>
          </div>
          
          <div>
            <div className="text-gray-600">Lucro Alvo por Trade</div>
            <div className="font-medium text-green-600">
              ${(parameters.maxPositionSize * parameters.takeProfitPercent / 100).toFixed(2)}
            </div>
          </div>
          
          <div>
            <div className="text-gray-600">Risk/Reward Ratio</div>
            <div className="font-medium">
              1:{(parameters.takeProfitPercent / parameters.stopLossPercent).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Risk Warnings */}
      {risk.level === 'Alto' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="text-red-600 mr-2">⚠️</div>
            <div>
              <div className="font-medium text-red-800">Configuração de Alto Risco</div>
              <div className="text-sm text-red-700 mt-1">
                Seus parâmetros atuais indicam um nível de risco alto. Considere:
              </div>
              <ul className="text-sm text-red-700 mt-2 list-disc list-inside">
                <li>Reduzir o tamanho máximo da posição</li>
                <li>Diminuir a perda máxima diária</li>
                <li>Limitar o número de posições abertas</li>
                <li>Aumentar o stop loss para reduzir perdas</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Best Practices */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="text-blue-600 mr-2">💡</div>
          <div>
            <div className="font-medium text-blue-800">Dicas de Gerenciamento de Risco</div>
            <ul className="text-sm text-blue-700 mt-2 list-disc list-inside">
              <li>Nunca arrisque mais de 1-2% do seu capital por trade</li>
              <li>Mantenha um ratio risk/reward de pelo menos 1:2</li>
              <li>Diversifique entre diferentes estratégias e símbolos</li>
              <li>Monitore regularmente o desempenho e ajuste os parâmetros</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};