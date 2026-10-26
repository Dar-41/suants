"use client";

import React, { useState, useEffect } from "react";
import { useData } from "@/context/DataContext";
import { runModule10 } from "@/lib/api";
import { Module10Result } from "@/lib/types";
import { ModuleWrapper } from "@/components/shared/ModuleWrapper";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatsTable, StatRow } from "@/components/shared/StatsTable";
import { PlotlyChart } from "@/components/shared/PlotlyChart";

export function Module10TripleBarrier() {
  const { prices, records } = useData();
  const [ptMult, setPtMult] = useState(2.0);
  const [slMult, setSlMult] = useState(1.5);
  const [verticalBars, setVerticalBars] = useState(15);
  const [ewmaSpan, setEwmaSpan] = useState(20);
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<Module10Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chartView, setChartView] = useState<"2D" | "3D">("2D");

  const compute = async () => {
    if (prices.length < 50) return;
    setIsCalculating(true);
    setError(null);
    try {
      const res = await runModule10(prices, ptMult, slMult, verticalBars, ewmaSpan, 2);
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to calculate triple-barrier labels");
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    compute();
  }, [prices.length, ptMult, slMult, verticalBars, ewmaSpan]);

  if (!result) {
    return (
      <div className="flex items-center justify-center p-16 bg-[#0D111D] border border-[#1E293B] rounded-2xl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-400">
            {error || "Computing Dynamic Volatility Barriers, Concurrency & Uniqueness..."}
          </span>
        </div>
      </div>
    );
  }

  const { kpis, flags, distribution, sample_events, surface_3d, verdict } = result;

  // 2D Chart 1: Price Path with Triple-Barrier Touches (+1, -1, 0)
  const pSlice = prices.slice(0, 150);
  const tSlice = records.slice(0, 150).map((r) => r.timestamp);

  const tracePrice = {
    x: tSlice,
    y: pSlice,
    type: "scatter",
    mode: "lines",
    name: "Asset Price Path",
    line: { color: "#94A3B8", width: 1.5 },
  };

  // Sample event touch markers
  const ptEvents = sample_events.filter((e) => e.label === 1 && e.t_exit < 150);
  const slEvents = sample_events.filter((e) => e.label === -1 && e.t_exit < 150);
  const vertEvents = sample_events.filter((e) => e.label === 0 && e.t_exit < 150);

  const tracePtHits = {
    x: ptEvents.map((e) => tSlice[e.t_exit] || `Bar_${e.t_exit}`),
    y: ptEvents.map((e) => e.exit_price),
    mode: "markers",
    type: "scatter",
    name: "Profit-Take Hit (+1)",
    marker: { color: "#10B981", size: 8, symbol: "triangle-up" },
  };

  const traceSlHits = {
    x: slEvents.map((e) => tSlice[e.t_exit] || `Bar_${e.t_exit}`),
    y: slEvents.map((e) => e.exit_price),
    mode: "markers",
    type: "scatter",
    name: "Stop-Loss Hit (-1)",
    marker: { color: "#EF4444", size: 8, symbol: "triangle-down" },
  };

  const traceVertHits = {
    x: vertEvents.map((e) => tSlice[e.t_exit] || `Bar_${e.t_exit}`),
    y: vertEvents.map((e) => e.exit_price),
    mode: "markers",
    type: "scatter",
    name: "Vertical Expiry (0)",
    marker: { color: "#64748B", size: 6, symbol: "circle" },
  };

  // 2D Chart 2: Label Distribution Bar Chart
  const traceDistribution = {
    x: distribution.labels,
    y: distribution.percentages,
    type: "bar",
    name: "Label Balance (%)",
    marker: { color: ["#10B981", "#EF4444", "#64748B"] },
  };

  // 2D Chart 3: Holding Time Distribution
  const traceHoldingTime = {
    x: distribution.labels,
    y: distribution.avg_holding_bars,
    type: "bar",
    name: "Avg Holding Time (Bars)",
    marker: { color: "#A855F7" },
  };

  // 3D Chart: PT Multiplier x SL Multiplier -> Win/Loss Ratio
  const trace3D = {
    x: surface_3d.x_profit_takes,
    y: surface_3d.y_stop_losses,
    z: surface_3d.z_matrix,
    type: "surface",
    colorscale: "Viridis",
  };

  const statsRows: StatRow[] = [
    {
      metric: "Profit-Take Hits (+1)",
      value: `${kpis.profit_take_pct}%`,
      stat: `Avg Hold: ${kpis.avg_profit_hold_time} bars`,
      significance: "Positive Target",
      interpretation: "Percentage of events reaching the upper dynamic volatility barrier.",
    },
    {
      metric: "Stop-Loss Hits (-1)",
      value: `${kpis.stop_loss_pct}%`,
      stat: `Avg Hold: ${kpis.avg_stop_hold_time} bars`,
      significance: "Risk Cutoff",
      interpretation: "Percentage of events reaching the lower dynamic volatility barrier.",
    },
    {
      metric: "Vertical Expiration (0)",
      value: `${kpis.vertical_expiry_pct}%`,
      stat: `T = ${verticalBars} bars`,
      significance: "Time Out",
      interpretation: "Neither barrier reached before maximum holding window expiration.",
    },
    {
      metric: "Average Sample Uniqueness (ū)",
      value: kpis.average_uniqueness.toFixed(3),
      stat: `Max Concurrency: ${kpis.max_concurrency}`,
      significance: flags.has_high_uniqueness ? "High Uniqueness" : "Overlapping",
      interpretation: "Fraction of independent informational content for ML training weights.",
    },
    {
      metric: "Labeled Event Population Sharpe",
      value: kpis.event_sharpe.toFixed(2),
      stat: "Annualized",
      significance: kpis.event_sharpe > 1.0 ? "High Sharpe" : "Modest",
      interpretation: "Realized Sharpe ratio of all generated triple-barrier trades.",
    },
  ];

  return (
    <ModuleWrapper
      moduleId={10}
      verdictText={verdict}
      onRecalculate={compute}
      isCalculating={isCalculating}
      kpisMap={kpis}
      paramsMap={{ ptMult, slMult, verticalBars, ewmaSpan }}
      overviewContent={
        <div className="space-y-4 text-xs font-mono text-slate-300">
          <div className="p-4 rounded-lg bg-[#090D16] border border-[#1E293B]">
            <h3 className="text-sm font-bold text-cyan-400 font-sans mb-2">
              Theoretical Foundation: Marcos López de Prado (AFML Chapter 3 & 4) Triple-Barrier Labeling
            </h3>
            <p className="leading-relaxed">
              In <em>"Advances in Financial Machine Learning"</em>, Marcos López de Prado revolutionized financial supervised learning by replacing flawed fixed-time horizon labeling (e.g. sign of return in 5 days) with the <strong>Triple-Barrier Method</strong>.
            </p>
            <div className="mt-2 text-cyan-300 p-2 rounded bg-[#0D111D] border border-cyan-500/20">
              Upper: P_0 · (1 + pt · σ_t) &nbsp;|&nbsp; Lower: P_0 · (1 - sl · σ_t) &nbsp;|&nbsp; Vertical: T_{`bars`}
            </div>
            <p className="mt-2 text-slate-400 text-[11px]">
              Crucially, financial labels overlap in time, creating severe multicollinearity. López de Prado introduced <strong>Sample Uniqueness (ū_i)</strong> based on label concurrency c_t to compute sample weights that prevent overfitting in machine learning models.
            </p>
          </div>
        </div>
      }
      controlsContent={
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300 font-semibold">Profit-Take Multiplier:</label>
              <span className="text-emerald-400 font-bold">{ptMult.toFixed(1)}σ</span>
            </div>
            <input
              type="range"
              min={1.0}
              max={3.5}
              step={0.1}
              value={ptMult}
              onChange={(e) => setPtMult(parseFloat(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300 font-semibold">Stop-Loss Multiplier:</label>
              <span className="text-rose-400 font-bold">{slMult.toFixed(1)}σ</span>
            </div>
            <input
              type="range"
              min={1.0}
              max={3.5}
              step={0.1}
              value={slMult}
              onChange={(e) => setSlMult(parseFloat(e.target.value))}
              className="w-full accent-rose-400 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300 font-semibold">Vertical Time Barrier:</label>
              <span className="text-cyan-400 font-bold">{verticalBars} Bars</span>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              step={1}
              value={verticalBars}
              onChange={(e) => setVerticalBars(parseInt(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300 font-semibold">EWMA Vol Span:</label>
              <span className="text-slate-300 font-bold">{ewmaSpan} Bars</span>
            </div>
            <input
              type="range"
              min={10}
              max={50}
              step={5}
              value={ewmaSpan}
              onChange={(e) => setEwmaSpan(parseInt(e.target.value))}
              className="w-full accent-slate-400 cursor-pointer"
            />
          </div>
        </div>
      }
      kpisContent={
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <KpiCard
              title="Profit-Take Rate (+1)"
              value={`${kpis.profit_take_pct}%`}
              subtext={`Avg Hold: ${kpis.avg_profit_hold_time} bars`}
              significance="pass"
              significanceLabel="UPPER BARRIER"
              accentColor="#10B981"
            />
            <KpiCard
              title="Stop-Loss Rate (-1)"
              value={`${kpis.stop_loss_pct}%`}
              subtext={`Avg Hold: ${kpis.avg_stop_hold_time} bars`}
              significance="critical"
              significanceLabel="LOWER BARRIER"
              accentColor="#EF4444"
            />
            <KpiCard
              title="Average Uniqueness (ū)"
              value={kpis.average_uniqueness.toFixed(3)}
              subtext={`Max Concurrency: ${kpis.max_concurrency}`}
              significance={flags.has_high_uniqueness ? "pass" : "warning"}
              significanceLabel={flags.has_high_uniqueness ? "HIGH UNIQUENESS" : "OVERLAPPING"}
              accentColor="#06B6D4"
            />
            <KpiCard
              title="Labeled Event Sharpe"
              value={kpis.event_sharpe.toFixed(2)}
              subtext={`${kpis.total_events} Total Events`}
              significance={kpis.event_sharpe > 1.0 ? "pass" : "neutral"}
              significanceLabel="EVENT SHARPE"
              accentColor="#A855F7"
            />
          </div>

          <StatsTable title="Module 10 Triple-Barrier Diagnostics Table" rows={statsRows} />
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
                2D Price Path & Barriers
              </button>
              <button
                onClick={() => setChartView("3D")}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  chartView === "3D" ? "bg-violet-500/20 text-violet-300 border border-violet-500/40" : "text-slate-400"
                }`}
              >
                3D PT × SL Response Surface
              </button>
            </div>
          </div>

          {chartView === "2D" ? (
            <>
              {/* Interactive Price Path with Triple Barrier Hit Events */}
              <PlotlyChart
                data={[tracePrice, tracePtHits, traceSlHits, traceVertHits]}
                layout={{
                  title: `Price Path with Dynamic Volatility Barriers (+${ptMult}σ PT / -${slMult}σ SL / ${verticalBars}b Expiry)`,
                  xaxis: { title: "Date / Time" },
                  yaxis: { title: "Price ($)" },
                }}
                title="Triple-Barrier Labeled Price Path Events"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Label Distribution Bar Chart */}
                <PlotlyChart
                  data={[traceDistribution]}
                  layout={{
                    title: "Triple-Barrier Label Distribution (+1, -1, 0 in %)",
                    xaxis: { title: "Outcome Class" },
                    yaxis: { title: "Percentage (%)" },
                  }}
                  title="Outcome Class Distribution"
                />

                {/* Holding Time Distribution */}
                <PlotlyChart
                  data={[traceHoldingTime]}
                  layout={{
                    title: "Mean Holding Duration per Label Class (Bars)",
                    xaxis: { title: "Outcome Class" },
                    yaxis: { title: "Holding Time (Bars)" },
                  }}
                  title="Holding Time Duration"
                />
              </div>
            </>
          ) : (
            <PlotlyChart
              data={[trace3D]}
              layout={{
                title: "3D Response Surface: Profit-Take (X) × Stop-Loss (Y) × Win/Loss Hit Ratio (Z)",
                scene: {
                  xaxis: { title: "PT Multiplier (σ)" },
                  yaxis: { title: "SL Multiplier (σ)" },
                  zaxis: { title: "Win/Loss Ratio" },
                },
              }}
              is3D
              style={{ width: "100%", height: "550px" }}
              title="3D Barrier Multiplier Optimization Surface"
            />
          )}
        </div>
      }
      interpretContent={
        <div className="space-y-4 text-xs font-mono text-slate-300 leading-relaxed">
          <div className="p-4 rounded-lg bg-[#090D16] border border-[#1E293B]">
            <h4 className="text-sm font-bold text-cyan-400 font-sans mb-2">
              Financial ML Practitioner's Guide to Triple Barriers
            </h4>
            <div className="space-y-2">
              <p>
                <strong>1. Overcoming the Fixed-Time Horizon Bias:</strong>
                <br />
                Traditional quantitative models predict price change over fixed intervals (e.g. return in 5 days). This ignores real-world trading realities where a stop-loss or profit-target would have triggered on day 2. The triple-barrier method aligns machine learning objectives with realistic execution.
              </p>
              <p>
                <strong>2. Meta-Labeling for Position Sizing:</strong>
                <br />
                A secondary machine learning model (e.g. Random Forest or LightGBM) can be trained on the triple-barrier outcomes to predict <em>meta-labels</em> (whether to accept or filter the trade), dramatically boosting the strategy's Sharpe ratio.
              </p>
            </div>
          </div>
        </div>
      }
    />
  );
}
