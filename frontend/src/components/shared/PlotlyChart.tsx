"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { FileSpreadsheet, RefreshCw } from "lucide-react";

interface PlotlyChartProps {
  data: any[];
  layout?: any;
  config?: any;
  style?: React.CSSProperties;
  title?: string;
  is3D?: boolean;
  onExportCsv?: () => void;
}

// Global cached Plotly promise
let plotlyPromise: Promise<any> | null = null;
function getPlotlyInstance() {
  if (typeof window === "undefined") return null;
  if (!plotlyPromise) {
    plotlyPromise = import("plotly.js-dist-min").then((m) => m.default || m);
  }
  return plotlyPromise;
}

export function PlotlyChart({
  data,
  layout = {},
  config = {},
  style = { width: "100%", height: "420px" },
  title,
  is3D = false,
  onExportCsv,
}: PlotlyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRendered, setIsRendered] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const isRenderingRef = useRef(false);
  const isMountedRef = useRef(true);

  const renderPlot = useCallback(async () => {
    if (!containerRef.current || !data || data.length === 0) return;
    if (isRenderingRef.current) return;

    try {
      isRenderingRef.current = true;
      const Plotly = await getPlotlyInstance();
      if (!Plotly || !isMountedRef.current || !containerRef.current) return;

      const darkLayout: any = {
        autosize: true,
        paper_bgcolor: "#090D16",
        plot_bgcolor: "#090D16",
        font: {
          family: "var(--font-mono, 'JetBrains Mono', monospace)",
          size: 11,
          color: "#94A3B8",
        },
        margin: { l: 50, r: 25, t: title ? 40 : 25, b: 40 },
        xaxis: {
          gridcolor: "#1E293B",
          zerolinecolor: "#334155",
          tickfont: { size: 10, color: "#64748B" },
          ...layout.xaxis,
        },
        yaxis: {
          gridcolor: "#1E293B",
          zerolinecolor: "#334155",
          tickfont: { size: 10, color: "#64748B" },
          ...layout.yaxis,
        },
        legend: {
          font: { color: "#CBD5E1", size: 10 },
          bgcolor: "rgba(13, 17, 29, 0.7)",
          bordercolor: "#1E293B",
          borderwidth: 1,
          ...layout.legend,
        },
        ...layout,
      };

      if (title) {
        darkLayout.title = {
          text: title,
          font: { family: "Inter, sans-serif", size: 13, color: "#F8FAFC" },
          x: 0.02,
          y: 0.98,
        };
      }

      // CRITICAL FIX: Only set scene when 3D is active, and NEVER leave scene: undefined
      // which triggers Plotly's e[s].annotations error in 2D charts
      if (is3D) {
        darkLayout.scene = {
          xaxis: {
            gridcolor: "#1E293B",
            backgroundcolor: "#090D16",
            tickfont: { size: 9, color: "#64748B" },
          },
          yaxis: {
            gridcolor: "#1E293B",
            backgroundcolor: "#090D16",
            tickfont: { size: 9, color: "#64748B" },
          },
          zaxis: {
            gridcolor: "#1E293B",
            backgroundcolor: "#090D16",
            tickfont: { size: 9, color: "#64748B" },
          },
          camera: { eye: { x: 1.6, y: -1.6, z: 1.2 } },
          ...layout.scene,
        };
      } else {
        delete darkLayout.scene;
      }

      const defaultConfig = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        modeBarButtonsToRemove: ["lasso2d", "select2d"],
        toImageButtonOptions: {
          format: "png",
          filename: `qrl_${title ? title.toLowerCase().replace(/\s+/g, "_") : "chart"}`,
          height: 700,
          width: 1100,
          scale: 2,
        },
        ...config,
      };

      // Safely use Plotly.react if initialized, else Plotly.newPlot
      const el = containerRef.current;
      if ((el as any)._fullLayout) {
        await Plotly.react(el, data, darkLayout, defaultConfig);
      } else {
        await Plotly.newPlot(el, data, darkLayout, defaultConfig);
      }

      if (isMountedRef.current) {
        setIsRendered(true);
        setRenderError(null);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        console.warn("Plotly chart render caught:", err?.message || err);
        setRenderError(err?.message || "Chart initialization error");
      }
    } finally {
      isRenderingRef.current = false;
    }
  }, [data, layout, config, title, is3D]);

  useEffect(() => {
    isMountedRef.current = true;

    const timer = setTimeout(() => {
      renderPlot();
    }, 40);

    const handleResize = () => {
      if (!containerRef.current) return;
      getPlotlyInstance()?.then((Plotly) => {
        try {
          if (containerRef.current && (containerRef.current as any)._fullLayout) {
            Plotly.Plots.resize(containerRef.current);
          }
        } catch {
          // ignore resize errors
        }
      });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);

      const el = containerRef.current;
      if (el && (el as any)._fullLayout) {
        getPlotlyInstance()?.then((Plotly) => {
          try {
            Plotly.purge(el);
          } catch {
            // ignore purge errors
          }
        });
      }
    };
  }, [renderPlot]);

  const handleExportCsv = () => {
    if (onExportCsv) {
      onExportCsv();
      return;
    }
    let csvContent = "data:text/csv;charset=utf-8,";
    if (data && data.length > 0) {
      const headers = ["Series", "X", "Y"];
      csvContent += headers.join(",") + "\r\n";
      data.forEach((trace: any) => {
        const traceName = trace.name || "Trace";
        const xArr = trace.x || [];
        const yArr = trace.y || [];
        for (let i = 0; i < Math.max(xArr.length, yArr.length); i++) {
          csvContent += `"${traceName}","${xArr[i] ?? ""}","${yArr[i] ?? ""}"\r\n`;
        }
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${title ? title.toLowerCase().replace(/\s+/g, "_") : "data"}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="relative group w-full bg-[#090D16] border border-[#1E293B] rounded-xl overflow-hidden shadow-lg p-2 min-h-[350px]">
      {/* Quick Toolbar */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
        {is3D && (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-violet-950/80 text-violet-400 border border-violet-500/40">
            3D SURFACE
          </span>
        )}
        <button
          onClick={handleExportCsv}
          className="p-1.5 rounded-md bg-[#111827] hover:bg-[#1E293B] text-slate-400 hover:text-cyan-400 border border-[#1E293B] transition-colors cursor-pointer"
          title="Download Chart Data as CSV"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
        </button>
      </div>

      {!isRendered && !renderError && (
        <div className="flex items-center justify-center w-full h-80 bg-[#090D16]/40 animate-pulse">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono text-slate-400">Rendering Visualization...</span>
          </div>
        </div>
      )}

      {renderError && !isRendered && (
        <div className="flex flex-col items-center justify-center w-full h-80 gap-3 text-xs font-mono text-slate-400">
          <span>Visualization: {renderError}</span>
          <button
            onClick={() => renderPlot()}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#111827] hover:bg-[#1E293B] text-cyan-400 border border-cyan-500/30 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry Chart</span>
          </button>
        </div>
      )}

      <div ref={containerRef} style={style} className="w-full" />
    </div>
  );
}
