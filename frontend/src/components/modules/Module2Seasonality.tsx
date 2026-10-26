"use client";

import React, { useState, useEffect } from "react";
import { useData } from "@/context/DataContext";
import { runModule2 } from "@/lib/api";
import { Module2Result } from "@/lib/types";
import { ModuleWrapper } from "@/components/shared/ModuleWrapper";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatsTable, StatRow } from "@/components/shared/StatsTable";
import { PlotlyChart } from "@/components/shared/PlotlyChart";

export function Module2Seasonality() {
  const { records } = useData();
  const [bucketMinutes, setBucketMinutes] = useState(30);
  const [fourierTerms, setFourierTerms] = useState(4);
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<Module2Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chartView, setChartView] = useState<"2D" | "3D">("2D");

  const compute = async () => {
    if (records.length < 50) return;
    setIsCalculating(true);
    setError(null);
    try {
      const res = await runModule2(records, bucketMinutes, fourierTerms);
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to calculate intraday seasonality");
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    compute();
  }, [records.length, bucketMinutes, fourierTerms]);

  if (!result) {
    return (
      <div className="flex items-center justify-center p-16 bg-[#0D111D] border border-[#1E293B] rounded-2xl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-400">
            {error || "Estimating Flexible Fourier Form & Diurnal Seasonality..."}
          </span>
        </div>
      </div>
    );
  }

  const { kpis, flags, buckets, surface_3d, session_summary, verdict } = result;

  // 2D Chart: Intraday U-Shape Profile (Empirical vs FFF Fitted)
  const traceEmpiricalVol = {
    x: buckets.labels,
    y: buckets.mean_vols_pct,
    type: "bar",
    name: "Empirical Volatility (%)",
    marker: { color: "rgba(6, 182, 212, 0.45)", line: { color: "#06B6D4", width: 1 } },
  };

  const traceFffVol = {
    x: buckets.labels,
    y: buckets.fff_fitted_vols,
    type: "scatter",
    mode: "lines",
    name: `Flexible Fourier Form Fit (P=${fourierTerms})`,
    line: { color: "#F59E0B", width: 2.5 },
  };

  const traceMeanReturns = {
    x: buckets.labels,
    y: buckets.mean_returns_bps,
    type: "scatter",
    mode: "lines+markers",
    name: "Mean Return (bps)",
    yaxis: "y2",
    line: { color: "#8B5CF6", width: 1.5, dash: "dot" },
  };

  const layoutIntradayProfile = {
    title: `Diurnal Intraday Volatility Profile & Flexible Fourier Form Filter (${bucketMinutes}m Buckets)`,
    xaxis: { title: "Time of Day (UTC/Market Time)", tickangle: -45 },
    yaxis: { title: "Volatility Proxy (%)", gridcolor: "#1E293B" },
    yaxis2: {
      title: "Mean Return (bps)",
      overlaying: "y",
      side: "right",
      gridcolor: "#1E293B",
      tickfont: { color: "#8B5CF6" },
    },
    legend: { x: 0.01, y: 0.99 },
  };

  // 2D Heatmap: Weekday x Time Bucket
  const traceHeatmap = {
    x: surface_3d.x_buckets,
    y: surface_3d.y_weekdays,
    z: surface_3d.z_matrix,
    type: "heatmap",
    colorscale: "Viridis",
  };

  // 3D Surface
  const trace3DSurface = {
    x: surface_3d.x_buckets,
    y: surface_3d.y_weekdays,
    z: surface_3d.z_matrix,
    type: "surface",
    colorscale: "Viridis",
  };

  const statsRows: StatRow[] = [
    {
      metric: "One-Way ANOVA F-Test",
      value: kpis.anova_f_stat.toFixed(2),
      stat: "F-Stat",
      pValue: kpis.anova_p_val,
      significance: kpis.anova_p_val < 0.01 ? "p < 0.01 ***" : "Not Sig",
      interpretation: "Confirms non-random intraday dispersion across trading intervals.",
    },
    {
      metric: "Diurnal U-Shape Ratio",
      value: `${kpis.u_shape_ratio.toFixed(2)}x`,
      stat: "(Open + Close) / (2 × Mid)",
      significance: flags.has_u_shape ? "U-Shape Confirmed" : "Flat Profile",
      interpretation: "Ratio > 1.25 reflects concentrated liquidity at market open and close.",
    },
    {
      metric: "Flexible Fourier Form R²",
      value: kpis.fff_r_squared.toFixed(3),
      stat: `P = ${fourierTerms} harmonics`,
      significance: "Goodness of Fit",
      interpretation: "Harmonic trigonometric polynomial accurately captures diurnal periodic wave.",
    },
    {
      metric: "Open vs Midday t-Test",
      value: kpis.open_mid_t_stat.toFixed(2),
      stat: "Two-sample t",
      pValue: kpis.open_mid_p_val,
      significance: kpis.open_mid_p_val < 0.01 ? "p < 0.01 ***" : "Not Sig",
      interpretation: "Opening price discovery generates significantly higher variance than lunch hour.",
    },
  ];

  return (
    <ModuleWrapper
      moduleId={2}
      verdictText={verdict}
      onRecalculate={compute}
      isCalculating={isCalculating}
      kpisMap={kpis}
      paramsMap={{ bucketMinutes, fourierTerms }}
      overviewContent={
        <div className="space-y-4 text-xs font-mono text-slate-300">
          <div className="p-4 rounded-lg bg-[#090D16] border border-[#1E293B]">
            <h3 className="text-sm font-bold text-cyan-400 font-sans mb-2">
              Theoretical Foundation: Andersen & Bollerslev (1997) Intraday Periodicity
            </h3>
            <p className="leading-relaxed">
              In their influential paper <em>"Intraday Periodicity and Volatility Persistence in Financial Markets"</em> (Journal of Empirical Finance), Torben Andersen and Tim Bollerslev demonstrated that high-frequency financial volatility is governed by a prominent, deterministic diurnal pattern (the classic U-shape or reverse J-shape).
            </p>
            <p className="mt-2 text-slate-300">
              Unadjusted high-frequency returns confound this deterministic diurnal periodicity with stochastic volatility clustering. Andersen & Bollerslev introduced the <strong>Flexible Fourier Form (FFF)</strong> to filter out the intraday seasonality:
            </p>
            <div className="mt-2 text-cyan-300 p-2 rounded bg-[#0D111D] border border-cyan-500/20">
              ln(s_t) = c + ∑_{`p=1`}^P [ a_p cos(2π p t / N) + b_p sin(2π p t / N) ]
            </div>
          </div>
        </div>
      }
      controlsContent={
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-mono text-slate-300 font-semibold">
              Time-of-Day Interval Bucket:
            </label>
            <select
              value={bucketMinutes}
              onChange={(e) => setBucketMinutes(parseInt(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-[#090D16] border border-[#1E293B] text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
            >
              <option value={5}>5-Minute Buckets</option>
              <option value={15}>15-Minute Buckets</option>
              <option value={30}>30-Minute Buckets</option>
              <option value={60}>60-Minute (Hourly) Buckets</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300 font-semibold">Fourier Harmonic Order (P):</label>
              <span className="text-cyan-400 font-bold">P = {fourierTerms}</span>
            </div>
            <input
              type="range"
              min={2}
              max={8}
              step={1}
              value={fourierTerms}
              onChange={(e) => setFourierTerms(parseInt(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <p className="text-[11px] font-mono text-slate-500">
              Higher P captures sharper curvature near market open and close.
            </p>
          </div>
        </div>
      }
      kpisContent={
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <KpiCard
              title="Diurnal U-Shape Ratio"
              value={`${kpis.u_shape_ratio.toFixed(2)}x`}
              subtext="Open/Close vs Midday"
              significance={flags.has_u_shape ? "pass" : "neutral"}
              significanceLabel={flags.has_u_shape ? "U-SHAPE DETECTED" : "UNIFORM"}
              accentColor="#3B82F6"
            />
            <KpiCard
              title="ANOVA F-Statistic"
              value={kpis.anova_f_stat.toFixed(1)}
              subtext={`p-value: ${kpis.anova_p_val < 0.0001 ? "< 1e-4" : kpis.anova_p_val.toFixed(4)}`}
              significance={flags.has_intraday_seasonality ? "pass" : "warning"}
              significanceLabel={flags.has_intraday_seasonality ? "PERIODIC ***" : "HOMOGENEOUS"}
              accentColor="#10B981"
            />
            <KpiCard
              title="Fourier Filter Fit (R²)"
              value={kpis.fff_r_squared.toFixed(3)}
              subtext={`P = ${fourierTerms} terms`}
              significance="pass"
              significanceLabel="SMOOTHED"
              accentColor="#F59E0B"
            />
            <KpiCard
              title="Peak Volatility Interval"
              value={kpis.highest_vol_bucket}
              subtext={`Lowest: ${kpis.lowest_vol_bucket}`}
              significance="neutral"
              significanceLabel="SESSION PEAK"
              accentColor="#06B6D4"
            />
          </div>

          <StatsTable title="Module 2 Intraday Seasonality Econometrics" rows={statsRows} />
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
                2D Profiles & Heatmap
              </button>
              <button
                onClick={() => setChartView("3D")}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  chartView === "3D" ? "bg-violet-500/20 text-violet-300 border border-violet-500/40" : "text-slate-400"
                }`}
              >
                3D Day × Time Surface
              </button>
            </div>
          </div>

          {chartView === "2D" ? (
            <>
              <PlotlyChart
                data={[traceEmpiricalVol, traceFffVol, traceMeanReturns]}
                layout={layoutIntradayProfile}
                title="Intraday Volatility U-Shape and Flexible Fourier Form Periodicity"
              />

              <PlotlyChart
                data={[traceHeatmap]}
                layout={{
                  title: "Weekday × Time-of-Day Volatility Intensity Heatmap",
                  xaxis: { title: "Time of Day Bucket" },
                  yaxis: { title: "Day of Week" },
                }}
                title="Weekday × Time Heatmap"
              />
            </>
          ) : (
            <PlotlyChart
              data={[trace3DSurface]}
              layout={{
                title: "3D Surface: Weekday (Y) × Time-of-Day Bucket (X) × Volatility (Z)",
                scene: {
                  xaxis: { title: "Time Bucket" },
                  yaxis: { title: "Weekday" },
                  zaxis: { title: "Volatility Proxy" },
                },
              }}
              is3D
              style={{ width: "100%", height: "550px" }}
              title="3D Weekday × Time Volatility Surface"
            />
          )}
        </div>
      }
      interpretContent={
        <div className="space-y-4 text-xs font-mono text-slate-300 leading-relaxed">
          <div className="p-4 rounded-lg bg-[#090D16] border border-[#1E293B]">
            <h4 className="text-sm font-bold text-cyan-400 font-sans mb-2">
              Execution Algorithm & Market Making Implications
            </h4>
            <div className="space-y-2">
              <p>
                <strong>1. VWAP & TWAP Scheduling:</strong>
                <br />
                Executing large block orders uniformly across time (TWAP) severely incurs excess market impact during midday liquidity troughs. Algorithmic execution engines must follow the FFF volume curve (VWAP / Volume Profile matching) to minimize slippage.
              </p>
              <p>
                <strong>2. Market Maker Spread Widening:</strong>
                <br />
                During the opening 15-30 minutes, elevated information asymmetry and inventory risk justify widening bid-ask spreads by 1.5x - 2.5x relative to midday.
              </p>
            </div>
          </div>
        </div>
      }
    />
  );
}
