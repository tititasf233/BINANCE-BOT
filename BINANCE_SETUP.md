# 🚀 Configuração da API Binance - Sistema AURA

## ✅ CREDENCIAIS BINANCE CONFIGURADAS

**API Key:** `SIJLUVItO87oczeEvAJ05Gi22hkyGrqhV0paZnsmcUVgpvwEbjYkuetbQf9CeRgI`
**Secret Key:** `hM6IsZFX5IIcKZekOA7pPCr7CYHWvy351TGVbFT289bIeG2WQjhgOxOfZu60OAX5`

🎉 **Suas credenciais estão completas e prontas para uso!**

O sistema AURA agora pode realizar trading automatizado completo com sua conta Binance.

## 📋 Configuração Completa

### 1. Edite o arquivo `.env` ou `backend/.env`:

```bash
# Suas credenciais Binance (já configuradas)
BINANCE_API_KEY=SIJLUVItO87oczeEvAJ05Gi22hkyGrqhV0paZnsmcUVgpvwEbjYkuetbQf9CeRgI
BINANCE_SECRET_KEY=hM6IsZFX5IIcKZekOA7pPCr7CYHWvy351TGVbFT289bIeG2WQjhgOxOfZu60OAX5

# Configurações de ambiente
BINANCE_USE_TESTNET=true  # true = testnet, false = produção
BINANCE_BASE_URL=https://api.binance.com
BINANCE_TESTNET_URL=https://testnet.binance.vision
```

### 2. Permissões necessárias na API Key

Certifique-se de que sua API Key tem as seguintes permissões habilitadas:

- ✅ **Enable Reading** (obrigatório)
- ✅ **Enable Spot & Margin Trading** (para abrir posições)
- ✅ **Enable Futures** (se quiser usar futuros)
- ❌ **Enable Withdrawals** (NÃO recomendado por segurança)

### 3. Whitelist de IP (Recomendado)

Para maior segurança, adicione seu IP à whitelist:
1. Na página de API Management
2. Clique em "Edit restrictions"
3. Adicione seu IP atual
4. Salve as alterações

## 🧪 Testando a Conexão

Após configurar a Secret Key, teste a conexão:

```bash
cd backend
npm run test:binance
```

Este comando irá:
- ✅ Testar conectividade básica
- ✅ Verificar autenticação
- ✅ Mostrar saldos da conta
- ✅ Verificar permissões
- ✅ Testar criação de ordens (modo teste)

## 🔒 Segurança

### ⚠️ NUNCA compartilhe sua Secret Key!

- ✅ Mantenha o arquivo `.env` no `.gitignore`
- ✅ Use testnet para desenvolvimento
- ✅ Configure whitelist de IP
- ✅ Desabilite withdrawals na API Key
- ❌ Nunca commite a Secret Key no Git

### 🧪 Testnet vs Produção

**Para desenvolvimento (recomendado):**
```bash
BINANCE_USE_TESTNET=true
```

**Para produção (apenas quando estiver pronto):**
```bash
BINANCE_USE_TESTNET=false
```

## 📊 O que o sistema pode fazer com sua API

### ✅ Com apenas API Key (sem Secret):
- Consultar preços em tempo real
- Obter dados históricos
- Fazer backtesting
- Monitorar mercado

### 🚀 Com API Key + Secret Key:
- **Abrir posições reais**
- **Fechar posições**
- **Consultar saldos**
- **Histórico de trades**
- **Gerenciar ordens**
- **Trading automatizado completo**

## 🆘 Problemas Comuns

### Erro: "Invalid API-key"
- Verifique se a API Key está correta
- Certifique-se de que não há espaços extras

### Erro: "Signature for this request is not valid"
- A Secret Key está incorreta ou ausente
- Verifique se copiou a Secret Key completa

### Erro: "IP address not allowed"
- Seu IP não está na whitelist
- Adicione seu IP ou remova a restrição de IP

### Erro: "This action is disabled on this account"
- A API Key não tem permissões de trading
- Habilite "Enable Spot & Margin Trading"

## 🎯 Próximos Passos

1. ✅ **Credenciais configuradas** - API Key e Secret Key já estão nos arquivos `.env`
2. **Execute o teste**: `npm run test:binance`
3. **Verifique se tudo está funcionando**
4. **Comece a usar o sistema AURA para trading real!**

---

💡 **Dica**: Comece sempre com `BINANCE_USE_TESTNET=true` para testar sem riscos!