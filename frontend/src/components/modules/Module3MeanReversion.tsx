"use client";

import React, { useState, useEffect } from "react";
import { useData } from "@/context/DataContext";
import { runModule3 } from "@/lib/api";
import { Module3Result } from "@/lib/types";
import { ModuleWrapper } from "@/components/shared/ModuleWrapper";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatsTable, StatRow } from "@/components/shared/StatsTable";
import { PlotlyChart } from "@/components/shared/PlotlyChart";

export function Module3MeanReversion() {
  const { prices, records } = useData();
  const [lookback, setLookback] = useState(30);
  const [entryZ, setEntryZ] = useState(2.0);
  const [stopLossZ, setStopLossZ] = useState(3.5);
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<Module3Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chartView, setChartView] = useState<"2D" | "3D">("2D");

  const compute = async () => {
    if (prices.length < 40) return;
    setIsCalculating(true);
    setError(null);
    try {
      const res = await runModule3(prices, undefined, lookback, entryZ, stopLossZ);
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to calculate mean-reversion");
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    compute();
  }, [prices.length, lookback, entryZ, stopLossZ]);

  if (!result) {
    return (
      <div className="flex items-center justify-center p-16 bg-[#0D111D] border border-[#1E293B] rounded-2xl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-400">
            {error || "Estimating Ornstein-Uhlenbeck Half-Life & Pairs Backtest..."}
          </span>
        </div>
      </div>
    );
  }

  const { kpis, flags, spread_series, z_score_series, rolling_half_life, equity_curve, surface_3d, trades, verdict } = result;

  const steps = records.slice(0, spread_series.length).map((r) => r.timestamp);

  // 2D Chart: Spread with Z-Score Bands and Trade Markers
  const traceZScore = {
    x: steps,
    y: z_score_series,
    type: "scatter",
    mode: "lines",
    name: "Spread Z-Score",
    line: { color: "#38BDF8", width: 1.5 },
  };

  const traceUpperEntry = {
    x: steps,
    y: Array(steps.length).fill(entryZ),
    type: "scatter",
    mode: "lines",
    name: `Short Threshold (+${entryZ}σ)`,
    line: { color: "#EF4444", width: 1, dash: "dash" },
  };

  const traceLowerEntry = {
    x: steps,
    y: Array(steps.length).fill(-entryZ),
    type: "scatter",
    mode: "lines",
    name: `Long Threshold (-${entryZ}σ)`,
    line: { color: "#10B981", width: 1, dash: "dash" },
  };

  const traceZeroLine = {
    x: steps,
    y: Array(steps.length).fill(0),
    type: "scatter",
    mode: "lines",
    name: "Mean Reversion Target (0)",
    line: { color: "#64748B", width: 1, dash: "dot" },
  };

  // Trade Markers
  const tradeX = trades.map((t) => steps[t.step] || `Bar_${t.step}`);
  const tradeY = trades.map((t) => t.z_score);
  const tradeColors = trades.map((t) => (t.action.includes("LONG") ? "#10B981" : t.action.includes("SHORT") ? "#EF4444" : "#F59E0B"));

  const traceTrades = {
    x: tradeX,
    y: tradeY,
    mode: "markers",
    type: "scatter",
    name: "Executed Trades",
    marker: { color: tradeColors, size: 8, symbol: "diamond" },
  };

  // 2D Chart: Cumulative Equity Curve vs Buy & Hold
  const traceEquity = {
    x: steps,
    y: equity_curve,
    type: "scatter",
    mode: "lines",
    name: "Pairs Mean-Reversion Equity",
    line: { color: "#10B981", width: 2 },
  };

  const normBenchmark = prices.slice(0, steps.length).map((p) => p / prices[0]);
  const traceBenchmark = {
    x: steps,
    y: normBenchmark,
    type: "scatter",
    mode: "lines",
    name: "Underlying Asset Price (Normalized)",
    line: { color: "#64748B", width: 1, dash: "dot" },
  };

  // 3D Parameter Surface: Lookback x Entry Z -> Sharpe
  const trace3D = {
    x: surface_3d.x_lookbacks,
    y: surface_3d.y_z_entries,
    z: surface_3d.z_sharpe_matrix,
    type: "surface",
    colorscale: "Viridis",
  };

  const statsRows: StatRow[] = [
    {
      metric: "Ornstein-Uhlenbeck Half-Life",
      value: `${kpis.half_life_bars} Bars`,
      stat: "t_{1/2} = -ln2 / λ",
      significance: kpis.half_life_bars < 60 ? "Fast Reversion" : "Slow Decay",
      interpretation: "Expected duration for spread deviation to decay by 50%.",
    },
    {
      metric: "Augmented Dickey-Fuller Test",
      value: kpis.adf_statistic.toFixed(2),
      stat: "ADF t-stat",
      pValue: kpis.adf_pvalue,
      significance: kpis.adf_pvalue < 0.05 ? "Stationary (p < 0.05) ***" : "Unit Root",
      interpretation: "Confirms spread is mean-reverting and integrated of order I(0).",
    },
    {
      metric: "Hurst Exponent (H)",
      value: kpis.hurst_exponent.toFixed(3),
      stat: "Variance Scaling",
      significance: kpis.hurst_exponent < 0.5 ? "Mean-Reverting (H < 0.5)" : "Trending",
      interpretation: "Values below 0.5 confirm anti-persistent mean-reversion dynamics.",
    },
    {
      metric: "Lo-MacKinlay Variance Ratio",
      value: kpis.variance_ratio.toFixed(3),
      stat: "VR(5)",
      significance: kpis.variance_ratio < 1.0 ? "Mean Reverting" : "Random Walk",
      interpretation: "Multi-period variance grows slower than linear time, confirming mean attraction.",
    },
    {
      metric: "Backtest Annualized Sharpe",
      value: kpis.sharpe_ratio.toFixed(2),
      stat: `${kpis.trade_count} Trades`,
      significance: kpis.sharpe_ratio > 1.0 ? "High Performance" : "Modest",
      interpretation: `Win Rate: ${kpis.win_rate}% with Max Drawdown of ${kpis.max_drawdown}%.`,
    },
  ];

  return (
    <ModuleWrapper
      moduleId={3}
      verdictText={verdict}
      onRecalculate={compute}
      isCalculating={isCalculating}
      kpisMap={kpis}
      paramsMap={{ lookback, entryZ, stopLossZ }}
      overviewContent={
        <div className="space-y-4 text-xs font-mono text-slate-300">
          <div className="p-4 rounded-lg bg-[#090D16] border border-[#1E293B]">
            <h3 className="text-sm font-bold text-cyan-400 font-sans mb-2">
              Theoretical Foundation: Gatev, Goetzmann & Rouwenhorst (2006) Pairs Trading
            </h3>
            <p className="leading-relaxed">
              In <em>"Pairs Trading: Performance of a Relative-Value Arbitrage Rule"</em> (Review of Financial Studies), Evan Gatev, William Goetzmann, and K. Geert Rouwenhorst introduced the institutional distance-metric framework for statistical arbitrage.
            </p>
            <p className="mt-2 text-slate-300">
              The spread between cointegrated assets is modeled as a continuous-time <strong>Ornstein-Uhlenbeck (OU)</strong> stochastic process:
            </p>
            <div className="mt-2 text-cyan-300 p-2 rounded bg-[#0D111D] border border-cyan-500/20">
              dS_t = θ (μ - S_t) dt + σ dW_t ⟹ ΔS_t = λ S_{`t-1`} + c + ε_t, where Half-Life = -ln(2) / λ
            </div>
            <p className="mt-2 text-slate-400 text-[11px]">
              When the normalized spread deviation |z| exceeds entry threshold (e.g. 2.0σ), the strategy initiates counter-trend long/short positions, unwinding when the spread converges back to equilibrium (z = 0).
            </p>
          </div>
        </div>
      }
      controlsContent={
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300 font-semibold">Rolling Lookback Window:</label>
              <span className="text-cyan-400 font-bold">{lookback} Bars</span>
            </div>
            <input
              type="range"
              min={10}
              max={90}
              step={5}
              value={lookback}
              onChange={(e) => setLookback(parseInt(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300 font-semibold">Entry Z-Threshold:</label>
              <span className="text-cyan-400 font-bold">±{entryZ.toFixed(1)}σ</span>
            </div>
            <input
              type="range"
              min={1.0}
              max={3.0}
              step={0.1}
              value={entryZ}
              onChange={(e) => setEntryZ(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300 font-semibold">Stop-Loss Z-Threshold:</label>
              <span className="text-rose-400 font-bold">±{stopLossZ.toFixed(1)}σ</span>
            </div>
            <input
              type="range"
              min={2.5}
              max={5.0}
              step={0.1}
              value={stopLossZ}
              onChange={(e) => setStopLossZ(parseFloat(e.target.value))}
              className="w-full accent-rose-400 cursor-pointer"
            />
          </div>
        </div>
      }
      kpisContent={
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <KpiCard
              title="Ornstein-Uhlenbeck Half-Life"
              value={`${kpis.half_life_bars} Bars`}
              subtext="Expected Mean Reversion Time"
              significance={flags.is_mean_reverting ? "pass" : "warning"}
              significanceLabel={flags.is_mean_reverting ? "MEAN-REVERTING" : "EXPLOSIVE"}
              accentColor="#10B981"
            />
            <KpiCard
              title="ADF Stationarity (p-val)"
              value={kpis.adf_pvalue < 0.0001 ? "< 1e-4" : kpis.adf_pvalue.toFixed(4)}
              subtext={`t-stat: ${kpis.adf_statistic.toFixed(2)}`}
              significance={flags.is_mean_reverting ? "pass" : "critical"}
              significanceLabel={flags.is_mean_reverting ? "STATIONARY ***" : "UNIT ROOT"}
              accentColor="#06B6D4"
            />
            <KpiCard
              title="Hurst Exponent (H)"
              value={kpis.hurst_exponent.toFixed(3)}
              subtext="H < 0.5 Anti-persistent"
              significance={kpis.hurst_exponent < 0.5 ? "pass" : "neutral"}
              significanceLabel={kpis.hurst_exponent < 0.5 ? "ANTI-PERSISTENT" : "TRENDING"}
              accentColor="#8B5CF6"
            />
            <KpiCard
              title="Strategy Sharpe Ratio"
              value={kpis.sharpe_ratio.toFixed(2)}
              subtext={`Win Rate: ${kpis.win_rate}% (${kpis.trade_count} trades)`}
              significance={kpis.sharpe_ratio > 1.0 ? "pass" : "neutral"}
              significanceLabel={kpis.sharpe_ratio > 1.0 ? "HIGH SHARPE" : "MODEST"}
              accentColor="#F59E0B"
            />
          </div>

          <StatsTable title="Module 3 Statistical Arbitrage Econometrics" rows={statsRows} />
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
                2D Spread & Equity Curve
              </button>
              <button
                onClick={() => setChartView("3D")}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  chartView === "3D" ? "bg-violet-500/20 text-violet-300 border border-violet-500/40" : "text-slate-400"
                }`}
              >
                3D Sharpe Optimization Surface
              </button>
            </div>
          </div>

          {chartView === "2D" ? (
            <>
              {/* Spread with Z Bands & Trades */}
              <PlotlyChart
                data={[traceZScore, traceUpperEntry, traceLowerEntry, traceZeroLine, traceTrades]}
                layout={{
                  title: `Spread Z-Score Series with Dynamic Entry Bands (±${entryZ}σ) and Trades`,
                  xaxis: { title: "Date / Time" },
                  yaxis: { title: "Z-Score (Normalized Spread)" },
                }}
                title="Spread Z-Score and Arbitrage Trades"
              />

              {/* Cumulative Equity Curve vs Benchmark */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PlotlyChart
                  data={[traceEquity, traceBenchmark]}
                  layout={{
                    title: `Cumulative Backtest Equity Curve (Sharpe = ${kpis.sharpe_ratio})`,
                    xaxis: { title: "Date / Time" },
                    yaxis: { title: "Portfolio Equity ($1.00 Start)" },
                  }}
                  title="Cumulative Equity Curve"
                />

                <PlotlyChart
                  data={[
                    {
                      x: steps,
                      y: rolling_half_life,
                      type: "scatter",
                      mode: "lines",
                      name: "Rolling OU Half-Life (Bars)",
                      line: { color: "#F59E0B", width: 1.5 },
                    },
                  ]}
                  layout={{
                    title: "Rolling Ornstein-Uhlenbeck Half-Life across Time",
                    xaxis: { title: "Date / Time" },
                    yaxis: { title: "Half-Life (Bars)" },
                  }}
                  title="Rolling Half-Life Stability"
                />
              </div>
            </>
          ) : (
            <PlotlyChart
              data={[trace3D]}
              layout={{
                title: "3D Response Surface: Lookback Window × Entry Z-Threshold × Annualized Sharpe",
                scene: {
                  xaxis: { title: "Lookback (Bars)" },
                  yaxis: { title: "Entry Z (σ)" },
                  zaxis: { title: "Annualized Sharpe" },
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
              Stat-Arb Desk Trader & Risk Officer Notes
            </h4>
            <div className="space-y-2">
              <p>
                <strong>1. Optimal Holding Time Calibration:</strong>
                <br />
                The Ornstein-Uhlenbeck half-life defines the fundamental trade horizon. If your strategy holding period is significantly longer than 2.0x the half-life without convergence, the cointegration relationship has likely broken down, requiring stop-loss liquidation.
              </p>
              <p>
                <strong>2. Cointegration vs Correlation Pitfall:</strong>
                <br />
                High historical correlation does NOT imply cointegration. Two random walks can be correlated (spurious correlation), but only cointegrated pairs share a true stationary linear combination with bounded variance.
              </p>
            </div>
          </div>
        </div>
      }
    />
  );
}
