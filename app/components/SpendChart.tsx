'use client';

import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface SpendChartProps {
  data: { date: string; spend: number; kpi_value: number }[];
  currency: string;
  kpiName: string;
}

export default function SpendChart({ data, currency, kpiName }: SpendChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !data.length) return;

    if (chartRef.current) chartRef.current.destroy();

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const labels = data.map(d => {
      const s = d.date;
      if (s.includes('-') || s.includes('/')) {
        try {
          const dt = new Date(s);
          return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch { return s; }
      }
      return s;
    });

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: `Spend (${currency})`,
            data: data.map(d => d.spend),
            backgroundColor: 'rgba(244, 129, 32, 0.3)',
            borderColor: 'rgba(244, 129, 32, 0.8)',
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y',
            order: 2,
          },
          {
            type: 'line',
            label: kpiName,
            data: data.map(d => d.kpi_value),
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 5,
            fill: true,
            tension: 0.3,
            yAxisID: 'y1',
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { usePointStyle: true, padding: 16, font: { size: 12, family: 'Inter' } },
          },
          tooltip: {
            backgroundColor: '#1A1A2E',
            titleFont: { family: 'Inter', size: 12 },
            bodyFont: { family: 'Inter', size: 12 },
            padding: 12,
            cornerRadius: 8,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 10, family: 'Inter' }, maxRotation: 45, color: '#9CA3AF' },
          },
          y: {
            position: 'left',
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: { font: { size: 11, family: 'Inter' }, color: '#9CA3AF', callback: (v) => `${currency}${Number(v).toLocaleString()}` },
          },
          y1: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { font: { size: 11, family: 'Inter' }, color: '#3B82F6' },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); };
  }, [data, currency, kpiName]);

  return <canvas ref={canvasRef} />;
}
