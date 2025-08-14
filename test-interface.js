// Script para testar a interface da aplicação AURA
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testInterface() {
    console.log('🚀 Testando Interface da Aplicação AURA');
    console.log('=====================================');

    try {
        // 1. Verificar se o backend está rodando
        console.log('\n1. Verificando Backend...');
        const healthResponse = await axios.get(`${BASE_URL}/health`);
        console.log('✅ Backend Status:', healthResponse.data.status);

        // 2. Registrar um usuário de teste
        console.log('\n2. Registrando usuário de teste...');
        const registerData = {
            name: 'Usuario Interface',
            email: 'interface@teste.com',
            password: 'senha123'
        };

        try {
            const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, registerData);
            console.log('✅ Usuário registrado:', registerResponse.data.data.user.name);
        } catch (error) {
            if (error.response?.status === 409) {
                console.log('ℹ️  Usuário já existe, continuando...');
            } else {
                throw error;
            }
        }

        // 3. Fazer login
        console.log('\n3. Fazendo login...');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'interface@teste.com',
            password: 'senha123'
        });
        
        const token = loginResponse.data.data.token;
        console.log('✅ Login realizado com sucesso');
        console.log('🔑 Token:', token.substring(0, 50) + '...');

        // 4. Acessar perfil
        console.log('\n4. Acessando perfil do usuário...');
        const profileResponse = await axios.get(`${BASE_URL}/api/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('✅ Perfil acessado:');
        console.log('   Nome:', profileResponse.data.data.user.name);
        console.log('   Email:', profileResponse.data.data.user.email);
        console.log('   Role:', profileResponse.data.data.user.role);

        // 5. Verificar monitoramento
        console.log('\n5. Verificando monitoramento...');
        const monitoringResponse = await axios.get(`${BASE_URL}/api/monitoring/stats`);
        console.log('✅ Estatísticas de monitoramento:');
        console.log('   Total Requests:', monitoringResponse.data.data.totalRequests);
        console.log('   Taxa de Erro:', monitoringResponse.data.data.errorRate + '%');
        console.log('   Tempo Médio:', monitoringResponse.data.data.avgResponseTime + 'ms');

        // 6. Simular acesso ao frontend
        console.log('\n6. Verificando Frontend...');
        const frontendResponse = await axios.get('http://localhost:3000');
        console.log('✅ Frontend Status:', frontendResponse.status === 200 ? 'OK' : 'ERRO');

        console.log('\n🎉 TESTE DA INTERFACE CONCLUÍDO COM SUCESSO!');
        console.log('📱 Acesse: http://localhost:3000 (Frontend)');
        console.log('🔧 API: http://localhost:3001 (Backend)');

    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        }
    }
}

// Executar o teste
testInterface();