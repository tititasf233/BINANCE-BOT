import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from './store';
import { checkAuthStatus } from './store/slices/authSlice';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import './services/api/interceptors'; // Initialize interceptors
import { enableGlobalUiInstrumentation } from './services/ui/uiLogger';

import { DashboardPage } from './components/dashboard/DashboardPage';
import { StrategiesPage } from './components/strategies/StrategiesPage';
import { BacktestPage } from './components/backtest/BacktestPage';
import { HistoryPage } from './components/history/HistoryPage';
import Dashboard from './components/Dashboard';
import Login from './components/Login';

// Placeholder components for routes
const Portfolio = () => <div>Portfolio Page</div>;
const Settings = () => <div>Settings Page</div>;

const App: React.FC = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, isLoading } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    dispatch(checkAuthStatus() as any);
    enableGlobalUiInstrumentation();
  }, [dispatch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public routes */}
          <Route 
            path="/login" 
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginForm />
            } 
          />
          <Route 
            path="/register" 
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterForm />
            } 
          />
          
          {/* Protected routes */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="strategies" element={<StrategiesPage />} />
            <Route path="backtest" element={<BacktestPage />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;