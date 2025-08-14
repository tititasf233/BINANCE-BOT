const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * SUITE COMPLETA DE DEPURAÇÃO
 * 
 * Este script executa todos os testes de depuração em sequência
 * e gera um relatório completo dos problemas encontrados.
 * 
 * TESTES INCLUÍDOS:
 * 1. Teste de realidade das ordens demo
 * 2. Teste de operações reais do frontend
 * 3. Teste de debug profundo do frontend
 * 4. Análise de logs do backend
 */

class CompleteDebugSuite {
  constructor() {
    this.results = {
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        critical: 0
      },
      issues: [],
      recommendations: []
    };
    this.logFile = `debug-report-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      'info': '📋',
      'success': '✅',
      'error': '❌',
      'warning': '⚠️',
      'debug': '🔍',
      'critical': '🚨'
    }[type] || '📋';
    
    const logMessage = `[${timestamp}] ${prefix} ${message}`;
    console.log(logMessage);
    
    // Salvar no arquivo de log
    fs.appendFileSync(this.logFile, logMessage + '\n');
  }

  async runTest(testName, scriptPath, description) {
    this.log(`\n=== EXECUTANDO: ${testName} ===`, 'info');
    this.log(description, 'info');
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      let output = '';
      let errorOutput = '';
      
      const child = spawn('node', [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      child.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        process.stdout.write(text);
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        process.stderr.write(text);
      });

      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        const success = code === 0;
        
        const result = {
          name: testName,
          description,
          success,
          duration,
          exitCode: code,
          output,
          errorOutput,
          issues: this.extractIssues(output + errorOutput),
          timestamp: new Date().toISOString()
        };

        this.results.tests.push(result);
        this.results.summary.total++;
        
        if (success) {
          this.results.summary.passed++;
          this.log(`✅ ${testName} CONCLUÍDO com sucesso em ${duration}ms`, 'success');
        } else {
          this.results.summary.failed++;
          this.log(`❌ ${testName} FALHOU (código ${code}) em ${duration}ms`, 'error');
        }

        // Adicionar issues críticos
        const criticalIssues = result.issues.filter(issue => issue.type === 'critical');
        this.results.summary.critical += criticalIssues.length;
        this.results.issues.push(...criticalIssues);

        resolve(result);
      });

      child.on('error', (error) => {
        this.log(`❌ Erro ao executar ${testName}: ${error.message}`, 'error');
        resolve({
          name: testName,
          description,
          success: false,
          duration: Date.now() - startTime,
          error: error.message,
          issues: [{ type: 'critical', message: `Falha na execução: ${error.message}` }],
          timestamp: new Date().toISOString()
        });
      });
    });
  }

  extractIssues(output) {
    const issues = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Detectar problemas críticos
      if (line.includes('❌') || line.includes('FALHA') || line.includes('BUG CRÍTICO')) {
        issues.push({
          type: 'critical',
          message: line.trim(),
          source: 'output'
        });
      }
      
      // Detectar avisos
      if (line.includes('⚠️') || line.includes('WARNING') || line.includes('AVISO')) {
        issues.push({
          type: 'warning',
          message: line.trim(),
          source: 'output'
        });
      }
      
      // Detectar erros de conexão
      if (line.includes('ECONNREFUSED') || line.includes('timeout') || line.includes('network')) {
        issues.push({
          type: 'connection',
          message: line.trim(),
          source: 'output'
        });
      }
    }
    
    return issues;
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Analisar resultados para gerar recomendações
    const failedTests = this.results.tests.filter(t => !t.success);
    const criticalIssues = this.results.issues.filter(i => i.type === 'critical');
    
    if (failedTests.length === 0) {
      recommendations.push({
        priority: 'high',
        category: 'frontend',
        title: 'Backend funcionando - problema no frontend',
        description: 'Todos os testes de backend passaram. O problema está no frontend (cache, refresh, etc.)',
        actions: [
          'Implementar refresh mais agressivo após operações',
          'Verificar logs do console do navegador',
          'Reduzir intervalo de refresh para 3-5 segundos',
          'Adicionar feedback visual imediato'
        ]
      });
    }
    
    if (criticalIssues.some(i => i.message.includes('não aparece'))) {
      recommendations.push({
        priority: 'critical',
        category: 'data-sync',
        title: 'Problema de sincronização de dados',
        description: 'Ordens não aparecem após criação',
        actions: [
          'Verificar se o mock storage está funcionando',
          'Implementar logs detalhados no BinanceService',
          'Verificar se as ordens estão sendo salvas corretamente',
          'Testar com dados reais da Binance Testnet'
        ]
      });
    }
    
    if (criticalIssues.some(i => i.message.includes('não desaparece'))) {
      recommendations.push({
        priority: 'critical',
        category: 'data-sync',
        title: 'Problema de remoção de dados',
        description: 'Ordens não desaparecem após cancelamento',
        actions: [
          'Verificar se o cancelamento está removendo do mock storage',
          'Implementar logs detalhados no cancelamento',
          'Verificar se o frontend está fazendo refresh após cancelamento',
          'Testar cancelamento com dados reais'
        ]
      });
    }
    
    if (this.results.tests.some(t => t.issues.some(i => i.type === 'connection'))) {
      recommendations.push({
        priority: 'medium',
        category: 'infrastructure',
        title: 'Problemas de conectividade',
        description: 'Detectados problemas de conexão durante os testes',
        actions: [
          'Verificar se o backend está rodando na porta 3001',
          'Verificar se o frontend está rodando na porta 3000',
          'Testar conectividade com curl ou Postman',
          'Verificar logs do servidor'
        ]
      });
    }
    
    // Recomendações gerais
    recommendations.push({
      priority: 'medium',
      category: 'monitoring',
      title: 'Implementar monitoramento contínuo',
      description: 'Adicionar monitoramento para detectar problemas automaticamente',
      actions: [
        'Implementar health checks automáticos',
        'Adicionar métricas de performance',
        'Configurar alertas para falhas críticas',
        'Implementar logs estruturados'
      ]
    });
    
    this.results.recommendations = recommendations;
  }

  generateReport() {
    this.log('\n📊 GERANDO RELATÓRIO FINAL', 'info');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results.summary,
      tests: this.results.tests.map(t => ({
        name: t.name,
        success: t.success,
        duration: t.duration,
        issueCount: t.issues?.length || 0,
        criticalIssues: t.issues?.filter(i => i.type === 'critical').length || 0
      })),
      criticalIssues: this.results.issues,
      recommendations: this.results.recommendations,
      logFile: this.logFile
    };
    
    const reportFile = `debug-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    this.log(`\n🎯 RELATÓRIO FINAL SALVO: ${reportFile}`, 'success');
    this.log(`📋 Log detalhado salvo: ${this.logFile}`, 'info');
    
