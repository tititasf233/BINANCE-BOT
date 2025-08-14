const puppeteer = require('puppeteer');

async function debugSite() {
    console.log('🔍 Debugando site AURA...');
    
    let browser;
    try {
        // Conectar ao browser remoto
        browser = await puppeteer.connect({
            browserURL: 'http://localhost:9222'
        });

        const page = await browser.newPage();
        
        // Capturar erros de console
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            console.log(`[CONSOLE ${type.toUpperCase()}]: ${text}`);
        });

        // Capturar erros de página
        page.on('pageerror', error => {
            console.log(`[PAGE ERROR]: ${error.message}`);
        });

        // Capturar falhas de requisição
        page.on('requestfailed', request => {
            console.log(`[REQUEST FAILED]: ${request.url()} - ${request.failure().errorText}`);
        });

        console.log('📱 Navegando para http://localhost:3000...');
        
        // Navegar para o site
        await page.goto('http://localhost:3000', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });

        // Aguardar um pouco para capturar erros
        await page.waitForTimeout(5000);

        // Capturar screenshot
        await page.screenshot({ 
            path: '/tmp/site-debug.png',
            fullPage: true 
        });

        // Verificar se há elementos de erro na página
        const errorElements = await page.evaluate(() => {
            const errors = [];
            
            // Procurar por elementos de erro comuns
            const errorSelectors = [
                '[class*="error"]',
                '[class*="Error"]',
                '[id*="error"]',
                '.error-message',
                '.error-container',
                '[data-testid*="error"]'
            ];

            errorSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    if (el.textContent && el.textContent.trim()) {
                        errors.push({
                            selector,
                            text: el.textContent.trim(),
                            html: el.outerHTML.substring(0, 200)
                        });
                    }
                });
            });

            return errors;
        });

        if (errorElements.length > 0) {
            console.log('❌ Erros encontrados na página:');
            errorElements.forEach((error, index) => {
                console.log(`${index + 1}. ${error.text}`);
                console.log(`   Seletor: ${error.selector}`);
                console.log(`   HTML: ${error.html}...`);
            });
        }

        // Verificar se a página carregou corretamente
        const pageTitle = await page.title();
        console.log(`📄 Título da página: ${pageTitle}`);

        // Verificar se há conteúdo na página
        const bodyText = await page.evaluate(() => document.body.textContent);
        if (bodyText && bodyText.trim().length > 0) {
            console.log(`📝 Conteúdo encontrado: ${bodyText.substring(0, 200)}...`);
        } else {
            console.log('⚠️  Página parece estar vazia');
        }

        // Verificar se há elementos React
        const hasReact = await page.evaluate(() => {
            return !!(window.React || document.querySelector('[data-reactroot]') || document.querySelector('#root'));
        });
        console.log(`⚛️  React detectado: ${hasReact ? 'SIM' : 'NÃO'}`);

        // Verificar chamadas de API
        console.log('🌐 Testando APIs...');
        
        // Testar API de mercado
        try {
            const marketResponse = await page.evaluate(async () => {
                const response = await fetch('/api/market/health');
                return {
                    status: response.status,
                    data: await response.json()
                };
            });
            console.log('✅ API Market Health:', marketResponse.status, marketResponse.data.data?.status);
        } catch (error) {
            console.log('❌ Erro na API Market:', error.message);
        }

        // Testar API de monitoramento
        try {
            const monitoringResponse = await page.evaluate(async () => {
                const response = await fetch('/api/monitoring/stats');
                return {
                    status: response.status,
                    data: await response.json()
                };
            });
            console.log('✅ API Monitoring:', monitoringResponse.status);
        } catch (error) {
            console.log('❌ Erro na API Monitoring:', error.message);
        }

        console.log('✅ Debug concluído!');

    } catch (error) {
        console.error('❌ Erro durante debug:', error.message);
    } finally {
        if (browser) {
            await browser.disconnect();
        }
    }
}

debugSite();