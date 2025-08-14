import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import AutonomousDashboard from './components/AutonomousDashboard';
import { ApiKeySetup } from './components/ApiKeySetup';
import { useAuth } from './hooks/useAuth';
import './App.css';

function SimpleApp() {
  const { user, isAuthenticated, isLoading, login, logout, authenticatedFetch } = useAuth();
  const [showApiKeySetup, setShowApiKeySetup] = useState(false);
  const [checkingApiKeys, setCheckingApiKeys] = useState(false);

  const handleLogin = async (email: string, password: string) => {
    const result = await login(email, password);
    return result;
  };

  const checkApiKeys = async () => {
    if (!isAuthenticated) return;
    
    setCheckingApiKeys(true);
    try {
      const response = await authenticatedFetch('/api/trading/account');
      const data = await response.json();
      
      if (data.requiresApiKeys) {
        setShowApiKeySetup(true);
      }
    } catch (error) {
      console.error('Error checking API keys:', error);
    } finally {
      setCheckingApiKeys(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      checkApiKeys();
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading || checkingApiKeys) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white">
            {isLoading ? 'Carregando AURA...' : 'Verificando configuração...'}
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Login onLogin={handleLogin} />;
  }

  if (showApiKeySetup) {
    return (
      <ApiKeySetup 
        onApiKeysConfigured={() => {
          setShowApiKeySetup(false);
          // Recarregar a página para atualizar o estado
          window.location.reload();
        }} 
      />
    );
  }

  return (
    <div className="App">
      <AutonomousDashboard user={user} onLogout={logout} />
    </div>
  );
}

export default SimpleApp;