"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  CrosshairMode,
  type CandlestickData,
  type IChartApi,
  type Time,
} from "lightweight-charts";

export function PriceChart({ data }: { data: CandlestickData<Time>[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { color: "transparent" },
        textColor: "#8a8073",
        fontFamily: "var(--font-plex-mono), monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1c1811" },
        horzLines: { color: "#1c1811" },
      },
      rightPriceScale: { borderColor: "#2a251d" },
      timeScale: { borderColor: "#2a251d", timeVisible: true },
      crosshair: { mode: CrosshairMode.Normal },
      autoSize: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#3ddc84",
      downColor: "#ff5c5c",
      borderVisible: false,
      wickUpColor: "#3ddc84",
      wickDownColor: "#ff5c5c",
    });

    series.setData(data);
    chart.timeScale().fitContent();
    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [data]);

  return <div ref={containerRef} className="h-full min-h-[320px] w-full" />;
}
