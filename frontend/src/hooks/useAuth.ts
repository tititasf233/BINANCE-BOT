import { useState, useEffect, useCallback } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true
  });

  // Verificar se o token é válido
  const isTokenValid = useCallback((token: string): boolean => {
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      
      // Verificar se o token não expirou (com margem de 5 minutos)
      return payload.exp > (currentTime + 300);
    } catch (error) {
      return false;
    }
  }, []);

  // Fazer login
  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const { token, user } = data.data;
        
        // Salvar no localStorage
        localStorage.setItem('aura_token', token);
        localStorage.setItem('aura_user', JSON.stringify(user));
        
        setAuthState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false
        });

        return { success: true };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }, []);

  // Fazer logout
  const logout = useCallback(() => {
    localStorage.removeItem('aura_token');
    localStorage.removeItem('aura_user');
    
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false
    });
  }, []);

  // Obter token válido (renovar se necessário)
  const getValidToken = useCallback(async (): Promise<string | null> => {
    const currentToken = authState.token || localStorage.getItem('aura_token');
    
    if (!currentToken || !isTokenValid(currentToken)) {
      // Token inválido ou expirado, fazer logout
      logout();
      return null;
    }
    
    return currentToken;
  }, [authState.token, isTokenValid, logout]);

  // Fazer requisição autenticada
  const authenticatedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = await getValidToken();
    
    if (!token) {
      throw new Error('No valid token available');
    }

    // Corrigir URL base - backend está na porta 3001
    const baseUrl = 'http://localhost:3001';
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

    return fetch(fullUrl, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }, [getValidToken]);

  // Função auxiliar para fazer chamadas da API e retornar JSON
  const apiCall = useCallback(async (url: string, options: RequestInit = {}) => {
    try {
      const response = await authenticatedFetch(url, options);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  }, [authenticatedFetch]);

  // Inicializar autenticação
  useEffect(() => {
    const initAuth = () => {
      const savedToken = localStorage.getItem('aura_token');
      const savedUser = localStorage.getItem('aura_user');

      if (savedToken && savedUser && isTokenValid(savedToken)) {
        try {
          const user = JSON.parse(savedUser);
          setAuthState({
            user,
            token: savedToken,
            isAuthenticated: true,
            isLoading: false
          });
        } catch (error) {
          console.error('Error parsing saved user data:', error);
          logout();
        }
      } else {
        // Token inválido ou não existe
        logout();
      }
    };

    initAuth();
  }, [isTokenValid, logout]);

  return {
    ...authState,
    login,
    logout,
    getValidToken,
    authenticatedFetch,
    apiCall
  };
};