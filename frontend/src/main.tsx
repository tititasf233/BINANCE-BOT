import React from 'react';
import ReactDOM from 'react-dom/client';
import SimpleApp from './SimpleApp';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <SimpleApp />
    </AuthProvider>
  </React.StrictMode>
);