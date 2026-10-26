"use client";

import React, { useState } from "react";
import { useLab } from "@/context/LabContext";
import { useData } from "@/context/DataContext";
import { runCustomMetric } from "@/lib/api";
import { CustomMetricResult } from "@/lib/types";
import { X, Calculator, Play, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

const DEMO_EXPRESSIONS = [
  { label: "Annualized Sharpe", expr: "mean(returns) / std(returns) * sqrt(252)" },
  { label: "Return Skewness", expr: "skew(returns)" },
  { label: "Pearson Kurtosis", expr: "kurtosis(returns)" },
  { label: "Realized Daily Volatility (bps)", expr: "std(returns) * 10000" },
  { label: "Tail Ratio (95% vs 5%)", expr: "abs(percentile(returns, 95)) / abs(percentile(returns, 5))" },
];

export function CustomMetricModal() {
  const { isCustomMetricOpen, setIsCustomMetricOpen } = useLab();
  const { records } = useData();
  const [expression, setExpression] = useState("mean(returns) / std(returns) * sqrt(252)");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<CustomMetricResult | null>(null);

  if (!isCustomMetricOpen) return null;

  const handleRun = async (exprToRun?: string) => {
    const code = exprToRun || expression;
    setIsRunning(true);
    setResult(null);
    try {
      const res = await runCustomMetric(code, records);
      setResult(res);
    } catch (err: any) {
      setResult({
        success: false,
        formula: code,
        error: err.message || "Failed to execute metric",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-[#0D111D] border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E293B] bg-[#090D16]">
          <div className="flex items-center gap-2.5">
            <Calculator className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
                Custom Quantitative Metric Sandbox
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Safe AST Execution Environment (returns, prices, volume, mean, std, skew, math, np)
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsCustomMetricOpen(false)}
            className="p-1 rounded text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Quick Preset Buttons */}
          <div>
            <div className="text-[11px] font-mono text-slate-400 mb-2">QUICK PRESETS:</div>
            <div className="flex flex-wrap gap-2">
              {DEMO_EXPRESSIONS.map((d, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setExpression(d.expr);
                    handleRun(d.expr);
                  }}
                  className="px-2.5 py-1 rounded bg-[#111827] hover:bg-[#1E293B] border border-[#1E293B] text-[11px] font-mono text-cyan-300 hover:border-cyan-500/40 transition-colors cursor-pointer"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Code Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
              <span>Python / Quantitative Expression:</span>
              <span className="text-[10px] text-slate-500">Available: returns, prices, volume, n</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRun()}
                placeholder="e.g. mean(abs(returns)) / std(returns)"
                className="w-full px-4 py-3 rounded-xl bg-[#090D16] border border-[#1E293B] text-sm font-mono text-cyan-300 focus:outline-none focus:border-cyan-500/60 shadow-inner"
              />
            </div>
          </div>

          {/* Results Box */}
          {result && (
            <div
              className={`p-4 rounded-xl border ${
                result.success
                  ? "bg-[#090D16] border-cyan-500/30"
                  : "bg-rose-950/40 border-rose-500/40 text-rose-300"
              }`}
            >
              {result.success ? (
                <div className="space-y-3 font-mono">
                  <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
                    <span className="text-xs text-slate-400">ESTIMATED VALUE:</span>
                    <span className="text-xl font-bold text-cyan-400">{result.value}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 rounded bg-[#111827] border border-[#1E293B]">
                      <div className="text-[10px] text-slate-500">SAMPLE SIZE</div>
                      <div className="font-semibold text-slate-200">N = {result.sample_size}</div>
                    </div>
                    <div className="p-2 rounded bg-[#111827] border border-[#1E293B]">
                      <div className="text-[10px] text-slate-500">T-STATISTIC</div>
                      <div className="font-semibold text-slate-200">{result.t_statistic ?? "—"}</div>
                    </div>
                    <div className="p-2 rounded bg-[#111827] border border-[#1E293B]">
                      <div className="text-[10px] text-slate-500">P-VALUE</div>
                      <div className="font-semibold text-slate-200">
                        {result.p_value !== undefined ? result.p_value.toFixed(4) : "—"}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-[#111827] border border-[#1E293B]">
                      <div className="text-[10px] text-slate-500">SIGNIFICANCE</div>
                      <div
                        className={`font-semibold ${
                          result.is_statistically_significant ? "text-emerald-400" : "text-slate-400"
                        }`}
                      >
                        {result.is_statistically_significant ? "p < 0.05 ***" : "Not Sig"}
                      </div>
                    </div>
                  </div>

                  {result.verdict && (
                    <div className="p-2.5 rounded bg-cyan-950/40 border border-cyan-800/40 text-xs text-cyan-300 font-sans">
                      {result.verdict}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-start gap-2 text-xs font-mono">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <div>
                    <div className="font-bold">Execution Error:</div>
                    <div>{result.error}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#1E293B] bg-[#090D16] flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-500">
            AST sandboxed: strictly blocks os/sys/subprocess/eval
          </span>
          <button
            onClick={() => handleRun()}
            disabled={isRunning || !expression.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-mono font-medium bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{isRunning ? "Evaluating..." : "Run Expression"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
