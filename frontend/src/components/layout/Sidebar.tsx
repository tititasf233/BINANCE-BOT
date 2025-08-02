import React from 'react';
import { NavLink } from 'react-router-dom';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Estratégias', href: '/strategies', icon: '🎯' },
  { name: 'Backtesting', href: '/backtest', icon: '📈' },
  { name: 'Portfolio', href: '/portfolio', icon: '💼' },
  { name: 'Histórico', href: '/history', icon: '📋' },
  { name: 'Configurações', href: '/settings', icon: '⚙️' },
];

export const Sidebar: React.FC = () => {
  return (
    <div className="w-64 bg-white shadow-sm border-r border-gray-200 min-h-screen">
      <nav className="mt-8">
        <div className="px-4">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `group flex items-center px-2 py-2 text-sm font-medium rounded-md mb-1 transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <span className="mr-3 text-lg">{item.icon}</span>
              {item.name}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};