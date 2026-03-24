'use client';

import { useRef, useEffect } from 'react';
import { createChart, ColorType, AreaSeries, type IChartApi } from 'lightweight-charts';

interface PriceChartProps {
  data: { time: string; value: number }[];
  color: string;
}

export function PriceChart({ data, color }: PriceChartProps) {
  const chartContainer = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainer.current) return;

    chart.current = createChart(chartContainer.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      width: chartContainer.current.clientWidth,
      height: 320,
      rightPriceScale: {
        borderColor: '#374151',
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: false,
      },
      crosshair: {
        vertLine: { color: '#4b5563', labelBackgroundColor: '#374151' },
        horzLine: { color: '#4b5563', labelBackgroundColor: '#374151' },
      },
    });

    const areaSeries = chart.current.addSeries(AreaSeries, {
      lineColor: color,
      topColor: `${color}33`,
      bottomColor: `${color}05`,
      lineWidth: 2,
    });

    // Convert ISO dates to YYYY-MM-DD for lightweight-charts
    const chartData = data
      .map((d) => ({
        time: d.time.slice(0, 10),
        value: d.value,
      }))
      .sort((a, b) => a.time.localeCompare(b.time));

    // Deduplicate by date (keep last value per day)
    const deduped = new Map<string, number>();
    chartData.forEach((d) => deduped.set(d.time, d.value));
    const finalData = Array.from(deduped.entries()).map(([time, value]) => ({ time, value }));

    areaSeries.setData(finalData as { time: string; value: number }[]);
    chart.current.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainer.current && chart.current) {
        chart.current.applyOptions({ width: chartContainer.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.current?.remove();
      chart.current = null;
    };
  }, [data, color]);

  if (data.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 flex items-center justify-center h-80">
        <p className="text-gray-500 text-sm">No price data yet. Completed deals will populate this chart.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Price History</h2>
      <div ref={chartContainer} />
    </div>
  );
}
