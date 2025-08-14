import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Eye, EyeOff, Lock, Mail, User, Zap } from './icons/Icons';

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        // Usar o novo sistema de autenticação
        const result = await onLogin(formData.email, formData.password);
        if (!result.success) {
          setError(result.error || 'Erro na autenticação');
        }
      } else {
        // Registro ainda usa o método antigo
        const response = await fetch('http://localhost:3001/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
          // Após registro bem-sucedido, fazer login
          const loginResult = await onLogin(formData.email, formData.password);
          if (!loginResult.success) {
            setError(loginResult.error || 'Erro após registro');
          }
        } else {
          setError(data.error || 'Erro no registro');
        }
      }
    } catch (err) {
      setError('Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">AURA</h1>
          <p className="text-blue-200">Trading System</p>
        </div>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center text-white">
              {isLogin ? 'Entrar' : 'Criar Conta'}
            </CardTitle>
            <p className="text-center text-blue-200">
              {isLogin 
                ? 'Acesse sua conta para continuar' 
                : 'Crie sua conta para começar'
              }
            </p>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Nome</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-blue-300" />
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Seu nome completo"
                      required={!isLogin}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-blue-300" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="seu@email.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-blue-300" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-12 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Sua senha"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-blue-300 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-md">
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-md transition-all duration-200"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processando...
                  </div>
                ) : (
                  isLogin ? 'Entrar' : 'Criar Conta'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(null);
                  setFormData({ name: '', email: '', password: '' });
                }}
                className="text-blue-300 hover:text-white text-sm transition-colors"
              >
                {isLogin 
                  ? 'Não tem uma conta? Criar conta' 
                  : 'Já tem uma conta? Entrar'
                }
              </button>
            </div>

            {/* Demo Credentials */}
            <div className="mt-6 p-3 bg-blue-500/20 border border-blue-500/50 rounded-md">
              <p className="text-blue-200 text-xs text-center mb-2">Credenciais de teste:</p>
              <p className="text-blue-100 text-xs text-center">
                Email: interface@teste.com<br />
                Senha: senha123
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-blue-200 text-sm">
          <p>AURA Trading System v1.0.0</p>
          <p>Desenvolvido com ❤️ para traders profissionais</p>
        </div>
      </div>
    </div>
  );
};

export default Login;