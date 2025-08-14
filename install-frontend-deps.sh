#!/bin/bash

echo "🚀 Instalando dependências do frontend para o display AURA..."

cd frontend

# Instalar dependências principais
npm install recharts lucide-react clsx tailwind-merge

# Instalar dependências de desenvolvimento se necessário
npm install -D @types/react @types/react-dom

echo "✅ Dependências instaladas com sucesso!"
echo "📱 Para ver o display, acesse: http://localhost:3000"
echo "🔧 Backend API: http://localhost:3001"

cd ..