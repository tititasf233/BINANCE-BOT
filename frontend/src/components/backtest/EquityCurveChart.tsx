import React, { useRef, useEffect } from 'react';
import { BacktestResult } from './BacktestPage';

interface EquityCurveChartProps {
  result: BacktestResult;
}

export const EquityCurveChart: React.FC<EquityCurveChartProps> = ({ result }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate mock equity curve data
  const generateEquityCurve = () => {
    const points = 100;
    const data = [];
    let equity = 10000; // Initial capital
    const finalEquity = 10000 + result.totalReturn;
    const volatility = 0.02;

    for (let i = 0; i <= points; i++) {
      const progress = i / points;
      const trend = (finalEquity - 10000) * progress;
      const noise = (Math.random() - 0.5) * volatility * equity;
      equity = 10000 + trend + noise;
      
      data.push({
        date: new Date(2023, 0, 1 + (i * 365 / points)),
        equity: Math.max(equity, 0),
      });
    }

    return data;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = generateEquityCurve();
    
    const drawChart = () => {
      const { width, height } = canvas;
      const padding = 60;
      const chartWidth = width - 2 * padding;
      const chartHeight = height - 2 * padding;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Draw background
      ctx.fillStyle = '#f9fafb';
      ctx.fillRect(0, 0, width, height);

      // Calculate min/max values
      const minEquity = Math.min(...data.map(d => d.equity));
      const maxEquity = Math.max(...data.map(d => d.equity));
      const equityRange = maxEquity - minEquity;

      // Draw grid lines
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;

      // Horizontal grid lines
      for (let i = 0; i <= 5; i++) {
        const y = padding + (i * chartHeight) / 5;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
      }

      // Vertical grid lines
      for (let i = 0; i <= 10; i++) {
        const x = padding + (i * chartWidth) / 10;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - padding);
        ctx.stroke();
      }

      // Draw equity curve
      ctx.strokeStyle = result.totalReturn >= 0 ? '#10b981' : '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath();

      data.forEach((point, index) => {
        const x = padding + (index * chartWidth) / (data.length - 1);
        const y = height - padding - ((point.equity - minEquity) / equityRange) * chartHeight;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // Fill area under curve
      ctx.fillStyle = result.totalReturn >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
      ctx.beginPath();
      
      data.forEach((point, index) => {
        const x = padding + (index * chartWidth) / (data.length - 1);
        const y = height - padding - ((point.equity - minEquity) / equityRange) * chartHeight;
        
        if (index === 0) {
          ctx.moveTo(x, height - padding);
          ctx.lineTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.lineTo(width - padding, height - padding);
      ctx.closePath();
      ctx.fill();

      // Draw baseline (initial capital)
      const baselineY = height - padding - ((10000 - minEquity) / equityRange) * chartHeight;
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding, baselineY);
      ctx.lineTo(width - padding, baselineY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw labels
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';

      // X-axis labels (months)
      const months = ['Jan', 'Mar', 'Mai', 'Jul', 'Set', 'Nov'];
      months.forEach((month, index) => {
        const x = padding + (index * chartWidth) / (months.length - 1);
        ctx.fillText(month, x, height - 10);
      });

      // Y-axis labels (equity values)
      ctx.textAlign = 'right';
      for (let i = 0; i <= 5; i++) {
        const value = minEquity + (i * equityRange) / 5;
        const y = height - padding - (i * chartHeight) / 5;
        ctx.fillText(`$${(value / 1000).toFixed(1)}k`, padding - 10, y + 4);
      }

      // Draw title
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Curva de Equity', width / 2, 30);

      // Draw legend
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      
      // Equity line
      ctx.fillStyle = result.totalReturn >= 0 ? '#10b981' : '#ef4444';
      ctx.fillRect(padding, height - 30, 15, 3);
      ctx.fillStyle = '#374151';
      ctx.fillText('Equity', padding + 20, height - 25);
      
      // Baseline
      ctx.strokeStyle = '#6b7280';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding + 80, height - 28);
      ctx.lineTo(padding + 95, height - 28);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillText('Capital Inicial', padding + 100, height - 25);
    };

    // Set canvas size
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    drawChart();

    // Redraw on resize
    const handleResize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      drawChart();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [result]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">
          Curva de Equity
        </h3>
        <div className="flex space-x-4 text-sm">
          <div className="flex items-center">
            <div className="w-4 h-1 bg-green-500 mr-2"></div>
            <span className="text-gray-600">Performance</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-1 border-b border-dashed border-gray-400 mr-2"></div>
            <span className="text-gray-600">Capital Inicial</span>
          </div>
        </div>
      </div>
      
      <div className="relative h-96 bg-white border border-gray-200 rounded-lg">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Chart Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="font-semibold text-gray-900">$10,000</div>
          <div className="text-gray-500">Capital Inicial</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className={`font-semibold ${result.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${(10000 + result.totalReturn).toLocaleString()}
          </div>
          <div className="text-gray-500">Capital Final</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className={`font-semibold ${result.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {result.totalReturn >= 0 ? '+' : ''}${result.totalReturn.toLocaleString()}
          </div>
          <div className="text-gray-500">Lucro/Prejuízo</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className={`font-semibold ${result.totalReturnPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {result.totalReturnPercent >= 0 ? '+' : ''}{result.totalReturnPercent.toFixed(2)}%
          </div>
          <div className="text-gray-500">Retorno %</div>
        </div>
      </div>
    </div>
  );
};