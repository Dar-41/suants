"use client";

import React, { useState, useEffect } from "react";
import { useData } from "@/context/DataContext";
import { runModule4 } from "@/lib/api";
import { Module4Result } from "@/lib/types";
import { ModuleWrapper } from "@/components/shared/ModuleWrapper";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatsTable, StatRow } from "@/components/shared/StatsTable";
import { PlotlyChart } from "@/components/shared/PlotlyChart";

export function Module4FactorNeutrality() {
  const { returns, records } = useData();
  const [rollingWindow, setRollingWindow] = useState(60);
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<Module4Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chartView, setChartView] = useState<"2D" | "3D">("2D");

  const compute = async () => {
    if (returns.length < 40) return;
    setIsCalculating(true);
    setError(null);
    try {
      const res = await runModule4(returns, rollingWindow);
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to calculate factor neutrality");
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    compute();
  }, [returns.length, rollingWindow]);

  if (!result) {
    return (
      <div className="flex items-center justify-center p-16 bg-[#0D111D] border border-[#1E293B] rounded-2xl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-400">
            {error || "Estimating Fama-French Regression & Newey-West HAC Errors..."}
          </span>
        </div>
      </div>
    );
  }

  const { kpis, flags, betas, beta_tstats, beta_pvals, confidence_intervals, waterfall_attribution, cumulative_curves, surface_3d, verdict } = result;

  const factorKeys = Object.keys(betas);
  const factorValues = Object.values(betas);

  // 2D Chart 1: Factor Betas Bar Chart with 95% Newey-West Error Bars
  const traceBetaBars = {
    x: factorKeys,
    y: factorValues,
    type: "bar",
    name: "Factor Betas (β)",
    marker: {
      color: factorValues.map((v) => (Math.abs(v) > 0.2 ? "#F59E0B" : "#10B981")),
    },
    error_y: {
      type: "data",
      symmetric: false,
      array: factorKeys.map((k) => confidence_intervals.high[k] - betas[k]),
      arrayminus: factorKeys.map((k) => betas[k] - confidence_intervals.low[k]),
      color: "#94A3B8",
      thickness: 1.5,
    },
  };

  // 2D Chart 2: Cumulative Raw Returns vs Factor-Neutral Residual Alpha
  const steps = records.slice(0, cumulative_curves.raw_strategy.length).map((r) => r.timestamp);
  const traceRawCum = {
    x: steps,
    y: cumulative_curves.raw_strategy,
    type: "scatter",
    mode: "lines",
    name: "Raw Unhedged Strategy Return",
    line: { color: "#38BDF8", width: 1.5 },
  };

  const traceResidualCum = {
    x: steps,
    y: cumulative_curves.residual_alpha,
    type: "scatter",
    mode: "lines",
    name: "Factor-Neutralized Residual Alpha (e_t)",
    line: { color: "#10B981", width: 2 },
  };

  // 2D Chart 3: Return Attribution Waterfall
  const waterfallLabels = Object.keys(waterfall_attribution);
  const waterfallValues = Object.values(waterfall_attribution);
  const traceWaterfall = {
    x: waterfallLabels,
    y: waterfallValues,
    type: "bar",
    name: "Annualized Attribution (bps)",
    marker: {
      color: waterfallValues.map((v) => (v >= 0 ? "#10B981" : "#EF4444")),
    },
  };

  // 3D Rolling Beta Surface (Time x Factor x Beta)
  const trace3D = {
    x: surface_3d.x_time_steps,
    y: surface_3d.y_factors,
    z: surface_3d.z_matrix,
    type: "surface",
    colorscale: "Viridis",
  };

  const statsRows: StatRow[] = [
    {
      metric: "Annualized Jensen's Alpha (α)",
      value: `${kpis.annualized_alpha_pct.toFixed(2)}%`,
      stat: `t = ${kpis.alpha_t_stat.toFixed(2)}`,
      pValue: kpis.alpha_p_value,
      significance: flags.has_significant_alpha ? "Significant (p < 0.05) ***" : "Not Sig",
      interpretation: "True idiosyncratic excess return after stripping all systematic factor risk.",
    },
    {
      metric: "Market Excess Beta (β_Mkt)",
      value: kpis.market_beta.toFixed(3),
      stat: `t = ${beta_tstats["Mkt-RF"] ?? "—"}`,
      pValue: beta_pvals["Mkt-RF"],
      significance: Math.abs(kpis.market_beta) < 0.15 ? "Market Neutral" : "Market Exposed",
      interpretation: "Sensitivity to S&P 500 / broad equity market direction.",
    },
    {
      metric: "Size Beta (β_SMB)",
      value: kpis.smb_beta.toFixed(3),
      stat: `t = ${beta_tstats["SMB"] ?? "—"}`,
      pValue: beta_pvals["SMB"],
      significance: Math.abs(kpis.smb_beta) < 0.15 ? "Size Neutral" : "Small/Large Cap Tilt",
      interpretation: "Sensitivity to Small-Minus-Big capitalization spread.",
    },
    {
      metric: "Value Beta (β_HML)",
      value: kpis.hml_beta.toFixed(3),
      stat: `t = ${beta_tstats["HML"] ?? "—"}`,
      pValue: beta_pvals["HML"],
      significance: Math.abs(kpis.hml_beta) < 0.15 ? "Value Neutral" : "Growth/Value Tilt",
      interpretation: "Sensitivity to High-Minus-Low book-to-market factor.",
    },
    {
      metric: "Model Explanatory Power (R²)",
      value: kpis.r_squared.toFixed(3),
      stat: `Adj R² = ${kpis.adj_r_squared.toFixed(3)}`,
      significance: "Goodness of Fit",
      interpretation: `${(kpis.r_squared * 100).toFixed(1)}% of variance explained by systematic factors.`,
    },
  ];

  return (
    <ModuleWrapper
      moduleId={4}
      verdictText={verdict}
      onRecalculate={compute}
      isCalculating={isCalculating}
      kpisMap={kpis}
      paramsMap={{ rollingWindow }}
      overviewContent={
        <div className="space-y-4 text-xs font-mono text-slate-300">
          <div className="p-4 rounded-lg bg-[#090D16] border border-[#1E293B]">
            <h3 className="text-sm font-bold text-cyan-400 font-sans mb-2">
              Theoretical Foundation: Fama & French (1993) / Carhart (1997) Multi-Factor Models
            </h3>
            <p className="leading-relaxed">
              Eugene Fama and Kenneth French demonstrated in 1993 that the classical CAPM single-beta model is inadequate for explaining cross-sectional returns. They introduced the 3-factor model expanding market risk to include Size (SMB) and Value (HML), later extended by Mark Carhart (1997) with Momentum (MOM).
            </p>
            <div className="mt-2 text-cyan-300 p-2 rounded bg-[#0D111D] border border-cyan-500/20">
              R_{`it`} - R_{`ft`} = α_i + β_{`Mkt`} (R_{`mt`} - R_{`ft`}) + β_{`SMB`} SMB_t + β_{`HML`} HML_t + β_{`MOM`} MOM_t + ε_{`it`}
            </div>
            <p className="mt-2 text-slate-400 text-[11px]">
              Institutional hedge fund investors demand pure <strong>Alpha (α)</strong>. If a strategy's returns can be replicated by static factor betas, it does not warrant high 2/20 management fees. Standard errors are computed using <strong>Newey-West (1987) HAC</strong> to prevent inflated t-statistics from autocorrelation.
            </p>
          </div>
        </div>
      }
      controlsContent={
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300 font-semibold">Rolling OLS Estimation Window:</label>
              <span className="text-cyan-400 font-bold">{rollingWindow} Days</span>
            </div>
            <input
              type="range"
              min={30}
              max={150}
              step={10}
              value={rollingWindow}
              onChange={(e) => setRollingWindow(parseInt(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <p className="text-[11px] font-mono text-slate-500">
              Controls lookback window for estimating time-varying factor betas.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#090D16] border border-[#1E293B] text-xs font-mono text-slate-400">
            <span className="text-slate-300 font-semibold">Factor Library Source:</span>
            <p className="mt-1 text-[11px]">
              Kenneth R. French Data Library (Market Excess, SMB, HML, MOM, Risk-Free Rate).
            </p>
          </div>
        </div>
      }
      kpisContent={
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <KpiCard
              title="Annualized Alpha (α)"
              value={`${kpis.annualized_alpha_pct.toFixed(2)}%`}
              subtext={`t-stat: ${kpis.alpha_t_stat.toFixed(2)} (p = ${kpis.alpha_p_value.toFixed(4)})`}
              significance={flags.has_significant_alpha ? "pass" : "neutral"}
              significanceLabel={flags.has_significant_alpha ? "SIGNIFICANT ALPHA" : "NO ALPHA"}
              accentColor="#10B981"
            />
            <KpiCard
              title="Market Beta (β_Mkt)"
              value={kpis.market_beta.toFixed(3)}
              subtext="S&P 500 Market Sensitivity"
              significance={flags.is_factor_neutral ? "pass" : "warning"}
              significanceLabel={flags.is_factor_neutral ? "FACTOR NEUTRAL" : "FACTOR EXPOSED"}
              accentColor="#06B6D4"
            />
            <KpiCard
              title="Factor R²"
              value={kpis.r_squared.toFixed(3)}
              subtext={`Adj R²: ${kpis.adj_r_squared.toFixed(3)}`}
              significance="neutral"
              significanceLabel="EXPLAINED VARIANCE"
              accentColor="#8B5CF6"
            />
            <KpiCard
              title="Newey-West HAC Lags"
              value={kpis.newey_west_lags}
              subtext="Robust standard error lags"
              significance="pass"
              significanceLabel="HAC ROBUST"
              accentColor="#F59E0B"
            />
          </div>

          <StatsTable title="Module 4 Factor Regression & Newey-West HAC Table" rows={statsRows} />
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
                2D Betas & Attribution
              </button>
              <button
                onClick={() => setChartView("3D")}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  chartView === "3D" ? "bg-violet-500/20 text-violet-300 border border-violet-500/40" : "text-slate-400"
                }`}
              >
                3D Rolling Beta Surface
              </button>
            </div>
          </div>

          {chartView === "2D" ? (
            <>
              {/* Factor Exposure with 95% Newey West CIs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PlotlyChart
                  data={[traceBetaBars]}
                  layout={{
                    title: "Factor Betas (β) with 95% Newey-West Confidence Intervals",
                    xaxis: { title: "Risk Factor" },
                    yaxis: { title: "Beta Coefficient" },
                  }}
                  title="Factor Exposure Betas"
                />

                <PlotlyChart
                  data={[traceWaterfall]}
                  layout={{
                    title: "Annualized Return Attribution (Waterfall Decomposition in bps)",
                    xaxis: { title: "Attribution Component" },
                    yaxis: { title: "Annualized Contribution (bps)" },
                  }}
                  title="Return Attribution Waterfall"
                />
              </div>

              {/* Cumulative Raw vs Residual Alpha */}
              <PlotlyChart
                data={[traceRawCum, traceResidualCum]}
                layout={{
                  title: "Cumulative Performance: Raw Unhedged Return vs Factor-Neutralized Residual Alpha (e_t)",
                  xaxis: { title: "Date" },
                  yaxis: { title: "Compound Wealth ($1.00 Base)" },
                }}
                title="Cumulative Raw vs Factor-Neutral Alpha"
              />
            </>
          ) : (
            <PlotlyChart
              data={[trace3D]}
              layout={{
                title: "3D Rolling Factor Betas: Time (X) × Factor (Y) × Beta Value (Z)",
                scene: {
                  xaxis: { title: "Time Step" },
                  yaxis: { title: "Factor" },
                  zaxis: { title: "Beta" },
                },
              }}
              is3D
              style={{ width: "100%", height: "550px" }}
              title="3D Rolling Beta Manifold"
            />
          )}
        </div>
      }
      interpretContent={
        <div className="space-y-4 text-xs font-mono text-slate-300 leading-relaxed">
          <div className="p-4 rounded-lg bg-[#090D16] border border-[#1E293B]">
            <h4 className="text-sm font-bold text-cyan-400 font-sans mb-2">
              Institutional Allocator & Due Diligence Guide
            </h4>
            <div className="space-y-2">
              <p>
                <strong>1. Hidden Factor Exposure (Beta Disguised as Alpha):</strong>
                <br />
                Many "alpha" strategies are simply taking implicit long exposure to the market (Mkt-RF) or small caps (SMB). If the residual return curve flattens out to zero after stripping factors, the manager is generating zero pure alpha.
              </p>
              <p>
                <strong>2. Newey-West Standard Error Importance:</strong>
                <br />
                OLS standard errors assume independent errors. In financial returns with autocorrelation, classical OLS severely underestimates standard errors, generating artificially high t-statistics (p-hacking). Newey-West HAC ensures econometric integrity.
              </p>
            </div>
          </div>
        </div>
      }
    />
  );
}
