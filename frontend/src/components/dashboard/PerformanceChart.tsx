import React, { useRef, useEffect } from 'react';

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    fill: boolean;
  }[];
}

export const PerformanceChart: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mock data - will be replaced with real data
  const chartData: ChartData = {
    labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
    datasets: [
      {
        label: 'Portfolio Value',
        data: [100000, 105000, 102000, 108000, 115000, 125000],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
      },
    ],
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Simple canvas chart implementation
    const drawChart = () => {
      const { width, height } = canvas;
      const padding = 40;
      const chartWidth = width - 2 * padding;
      const chartHeight = height - 2 * padding;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Draw background
      ctx.fillStyle = '#f9fafb';
      ctx.fillRect(0, 0, width, height);

      // Draw grid lines
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;

      // Vertical grid lines
      for (let i = 0; i <= 5; i++) {
        const x = padding + (i * chartWidth) / 5;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - padding);
        ctx.stroke();
      }

      // Horizontal grid lines
      for (let i = 0; i <= 4; i++) {
        const y = padding + (i * chartHeight) / 4;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
      }

      // Draw data line
      const data = chartData.datasets[0].data;
      const minValue = Math.min(...data);
      const maxValue = Math.max(...data);
      const valueRange = maxValue - minValue;

      ctx.strokeStyle = chartData.datasets[0].borderColor;
      ctx.lineWidth = 3;
      ctx.beginPath();

      data.forEach((value, index) => {
        const x = padding + (index * chartWidth) / (data.length - 1);
        const y = height - padding - ((value - minValue) / valueRange) * chartHeight;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // Draw data points
      ctx.fillStyle = chartData.datasets[0].borderColor;
      data.forEach((value, index) => {
        const x = padding + (index * chartWidth) / (data.length - 1);
        const y = height - padding - ((value - minValue) / valueRange) * chartHeight;
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      // Draw labels
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';

      chartData.labels.forEach((label, index) => {
        const x = padding + (index * chartWidth) / (chartData.labels.length - 1);
        ctx.fillText(label, x, height - 10);
      });

      // Draw values on y-axis
      ctx.textAlign = 'right';
      for (let i = 0; i <= 4; i++) {
        const value = minValue + (i * valueRange) / 4;
        const y = height - padding - (i * chartHeight) / 4;
        ctx.fillText(`$${(value / 1000).toFixed(0)}k`, padding - 10, y + 4);
      }
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
  }, []);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Performance do Portfolio
        </h3>
        <div className="flex space-x-2">
          <button className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md">
            6M
          </button>
          <button className="px-3 py-1 text-sm text-gray-500 hover:bg-gray-100 rounded-md">
            1A
          </button>
          <button className="px-3 py-1 text-sm text-gray-500 hover:bg-gray-100 rounded-md">
            Tudo
          </button>
        </div>
      </div>
      
      <div className="relative h-64">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      <div className="mt-4 flex justify-center">
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
            <span>Valor do Portfolio</span>
          </div>
        </div>
      </div>
    </div>
  );
};