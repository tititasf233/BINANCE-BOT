import React, { useState } from 'react';

interface Condition {
  id: string;
  indicator: string;
  operator: string;
  value: number;
  timeframe?: string;
  logic?: 'AND' | 'OR';
}

interface ConditionBuilderProps {
  title: string;
  description: string;
  conditions: Condition[];
  onChange: (conditions: Condition[]) => void;
}

export const ConditionBuilder: React.FC<ConditionBuilderProps> = ({
  title,
  description,
  conditions,
  onChange,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const indicators = [
    { value: 'rsi', label: 'RSI (Relative Strength Index)' },
    { value: 'macd', label: 'MACD' },
    { value: 'sma', label: 'SMA (Simple Moving Average)' },
    { value: 'ema', label: 'EMA (Exponential Moving Average)' },
    { value: 'bb_upper', label: 'Bollinger Bands Upper' },
    { value: 'bb_lower', label: 'Bollinger Bands Lower' },
    { value: 'volume', label: 'Volume' },
    { value: 'price', label: 'Price' },
  ];

  const operators = [
    { value: '>', label: 'Maior que (>)' },
    { value: '<', label: 'Menor que (<)' },
    { value: '>=', label: 'Maior ou igual (>=)' },
    { value: '<=', label: 'Menor ou igual (<=)' },
    { value: '==', label: 'Igual (==)' },
    { value: 'crosses_above', label: 'Cruza para cima' },
    { value: 'crosses_below', label: 'Cruza para baixo' },
  ];

  const addCondition = () => {
    const newCondition: Condition = {
      id: Date.now().toString(),
      indicator: 'rsi',
      operator: '>',
      value: 70,
      logic: conditions.length > 0 ? 'AND' : undefined,
    };

    onChange([...conditions, newCondition]);
  };

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    const updatedConditions = conditions.map((condition, i) =>
      i === index ? { ...condition, ...updates } : condition
    );
    onChange(updatedConditions);
  };

  const removeCondition = (index: number) => {
    const updatedConditions = conditions.filter((_, i) => i !== index);
    // Remove logic operator from first condition if it exists
    if (updatedConditions.length > 0 && updatedConditions[0].logic) {
      updatedConditions[0] = { ...updatedConditions[0], logic: undefined };
    }
    onChange(updatedConditions);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newConditions = [...conditions];
    const draggedCondition = newConditions[draggedIndex];
    
    // Remove dragged item
    newConditions.splice(draggedIndex, 1);
    
    // Insert at new position
    newConditions.splice(dropIndex, 0, draggedCondition);
    
    onChange(newConditions);
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-gray-600 mt-1">{description}</p>
      </div>

      {/* Conditions List */}
      <div className="space-y-4">
        {conditions.map((condition, index) => (
          <div
            key={condition.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow cursor-move"
          >
            {/* Logic Operator */}
            {index > 0 && (
              <div className="mb-4">
                <select
                  value={condition.logic || 'AND'}
                  onChange={(e) => updateCondition(index, { logic: e.target.value as 'AND' | 'OR' })}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="AND">E (AND)</option>
                  <option value="OR">OU (OR)</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              {/* Indicator */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Indicador
                </label>
                <select
                  value={condition.indicator}
                  onChange={(e) => updateCondition(index, { indicator: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {indicators.map((indicator) => (
                    <option key={indicator.value} value={indicator.value}>
                      {indicator.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Operator */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Operador
                </label>
                <select
                  value={condition.operator}
                  onChange={(e) => updateCondition(index, { operator: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {operators.map((operator) => (
                    <option key={operator.value} value={operator.value}>
                      {operator.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor
                </label>
                <input
                  type="number"
                  value={condition.value}
                  onChange={(e) => updateCondition(index, { value: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="0.01"
                />
              </div>

              {/* Actions */}
              <div>
                <button
                  onClick={() => removeCondition(index)}
                  className="w-full px-3 py-2 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
                >
                  Remover
                </button>
              </div>
            </div>

            {/* Condition Preview */}
            <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-600">
              <strong>Condição:</strong> {condition.indicator.toUpperCase()} {condition.operator} {condition.value}
            </div>
          </div>
        ))}
      </div>

      {/* Add Condition Button */}
      <button
        onClick={addCondition}
        className="w-full px-4 py-3 text-sm font-medium text-blue-600 border-2 border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
      >
        + Adicionar Condição
      </button>

      {/* Strategy Preview */}
      {conditions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Preview da Lógica:</h4>
          <div className="text-sm text-blue-800">
            {conditions.map((condition, index) => (
              <span key={condition.id}>
                {index > 0 && (
                  <span className="font-medium mx-2">
                    {condition.logic}
                  </span>
                )}
                <span className="bg-white px-2 py-1 rounded border">
                  {condition.indicator.toUpperCase()} {condition.operator} {condition.value}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {conditions.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">🎯</div>
          <div className="text-sm">Nenhuma condição configurada</div>
          <div className="text-xs mt-1">Clique em "Adicionar Condição" para começar</div>
        </div>
      )}
    </div>
  );
};