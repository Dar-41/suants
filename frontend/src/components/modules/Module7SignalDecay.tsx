"use client";

import React, { useState, useEffect } from "react";
import { useData } from "@/context/DataContext";
import { runModule7 } from "@/lib/api";
import { Module7Result } from "@/lib/types";
import { ModuleWrapper } from "@/components/shared/ModuleWrapper";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatsTable, StatRow } from "@/components/shared/StatsTable";
import { PlotlyChart } from "@/components/shared/PlotlyChart";

export function Module7SignalDecay() {
  const { returns } = useData();
  const [maxHorizon, setMaxHorizon] = useState(25);
  const [signalLookback, setSignalLookback] = useState(10);
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<Module7Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chartView, setChartView] = useState<"2D" | "3D">("2D");

  const compute = async () => {
    if (returns.length < 50) return;
    setIsCalculating(true);
    setError(null);
    try {
      const res = await runModule7(returns, undefined, maxHorizon, signalLookback);
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to calculate signal decay");
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    compute();
  }, [returns.length, maxHorizon, signalLookback]);

  if (!result) {
    return (
      <div className="flex items-center justify-center p-16 bg-[#0D111D] border border-[#1E293B] rounded-2xl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-400">
            {error || "Estimating Information Coefficient Decay & Data-Snooping Reality Check..."}
          </span>
        </div>
      </div>
    );
  }

  const { kpis, flags, decay_curves, multiple_testing, surface_3d, verdict } = result;

  // 2D Chart 1: IC vs Horizon with Confidence Bands and Exponential Fit
  const traceSpearman = {
    x: decay_curves.horizons,
    y: decay_curves.spearman_ic,
    type: "scatter",
    mode: "lines+markers",
    name: "Empirical Spearman Rank IC",
    line: { color: "#06B6D4", width: 2 },
  };

  const traceDecayFit = {
    x: decay_curves.horizons,
    y: decay_curves.fitted_decay,
    type: "scatter",
    mode: "lines",
    name: `Exponential Decay Fit (t_{1/2} = ${kpis.signal_half_life_bars} bars)`,
    line: { color: "#F59E0B", width: 2, dash: "dash" },
  };

  const traceCiUpper = {
    x: decay_curves.horizons,
    y: decay_curves.ci_high,
    type: "scatter",
    mode: "lines",
    name: "95% Confidence Upper Band",
    line: { color: "rgba(6, 182, 212, 0.2)", width: 1 },
    showlegend: false,
  };

  const traceCiLower = {
    x: decay_curves.horizons,
    y: decay_curves.ci_low,
    type: "scatter",
    mode: "lines",
    name: "95% Confidence Band",
    fill: "tonexty",
    fillcolor: "rgba(6, 182, 212, 0.1)",
    line: { color: "rgba(6, 182, 212, 0.2)", width: 1 },
  };

  const traceZeroLine = {
    x: decay_curves.horizons,
    y: Array(decay_curves.horizons.length).fill(0),
    type: "scatter",
    mode: "lines",
    name: "Zero Baseline",
    line: { color: "#64748B", width: 1, dash: "dot" },
  };

  // 2D Chart 2: P-Values Comparison (Raw vs Bonferroni vs FDR)
  const traceRawP = {
    x: multiple_testing.horizons,
    y: multiple_testing.raw_pvalues,
    type: "scatter",
    mode: "lines+markers",
    name: "Unadjusted Raw P-Values",
    line: { color: "#38BDF8", width: 1.5 },
  };

  const traceBonfP = {
    x: multiple_testing.horizons,
    y: multiple_testing.bonferroni_pvalues,
    type: "scatter",
    mode: "lines",
    name: "Bonferroni Corrected P-Values",
    line: { color: "#EF4444", width: 1.5, dash: "dot" },
  };

  const traceFdrQ = {
    x: multiple_testing.horizons,
    y: multiple_testing.fdr_qvalues,
    type: "scatter",
    mode: "lines",
    name: "Benjamini-Hochberg FDR Q-Values",
    line: { color: "#10B981", width: 2 },
  };

  const traceSigThreshold = {
    x: multiple_testing.horizons,
    y: Array(multiple_testing.horizons.length).fill(0.05),
    type: "scatter",
    mode: "lines",
    name: "α = 0.05 Cutoff",
    line: { color: "#F59E0B", width: 1, dash: "dash" },
  };

  // 3D Surface: Lookback x Horizon x IC
  const trace3D = {
    x: surface_3d.x_horizons,
    y: surface_3d.y_signal_lookbacks,
    z: surface_3d.z_matrix,
    type: "surface",
    colorscale: "Viridis",
  };

  const statsRows: StatRow[] = [
    {
      metric: "Initial Information Coefficient (h=1)",
      value: kpis.initial_ic_h1.toFixed(4),
      stat: "Spearman Rank IC",
      significance: Math.abs(kpis.initial_ic_h1) > 0.03 ? "High Predictability" : "Modest",
      interpretation: "Correlation between signal and next-period return.",
    },
    {
      metric: "Signal Half-Life (h_{1/2})",
      value: `${kpis.signal_half_life_bars} Bars`,
      stat: `λ = ${kpis.decay_rate_lambda}`,
      significance: kpis.signal_half_life_bars < 5 ? "Fast Decay" : "Persistent",
      interpretation: `Horizon at which signal predictive power decays by 50% (R² = ${kpis.decay_fit_r2}).`,
    },
    {
      metric: "Hansen Bootstrap Reality Check",
      value: kpis.bootstrap_reality_check_pval.toFixed(4),
      stat: "p-value (B=500)",
      significance: flags.is_genuine_alpha ? "Genuine Alpha (p < 0.05) ***" : "Data Snooping Warning",
      interpretation: "Tests whether max observed IC survives data-mining corrections.",
    },
    {
      metric: "Horizons Surviving FDR (q < 0.05)",
      value: `${kpis.horizons_surviving_fdr} / ${maxHorizon}`,
      stat: "BH-FDR Control",
      significance: kpis.horizons_surviving_fdr > 0 ? "FDR Surviving" : "No Surviving Horizons",
      interpretation: "Expected proportion of false discoveries controlled at 5%.",
    },
  ];

  return (
    <ModuleWrapper
      moduleId={7}
      verdictText={verdict}
      onRecalculate={compute}
      isCalculating={isCalculating}
      kpisMap={kpis}
      paramsMap={{ maxHorizon, signalLookback }}
      overviewContent={
        <div className="space-y-4 text-xs font-mono text-slate-300">
          <div className="p-4 rounded-lg bg-[#090D16] border border-[#1E293B]">
            <h3 className="text-sm font-bold text-cyan-400 font-sans mb-2">
              Theoretical Foundation: Bajgrowicz & Scaillet (2012) Technical Trading & Data Snooping
            </h3>
            <p className="leading-relaxed">
              In <em>"Technical Trading Rules: Risk, False Discoveries, and Data Snooping"</em> (Journal of Financial Economics), Pierre Bajgrowicz and Olivier Scaillet established that when quantitative researchers test hundreds of signals or forward horizons, conventional p-values lead to severe false discoveries.
            </p>
            <p className="mt-2 text-slate-300">
              Alpha predictability decays exponentially across forward forecast horizons h = 1..N:
            </p>
            <div className="mt-2 text-cyan-300 p-2 rounded bg-[#0D111D] border border-cyan-500/20">
              IC(h) = IC_0 · exp(-λ h) ⟹ Signal Half-Life = ln(2) / λ
            </div>
            <p className="mt-2 text-slate-400 text-[11px]">
              To prevent p-hacking, multiple-testing corrections are applied: <strong>Bonferroni</strong> (controls Family-Wise Error Rate), <strong>Benjamini-Hochberg (BH-FDR)</strong> (controls False Discovery Rate), and <strong>Hansen's Bootstrap Reality Check</strong> (resamples the null distribution of the maximum test statistic).
            </p>
          </div>
        </div>
      }
      controlsContent={
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300 font-semibold">Maximum Forward Horizon (N):</label>
              <span className="text-cyan-400 font-bold">{maxHorizon} Bars</span>
            </div>
            <input
              type="range"
              min={10}
              max={40}
              step={5}
              value={maxHorizon}
              onChange={(e) => setMaxHorizon(parseInt(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-slate-300 font-semibold">Signal Parameter (Lookback):</label>
              <span className="text-cyan-400 font-bold">{signalLookback} Bars</span>
            </div>
            <input
              type="range"
              min={3}
              max={30}
              step={1}
              value={signalLookback}
              onChange={(e) => setSignalLookback(parseInt(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>
      }
      kpisContent={
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <KpiCard
              title="Initial IC (h=1)"
              value={kpis.initial_ic_h1.toFixed(4)}
              subtext="Spearman Rank IC"
              significance={Math.abs(kpis.initial_ic_h1) > 0.03 ? "pass" : "neutral"}
              significanceLabel={Math.abs(kpis.initial_ic_h1) > 0.03 ? "PREDICTIVE" : "WEAK"}
              accentColor="#06B6D4"
            />
            <KpiCard
              title="Signal Half-Life"
              value={`${kpis.signal_half_life_bars} Bars`}
              subtext={`Decay Rate λ: ${kpis.decay_rate_lambda.toFixed(3)}`}
              significance={flags.has_fast_decay ? "warning" : "pass"}
              significanceLabel={flags.has_fast_decay ? "FAST DECAY" : "PERSISTENT"}
              accentColor="#F59E0B"
            />
            <KpiCard
              title="Bootstrap Reality Check"
              value={kpis.bootstrap_reality_check_pval.toFixed(4)}
              subtext="Hansen Reality Check p-val"
              significance={flags.is_genuine_alpha ? "pass" : "critical"}
              significanceLabel={flags.is_genuine_alpha ? "GENUINE ALPHA" : "DATA SNOOPING"}
              accentColor="#10B981"
            />
            <KpiCard
              title="FDR Surviving Horizons"
              value={`${kpis.horizons_surviving_fdr} / ${maxHorizon}`}
              subtext="Benjamini-Hochberg q < 0.05"
              significance={kpis.horizons_surviving_fdr > 0 ? "pass" : "critical"}
              significanceLabel={kpis.horizons_surviving_fdr > 0 ? "SURVIVING" : "DISQUALIFIED"}
              accentColor="#8B5CF6"
            />
          </div>

          <StatsTable title="Module 7 Signal Decay & Data Snooping Controls" rows={statsRows} />
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
                2D Decay Curve & P-Values
              </button>
              <button
                onClick={() => setChartView("3D")}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  chartView === "3D" ? "bg-violet-500/20 text-violet-300 border border-violet-500/40" : "text-slate-400"
                }`}
              >
                3D Signal × Horizon Surface
              </button>
            </div>
          </div>

          {chartView === "2D" ? (
            <>
              {/* IC Decay Curve with 95% Confidence Band */}
              <PlotlyChart
                data={[traceCiUpper, traceCiLower, traceSpearman, traceDecayFit, traceZeroLine]}
                layout={{
                  title: `Information Coefficient (Rank IC) Decay Curve vs Forward Horizon h (Half-Life = ${kpis.signal_half_life_bars} bars)`,
                  xaxis: { title: "Forward Forecast Horizon (h in bars)" },
                  yaxis: { title: "Spearman Rank IC" },
                }}
                title="IC Decay Curve and Half-Life Fit"
              />

              {/* Multiple Testing Corrections */}
              <PlotlyChart
                data={[traceRawP, traceBonfP, traceFdrQ, traceSigThreshold]}
                layout={{
                  title: "Multiple-Testing Corrections: Raw P-Values vs Bonferroni vs Benjamini-Hochberg FDR",
                  xaxis: { title: "Forward Horizon (h)" },
                  yaxis: { title: "P-Value / FDR Q-Value", range: [0, 1.05] },
                }}
                title="Multiple Testing & False Discovery Controls"
              />
            </>
          ) : (
            <PlotlyChart
              data={[trace3D]}
              layout={{
                title: "3D Surface: Signal Lookback Parameter (Y) × Forward Horizon (X) × Rank IC (Z)",
                scene: {
                  xaxis: { title: "Horizon (h)" },
                  yaxis: { title: "Lookback" },
                  zaxis: { title: "Rank IC" },
                },
              }}
              is3D
              style={{ width: "100%", height: "550px" }}
              title="3D Parameter Decay Surface"
            />
          )}
        </div>
      }
      interpretContent={
        <div className="space-y-4 text-xs font-mono text-slate-300 leading-relaxed">
          <div className="p-4 rounded-lg bg-[#090D16] border border-[#1E293B]">
            <h4 className="text-sm font-bold text-cyan-400 font-sans mb-2">
              Quant Research Pitfall: The Multiple Testing Illusion
            </h4>
            <div className="space-y-2">
              <p>
                <strong>1. Why Peak IC is Often an Artifact:</strong>
                <br />
                If a researcher scans 40 horizons, testing at standard α = 0.05 guarantees a ~87% probability of finding at least one "statistically significant" horizon purely by random chance [1 - (1 - 0.05)^40 = 0.87]. The Hansen Reality Check is critical because it explicitly accounts for the search protocol.
              </p>
              <p>
                <strong>2. Execution Latency Implications:</strong>
                <br />
                A signal with half-life of 2 bars requires immediate colocation and low-latency execution; by bar 3, more than 65% of the alpha has been captured by faster participants. Conversely, a signal with half-life of 20 bars can be executed passively via TWAP/VWAP.
              </p>
            </div>
          </div>
        </div>
      }
    />
  );
}
