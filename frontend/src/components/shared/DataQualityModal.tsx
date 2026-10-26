"use client";

import React from "react";
import { useLab } from "@/context/LabContext";
import { useData } from "@/context/DataContext";
import { X, CheckCircle2, AlertTriangle, ShieldCheck, Activity } from "lucide-react";

export function DataQualityModal() {
  const { isQualityModalOpen, setIsQualityModalOpen } = useLab();
  const { quality, datasetName } = useData();

  if (!isQualityModalOpen || !quality) return null;

  const items = [
    { label: "Validation Status", value: quality.status, ok: quality.status === "PASSED" },
    { label: "Total Observations (N)", value: quality.n_samples.toLocaleString(), ok: quality.n_samples > 100 },
    { label: "Date Range", value: `${quality.start_date} to ${quality.end_date}`, ok: true },
    { label: "Price Range", value: `$${quality.min_price.toFixed(2)} - $${quality.max_price.toFixed(2)}`, ok: true },
    { label: "Annualized Volatility", value: `${(quality.annualized_volatility * 100).toFixed(2)}%`, ok: true },
    { label: "Mean Daily Return", value: `${(quality.mean_daily_return * 10000).toFixed(2)} bps`, ok: true },
    { label: "Null / Inf Count", value: quality.null_count, ok: quality.null_count === 0 },
    { label: "4-Sigma Outliers", value: quality.outlier_count_4sigma, ok: quality.outlier_count_4sigma < 15 },
    { label: "ADF Stationarity (Returns)", value: `t = ${quality.adf_stat.toFixed(2)} (p = ${quality.adf_pvalue.toFixed(4)})`, ok: quality.is_stationary },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-[#0D111D] border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E293B] bg-[#090D16]">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
                Data Quality & Validation Audit
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">{datasetName}</p>
            </div>
          </div>
          <button
            onClick={() => setIsQualityModalOpen(false)}
            className="p-1 rounded text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Audit Rows */}
        <div className="p-5 space-y-2.5">
          {items.map((it, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2.5 rounded-lg bg-[#090D16] border border-[#1E293B] text-xs font-mono"
            >
              <span className="text-slate-400">{it.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-200">{it.value}</span>
                {it.ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#1E293B] bg-[#090D16] flex justify-end">
          <button
            onClick={() => setIsQualityModalOpen(false)}
            className="px-4 py-1.5 rounded-lg text-xs font-mono font-medium bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
}
