// Gráfico simples usando Canvas - sem dependências externas
import React, { useEffect, useRef } from 'react';

interface DataPoint {
  time: string;
  value: number;
  price?: number;
}

interface SimpleChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  type?: 'line' | 'area';
  showGrid?: boolean;
}

export const SimpleChart: React.FC<SimpleChartProps> = ({
  data,
  width = 400,
  height = 200,
  color = '#10b981',
  type = 'line',
  showGrid = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Setup
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Find min/max values
    const values = data.map(d => d.value || d.price || 0);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 0.5;
      
      // Horizontal lines
      for (let i = 0; i <= 4; i++) {
        const y = padding + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
      }

      // Vertical lines
      for (let i = 0; i <= 4; i++) {
        const x = padding + (chartWidth / 4) * i;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - padding);
        ctx.stroke();
      }
    }

    // Draw chart
    if (data.length > 1) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      // Calculate points
      const points = data.map((point, index) => {
        const x = padding + (chartWidth / (data.length - 1)) * index;
        const y = padding + chartHeight - ((point.value || point.price || 0) - minValue) / valueRange * chartHeight;
        return { x, y };
      });

      // Draw area fill if type is area
      if (type === 'area') {
        ctx.fillStyle = color + '20'; // Add transparency
        ctx.beginPath();
        ctx.moveTo(points[0].x, height - padding);
        points.forEach(point => ctx.lineTo(point.x, point.y));
        ctx.lineTo(points[points.length - 1].x, height - padding);
        ctx.closePath();
        ctx.fill();
      }

      // Draw line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.forEach(point => ctx.lineTo(point.x, point.y));
      ctx.stroke();

      // Draw points
      ctx.fillStyle = color;
      points.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Draw labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';

    // Y-axis labels
    for (let i = 0; i <= 4; i++) {
      const value = minValue + (valueRange / 4) * (4 - i);
      const y = padding + (chartHeight / 4) * i;
      ctx.textAlign = 'right';
      ctx.fillText(value.toFixed(2), padding - 10, y + 4);
    }

    // X-axis labels
    if (data.length > 0) {
      ctx.textAlign = 'center';
      const step = Math.max(1, Math.floor(data.length / 4));
      for (let i = 0; i < data.length; i += step) {
        const x = padding + (chartWidth / (data.length - 1)) * i;
        const time = data[i].time;
        ctx.fillText(time, x, height - 10);
      }
    }

  }, [data, width, height, color, type, showGrid]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="border border-gray-700 rounded-lg bg-gray-900"
    />
  );
};

// Componente de gráfico responsivo
export const ResponsiveChart: React.FC<Omit<SimpleChartProps, 'width' | 'height'>> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 400, height: 200 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        setDimensions({ width: width - 20, height: 200 });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      <SimpleChart {...props} width={dimensions.width} height={dimensions.height} />
    </div>
  );
};