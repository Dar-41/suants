"use client";

import React, { useState, useEffect, useRef } from "react";
import { useLab, MODULE_REGISTRY } from "@/context/LabContext";
import { useData } from "@/context/DataContext";
import {
  Search,
  Layers,
  Database,
  Calculator,
  Upload,
  Activity,
  Sparkles,
  Save,
  ArrowRight,
  X
} from "lucide-react";

export function CommandPalette() {
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    setActiveModule,
    setIsCustomMetricOpen,
    setIsQualityModalOpen,
    setIsCsvModalOpen,
    setIsHero3DExpanded,
    exportSessionJson,
  } = useLab();

  const { loadPreset, loadSynthetic } = useData();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
      setQuery("");
    }
  }, [isCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  // Items to search through
  const moduleItems = MODULE_REGISTRY.map((m) => ({
    type: "MODULE",
    title: `Module ${m.id}: ${m.name}`,
    subtitle: `${m.paper} • ${m.subtitle}`,
    icon: Layers,
    action: () => {
      setActiveModule(m.id);
      setIsCommandPaletteOpen(false);
    },
  }));

  const actionItems = [
    {
      type: "DATASET",
      title: "Load Dataset: Synthetic GARCH + HMM + FFF",
      subtitle: "Deterministic benchmark with known ground truth parameters",
      icon: Database,
      action: () => {
        loadSynthetic(500);
        setIsCommandPaletteOpen(false);
      },
    },
    {
      type: "DATASET",
      title: "Load Dataset: S&P 500 ETF (SPY)",
      subtitle: "Live/historical US benchmark equity index data",
      icon: Database,
      action: () => {
        loadPreset("SPY");
        setIsCommandPaletteOpen(false);
      },
    },
    {
      type: "DATASET",
      title: "Load Dataset: Bitcoin Crypto (BTCUSDT)",
      subtitle: "Binance public 1-hour crypto klines",
      icon: Database,
      action: () => {
        loadPreset("BTCUSDT");
        setIsCommandPaletteOpen(false);
      },
    },
    {
      type: "DATASET",
      title: "Load Dataset: Gold Bullion (XAUUSD)",
      subtitle: "Historical physical gold spot price series",
      icon: Database,
      action: () => {
        loadPreset("XAUUSD");
        setIsCommandPaletteOpen(false);
      },
    },
    {
      type: "TOOL",
      title: "Open Custom Metric Calculator",
      subtitle: "Evaluate user-defined formulas on returns/prices safely",
      icon: Calculator,
      action: () => {
        setIsCustomMetricOpen(true);
        setIsCommandPaletteOpen(false);
      },
    },
    {
      type: "TOOL",
      title: "Inspect Data Quality Report",
      subtitle: "ADF stationarity, missing values, and 4-sigma outliers",
      icon: Activity,
      action: () => {
        setIsQualityModalOpen(true);
        setIsCommandPaletteOpen(false);
      },
    },
    {
      type: "TOOL",
      title: "Upload Custom CSV File",
      subtitle: "Ingest your own OHLCV, tick, or factor time series",
      icon: Upload,
      action: () => {
        setIsCsvModalOpen(true);
        setIsCommandPaletteOpen(false);
      },
    },
    {
      type: "ACTION",
      title: "Toggle 3D Mathematical Hero Manifold",
      subtitle: "Expand or collapse the Three.js parametric visualization",
      icon: Sparkles,
      action: () => {
        setIsHero3DExpanded(true);
        setIsCommandPaletteOpen(false);
      },
    },
    {
      type: "ACTION",
      title: "Save Lab Session to JSON",
      subtitle: "Serialize parameters and dataset configuration",
      icon: Save,
      action: () => {
        exportSessionJson();
        setIsCommandPaletteOpen(false);
      },
    },
  ];

  const allItems = [...moduleItems, ...actionItems];
  const filtered = allItems.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    } else if (e.key === "Escape") {
      setIsCommandPaletteOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/70 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-2xl bg-[#0D111D] border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#1E293B] bg-[#090D16]">
          <Search className="w-4 h-4 text-cyan-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a module (1-10), dataset name, or action..."
            className="flex-1 bg-transparent text-sm font-mono text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            onClick={() => setIsCommandPaletteOpen(false)}
            className="p-1 rounded text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-slate-500">
              No matching modules, datasets, or actions found.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-cyan-950/60 border border-cyan-500/40 text-white"
                      : "hover:bg-[#111827] text-slate-300 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg border text-xs ${
                        isSelected
                          ? "bg-cyan-900/60 text-cyan-300 border-cyan-500/50"
                          : "bg-[#090D16] text-slate-400 border-[#1E293B]"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">{item.title}</div>
                      <div className="text-[11px] font-mono text-slate-400 line-clamp-1">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0 mr-2" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-[#1E293B] bg-[#090D16] text-[10px] font-mono text-slate-400">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span className="text-cyan-400 font-semibold">QUANT RESEARCH LAB CMD</span>
        </div>
      </div>
    </div>
  );
}
