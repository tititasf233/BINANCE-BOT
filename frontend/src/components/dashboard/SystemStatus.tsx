import React from 'react';

interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'warning';
  lastUpdate: string;
  description: string;
}

export const SystemStatus: React.FC = () => {
  // Mock data - will be replaced with real data from Redux store
  const services: ServiceStatus[] = [
    {
      name: 'Data Ingestor',
      status: 'online',
      lastUpdate: '2024-01-15 18:30:15',
      description: 'Coletando dados de mercado em tempo real',
    },
    {
      name: 'Strategy Engine',
      status: 'online',
      lastUpdate: '2024-01-15 18:30:10',
      description: '3 estratégias ativas processando sinais',
    },
    {
      name: 'Execution Engine',
      status: 'warning',
      lastUpdate: '2024-01-15 18:29:45',
      description: 'Latência elevada detectada (150ms)',
    },
    {
      name: 'Risk Manager',
      status: 'online',
      lastUpdate: '2024-01-15 18:30:12',
      description: 'Monitorando exposição e limites',
    },
    {
      name: 'Portfolio Service',
      status: 'online',
      lastUpdate: '2024-01-15 18:30:08',
      description: 'Calculando métricas de performance',
    },
  ];

  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'offline':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'online':
        return '🟢';
      case 'warning':
        return '🟡';
      case 'offline':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  const onlineServices = services.filter(s => s.status === 'online').length;
  const totalServices = services.length;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">
            Status do Sistema
          </h2>
          <div className="flex items-center space-x-2">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              onlineServices === totalServices 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {onlineServices}/{totalServices} Serviços Online
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <div
              key={service.name}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-900">
                  {service.name}
                </h3>
                <div className="flex items-center space-x-1">
                  <span className="text-sm">{getStatusIcon(service.status)}</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(service.status)}`}>
                    {service.status.toUpperCase()}
                  </span>
                </div>
              </div>
              
              <p className="text-xs text-gray-600 mb-2">
                {service.description}
              </p>
              
              <div className="text-xs text-gray-400">
                Última atualização: {formatTime(service.lastUpdate)}
              </div>
            </div>
          ))}
        </div>

        {/* System Health Summary */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">💚</span>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  Sistema Operacional
                </div>
                <div className="text-xs text-gray-500">
                  Todos os serviços críticos estão funcionando
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">
                Uptime: 99.8%
              </div>
              <div className="text-xs text-gray-500">
                Últimas 24h
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};