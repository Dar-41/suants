"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

export interface StatRow {
  metric: string;
  value: string | number;
  stat?: string;
  pValue?: number;
  significance?: string;
  interpretation?: string;
}

interface StatsTableProps {
  title?: string;
  rows: StatRow[];
}

export function StatsTable({ title, rows }: StatsTableProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = rows
      .map(
        (r) =>
          `${r.metric}\t${r.value}\t${r.stat ?? ""}\t${r.pValue ?? ""}\t${r.significance ?? ""}\t${r.interpretation ?? ""}`
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#0D111D] border border-[#1E293B] rounded-xl overflow-hidden shadow-md">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E293B] bg-[#090D16]/50">
        <span className="text-xs font-semibold font-mono text-slate-300 uppercase tracking-wider">
          {title || "Empirical Econometric Table"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono text-slate-400 hover:text-cyan-400 rounded bg-[#111827] hover:bg-[#1E293B] border border-[#1E293B] transition-colors cursor-pointer"
          title="Copy tab-delimited values"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy Data</span>
            </>
          )}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#1E293B] bg-[#111827]/40 text-slate-400 font-mono">
              <th className="py-2.5 px-4 font-semibold">ESTIMATOR / METRIC</th>
              <th className="py-2.5 px-4 font-semibold text-right">VALUE</th>
              <th className="py-2.5 px-4 font-semibold text-right">TEST STAT</th>
              <th className="py-2.5 px-4 font-semibold text-right">P-VALUE</th>
              <th className="py-2.5 px-4 font-semibold">SIGNIFICANCE</th>
              <th className="py-2.5 px-4 font-semibold">ECONOMETRIC INFERENCE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]/60 font-mono">
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-[#1E293B]/30 transition-colors">
                <td className="py-2.5 px-4 font-medium text-slate-200">{row.metric}</td>
                <td className="py-2.5 px-4 text-right font-bold text-cyan-400">{row.value}</td>
                <td className="py-2.5 px-4 text-right text-slate-400">{row.stat ?? "—"}</td>
                <td className="py-2.5 px-4 text-right text-slate-400">
                  {row.pValue !== undefined ? (row.pValue < 0.0001 ? "< 1e-4" : row.pValue.toFixed(4)) : "—"}
                </td>
                <td className="py-2.5 px-4">
                  {row.significance ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950/50 text-cyan-300 border border-cyan-800/40">
                      {row.significance}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2.5 px-4 text-slate-400 font-sans text-[11px]">{row.interpretation ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
