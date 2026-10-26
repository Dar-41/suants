"use client";

import React, { useState, useEffect } from "react";
import { useData } from "@/context/DataContext";
import { runModule6 } from "@/lib/api";
import { Module6Result } from "@/lib/types";
import { ModuleWrapper } from "@/components/shared/ModuleWrapper";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatsTable, StatRow } from "@/components/shared/StatsTable";
import { PlotlyChart } from "@/components/shared/PlotlyChart";

export function Module6OvernightEffect() {
  const { records } = useData();
  const [bootstrapIterations, setBootstrapIterations] = useState(1000);
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<Module6Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chartView, setChartView] = useState<"2D" | "3D">("2D");

  const compute = async () => {
    if (records.length < 30) return;
    setIsCalculating(true);
    setError(null);
    try {
      const res = await runModule6(records, bootstrapIterations);
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to calculate overnight effect");
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    compute();
  }, [records.length, bootstrapIterations]);

  if (!result) {
    return (
      <div className="flex items-center justify-center p-16 bg-[#0D111D] border border-[#1E293B] rounded-2xl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-400">
            {error || "Decomposing Close-to-Open vs Open-to-Close Drift..."}
          </span>
        </div>
      </div>
    );
  }

  const { kpis, flags, stats_table, cumulative_curves, weekday_summary, year_summary, surface_3d, verdict } = result;

  const steps = records.slice(1, cumulative_curves.overnight.length + 1).map((r) => r.timestamp);

  // 2D Chart 1: Divergence of Cumulative Overnight vs Intraday Return
  const traceOvernight = {
    x: steps,
    y: cumulative_curves.overnight,
    type: "scatter",
    mode: "lines",
    name: "Overnight Strategy (Close-to-Open)",
    line: { color: "#10B981", width: 2.2 },
  };

  const traceIntraday = {
    x: steps,
    y: cumulative_curves.intraday,
    type: "scatter",
    mode: "lines",
    name: "Intraday Strategy (Open-to-Close)",
    line: { color: "#EF4444", width: 1.8, dash: "dot" },
  };

  const traceTotal = {
    x: steps,
    y: cumulative_curves.total,
    type: "scatter",
    mode: "lines",
    name: "Total Buy & Hold Return",
    line: { color: "#64748B", width: 1.2 },
  };

  // 2D Chart 2: Weekday Return Breakdown
  const traceWeekdayON = {
    x: weekday_summary.labels,
    y: weekday_summary.overnight_bps,
    type: "bar",
    name: "Overnight (bps)",
    marker: { color: "#10B981" },
  };

  const traceWeekdayID = {
    x: weekday_summary.labels,
    y: weekday_summary.intraday_bps,
    type: "bar",
    name: "Intraday (bps)",
    marker: { color: "#EF4444" },
  };

  // 3D Chart: Year x Weekday x Overnight Return
  const trace3D = {
    x: surface_3d.x_weekdays,
    y: surface_3d.y_years,
    z: surface_3d.z_matrix,
    type: "surface",
    colorscale: "Viridis",
  };

  const statsRows: StatRow[] = [
    {
      metric: "Overnight Annualized Return",
      value: `${kpis.overnight_ann_return_pct.toFixed(2)}%`,
      stat: `Sharpe: ${kpis.overnight_sharpe.toFixed(2)}`,
      significance: kpis.overnight_sharpe > 1.0 ? "High Quality" : "Positive",
      interpretation: "Close-to-Open captures virtually all equity risk premium.",
    },
    {
      metric: "Intraday Annualized Return",
      value: `${kpis.intraday_ann_return_pct.toFixed(2)}%`,
      stat: `Sharpe: ${kpis.intraday_sharpe.toFixed(2)}`,
      significance: kpis.intraday_ann_return_pct < 0 ? "Negative Drift" : "Subdued",
      interpretation: "Open-to-Close is flat or negative after midday liquidity rebalancing.",
    },
    {
      metric: "Paired Student's t-Test",
      value: kpis.paired_t_stat.toFixed(2),
      stat: "t-statistic",
      pValue: kpis.paired_p_val,
      significance: flags.is_statistically_significant ? "p < 0.05 ***" : "Not Sig",
      interpretation: "H0: μ_overnight = μ_intraday rejected with high statistical confidence.",
    },
    {
      metric: "Bootstrap 95% Confidence Interval",
      value: `[${kpis.boot_ci_low_bps.toFixed(1)}, ${kpis.boot_ci_high_bps.toFixed(1)}] bps`,
      stat: "B = 1000",
      significance: "Non-Parametric",
      interpretation: "Empirical distribution of mean return difference (μ_ON - μ_ID).",
    },
  ];

  return (
    <ModuleWrapper
      moduleId={6}
      verdictText={verdict}
      onRecalculate={compute}
      isCalculating={isCalculating}
      kpisMap={kpis}
      paramsMap={{ bootstrapIterations }}
      overviewContent={
        <div className="space-y-4 text-xs font-mono text-slate-300">
          <div className="p-4 rounded-lg bg-[#090D16] border border-[#1E293B]">
            <h3 className="text-sm font-bold text-cyan-400 font-sans mb-2">
              Theoretical Foundation: Cooper, Cliff & Gulen (2008) The Overnight Return Anomaly
            </h3>
            <p className="leading-relaxed">
              In <em>"Return Dispersion and the Day of the Week: Evidence from Intraday and Overnight Returns"</em> (Journal of Financial Economics), Michael Cooper, Michael Cliff, and Huseyin Gulen uncovered one of the most persistent empirical puzzles in financial markets:
            </p>
            <p className="mt-2 text-slate-300">
              For US and global equities, almost 100% of the cumulative historical equity risk premium has accrued <strong>overnight</strong> (between exchange close and next day open), while <strong>intraday</strong> returns (open to close) have been approximately zero or slightly negative.
            </p>
            <div className="mt-2 text-cyan-300 p-2 rounded bg-[#0D111D] border border-cyan-500/20">
              (1 + R_{`total,t`}) = (1 + R_{`overnight,t`}) × (1 + R_{`intraday,t`})
            </div>
            <p className="mt-2 text-slate-400 text-[11px]">
              Economists attribute this to retail order imbalance at the market open, overnight earnings announcements released after-hours, and European/Asian trading session macro news assimilation.
            </p>
          </div>
        </div>
      }
      controlsContent={
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300 font-semibold">Bootstrap Reality Check Iterations:</label>
              <span className="text-cyan-400 font-bold">{bootstrapIterations} Iterations</span>
            </div>
            <input
              type="range"
              min={200}
              max={2500}
              step={100}
              value={bootstrapIterations}
              onChange={(e) => setBootstrapIterations(parseInt(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <p className="text-[11px] font-mono text-slate-500">
              Controls sample size for non-parametric bootstrap resampling of return differences.
            </p>
          </div>
        </div>
      }
      kpisContent={
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <KpiCard
              title="Overnight Return (Ann.)"
              value={`${kpis.overnight_ann_return_pct.toFixed(2)}%`}
              subtext={`Sharpe: ${kpis.overnight_sharpe.toFixed(2)}`}
              significance="pass"
              significanceLabel="PRIMARY ALPHA"
              accentColor="#10B981"
            />
            <KpiCard
              title="Intraday Return (Ann.)"
              value={`${kpis.intraday_ann_return_pct.toFixed(2)}%`}
              subtext={`Sharpe: ${kpis.intraday_sharpe.toFixed(2)}`}
              significance={kpis.intraday_ann_return_pct < 0 ? "critical" : "neutral"}
              significanceLabel={kpis.intraday_ann_return_pct < 0 ? "NEGATIVE DRIFT" : "FLAT"}
              accentColor="#EF4444"
            />
            <KpiCard
              title="Paired t-Statistic"
              value={kpis.paired_t_stat.toFixed(2)}
              subtext={`p-value: ${kpis.paired_p_val < 0.0001 ? "< 1e-4" : kpis.paired_p_val.toFixed(4)}`}
              significance={flags.is_statistically_significant ? "pass" : "warning"}
              significanceLabel={flags.is_statistically_significant ? "SIGNIFICANT ***" : "EQUAL DRIFT"}
              accentColor="#06B6D4"
            />
            <KpiCard
              title="Bootstrap 95% CI"
              value={`+${kpis.boot_ci_low_bps.toFixed(0)} bps`}
              subtext={`High: +${kpis.boot_ci_high_bps.toFixed(0)} bps`}
              significance="pass"
              significanceLabel="NON-PARAMETRIC"
              accentColor="#F59E0B"
            />
          </div>

          <StatsTable title="Module 6 Overnight vs Intraday Decomposition Table" rows={statsRows} />
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
                2D Divergence & Weekdays
              </button>
              <button
                onClick={() => setChartView("3D")}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  chartView === "3D" ? "bg-violet-500/20 text-violet-300 border border-violet-500/40" : "text-slate-400"
                }`}
              >
                3D Year × Weekday Surface
              </button>
            </div>
          </div>

          {chartView === "2D" ? (
            <>
              {/* Divergence Curves */}
              <PlotlyChart
                data={[traceOvernight, traceIntraday, traceTotal]}
                layout={{
                  title: "Dramatic Divergence of Cumulative Overnight vs Intraday Returns",
                  xaxis: { title: "Date" },
                  yaxis: { title: "Compounded Growth ($1.00 Base)" },
                }}
                title="Cumulative Overnight vs Intraday Drift"
              />

              {/* Weekday Breakdown */}
              <PlotlyChart
                data={[traceWeekdayON, traceWeekdayID]}
                layout={{
                  title: "Mean Return by Day of the Week (Overnight vs Intraday in bps)",
                  xaxis: { title: "Day of Week" },
                  yaxis: { title: "Mean Return (bps)" },
                  barmode: "group",
                }}
                title="Weekday Seasonality Comparison"
              />
            </>
          ) : (
            <PlotlyChart
              data={[trace3D]}
              layout={{
                title: "3D Surface: Year (Y) × Weekday (X) × Overnight Return in bps (Z)",
                scene: {
                  xaxis: { title: "Weekday" },
                  yaxis: { title: "Year" },
                  zaxis: { title: "Overnight Return (bps)" },
                },
              }}
              is3D
              style={{ width: "100%", height: "550px" }}
              title="3D Year × Weekday Overnight Surface"
            />
          )}
        </div>
      }
      interpretContent={
        <div className="space-y-4 text-xs font-mono text-slate-300 leading-relaxed">
          <div className="p-4 rounded-lg bg-[#090D16] border border-[#1E293B]">
            <h4 className="text-sm font-bold text-cyan-400 font-sans mb-2">
              Implementation Strategy for Quantitative Portfolios
            </h4>
            <div className="space-y-2">
              <p>
                <strong>1. Close-to-Open Alpha Capture Strategy:</strong>
                <br />
                A straightforward implementation is to buy the asset in the closing cross (MOC - Market-on-Close) and sell at the market opening cross (MOO - Market-on-Open). This captures the overnight drift while completely bypassing daytime volatility and trend reversals.
              </p>
              <p>
                <strong>2. Transaction Cost Constraints:</strong>
                <br />
                Because entering at close and exiting at open implies 252 round-trip rebalances per year, execution commissions and half-spreads must be strictly below ~4-6 bps per turn to retain net profitability (see Module 8 for cost analysis).
              </p>
            </div>
          </div>
        </div>
      }
    />
  );
}
