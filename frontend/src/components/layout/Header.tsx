"use client";

import React from "react";
import { useData } from "@/context/DataContext";
import { useLab } from "@/context/LabContext";
import {
  Database,
  Upload,
  Calculator,
  Search,
  Save,
  FolderOpen,
  Activity,
  Layers,
  Sparkles,
  RefreshCw
} from "lucide-react";

const DATASET_PRESETS = [
  { type: "sample", id: "sp500_daily.csv", label: "Sample S&P 500 Daily" },
  { type: "sample", id: "crypto_intraday_hourly.csv", label: "Sample Crypto 1H" },
  { type: "synthetic", id: "SYNTHETIC", label: "Synthetic (GARCH+HMM+FFF)" },
  { type: "preset", id: "SPY", label: "S&P 500 ETF (SPY Live)" },
  { type: "preset", id: "AAPL", label: "Apple Inc. (AAPL)" },
  { type: "preset", id: "NVDA", label: "NVIDIA Corp. (NVDA)" },
  { type: "preset", id: "BTCUSDT", label: "Bitcoin Crypto (BTCUSDT)" },
  { type: "preset", id: "XAUUSD", label: "Gold Bullion (XAUUSD)" },
];

export function Header() {
  const {
    datasetName,
    loadPreset,
    loadSynthetic,
    loadSampleFile,
    quality,
    isLoading,
    isBackendConnected,
    refreshBackendStatus,
  } = useData();

  const {
    setIsCommandPaletteOpen,
    setIsCustomMetricOpen,
    setIsQualityModalOpen,
    setIsCsvModalOpen,
    exportSessionJson,
    importSessionJson,
  } = useLab();

  const handleSelectPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = DATASET_PRESETS.find((p) => p.id === e.target.value);
    if (!selected) return;

    if (selected.type === "sample") {
      loadSampleFile(selected.id);
    } else if (selected.type === "synthetic") {
      loadSynthetic(400);
    } else {
      loadPreset(selected.id);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        importSessionJson(text);
      };
      reader.readAsText(file);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#07090E]/95 backdrop-blur-md border-b border-[#1E293B] px-5 py-2.5">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 via-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-cyan-950/50">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white font-mono">
                  QUANT RESEARCH LAB
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/40">
                  v2.0
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                Institutional Econometrics & Alpha Terminal
              </p>
            </div>
          </div>

          {/* Backend Status indicator */}
          <button
            onClick={() => refreshBackendStatus()}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0D111D] hover:bg-[#1E293B] border border-[#1E293B] text-[11px] font-mono transition-colors cursor-pointer"
            title="Click to check backend connectivity"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isBackendConnected
                  ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                  : "bg-amber-400 animate-ping"
              }`}
            />
            <span className="text-slate-300">
              {isBackendConnected ? "Core Engine Live" : "Core Connecting..."}
            </span>
          </button>
        </div>

        {/* Center: Global Shared Dataset Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Preset Selector */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0D111D] border border-[#1E293B]">
            <Database className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <select
              onChange={handleSelectPreset}
              disabled={isLoading}
              className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none cursor-pointer max-w-[200px]"
            >
              {DATASET_PRESETS.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#0D111D] text-slate-200">
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Load Sample Data Button */}
          <button
            onClick={() => loadSampleFile("sp500_daily.csv")}
            className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 text-xs font-mono transition-colors cursor-pointer"
            title="Load Pre-bundled S&P 500 Daily Dataset"
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Load Sample Data</span>
          </button>

          {/* Upload CSV trigger */}
          <button
            onClick={() => setIsCsvModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D111D] hover:bg-[#1E293B] text-slate-300 hover:text-white border border-[#1E293B] text-xs font-mono transition-colors cursor-pointer"
            title="Upload CSV dataset"
          >
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Upload CSV</span>
          </button>

          {/* Data Quality Report Trigger */}
          {quality && (
            <button
              onClick={() => setIsQualityModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0D111D] hover:bg-[#1E293B] border border-[#1E293B] text-xs font-mono transition-colors cursor-pointer"
              title="View Data Quality Diagnostics"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">{quality.n_samples} Bars</span>
            </button>
          )}
        </div>

        {/* Right: Quick Tools & Command Palette */}
        <div className="flex items-center gap-2">
          {/* Custom Metric AST Calculator */}
          <button
            onClick={() => setIsCustomMetricOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D111D] hover:bg-[#1E293B] text-cyan-400 border border-cyan-500/30 text-xs font-mono transition-colors cursor-pointer"
            title="Custom Quantitative Metric Calculator"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Custom Metric</span>
          </button>

          {/* Save / Load Session */}
          <button
            onClick={exportSessionJson}
            className="p-2 rounded-lg bg-[#0D111D] hover:bg-[#1E293B] text-slate-400 hover:text-white border border-[#1E293B] transition-colors cursor-pointer"
            title="Export Lab Session JSON"
          >
            <Save className="w-3.5 h-3.5" />
          </button>

          <label
            className="p-2 rounded-lg bg-[#0D111D] hover:bg-[#1E293B] text-slate-400 hover:text-white border border-[#1E293B] transition-colors cursor-pointer"
            title="Load Saved Session JSON"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>

          {/* Command Palette Trigger */}
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111827] hover:bg-[#1E293B] text-slate-400 hover:text-slate-200 border border-[#1E293B] text-xs font-mono transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Search Lab</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[#090D16] text-[10px] text-slate-400 border border-[#1E293B]">
              ⌘K
            </kbd>
          </button>
        </div>
      </div>
    </header>
  );
}
