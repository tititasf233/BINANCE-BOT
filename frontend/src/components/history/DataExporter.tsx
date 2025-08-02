import React, { useState } from 'react';

interface ExportConfig {
  format: 'csv' | 'pdf' | 'excel';
  dateRange: {
    start: string;
    end: string;
  };
  includeFields: string[];
  strategies: string[];
  symbols: string[];
  reportType: 'trades' | 'summary' | 'detailed';
}

export const DataExporter: React.FC = () => {
  const [config, setConfig] = useState<ExportConfig>({
    format: 'csv',
    dateRange: {
      start: '',
      end: '',
    },
    includeFields: ['id', 'symbol', 'strategy', 'entryTime', 'exitTime', 'pnl'],
    strategies: [],
    symbols: [],
    reportType: 'trades',
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportHistory, setExportHistory] = useState([
    {
      id: '1',
      filename: 'trades_2024-01-15.csv',
      format: 'CSV',
      size: '2.3 MB',
      records: 1250,
      createdAt: '2024-01-15T10:30:00Z',
      status: 'completed',
    },
    {
      id: '2',
      filename: 'performance_report_2024-01-14.pdf',
      format: 'PDF',
      size: '1.8 MB',
      records: 0,
      createdAt: '2024-01-14T15:45:00Z',
      status: 'completed',
    },
    {
      id: '3',
      filename: 'detailed_analysis_2024-01-13.xlsx',
      format: 'Excel',
      size: '4.1 MB',
      records: 2100,
      createdAt: '2024-01-13T09:15:00Z',
      status: 'completed',
    },
  ]);

  const availableFields = [
    { id: 'id', label: 'ID do Trade', category: 'basic' },
    { id: 'symbol', label: 'Símbolo', category: 'basic' },
    { id: 'strategy', label: 'Estratégia', category: 'basic' },
    { id: 'side', label: 'Lado (Buy/Sell)', category: 'basic' },
    { id: 'entryTime', label: 'Data/Hora Entrada', category: 'basic' },
    { id: 'exitTime', label: 'Data/Hora Saída', category: 'basic' },
    { id: 'entryPrice', label: 'Preço de Entrada', category: 'pricing' },
    { id: 'exitPrice', label: 'Preço de Saída', category: 'pricing' },
    { id: 'quantity', label: 'Quantidade', category: 'pricing' },
    { id: 'pnl', label: 'P&L Absoluto', category: 'performance' },
    { id: 'pnlPercent', label: 'P&L Percentual', category: 'performance' },
    { id: 'fees', label: 'Taxas', category: 'performance' },
    { id: 'duration', label: 'Duração', category: 'performance' },
    { id: 'status', label: 'Status', category: 'basic' },
    { id: 'signal', label: 'Sinal', category: 'advanced' },
    { id: 'notes', label: 'Observações', category: 'advanced' },
  ];

  const availableStrategies = [
    'RSI Strategy',
    'MACD Strategy',
    'Bollinger Bands',
    'Custom Strategy',
  ];

  const availableSymbols = [
    'BTCUSDT',
    'ETHUSDT',
    'ADAUSDT',
    'BNBUSDT',
    'SOLUSDT',
  ];

  const handleFieldToggle = (fieldId: string) => {
    setConfig(prev => ({
      ...prev,
      includeFields: prev.includeFields.includes(fieldId)
        ? prev.includeFields.filter(id => id !== fieldId)
        : [...prev.includeFields, fieldId],
    }));
  };

  const handleMultiSelectToggle = (field: 'strategies' | 'symbols', value: string) => {
    setConfig(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value],
    }));
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      // Simulate export process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${config.reportType}_${timestamp}.${config.format}`;
      
      // Add to export history
      const newExport = {
        id: Date.now().toString(),
        filename,
        format: config.format.toUpperCase(),
        size: '1.5 MB',
        records: 850,
        createdAt: new Date().toISOString(),
        status: 'completed' as const,
      };
      
      setExportHistory(prev => [newExport, ...prev]);
      
      // In a real implementation, this would trigger the actual download
      console.log('Export completed:', config);
      
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = (exportId: string) => {
    const exportItem = exportHistory.find(item => item.id === exportId);
    if (exportItem) {
      // In a real implementation, this would trigger the download
      console.log('Downloading:', exportItem.filename);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFieldsByCategory = (category: string) => {
    return availableFields.filter(field => field.category === category);
  };

  return (
    <div className="space-y-6">
      {/* Export Configuration */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Configuração de Exportação
        </h2>
        
        <div className="space-y-6">
          {/* Format and Report Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Formato de Exportação
              </label>
              <div className="space-y-2">
                {[
                  { value: 'csv', label: 'CSV', description: 'Arquivo de valores separados por vírgula' },
                  { value: 'excel', label: 'Excel', description: 'Planilha do Microsoft Excel' },
                  { value: 'pdf', label: 'PDF', description: 'Relatório em formato PDF' },
                ].map((format) => (
                  <label key={format.value} className="flex items-start space-x-3">
                    <input
                      type="radio"
                      value={format.value}
                      checked={config.format === format.value}
                      onChange={(e) => setConfig(prev => ({ ...prev, format: e.target.value as any }))}
                      className="mt-1 h-4 w-4 text-blue-600"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{format.label}</div>
                      <div className="text-xs text-gray-500">{format.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Relatório
              </label>
              <div className="space-y-2">
                {[
                  { value: 'trades', label: 'Lista de Trades', description: 'Dados detalhados de cada trade' },
                  { value: 'summary', label: 'Resumo', description: 'Métricas agregadas de performance' },
                  { value: 'detailed', label: 'Análise Detalhada', description: 'Relatório completo com gráficos' },
                ].map((type) => (
                  <label key={type.value} className="flex items-start space-x-3">
                    <input
                      type="radio"
                      value={type.value}
                      checked={config.reportType === type.value}
                      onChange={(e) => setConfig(prev => ({ ...prev, reportType: e.target.value as any }))}
                      className="mt-1 h-4 w-4 text-blue-600"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{type.label}</div>
                      <div className="text-xs text-gray-500">{type.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Data Inicial</label>
                <input
                  type="date"
                  value={config.dateRange.start}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, start: e.target.value },
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Data Final</label>
                <input
                  type="date"
                  value={config.dateRange.end}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, end: e.target.value },
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Fields Selection (only for trades report) */}
          {config.reportType === 'trades' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Campos a Incluir ({config.includeFields.length} selecionados)
              </label>
              
              <div className="space-y-4">
                {['basic', 'pricing', 'performance', 'advanced'].map((category) => (
                  <div key={category}>
                    <h4 className="text-sm font-medium text-gray-600 mb-2 capitalize">
                      {category === 'basic' ? 'Básicos' :
                       category === 'pricing' ? 'Preços' :
                       category === 'performance' ? 'Performance' : 'Avançados'}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {getFieldsByCategory(category).map((field) => (
                        <label key={field.id} className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={config.includeFields.includes(field.id)}
                            onChange={() => handleFieldToggle(field.id)}
                            className="h-4 w-4 text-blue-600 rounded"
                          />
                          <span>{field.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estratégias ({config.strategies.length} selecionadas)
              </label>
              <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-1">
                {availableStrategies.map((strategy) => (
                  <label key={strategy} className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={config.strategies.includes(strategy)}
                      onChange={() => handleMultiSelectToggle('strategies', strategy)}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <span>{strategy}</span>
                  </label>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Deixe vazio para incluir todas
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Símbolos ({config.symbols.length} selecionados)
              </label>
              <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-1">
                {availableSymbols.map((symbol) => (
                  <label key={symbol} className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={config.symbols.includes(symbol)}
                      onChange={() => handleMultiSelectToggle('symbols', symbol)}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <span>{symbol}</span>
                  </label>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Deixe vazio para incluir todos
              </div>
            </div>
          </div>

          {/* Export Button */}
          <div className="flex justify-end">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Exportando...
                </div>
              ) : (
                '📤 Exportar Dados'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Export History */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Histórico de Exportações
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Arquivo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Formato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tamanho
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registros
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {exportHistory.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {item.filename}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {item.format}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.size}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.records > 0 ? item.records.toLocaleString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(item.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleDownload(item.id)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      📥 Download
                    </button>
                    <button
                      onClick={() => setExportHistory(prev => prev.filter(e => e.id !== item.id))}
                      className="text-red-600 hover:text-red-900"
                    >
                      🗑️ Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {exportHistory.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            <div className="text-4xl mb-2">📤</div>
            <div>Nenhuma exportação realizada ainda</div>
          </div>
        )}
      </div>

      {/* Export Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">
          💡 Dicas de Exportação
        </h3>
        
        <div className="space-y-2 text-sm text-blue-800">
          <p>• <strong>CSV:</strong> Ideal para análise em planilhas ou importação em outras ferramentas</p>
          <p>• <strong>Excel:</strong> Melhor para análises complexas com fórmulas e gráficos</p>
          <p>• <strong>PDF:</strong> Perfeito para relatórios profissionais e apresentações</p>
          <p>• <strong>Filtros:</strong> Use filtros para reduzir o tamanho do arquivo e focar nos dados relevantes</p>
          <p>• <strong>Campos:</strong> Selecione apenas os campos necessários para otimizar o desempenho</p>
        </div>
      </div>
    </div>
  );
};