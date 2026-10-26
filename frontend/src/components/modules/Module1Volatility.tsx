"use client";

import React, { useState, useEffect } from "react";
import { useData } from "@/context/DataContext";
import { runModule1 } from "@/lib/api";
import { Module1Result } from "@/lib/types";
import { ModuleWrapper } from "@/components/shared/ModuleWrapper";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatsTable, StatRow } from "@/components/shared/StatsTable";
import { PlotlyChart } from "@/components/shared/PlotlyChart";
import { Activity, Zap, ShieldAlert, BarChart2 } from "lucide-react";

export function Module1Volatility() {
  const { returns, records } = useData();
  const [maxLag, setMaxLag] = useState(30);
  const [garchType, setGarchType] = useState("GARCH");
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<Module1Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chartView, setChartView] = useState<"2D" | "3D">("2D");

  const compute = async () => {
    if (returns.length < 50) return;
    setIsCalculating(true);
    setError(null);
    try {
      const res = await runModule1(returns, maxLag, garchType);
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to calculate volatility clustering");
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    compute();
  }, [returns.length, maxLag, garchType]);

  if (!result) {
    return (
      <div className="flex items-center justify-center p-16 bg-[#0D111D] border border-[#1E293B] rounded-2xl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-400">
            {error || "Estimating GARCH(1,1), ACF & Stylized Facts..."}
          </span>
        </div>
      </div>
    );
  }

  const { kpis, flags, acf_data, conditional_volatility, qq_plot, surface_3d, verdict } = result;

  // Build 2D Chart: Returns with Volatility Regime Background
  const traceReturns = {
    x: records.map((r) => r.timestamp),
    y: returns.map((r) => r * 100),
    type: "scatter",
    mode: "lines",
    name: "Log Returns (%)",
    line: { color: "#38BDF8", width: 1 },
  };

  const traceCondVol = {
    x: records.map((r) => r.timestamp),
    y: conditional_volatility.map((v) => v * 100),
    type: "scatter",
    mode: "lines",
    name: "Annualized Cond Vol (%)",
    yaxis: "y2",
    line: { color: "#F59E0B", width: 1.5 },
  };

  const layoutReturnsVol = {
    title: "Asset Returns (%) and GARCH(1,1) Conditional Volatility Series",
    yaxis: { title: "Return (%)", gridcolor: "#1E293B" },
    yaxis2: {
      title: "Ann. Volatility (%)",
      overlaying: "y",
      side: "right",
      gridcolor: "#1E293B",
      tickfont: { color: "#F59E0B" },
    },
    legend: { x: 0.01, y: 0.99 },
  };

  // Build 2D Chart: ACF Comparison (Raw vs |r| vs r^2)
  const traceAcfRaw = {
    x: acf_data.lags,
    y: acf_data.acf_raw,
    type: "bar",
    name: "ACF: Raw Returns r_t",
    marker: { color: "#64748B" },
  };

  const traceAcfAbs = {
    x: acf_data.lags,
    y: acf_data.acf_abs,
    type: "scatter",
    mode: "lines+markers",
    name: "ACF: Absolute |r_t| (Clustering)",
    line: { color: "#06B6D4", width: 2 },
  };

  const traceAcfSq = {
    x: acf_data.lags,
    y: acf_data.acf_sq,
    type: "scatter",
    mode: "lines",
    name: "ACF: Squared Returns r_t^2",
    line: { color: "#8B5CF6", width: 1.5, dash: "dot" },
  };

  const traceUpperBand = {
    x: acf_data.lags,
    y: Array(acf_data.lags.length).fill(acf_data.bartlett_band),
    type: "scatter",
    mode: "lines",
    name: "95% Bartlett Band (+1.96/√N)",
    line: { color: "#EF4444", width: 1, dash: "dash" },
  };

  const traceLowerBand = {
    x: acf_data.lags,
    y: Array(acf_data.lags.length).fill(-acf_data.bartlett_band),
    type: "scatter",
    mode: "lines",
    name: "95% Bartlett Band (-1.96/√N)",
    line: { color: "#EF4444", width: 1, dash: "dash" },
  };

  // Build 2D Chart: QQ Plot
  const traceQQ = {
    x: qq_plot.theoretical,
    y: qq_plot.sample,
    mode: "markers",
    type: "scatter",
    name: "Sample Quantiles",
    marker: { color: "#38BDF8", size: 5 },
  };

  const traceQQLine = {
    x: [-3.5, 3.5],
    y: [-3.5, 3.5],
    mode: "lines",
    type: "scatter",
    name: "Normal 45° Reference",
    line: { color: "#EF4444", width: 1.5, dash: "dash" },
  };

  // Build 3D Chart: Surface of Autocorrelation across Lag x Power q
  const trace3DSurface = {
    x: surface_3d.x_lags,
    y: surface_3d.y_powers,
    z: surface_3d.z_matrix,
    type: "surface",
    colorscale: "Viridis",
    contours: {
      z: { show: true, usecolormap: true, highlightcolor: "#06B6D4", project: { z: true } },
    },
  };

  const layout3D = {
    title: "3D Manifold: Autocorrelation Surface across Lag (k) × Power (q) of |r|^q",
    scene: {
      xaxis: { title: "Lag k (1..25)" },
      yaxis: { title: "Power q of |r|^q" },
      zaxis: { title: "Autocorrelation" },
    },
  };

  // Build Stats Table Rows
  const statsRows: StatRow[] = [
    {
      metric: "Engle ARCH-LM Test",
      value: kpis.arch_lm_stat.toFixed(2),
      stat: "LM Stat",
      pValue: kpis.arch_lm_pval,
      significance: kpis.arch_lm_pval < 0.05 ? "p < 0.05 ***" : "Not Sig",
      interpretation: "Rejection of null validates autoregressive conditional heteroskedasticity.",
    },
    {
      metric: "Ljung-Box Q(10) on r²",
      value: kpis.ljung_box_stat_10.toFixed(2),
      stat: "Q(10)",
      pValue: kpis.ljung_box_pval_10,
      significance: kpis.ljung_box_pval_10 < 0.05 ? "p < 0.05 ***" : "Not Sig",
      interpretation: "Confirms persistent serial dependence in second-moment volatility.",
    },
    {
      metric: "GARCH Persistence (α + β)",
      value: kpis.garch_persistence.toFixed(4),
      stat: `α=${kpis.garch_alpha}, β=${kpis.garch_beta}`,
      significance: kpis.garch_persistence < 1.0 ? "Stationary" : "Non-Stationary",
      interpretation: `Half-life of volatility shocks is ${kpis.garch_half_life.toFixed(1)} periods.`,
    },
    {
      metric: "Jarque-Bera Fat Tails Test",
      value: kpis.jarque_bera_stat.toFixed(2),
      stat: `Excess Kurt=${kpis.excess_kurtosis}`,
      pValue: kpis.jarque_bera_pval,
      significance: kpis.jarque_bera_pval < 0.05 ? "Fat Tailed ***" : "Gaussian",
      interpretation: "Rejection of normality confirms heavy power-law tail distribution.",
    },
    {
      metric: "Power-Law Decay Exponent (γ)",
      value: kpis.power_law_gamma.toFixed(3),
      stat: `R² = ${kpis.power_law_r2}`,
      significance: "Empirical Fit",
      interpretation: "Absolute returns decay as k^(-γ), typical of Cont (2001) stylized facts.",
    },
    {
      metric: "Leverage Effect Correlation",
      value: kpis.leverage_effect_corr.toFixed(3),
      stat: "Corr(r_t, σ_{t+1}²)",
      significance: kpis.leverage_effect_corr < 0 ? "Asymmetric Vol" : "Symmetric",
      interpretation: "Negative correlation indicates market selloffs trigger higher volatility than rallies.",
    },
  ];

  return (
    <ModuleWrapper
      moduleId={1}
      verdictText={verdict}
      onRecalculate={compute}
      isCalculating={isCalculating}
      kpisMap={kpis}
      paramsMap={{ maxLag, garchType }}
      overviewContent={
        <div className="space-y-4 text-xs font-mono text-slate-300">
          <div className="p-4 rounded-lg bg-[#090D16] border border-[#1E293B]">
            <h3 className="text-sm font-bold text-cyan-400 font-sans mb-2">
              Theoretical Foundation: Rama Cont (2001) Stylised Facts of Financial Returns
            </h3>
            <p className="leading-relaxed">
              In his landmark 2001 paper <em>"Empirical properties of asset returns: stylised facts and statistical issues"</em>, Rama Cont formalized eleven persistent statistical realities that contradict the classical Bachelier/Black-Scholes Geometric Brownian Motion assumptions:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1.5 text-slate-300">
              <li><strong>Absence of autocorrelations in raw returns:</strong> Autocorrelations of asset returns Corr(r_t, r_{`t-k`}) are statistically indistinguishable from zero for lags k &gt; 15 minutes.</li>
              <li><strong>Slow decay of autocorrelation in absolute returns:</strong> Autocorrelation of absolute returns Corr(|r_t|, |r_{`t-k`}|) is positive and displays extremely slow power-law decay ~ k^(-γ) (where γ ∈ [0.2, 0.4]).</li>
              <li><strong>Volatility Clustering:</strong> High-volatility events cluster together in time; large price fluctuations are followed by large price fluctuations of either sign.</li>
              <li><strong>Heavy / Fat Tails:</strong> Unconditional return distributions display excess kurtosis (&gt; 0) and tail exponents α &lt; 5, ruling out Gaussian distributions.</li>
              <li><strong>Leverage Effect:</strong> Volatility is negatively correlated with past returns; negative price shocks induce higher conditional volatility spikes than positive shocks of equal magnitude.</li>
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-[#090D16] border border-[#1E293B]">
            <div className="text-xs font-bold text-slate-300 mb-1">ECONOMETRIC FORMULATION:</div>
            <div className="text-cyan-300 p-2 rounded bg-[#0D111D] border border-cyan-500/20">
              σ_t² = ω + α ε_{`t-1`}² + β σ_{`t-1`}², where Persistence = α + β &lt; 1
            </div>
            <p className="mt-2 text-slate-400 text-[11px]">
              Engle (1982) ARCH-LM test evaluates H0: α1 = ... = αp = 0. Ljung-Box test evaluates joint autocorrelation up to lag k on squared innovations.
            </p>
          </div>
        </div>
      }
      controlsContent={
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300 font-semibold">Maximum Lag (k):</label>
              <span className="text-cyan-400 font-bold">{maxLag} Lags</span>
            </div>
            <input
              type="range"
              min={10}
              max={60}
              step={5}
              value={maxLag}
              onChange={(e) => setMaxLag(parseInt(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <p className="text-[11px] font-mono text-slate-500">
              Controls number of autocorrelation lags evaluated for ACF and power-law decay.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-mono text-slate-300 font-semibold">
              GARCH Volatility Model Specification:
            </label>
            <select
              value={garchType}
              onChange={(e) => setGarchType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#090D16] border border-[#1E293B] text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="GARCH">Standard GARCH(1,1) (Bollerslev 1986)</option>
              <option value="EGARCH">Exponential GARCH (EGARCH) (Nelson 1991)</option>
              <option value="GJR">GJR-GARCH Asymmetric (Glosten, Jagannathan & Runkle 1993)</option>
            </select>
            <p className="text-[11px] font-mono text-slate-500">
              EGARCH and GJR allow asymmetric leverage shock modeling.
            </p>
          </div>
        </div>
      }
      kpisContent={
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <KpiCard
              title="GARCH Persistence (α + β)"
              value={kpis.garch_persistence.toFixed(4)}
              subtext={`Half-Life: ${kpis.garch_half_life.toFixed(1)} bars`}
              significance={kpis.garch_persistence < 1.0 ? "pass" : "critical"}
              significanceLabel={kpis.garch_persistence < 1.0 ? "STATIONARY" : "UNIT ROOT"}
              accentColor="#06B6D4"
            />
            <KpiCard
              title="ARCH-LM Test (p-val)"
              value={kpis.arch_lm_pval < 0.0001 ? "< 1e-4" : kpis.arch_lm_pval.toFixed(4)}
              subtext={`LM Stat: ${kpis.arch_lm_stat.toFixed(1)}`}
              significance={flags.has_volatility_clustering ? "pass" : "warning"}
              significanceLabel={flags.has_volatility_clustering ? "CLUSTERING ***" : "NO ARCH"}
              accentColor="#10B981"
            />
            <KpiCard
              title="Excess Kurtosis"
              value={`+${kpis.excess_kurtosis.toFixed(2)}`}
              subtext={`Jarque-Bera: ${kpis.jarque_bera_stat.toFixed(0)}`}
              significance={flags.has_fat_tails ? "critical" : "pass"}
              significanceLabel={flags.has_fat_tails ? "FAT TAILS" : "GAUSSIAN"}
              accentColor="#8B5CF6"
            />
            <KpiCard
              title="Leverage Correlation"
              value={kpis.leverage_effect_corr.toFixed(3)}
              subtext="Corr(r_t, σ_{t+1}²)"
              significance={flags.has_leverage_effect ? "warning" : "neutral"}
              significanceLabel={flags.has_leverage_effect ? "ASYMMETRIC" : "SYMMETRIC"}
              accentColor="#F59E0B"
            />
          </div>

          <StatsTable title="Module 1 Econometric Verification Table" rows={statsRows} />
        </div>
      }
      chartsContent={
        <div className="space-y-6">
          {/* 2D / 3D Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">CHART VISUALIZATION MODE:</span>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#090D16] border border-[#1E293B]">
              <button
                onClick={() => setChartView("2D")}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  chartView === "2D" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400"
                }`}
              >
                2D Comprehensive
              </button>
              <button
                onClick={() => setChartView("3D")}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  chartView === "3D" ? "bg-violet-500/20 text-violet-300 border border-violet-500/40" : "text-slate-400"
                }`}
              >
                3D Volatility Manifold
              </button>
            </div>
          </div>

          {chartView === "2D" ? (
            <>
              {/* Chart 1: Returns with Conditional Volatility */}
              <PlotlyChart
                data={[traceReturns, traceCondVol]}
                layout={layoutReturnsVol}
                title="Asset Return Series with GARCH(1,1) Conditional Volatility"
              />

              {/* Chart 2: Autocorrelation Comparison (Cont 2001 core test) */}
              <PlotlyChart
                data={[traceAcfRaw, traceAcfAbs, traceAcfSq, traceUpperBand, traceLowerBand]}
                layout={{
                  title: "Autocorrelation of Raw vs Absolute vs Squared Returns (with 95% Bartlett Band)",
                  xaxis: { title: "Lag (k)" },
                  yaxis: { title: "Autocorrelation Coefficient", range: [-0.15, 0.45] },
                }}
                title="Autocorrelation Comparison (Raw vs Absolute vs Squared)"
              />

              {/* Chart 3: QQ Plot */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PlotlyChart
                  data={[traceQQ, traceQQLine]}
                  layout={{
                    title: "Normal Quantile-Quantile (Q-Q) Plot (Fat Tail Diagnostics)",
                    xaxis: { title: "Theoretical Gaussian Quantiles" },
                    yaxis: { title: "Empirical Sample Quantiles" },
                  }}
                  title="Normal Q-Q Plot"
                />

                <PlotlyChart
                  data={[
                    {
                      x: returns.map((r) => r * 100),
                      type: "histogram",
                      name: "Empirical Returns",
                      marker: { color: "rgba(6, 182, 212, 0.6)" },
                      nbinsx: 50,
                    },
                  ]}
                  layout={{
                    title: "Empirical Return Distribution Histogram",
                    xaxis: { title: "Return (%)" },
                    yaxis: { title: "Frequency" },
                  }}
                  title="Empirical Distribution Histogram"
                />
              </div>
            </>
          ) : (
            <PlotlyChart
              data={[trace3DSurface]}
              layout={layout3D}
              is3D
              style={{ width: "100%", height: "550px" }}
              title="3D Autocorrelation Surface: Lag (k) × Power (q) of |r|^q"
            />
          )}
        </div>
      }
      interpretContent={
        <div className="space-y-4 text-xs font-mono text-slate-300 leading-relaxed">
          <div className="p-4 rounded-lg bg-[#090D16] border border-[#1E293B]">
            <h4 className="text-sm font-bold text-cyan-400 font-sans mb-2">
              Institutional Portfolio Manager Interpretation Guide
            </h4>
            <div className="space-y-2">
              <p>
                <strong>1. Why is Raw ACF Zero while Absolute ACF is Positive?</strong>
                <br />
                Efficient Market Hypothesis implies asset prices follow a martingale difference sequence: tomorrow's return direction cannot be forecasted by past returns. However, the <em>magnitude</em> (second moment) is highly predictable. The slow power-law decay proves that volatility exhibits long memory.
              </p>
              <p>
                <strong>2. Risk Management (VaR and Expected Shortfall) Implications:</strong>
                <br />
                Gaussian VaR models that assume i.i.d. Normal returns systematically under-price tail risk by up to 300%. A GARCH-filtered historical simulation or EVT (Extreme Value Theory) approach must be used instead.
              </p>
              <p>
                <strong>3. Volatility Regimes & Position Sizing:</strong>
                <br />
                When conditional volatility spikes into the top tercile (&gt; 67th percentile), position sizing must be dynamically downscaled inversely proportional to σ_t to maintain constant portfolio risk contribution.
              </p>
            </div>
          </div>
        </div>
      }
    />
  );
}
