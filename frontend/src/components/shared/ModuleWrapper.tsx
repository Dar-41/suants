"use client";

import React, { useState, ReactNode } from "react";
import { useLab } from "@/context/LabContext";
import { useData } from "@/context/DataContext";
import { exportReportDossierHtml } from "@/lib/api";
import { FileText, Sliders, BarChart3, HelpCircle, CheckCircle, RefreshCw } from "lucide-react";

interface ModuleWrapperProps {
  moduleId: number;
  overviewContent: ReactNode;
  controlsContent: ReactNode;
  kpisContent: ReactNode;
  chartsContent: ReactNode;
  interpretContent: ReactNode;
  verdictText: string;
  onRecalculate?: () => void;
  isCalculating?: boolean;
  kpisMap?: Record<string, any>;
  paramsMap?: Record<string, any>;
}

export function ModuleWrapper({
  moduleId,
  overviewContent,
  controlsContent,
  kpisContent,
  chartsContent,
  interpretContent,
  verdictText,
  onRecalculate,
  isCalculating = false,
  kpisMap = {},
  paramsMap = {},
}: ModuleWrapperProps) {
  const { currentModuleDef } = useLab();
  const { datasetName, records } = useData();
  const [activeTab, setActiveTab] = useState<"overview" | "controls" | "results" | "charts" | "interpret" | "verdict">(
    "charts"
  );
  const [isExporting, setIsExporting] = useState(false);

  const handleExportDossier = async () => {
    setIsExporting(true);
    try {
      const html = await exportReportDossierHtml({
        module_id: moduleId,
        module_name: currentModuleDef.name,
        paper_reference: currentModuleDef.paper,
        dataset_name: datasetName,
        kpis: kpisMap,
        verdict: verdictText,
        parameters: paramsMap,
        sample_size: records.length,
      });

      // Open printable HTML dossier in new tab or trigger download
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (!win) {
        // Fallback download if popup blocked
        const a = document.createElement("a");
        a.href = url;
        a.download = `qrl-dossier-module-${moduleId}.html`;
        a.click();
      }
    } catch (err: any) {
      alert("Failed to export dossier: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const tabs = [
    { id: "charts", label: "Charts & Visualizations", icon: BarChart3 },
    { id: "results", label: "Results & KPIs", icon: CheckCircle },
    { id: "controls", label: "Parameters & Controls", icon: Sliders },
    { id: "overview", label: "Paper & Formula", icon: FileText },
    { id: "interpret", label: "How to Interpret", icon: HelpCircle },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Module Sub-Header & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#0D111D]/90 border border-[#1E293B] shadow-sm">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-[#090D16] border border-[#1E293B]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-[#111827]"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-cyan-400" : "text-slate-500"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {onRecalculate && (
            <button
              onClick={onRecalculate}
              disabled={isCalculating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-[#111827] hover:bg-[#1E293B] text-cyan-400 border border-cyan-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCalculating ? "animate-spin" : ""}`} />
              <span>{isCalculating ? "Computing..." : "Recalculate"}</span>
            </button>
          )}

          <button
            onClick={handleExportDossier}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md shadow-cyan-950/40 transition-all cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isExporting ? "Generating..." : "Export Dossier (HTML/PDF)"}</span>
          </button>
        </div>
      </div>

      {/* Auto-Generated Plain-English Executive Verdict Box */}
      <div className="relative p-4 rounded-xl bg-gradient-to-r from-cyan-950/30 via-[#0D111D] to-[#0D111D] border border-cyan-500/30 shadow-md">
        <div className="flex items-start gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 mt-1.5 shrink-0 shadow-[0_0_8px_#06b6d4]" />
          <div className="flex-1">
            <div className="text-[11px] font-mono font-semibold tracking-wider text-cyan-400 uppercase mb-1">
              Automated Plain-English Verdict // Institutional Interpretation
            </div>
            <p className="text-sm text-slate-200 leading-relaxed font-sans">{verdictText}</p>
          </div>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="transition-opacity duration-150">
        {activeTab === "charts" && <div className="space-y-6">{chartsContent}</div>}

        {activeTab === "results" && (
          <div className="space-y-6">
            <div>{kpisContent}</div>
          </div>
        )}

        {activeTab === "controls" && (
          <div className="p-6 rounded-xl bg-[#0D111D] border border-[#1E293B]">{controlsContent}</div>
        )}

        {activeTab === "overview" && (
          <div className="p-6 rounded-xl bg-[#0D111D] border border-[#1E293B] space-y-4">{overviewContent}</div>
        )}

        {activeTab === "interpret" && (
          <div className="p-6 rounded-xl bg-[#0D111D] border border-[#1E293B] space-y-4">{interpretContent}</div>
        )}
      </div>
    </div>
  );
}
