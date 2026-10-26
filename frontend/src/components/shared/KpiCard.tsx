"use client";

import React from "react";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  significance?: "critical" | "warning" | "neutral" | "pass";
  significanceLabel?: string;
  accentColor?: string; // hex or tailwind class
}

export function KpiCard({
  title,
  value,
  subtext,
  significance,
  significanceLabel,
  accentColor = "#06B6D4",
}: KpiCardProps) {
  const getBadgeStyle = () => {
    switch (significance) {
      case "pass":
        return "bg-emerald-950/70 text-emerald-400 border-emerald-500/40";
      case "critical":
        return "bg-rose-950/70 text-rose-400 border-rose-500/40";
      case "warning":
        return "bg-amber-950/70 text-amber-400 border-amber-500/40";
      default:
        return "bg-slate-800/60 text-slate-300 border-slate-700/50";
    }
  };

  return (
    <div className="relative group bg-[#0D111D]/80 backdrop-blur-md border border-[#1E293B] hover:border-cyan-500/40 rounded-xl p-4 transition-all duration-200 shadow-sm hover:shadow-cyan-950/20 overflow-hidden">
      {/* Top micro neon bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-60 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: accentColor }}
      />

      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider line-clamp-1">
          {title}
        </span>
        {significanceLabel && (
          <span
            className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${getBadgeStyle()}`}
          >
            {significanceLabel}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold font-mono tracking-tight text-white group-hover:text-cyan-300 transition-colors">
          {value}
        </span>
      </div>

      {subtext && (
        <p className="mt-1 text-[11px] font-mono text-slate-500 line-clamp-1">
          {subtext}
        </p>
      )}
    </div>
  );
}
