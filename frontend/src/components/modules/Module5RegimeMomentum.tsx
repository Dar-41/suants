"use client";

import React, { useState, useEffect } from "react";
import { useData } from "@/context/DataContext";
import { runModule5 } from "@/lib/api";
import { Module5Result } from "@/lib/types";
import { ModuleWrapper } from "@/components/shared/ModuleWrapper";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatsTable, StatRow } from "@/components/shared/StatsTable";
import { PlotlyChart } from "@/components/shared/PlotlyChart";

export function Module5RegimeMomentum() {
  const { returns, records } = useData();
  const [nRegimes, setNRegimes] = useState(3);
  const [lookbackMom, setLookbackMom] = useState(21);
  const [holdingMom, setHoldingMom] = useState(5);
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<Module5Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chartView, setChartView] = useState<"2D" | "3D">("2D");

  const compute = async () => {
    if (returns.length < 60) return;
    setIsCalculating(true);
    setError(null);
    try {
      const res = await runModule5(returns, nRegimes, lookbackMom, holdingMom);
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to calculate regime momentum");
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    compute();
  }, [returns.length, nRegimes, lookbackMom, holdingMom]);

  if (!result) {
    return (
      <div className="flex items-center justify-center p-16 bg-[#0D111D] border border-[#1E293B] rounded-2xl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-400">
            {error || "Estimating Gaussian HMM & Momentum Crash Dynamics..."}
          </span>
        </div>
      </div>
    );
  }

  const { kpis, flags, regime_stats, transition_matrix, regime_timeline, cumulative_curves, surface_3d, verdict } = result;

  const steps = records.slice(0, cumulative_curves.momentum.length).map((r) => r.timestamp);

  // 2D Chart 1: Cumulative Momentum vs Market Benchmark
  const traceMom = {
    x: steps,
    y: cumulative_curves.momentum,
    type: "scatter",
    mode: "lines",
    name: "Momentum Strategy (WML)",
    line: { color: "#EC4899", width: 2 },
  };

  const traceMkt = {
    x: steps,
    y: cumulative_curves.market_benchmark,
    type: "scatter",
    mode: "lines",
    name: "Market Benchmark",
    line: { color: "#64748B", width: 1.5, dash: "dot" },
  };

  // 2D Chart 2: Regime Timeline
  const traceRegimes = {
    x: steps,
    y: regime_timeline,
    type: "scatter",
    mode: "lines",
    name: "HMM Regime State",
    line: { color: "#8B5CF6", width: 1.5, shape: "hv" },
  };

  // 2D Chart 3: Transition Matrix Heatmap
  const traceTransition = {
    x: transition_matrix.labels,
    y: transition_matrix.labels,
    z: transition_matrix.matrix,
    type: "heatmap",
    colorscale: "Viridis",
  };

  // 3D Chart: Lookback x Holding x Bull/Bear Sharpe
  const trace3DBull = {
    x: surface_3d.x_lookbacks,
    y: surface_3d.y_holdings,
    z: surface_3d.z_bull,
    type: "surface",
    colorscale: "Viridis",
    name: "Bull Regime Sharpe",
  };

  const statsRows: StatRow[] = [
    {
      metric: "Bull Regime Sharpe",
      value: kpis.bull_regime_sharpe.toFixed(2),
      stat: "Annualized",
      significance: kpis.bull_regime_sharpe > 1.0 ? "High Performance" : "Modest",
      interpretation: "Smooth trend persistence in low-volatility expansions.",
    },
    {
      metric: "Bear Regime Sharpe",
      value: kpis.bear_regime_sharpe.toFixed(2),
      stat: "Annualized",
      significance: kpis.bear_regime_sharpe < 0 ? "Momentum Crash Risk" : "Stable",
      interpretation: "Severe underperformance due to short squeezes during relief rallies.",
    },
    {
      metric: "Momentum Crashes Detected",
      value: kpis.momentum_crashes_detected,
      stat: "Daniel & Moskowitz events",
      significance: flags.has_momentum_crash_risk ? "Crash Prone" : "Low Crash Risk",
      interpretation: "Past losers soar faster than past winners during panic rebounds.",
    },
    {
      metric: "Overall Strategy Sharpe",
      value: kpis.overall_sharpe.toFixed(2),
      stat: `Return: ${kpis.overall_return_pct}%`,
      significance: "Full Sample",
      interpretation: `Unconditional strategy Sharpe across entire observation window.`,
    },
  ];

  return (
    <ModuleWrapper
      moduleId={5}
      verdictText={verdict}
      onRecalculate={compute}
      isCalculating={isCalculating}
      kpisMap={kpis}
      paramsMap={{ nRegimes, lookbackMom, holdingMom }}
      overviewContent={
        <div className="space-y-4 text-xs font-mono text-slate-300">
          <div className="p-4 rounded-lg bg-[#090D16] border border-[#1E293B]">
            <h3 className="text-sm font-bold text-cyan-400 font-sans mb-2">
              Theoretical Foundation: Daniel & Moskowitz (2016) Momentum Crashes
            </h3>
            <p className="leading-relaxed">
              In <em>"Momentum Crashes"</em> (Journal of Financial Economics), Kent Daniel and Tobias Moskowitz uncovered the darker side of momentum: while momentum generates positive alpha in normal bull markets, it experiences catastrophic left-tail losses (crashes) in high-volatility bear markets during sudden market rebounds.
            </p>
            <p className="mt-2 text-slate-300">
              When the market rebounds sharply after a bear market, beaten-down past "losers" (high-beta distressed stocks) skyrocket upward in a violent short squeeze, while past "winners" lag behind. Because momentum is short the losers and long the winners, the strategy suffers massive drawdowns.
            </p>
          </div>
        </div>
      }
      controlsContent={
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-mono text-slate-300 font-semibold">
              HMM Regime Components:
            </label>
            <select
              value={nRegimes}
              onChange={(e) => setNRegimes(parseInt(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-[#090D16] border border-[#1E293B] text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
            >
              <option value={2}>2 Regimes (Bear / Bull)</option>
              <option value={3}>3 Regimes (Bear / Turbulent / Bull)</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300 font-semibold">Momentum Lookback:</label>
              <span className="text-cyan-400 font-bold">{lookbackMom} Bars</span>
            </div>
            <input
              type="range"
              min={5}
              max={60}
              step={5}
              value={lookbackMom}
              onChange={(e) => setLookbackMom(parseInt(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300 font-semibold">Holding / Rebalance:</label>
              <span className="text-cyan-400 font-bold">{holdingMom} Bars</span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={holdingMom}
              onChange={(e) => setHoldingMom(parseInt(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>
      }
      kpisContent={
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <KpiCard
              title="Bull Regime Sharpe"
              value={kpis.bull_regime_sharpe.toFixed(2)}
              subtext="Low-Vol Expansion Phase"
              significance="pass"
              significanceLabel="TRENDING ALPHA"
              accentColor="#10B981"
            />
            <KpiCard
              title="Bear Regime Sharpe"
              value={kpis.bear_regime_sharpe.toFixed(2)}
              subtext="High-Vol Contraction Phase"
              significance={kpis.bear_regime_sharpe < 0 ? "critical" : "warning"}
              significanceLabel={kpis.bear_regime_sharpe < 0 ? "CRASH PRONE" : "SUBDUED"}
              accentColor="#EF4444"
            />
            <KpiCard
              title="Momentum Crashes"
              value={kpis.momentum_crashes_detected}
              subtext="Rebound Short Squeezes"
              significance={flags.has_momentum_crash_risk ? "critical" : "pass"}
              significanceLabel={flags.has_momentum_crash_risk ? "LEFT-TAIL RISK" : "MINIMAL"}
              accentColor="#EC4899"
            />
            <KpiCard
              title="Overall Sharpe"
              value={kpis.overall_sharpe.toFixed(2)}
              subtext={`Full Period Return: ${kpis.overall_return_pct}%`}
              significance="neutral"
              significanceLabel="UNCONDITIONAL"
              accentColor="#8B5CF6"
            />
          </div>

          <StatsTable title="Module 5 Regime-Switching Momentum Table" rows={statsRows} />
        </div>
      }
      chartsContent={
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">CHART VISUALIZATION:</span>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#090D16] border border-[#1E293B]">
              <button
                onClick={() => setChartView("2D")}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  chartView === "2D" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400"
                }`}
              >
                2D Momentum & Regimes
              </button>
              <button
                onClick={() => setChartView("3D")}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  chartView === "3D" ? "bg-violet-500/20 text-violet-300 border border-violet-500/40" : "text-slate-400"
                }`}
              >
                3D Lookback × Holding Surface
              </button>
            </div>
          </div>

          {chartView === "2D" ? (
            <>
              <PlotlyChart
                data={[traceMom, traceMkt]}
                layout={{
                  title: `Cumulative Momentum Strategy Return (WML) vs Benchmark`,
                  xaxis: { title: "Date" },
                  yaxis: { title: "Wealth Index ($1.00 Start)" },
                }}
                title="Cumulative Momentum Returns"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PlotlyChart
                  data={[traceRegimes]}
                  layout={{
                    title: `Gaussian HMM Macro Regimes (0: Bear, 1: Turbulent, 2: Bull)`,
                    xaxis: { title: "Date" },
                    yaxis: { title: "Regime State", tickvals: [0, 1, 2] },
                  }}
                  title="HMM Regime Timeline"
                />

                <PlotlyChart
                  data={[traceTransition]}
                  layout={{
                    title: "Markov Regime Transition Probability Heatmap P(S_t | S_{t-1})",
                    xaxis: { title: "To State (t)" },
                    yaxis: { title: "From State (t-1)" },
                  }}
                  title="Transition Matrix Heatmap"
                />
              </div>
            </>
          ) : (
            <PlotlyChart
              data={[trace3DBull]}
              layout={{
                title: "3D Surface: Lookback (X) × Holding (Y) × Bull Regime Sharpe (Z)",
                scene: {
                  xaxis: { title: "Lookback Bars" },
                  yaxis: { title: "Holding Bars" },
                  zaxis: { title: "Sharpe Ratio" },
                },
              }}
              is3D
              style={{ width: "100%", height: "550px" }}
              title="3D Parameter Optimization Surface"
            />
          )}
        </div>
      }
      interpretContent={
        <div className="space-y-4 text-xs font-mono text-slate-300 leading-relaxed">
          <div className="p-4 rounded-lg bg-[#090D16] border border-[#1E293B]">
            <h4 className="text-sm font-bold text-cyan-400 font-sans mb-2">
              Dynamic Volatility Scaling & Momentum Hedging
            </h4>
            <div className="space-y-2">
              <p>
                <strong>1. Dynamic Volatility Scaling (Daniel & Moskowitz Solution):</strong>
                <br />
                To eliminate momentum crashes, Daniel & Moskowitz proposed scaling exposure inversely with forecasted market volatility: w_t = (σ_target / σ_t) * (1 / σ_market_t). During turbulent bear phases, leverage is shrunk, insulating the strategy from violent relief rally squeezes.
              </p>
              <p>
                <strong>2. Stop-Loss Hedging with Call Options:</strong>
                <br />
                Since momentum crashes behave like a short call option on the market, buying out-of-the-money market call options during high-volatility bear states provides an effective crash hedge.
              </p>
            </div>
          </div>
        </div>
      }
    />
  );
}
