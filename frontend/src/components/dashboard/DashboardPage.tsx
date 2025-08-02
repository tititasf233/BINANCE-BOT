import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { PortfolioOverview } from './PortfolioOverview';
import { PerformanceChart } from './PerformanceChart';
import { ActivePositions } from './ActivePositions';
import { LogsFeed } from './LogsFeed';
import { SystemStatus } from './SystemStatus';

export const DashboardPage: React.FC = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    // Initialize dashboard data
    // dispatch(fetchPortfolioData());
    // dispatch(fetchActivePositions());
    // dispatch(connectWebSocket());
  }, [dispatch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Dashboard - Sistema AURA
        </h1>
        <p className="text-gray-600 mt-1">
          Bem-vindo de volta, {user?.email}
        </p>
      </div>

      {/* System Status */}
      <SystemStatus />

      {/* Portfolio Overview */}
      <PortfolioOverview />

      {/* Charts and Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PerformanceChart />
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Métricas Rápidas
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">+12.5%</div>
              <div className="text-sm text-gray-500">Retorno Mensal</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">85%</div>
              <div className="text-sm text-gray-500">Win Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">1.8</div>
              <div className="text-sm text-gray-500">Sharpe Ratio</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">-3.2%</div>
              <div className="text-sm text-gray-500">Max Drawdown</div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Positions and Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivePositions />
        <LogsFeed />
      </div>
    </div>
  );
};