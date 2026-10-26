"use client";

import React from "react";
import { useLab, MODULE_REGISTRY } from "@/context/LabContext";
import { Activity, Compass, Flame, GitCompare, Layers, TrendingUp, Clock, Zap, DollarSign, BarChart2, CheckSquare } from "lucide-react";

const MODULE_ICONS: Record<number, any> = {
  1: Activity,
  2: Clock,
  3: GitCompare,
  4: Layers,
  5: TrendingUp,
  6: Compass,
  7: Zap,
  8: DollarSign,
  9: BarChart2,
  10: CheckSquare,
};

export function Sidebar() {
  const { activeModule, setActiveModule } = useLab();

  return (
    <aside className="w-80 shrink-0 bg-[#07090E] border-r border-[#1E293B] flex flex-col h-[calc(100vh-53px)] sticky top-[53px] overflow-hidden">
      {/* Sidebar Header */}
      <div className="p-3 border-b border-[#1E293B] bg-[#090D16]/60">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono font-semibold tracking-wider text-slate-400 uppercase">
            RESEARCH MODULES (10)
          </span>
          <span className="text-[10px] font-mono text-cyan-400">
            Keys [1-9, 0]
          </span>
        </div>
      </div>

      {/* Module Scroll List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
        {MODULE_REGISTRY.map((mod) => {
          const isActive = activeModule === mod.id;
          const Icon = MODULE_ICONS[mod.id] || Activity;

          return (
            <button
              key={mod.id}
              onClick={() => setActiveModule(mod.id)}
              className={`w-full text-left p-3 rounded-xl transition-all duration-150 cursor-pointer relative overflow-hidden group ${
                isActive
                  ? "bg-[#0D111D] border border-cyan-500/40 shadow-md shadow-cyan-950/30"
                  : "bg-transparent hover:bg-[#0D111D]/60 border border-transparent hover:border-[#1E293B]"
              }`}
            >
              {/* Active Left Indicator Bar */}
              {isActive && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 shadow-[0_0_8px_#06b6d4]"
                  style={{ backgroundColor: mod.color }}
                />
              )}

              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-lg border text-xs font-mono transition-colors ${
                      isActive
                        ? "bg-cyan-950/80 text-cyan-300 border-cyan-500/40"
                        : "bg-[#111827] text-slate-400 border-[#1E293B] group-hover:text-slate-200"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono font-bold text-slate-400">
                        {mod.id}.
                      </span>
                      <span
                        className={`text-xs font-semibold tracking-tight transition-colors ${
                          isActive ? "text-white" : "text-slate-300 group-hover:text-white"
                        }`}
                      >
                        {mod.name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Keyboard Shortcut Badge */}
                <kbd
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                    isActive
                      ? "bg-cyan-950 text-cyan-300 border-cyan-700/50"
                      : "bg-[#111827] text-slate-500 border-[#1E293B]"
                  }`}
                >
                  {mod.shortcut}
                </kbd>
              </div>

              {/* Subtitle & Paper reference */}
              <div className="mt-1.5 pl-7">
                <p className="text-[11px] text-slate-400 line-clamp-1 font-mono">
                  {mod.subtitle}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[10px] font-mono text-cyan-400/90 font-medium">
                    {mod.paper}
                  </span>
                  <span className="text-[9px] font-mono px-1 rounded bg-[#111827] text-slate-400">
                    {mod.category}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sidebar Footer info */}
      <div className="p-3 border-t border-[#1E293B] bg-[#090D16]/80 text-[11px] font-mono text-slate-500 flex items-center justify-between">
        <span>BLOOMBERG-APPLE UI</span>
        <span className="text-cyan-400">EMPIRICAL ACCURACY 100%</span>
      </div>
    </aside>
  );
}
