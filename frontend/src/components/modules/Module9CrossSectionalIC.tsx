"use client";

import React, { useState, useEffect } from "react";
import { runModule9 } from "@/lib/api";
import { Module9Result } from "@/lib/types";
import { ModuleWrapper } from "@/components/shared/ModuleWrapper";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatsTable, StatRow } from "@/components/shared/StatsTable";
import { PlotlyChart } from "@/components/shared/PlotlyChart";

export function Module9CrossSectionalIC() {
  const [nQuantiles, setNQuantiles] = useState(10);
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<Module9Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chartView, setChartView] = useState<"2D" | "3D">("2D");

  const compute = async () => {
    setIsCalculating(true);
    setError(null);
    try {
      const res = await runModule9(undefined, undefined, nQuantiles, [1, 2, 3, 5, 10, 15]);
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to calculate cross-sectional IC");
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    compute();
  }, [nQuantiles]);

  if (!result) {
    return (
      <div className="flex items-center justify-center p-16 bg-[#0D111D] border border-[#1E293B] rounded-2xl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-400">
            {error || "Computing Cross-Sectional Spearman Rank IC, Monotonic Deciles & ICIR..."}
          </span>
        </div>
      </div>
    );
  }

  const { kpis, flags, ic_time_series, quantiles, long_short_curve, ic_decay, surface_3d, verdict } = result;

  // 2D Chart 1: IC Time Series with Rolling Mean
  const traceIcSeries = {
    x: ic_time_series.steps,
    y: ic_time_series.ic_values,
    type: "bar",
    name: "Per-Period Rank IC",
    marker: {
      color: ic_time_series.ic_values.map((v) => (v >= 0 ? "rgba(6, 182, 212, 0.45)" : "rgba(239, 68, 68, 0.45)")),
    },
  };

  const traceRollingIc = {
    x: ic_time_series.steps,
    y: ic_time_series.rolling_mean_ic,
    type: "scatter",
    mode: "lines",
    name: "Rolling 15-Period Mean IC",
    line: { color: "#F59E0B", width: 2 },
  };

  const traceZeroLine = {
    x: ic_time_series.steps,
    y: Array(ic_time_series.steps.length).fill(0),
    type: "scatter",
    mode: "lines",
    name: "Zero Line",
    line: { color: "#64748B", width: 1, dash: "dot" },
  };

  // 2D Chart 2: Quantile Monotonicity Bar Chart (Q1 to Q10)
  const traceQuantiles = {
    x: quantiles.labels,
    y: quantiles.mean_returns_bps,
    type: "bar",
    name: "Mean Return (bps)",
    marker: {
      color: quantiles.mean_returns_bps.map((v, i) =>
        i === 0 ? "#EF4444" : i === quantiles.mean_returns_bps.length - 1 ? "#10B981" : "#38BDF8"
      ),
    },
  };

  // 2D Chart 3: Cumulative Long-Short Spread Curve
  const traceLongShort = {
    x: Array.from({ length: long_short_curve.length }, (_, i) => i + 1),
    y: long_short_curve,
    type: "scatter",
    mode: "lines",
    name: `Long Q${nQuantiles} / Short Q1 Spread (Sharpe = ${kpis.long_short_sharpe})`,
    line: { color: "#10B981", width: 2 },
  };

  // 3D Chart: Time Slice x Horizon x IC Surface
  const trace3D = {
    x: surface_3d.x_horizons,
    y: surface_3d.y_time_slices,
    z: surface_3d.z_matrix,
    type: "surface",
    colorscale: "Viridis",
  };

  const statsRows: StatRow[] = [
    {
      metric: "Mean Spearman Rank IC",
      value: kpis.mean_rank_ic.toFixed(4),
      stat: `Std: ${kpis.ic_std.toFixed(4)}`,
      significance: flags.has_significant_ic ? "Strong Factor" : "Weak Signal",
      interpretation: "Cross-sectional correlation between factor score and forward return.",
    },
    {
      metric: "IC Information Ratio (ICIR)",
      value: kpis.icir.toFixed(2),
      stat: "Mean IC / Std IC",
      significance: kpis.icir > 0.5 ? "High ICIR (> 0.5)" : "Modest",
      interpretation: "Consistency of alpha signal across time periods.",
    },
    {
      metric: "IC t-Statistic & P-Value",
      value: kpis.ic_t_stat.toFixed(2),
      stat: "t-stat",
      pValue: kpis.ic_p_value,
      significance: kpis.ic_p_value < 0.01 ? "p < 0.01 ***" : "Not Sig",
      interpretation: "Rejection of null hypothesis of zero predictive rank correlation.",
    },
    {
      metric: "Quantile Monotonicity Test",
      value: kpis.monotonicity_corr.toFixed(3),
      stat: "Spearman Rank r",
      significance: flags.has_monotonic_sort ? "Strictly Monotonic" : "Non-Monotonic",
      interpretation: "Correlation between quantile bin number and realized return.",
    },
    {
      metric: "Long-Short Spread Sharpe",
      value: kpis.long_short_sharpe.toFixed(2),
      stat: `${kpis.long_short_ann_ret_pct.toFixed(1)}% Ann Return`,
      significance: "L/S Spread",
      interpretation: `Top quantile Q${nQuantiles} minus bottom quantile Q1 performance.`,
    },
    {
      metric: "Factor Hit Rate",
      value: `${kpis.hit_rate_pct}%`,
      stat: "Periods IC > 0",
      significance: kpis.hit_rate_pct > 55 ? "Positive Hit Rate" : "Symmetric",
      interpretation: "Percentage of cross-sectional time periods with positive rank correlation.",
    },
  ];

  return (
    <ModuleWrapper
      moduleId={9}
      verdictText={verdict}
      onRecalculate={compute}
      isCalculating={isCalculating}
      kpisMap={kpis}
      paramsMap={{ nQuantiles }}
      overviewContent={
        <div className="space-y-4 text-xs font-mono text-slate-300">
          <div className="p-4 rounded-lg bg-[#090D16] border border-[#1E293B]">
            <h3 className="text-sm font-bold text-cyan-400 font-sans mb-2">
              Theoretical Foundation: Quantitative Equity Factor Research Standards
            </h3>
            <p className="leading-relaxed">
              In institutional quantitative equity research (e.g. Grinold & Kahn's <em>Active Portfolio Management</em>, WorldQuant 101 Alphas, AQR), the primary metric of alpha quality is the <strong>Information Coefficient (IC)</strong>:
            </p>
            <div className="mt-2 text-cyan-300 p-2 rounded bg-[#0D111D] border border-cyan-500/20">
              Rank IC_t = SpearmanRank( Factor_{`i,t`}, Return_{`i,t+1`} ) ⟹ ICIR = μ(IC) / σ(IC)
            </div>
            <p className="mt-2 text-slate-400 text-[11px]">
              By the Fundamental Law of Active Management (Grinold 1989), Strategy Information Ratio is: IR ≈ IC · √(Breadth). A valid factor must also demonstrate <strong>quantile monotonicity</strong>: returns must strictly rise from Q1 (most negative) through Q10 (most positive).
            </p>
          </div>
        </div>
      }
      controlsContent={
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-mono text-slate-300 font-semibold">
              Quantile Sorting Granularity:
            </label>
            <select
              value={nQuantiles}
              onChange={(e) => setNQuantiles(parseInt(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-[#090D16] border border-[#1E293B] text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
            >
              <option value={5}>5 Quintiles (Q1 - Q5)</option>
              <option value={10}>10 Deciles (Q1 - Q10)</option>
            </select>
            <p className="text-[11px] font-mono text-slate-500">
              Sorts cross-section into equal-sized buckets to inspect monotonic alpha spread.
            </p>
          </div>
        </div>
      }
      kpisContent={
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <KpiCard
              title="Mean Rank IC"
              value={kpis.mean_rank_ic.toFixed(4)}
              subtext={`Std: ${kpis.ic_std.toFixed(4)}`}
              significance={flags.has_significant_ic ? "pass" : "neutral"}
              significanceLabel={flags.has_significant_ic ? "ALPHA PREDICTIVE" : "WEAK SIGNAL"}
              accentColor="#14B8A6"
            />
            <KpiCard
              title="IC Information Ratio"
              value={kpis.icir.toFixed(2)}
              subtext={`t-stat: ${kpis.ic_t_stat.toFixed(2)}`}
              significance={kpis.icir > 0.5 ? "pass" : "neutral"}
              significanceLabel={kpis.icir > 0.5 ? "HIGH ICIR" : "MODEST"}
              accentColor="#06B6D4"
            />
            <KpiCard
              title="Monotonicity Rank Correlation"
              value={kpis.monotonicity_corr.toFixed(3)}
              subtext={`Hit Rate: ${kpis.hit_rate_pct}%`}
              significance={flags.has_monotonic_sort ? "pass" : "warning"}
              significanceLabel={flags.has_monotonic_sort ? "MONOTONIC" : "NON-MONOTONIC"}
              accentColor="#10B981"
            />
            <KpiCard
              title="Long-Short Sharpe"
              value={kpis.long_short_sharpe.toFixed(2)}
              subtext={`Q${nQuantiles} - Q1 Spread`}
              significance={kpis.long_short_sharpe > 1.0 ? "pass" : "neutral"}
              significanceLabel="L/S SPREAD"
              accentColor="#F59E0B"
            />
          </div>

          <StatsTable title="Module 9 Cross-Sectional Factor Evaluation Table" rows={statsRows} />
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
                2D Time Series & Deciles
              </button>
              <button
                onClick={() => setChartView("3D")}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  chartView === "3D" ? "bg-violet-500/20 text-violet-300 border border-violet-500/40" : "text-slate-400"
                }`}
              >
                3D Time × Horizon Surface
              </button>
            </div>
          </div>

          {chartView === "2D" ? (
            <>
              {/* IC Time Series with Rolling Mean */}
              <PlotlyChart
                data={[traceIcSeries, traceRollingIc, traceZeroLine]}
                layout={{
                  title: `Cross-Sectional Spearman Rank IC Time Series (Mean IC = ${kpis.mean_rank_ic}, ICIR = ${kpis.icir})`,
                  xaxis: { title: "Time Period (t)" },
                  yaxis: { title: "Spearman Rank IC" },
                }}
                title="Cross-Sectional Rank IC Time Series"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Quantiles Monotonicity Bar Chart */}
                <PlotlyChart
                  data={[traceQuantiles]}
                  layout={{
                    title: `Quantile Return Monotonicity (Q1 to Q${nQuantiles} in bps) [r = ${kpis.monotonicity_corr}]`,
                    xaxis: { title: "Quantile Portfolio" },
                    yaxis: { title: "Mean Forward Return (bps)" },
                  }}
                  title="Quantile Monotonicity Verification"
                />

                {/* Long-Short Equity Curve */}
                <PlotlyChart
                  data={[traceLongShort]}
                  layout={{
                    title: `Long-Short Spread Cumulative Return (Q${nQuantiles} - Q1) [Sharpe = ${kpis.long_short_sharpe}]`,
                    xaxis: { title: "Period" },
                    yaxis: { title: "Portfolio Wealth" },
                  }}
                  title="Cumulative Long-Short Alpha Spread"
                />
              </div>
            </>
          ) : (
            <PlotlyChart
              data={[trace3D]}
              layout={{
                title: "3D Surface: Forward Horizon (X) × Time Slice (Y) × Rank IC (Z)",
                scene: {
                  xaxis: { title: "Horizon (h)" },
                  yaxis: { title: "Time Slice" },
                  zaxis: { title: "Rank IC" },
                },
              }}
              is3D
              style={{ width: "100%", height: "550px" }}
              title="3D Horizon × Time IC Surface"
            />
          )}
        </div>
      }
      interpretContent={
        <div className="space-y-4 text-xs font-mono text-slate-300 leading-relaxed">
          <div className="p-4 rounded-lg bg-[#090D16] border border-[#1E293B]">
            <h4 className="text-sm font-bold text-cyan-400 font-sans mb-2">
              Fundamental Law of Active Management (FLAM) Translation
            </h4>
            <div className="space-y-2">
              <p>
                <strong>1. What does Mean IC = 0.05 mean?</strong>
                <br />
                In quantitative finance, an IC of 0.05 (5% rank correlation) across 500 stocks traded 50 times per year produces an Information Ratio of ~1.2 (IR = 0.05 × √(25,000) = 7.9 theoretically, typically degraded by turnover and noise to ~1.5 net). An IC &gt; 0.03 is considered institutional caliber.
              </p>
              <p>
                <strong>2. The Monotonicity Test:</strong>
                <br />
                If Q10 is high, but Q9 is lower than Q8, or Q1 is higher than Q2, the factor is non-monotonic and may be suffering from non-linear threshold effects or extreme outlier dominance rather than true linear ranking power.
              </p>
            </div>
          </div>
        </div>
      }
    />
  );
}