    return report;
  }

  printSummary() {
    this.log('\n' + '='.repeat(60), 'info');
    this.log('📊 RESUMO EXECUTIVO DA DEPURAÇÃO', 'info');
    this.log('='.repeat(60), 'info');
    
    this.log(`\n📈 ESTATÍSTICAS:`, 'info');
    this.log(`  Total de testes: ${this.results.summary.total}`, 'info');
    this.log(`  Testes aprovados: ${this.results.summary.passed}`, 'success');
    this.log(`  Testes falharam: ${this.results.summary.failed}`, this.results.summary.failed > 0 ? 'error' : 'info');
    this.log(`  Issues críticos: ${this.results.summary.critical}`, this.results.summary.critical > 0 ? 'critical' : 'info');
    
    if (this.results.issues.length > 0) {
      this.log(`\n🚨 PROBLEMAS CRÍTICOS ENCONTRADOS:`, 'critical');
      this.results.issues.forEach((issue, i) => {
        this.log(`  ${i + 1}. ${issue.message}`, 'critical');
      });
    }
    
    if (this.results.recommendations.length > 0) {
      this.log(`\n💡 RECOMENDAÇÕES PRIORITÁRIAS:`, 'info');
      this.results.recommendations
        .filter(r => r.priority === 'critical' || r.priority === 'high')
        .forEach((rec, i) => {
          this.log(`  ${i + 1}. ${rec.title}`, rec.priority === 'critical' ? 'critical' : 'warning');
          this.log(`     ${rec.description}`, 'info');
        });
    }
    
    this.log('\n' + '='.repeat(60), 'info');
  }

  async run() {
    this.log('🚀 INICIANDO SUITE COMPLETA DE DEPURAÇÃO', 'info');
    this.log('==========================================\n', 'info');
    
    const tests = [
      {
        name: 'Teste de Realidade das Ordens Demo',
        script: 'test-demo-mode-reality.js',
        description: 'Verifica se as ordens do modo demo são reais e funcionam corretamente'
      },
      {
        name: 'Teste de Operações Reais do Frontend',
        script: 'test-real-frontend-operations.js',
        description: 'Simula exatamente as operações que o usuário faz no frontend'
      },
      {
        name: 'Debug Profundo do Frontend',
        script: 'debug-deep-frontend-issue.js',
        description: 'Análise detalhada dos problemas reportados no frontend'
      }
    ];
    
    // Executar todos os testes
    for (const test of tests) {
      if (fs.existsSync(test.script)) {
        await this.runTest(test.name, test.script, test.description);
        
        // Pausa entre testes para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        this.log(`⚠️ Arquivo de teste não encontrado: ${test.script}`, 'warning');
      }
    }
    
    // Gerar recomendações baseadas nos resultados
    this.generateRecommendations();
    
    // Gerar relatório final
    const report = this.generateReport();
    
    // Imprimir resumo
    this.printSummary();
    
    return report;
  }
}

// Executar suite
const suite = new CompleteDebugSuite();
suite.run().then(report => {
  console.log('\n✅ Suite de depuração concluída!');
  console.log(`📊 Relatório: ${JSON.stringify(report.summary, null, 2)}`);
  process.exit(report.summary.failed > 0 ? 1 : 0);
}).catch(error => {
  console.error('❌ Erro fatal na suite de depuração:', error);
  process.exit(1);
});