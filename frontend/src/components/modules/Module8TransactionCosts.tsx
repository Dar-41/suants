"use client";

import React, { useState, useEffect } from "react";
import { useData } from "@/context/DataContext";
import { runModule8 } from "@/lib/api";
import { Module8Result } from "@/lib/types";
import { ModuleWrapper } from "@/components/shared/ModuleWrapper";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatsTable, StatRow } from "@/components/shared/StatsTable";
import { PlotlyChart } from "@/components/shared/PlotlyChart";

export function Module8TransactionCosts() {
  const { returns, records } = useData();
  const [spreadBps, setSpreadBps] = useState(3.0);
  const [slippageBps, setSlippageBps] = useState(2.0);
  const [commissionBps, setCommissionBps] = useState(1.0);
  const [targetAumM, setTargetAumM] = useState(25);
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<Module8Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chartView, setChartView] = useState<"2D" | "3D">("2D");

  const compute = async () => {
    if (returns.length < 40) return;
    setIsCalculating(true);
    setError(null);
    try {
      const res = await runModule8(
        returns,
        undefined,
        spreadBps,
        slippageBps,
        commissionBps,
        5000000,
        targetAumM * 1000000,
        100.0
      );
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to calculate transaction costs");
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    compute();
  }, [returns.length, spreadBps, slippageBps, commissionBps, targetAumM]);

  if (!result) {
    return (
      <div className="flex items-center justify-center p-16 bg-[#0D111D] border border-[#1E293B] rounded-2xl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-400">
            {error || "Estimating Square-Root Market Impact & Capacity Decay..."}
          </span>
        </div>
      </div>
    );
  }

  const { kpis, flags, waterfall, cost_sweep, cumulative_curves, surface_3d, verdict } = result;

  const steps = records.slice(0, cumulative_curves.gross.length).map((r) => r.timestamp);

  // 2D Chart 1: Gross vs Net Cumulative Equity Curves
  const traceGross = {
    x: steps,
    y: cumulative_curves.gross,
    type: "scatter",
    mode: "lines",
    name: `Gross Strategy (Sharpe = ${kpis.gross_sharpe})`,
    line: { color: "#38BDF8", width: 2 },
  };

  const traceNet = {
    x: steps,
    y: cumulative_curves.net,
    type: "scatter",
    mode: "lines",
    name: `Net Strategy after Frictions (Sharpe = ${kpis.net_sharpe})`,
    line: { color: "#10B981", width: 2 },
  };

  // 2D Chart 2: Net Sharpe vs Friction Cost with Breakeven Intercept
  const traceSharpeSweep = {
    x: cost_sweep.costs_bps,
    y: cost_sweep.net_sharpes,
    type: "scatter",
    mode: "lines+markers",
    name: "Net Sharpe vs Cost",
    line: { color: "#F59E0B", width: 2 },
  };

  const traceZeroLine = {
    x: cost_sweep.costs_bps,
    y: Array(cost_sweep.costs_bps.length).fill(0),
    type: "scatter",
    mode: "lines",
    name: "Breakeven Threshold (Sharpe = 0)",
    line: { color: "#EF4444", width: 1.5, dash: "dash" },
  };

  // 2D Chart 3: Cost Waterfall Breakdown (bps/year)
  const wfKeys = Object.keys(waterfall);
  const wfVals = Object.values(waterfall);
  const traceWf = {
    x: wfKeys,
    y: wfVals,
    type: "bar",
    name: "Annualized Drag (bps)",
    marker: { color: wfVals.map((v, i) => (i === wfVals.length - 1 ? "#EF4444" : "#F59E0B")) },
  };

  // 3D Chart: Spread x Slippage x Net Sharpe
  const trace3D = {
    x: surface_3d.x_spreads_bps,
    y: surface_3d.y_slippages_bps,
    z: surface_3d.z_matrix,
    type: "surface",
    colorscale: "Viridis",
  };

  const statsRows: StatRow[] = [
    {
      metric: "Gross vs Net Sharpe Ratio",
      value: `${kpis.gross_sharpe.toFixed(2)} ➔ ${kpis.net_sharpe.toFixed(2)}`,
      stat: `Δ = ${(kpis.gross_sharpe - kpis.net_sharpe).toFixed(2)}`,
      significance: kpis.net_sharpe > 0.5 ? "Viable Strategy" : "Alpha Eroded",
      interpretation: "Decay in risk-adjusted performance caused by execution frictions.",
    },
    {
      metric: "Breakeven Cost Ceiling (C*)",
      value: `${kpis.breakeven_cost_bps.toFixed(1)} bps`,
      stat: "Per-Turn One-Way",
      significance: kpis.total_one_way_cost_bps < kpis.breakeven_cost_bps ? "Safe Margin" : "Exceeded",
      interpretation: "Exact friction cost where net strategy return drops to zero.",
    },
    {
      metric: "Annualized Strategy Turnover",
      value: `${kpis.annual_turnover_x.toFixed(1)}x`,
      stat: "Annual Volume / AUM",
      significance: flags.has_high_turnover ? "High Turnover" : "Low Turnover",
      interpretation: "High turnover rapidly amplifies bid-ask spread and commission friction.",
    },
    {
      metric: "Total Annual Cost Drag",
      value: `${kpis.annual_cost_drag_bps.toFixed(0)} bps / yr`,
      stat: `${(kpis.annual_cost_drag_bps / 100).toFixed(2)}% of AUM`,
      significance: "Friction Overhead",
      interpretation: "Total return surrendered annually to brokers, market makers, and market impact.",
    },
    {
      metric: "Maximum Scalable Capacity",
      value: `$${kpis.capacity_aum_millions.toFixed(1)}M AUM`,
      stat: "Square-Root Law",
      significance: "Capacity Ceiling",
      interpretation: "Maximum portfolio scale before non-linear market impact extinguishes alpha.",
    },
  ];

  return (
    <ModuleWrapper
      moduleId={8}
      verdictText={verdict}
      onRecalculate={compute}
      isCalculating={isCalculating}
      kpisMap={kpis}
      paramsMap={{ spreadBps, slippageBps, commissionBps, targetAumM }}
      overviewContent={
        <div className="space-y-4 text-xs font-mono text-slate-300">
          <div className="p-4 rounded-lg bg-[#090D16] border border-[#1E293B]">
            <h3 className="text-sm font-bold text-cyan-400 font-sans mb-2">
              Theoretical Foundation: Kourtis (2014) & Almgren-Chriss Market Impact Laws
            </h3>
            <p className="leading-relaxed">
              In <em>"The impact of transaction costs on portfolio selection"</em> (Journal of Banking & Finance), Apostolos Kourtis demonstrated that paper backtests that ignore transaction costs suffer devastating out-of-sample decay.
            </p>
            <p className="mt-2 text-slate-300">
              Total transaction cost encompasses linear fees plus <strong>Non-Linear Square-Root Market Impact</strong> (Barra / Bouchaud / Almgren & Chriss):
            </p>
            <div className="mt-2 text-cyan-300 p-2 rounded bg-[#0D111D] border border-cyan-500/20">
              Cost = ½ Spread + Slippage + Commission + Y · σ_{`daily`} · √( OrderSize / ADV )
            </div>
            <p className="mt-2 text-slate-400 text-[11px]">
              Because market impact grows with √(AUM), high-turnover strategies face a hard capacity limit beyond which scaling AUM guarantees negative net returns.
            </p>
          </div>
        </div>
      }
      controlsContent={
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300 font-semibold">Bid-Ask Spread:</label>
              <span className="text-cyan-400 font-bold">{spreadBps} bps</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={15.0}
              step={0.5}
              value={spreadBps}
              onChange={(e) => setSpreadBps(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300 font-semibold">Execution Slippage:</label>
              <span className="text-cyan-400 font-bold">{slippageBps} bps</span>
            </div>
            <input
              type="range"
              min={0.0}
              max={10.0}
              step={0.5}
              value={slippageBps}
              onChange={(e) => setSlippageBps(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300 font-semibold">Brokerage Commission:</label>
              <span className="text-cyan-400 font-bold">{commissionBps} bps</span>
            </div>
            <input
              type="range"
              min={0.0}
              max={5.0}
              step={0.2}
              value={commissionBps}
              onChange={(e) => setCommissionBps(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300 font-semibold">Target Strategy AUM:</label>
              <span className="text-emerald-400 font-bold">${targetAumM}M</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              step={5}
              value={targetAumM}
              onChange={(e) => setTargetAumM(parseInt(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>
        </div>
      }
      kpisContent={
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <KpiCard
              title="Net Strategy Sharpe"
              value={kpis.net_sharpe.toFixed(2)}
              subtext={`Gross: ${kpis.gross_sharpe.toFixed(2)}`}
              significance={flags.is_cost_viable ? "pass" : "critical"}
              significanceLabel={flags.is_cost_viable ? "NET PROFITABLE" : "COST DRAGGED"}
              accentColor="#10B981"
            />
            <KpiCard
              title="Breakeven Cost (C*)"
              value={`${kpis.breakeven_cost_bps.toFixed(1)} bps`}
              subtext={`Current Cost: ${kpis.total_one_way_cost_bps.toFixed(1)} bps`}
              significance={kpis.total_one_way_cost_bps < kpis.breakeven_cost_bps ? "pass" : "critical"}
              significanceLabel="BREAKEVEN CEILING"
              accentColor="#F59E0B"
            />
            <KpiCard
              title="Annual Cost Drag"
              value={`${kpis.annual_cost_drag_bps} bps`}
              subtext={`Turnover: ${kpis.annual_turnover_x}x / year`}
              significance={flags.has_high_turnover ? "warning" : "pass"}
              significanceLabel="FRICTION DRAG"
              accentColor="#EF4444"
            />
            <KpiCard
              title="Scalable Capacity"
              value={`$${kpis.capacity_aum_millions.toFixed(0)}M`}
              subtext="Max Scalable AUM Ceiling"
              significance="pass"
              significanceLabel="CAPACITY CEILING"
              accentColor="#06B6D4"
            />
          </div>

          <StatsTable title="Module 8 Transaction Cost Sensitivity Table" rows={statsRows} />
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
                2D Gross vs Net & Waterfall
              </button>
              <button
                onClick={() => setChartView("3D")}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  chartView === "3D" ? "bg-violet-500/20 text-violet-300 border border-violet-500/40" : "text-slate-400"
                }`}
              >
                3D Spread × Slippage Surface
              </button>
            </div>
          </div>

          {chartView === "2D" ? (
            <>
              {/* Gross vs Net Equity Curve */}
              <PlotlyChart
                data={[traceGross, traceNet]}
                layout={{
                  title: `Cumulative Performance: Gross Strategy vs Net Strategy after Frictions (${kpis.total_one_way_cost_bps} bps one-way)`,
                  xaxis: { title: "Date" },
                  yaxis: { title: "Portfolio Wealth ($1.00 Base)" },
                }}
                title="Gross vs Net Strategy Cumulative Curves"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Net Sharpe vs Cost Curve */}
                <PlotlyChart
                  data={[traceSharpeSweep, traceZeroLine]}
                  layout={{
                    title: `Net Sharpe vs Execution Friction (Breakeven Intercept C* = ${kpis.breakeven_cost_bps} bps)`,
                    xaxis: { title: "Friction Cost (bps one-way)" },
                    yaxis: { title: "Annualized Net Sharpe" },
                  }}
                  title="Net Sharpe vs Transaction Cost"
                />

                {/* Cost Waterfall */}
                <PlotlyChart
                  data={[traceWf]}
                  layout={{
                    title: "Annualized Cost Drag Breakdown Waterfall (bps/year)",
                    xaxis: { title: "Friction Component" },
                    yaxis: { title: "Annual Drag (bps)" },
                  }}
                  title="Cost Waterfall Breakdown"
                />
              </div>
            </>
          ) : (
            <PlotlyChart
              data={[trace3D]}
              layout={{
                title: "3D Surface: Bid-Ask Spread (X) × Slippage (Y) × Net Sharpe Ratio (Z)",
                scene: {
                  xaxis: { title: "Spread (bps)" },
                  yaxis: { title: "Slippage (bps)" },
                  zaxis: { title: "Net Sharpe" },
                },
              }}
              is3D
              style={{ width: "100%", height: "550px" }}
              title="3D Friction Response Surface"
            />
          )}
        </div>
      }
      interpretContent={
        <div className="space-y-4 text-xs font-mono text-slate-300 leading-relaxed">
          <div className="p-4 rounded-lg bg-[#090D16] border border-[#1E293B]">
            <h4 className="text-sm font-bold text-cyan-400 font-sans mb-2">
              Portfolio Optimization under Transaction Costs
            </h4>
            <div className="space-y-2">
              <p>
                <strong>1. Why High-Frequency Signals Evaporate in Production:</strong>
                <br />
                A signal with 100x turnover per year requires 100 bps gross return just to pay for 1 bps of trading friction. Strategies with high turnover must either achieve massive gross Sharpe (&gt; 3.0) or implement turnover constraints / quadratic penalty terms in the mean-variance optimizer.
              </p>
              <p>
                <strong>2. The Square-Root Impact Non-Linearity:</strong>
                <br />
                Because market impact scales with √(OrderSize/ADV), doubling your fund size from $25M to $50M increases total dollar impact costs by roughly 2.8x (doubling trade size while unit cost rises by 1.41x).
              </p>
            </div>
          </div>
        </div>
      }
    />
  );
}
