const puppeteer = require('puppeteer');

async function testAuraInterface() {
    console.log('🚀 Iniciando teste automatizado da interface AURA com Puppeteer');
    
    let browser;
    try {
        // Configurar o browser
        browser = await puppeteer.launch({
            headless: true, // Modo headless para Docker
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-extensions'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });

        console.log('📱 Navegando para o frontend...');
        
        // Navegar para o frontend
        try {
            await page.goto('http://host.docker.internal:3000', { 
                waitUntil: 'networkidle2',
                timeout: 10000 
            });
            console.log('✅ Frontend carregado com sucesso');
        } catch (error) {
            console.log('⚠️  Frontend não disponível, testando API diretamente...');
            
            // Se o frontend não estiver disponível, vamos testar a API
            await page.goto('http://host.docker.internal:3001/health', { 
                waitUntil: 'networkidle2' 
            });
            
            const healthContent = await page.content();
            console.log('🔍 Conteúdo da API Health:', healthContent);
        }

        // Tirar screenshot da página atual
        await page.screenshot({ 
            path: '/screenshots/aura-interface.png',
            fullPage: true 
        });
        console.log('📸 Screenshot salvo em /screenshots/aura-interface.png');

        // Testar a API usando JavaScript no browser
        console.log('🧪 Testando API via JavaScript...');
        
        const apiTest = await page.evaluate(async () => {
            try {
                // Teste de health check
                const healthResponse = await fetch('http://host.docker.internal:3001/health');
                const healthData = await healthResponse.json();
                
                // Teste de registro
                const registerResponse = await fetch('http://host.docker.internal:3001/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: 'Puppeteer User',
                        email: 'puppeteer@teste.com',
                        password: 'senha123'
                    })
                });
                
                let registerData = null;
                try {
                    registerData = await registerResponse.json();
                } catch (e) {
                    registerData = { error: 'User might already exist' };
                }

                // Teste de login
                const loginResponse = await fetch('http://host.docker.internal:3001/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: 'puppeteer@teste.com',
                        password: 'senha123'
                    })
                });
                
                const loginData = await loginResponse.json();
                
                return {
                    health: healthData,
                    register: registerData,
                    login: loginData,
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                return {
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
            }
        });

        console.log('📊 Resultados dos testes da API:');
        console.log(JSON.stringify(apiTest, null, 2));

        // Se conseguimos fazer login, testar rotas protegidas
        if (apiTest.login && apiTest.login.data && apiTest.login.data.token) {
            console.log('🔐 Testando rota protegida...');
            
            const protectedTest = await page.evaluate(async (token) => {
                try {
                    const profileResponse = await fetch('http://host.docker.internal:3001/api/auth/profile', {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    return await profileResponse.json();
                } catch (error) {
                    return { error: error.message };
                }
            }, apiTest.login.data.token);

            console.log('👤 Dados do perfil:', JSON.stringify(protectedTest, null, 2));
        }

        // Aguardar um pouco para visualização
        console.log('⏳ Aguardando 5 segundos para visualização...');
        await page.waitForTimeout(5000);

        console.log('✅ Teste automatizado concluído com sucesso!');

    } catch (error) {
        console.error('❌ Erro durante o teste:', error.message);
        
        if (browser) {
            await browser.newPage().then(async (errorPage) => {
                await errorPage.setContent(`
                    <html>
                        <body>
                            <h1>Erro no Teste Puppeteer</h1>
                            <p><strong>Erro:</strong> ${error.message}</p>
                            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                            <h2>Informações do Sistema:</h2>
                            <ul>
                                <li>Frontend: http://host.docker.internal:3000</li>
                                <li>Backend: http://host.docker.internal:3001</li>
                                <li>Status: Teste automatizado executado</li>
                            </ul>
                        </body>
                    </html>
                `);
                
                await errorPage.screenshot({ 
                    path: '/screenshots/error-page.png',
                    fullPage: true 
                });
            });
        }
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Executar o teste
testAuraInterface();