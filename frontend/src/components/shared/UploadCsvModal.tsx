"use client";

import React, { useState } from "react";
import { useLab } from "@/context/LabContext";
import { useData } from "@/context/DataContext";
import { X, Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";

export function UploadCsvModal() {
  const { isCsvModalOpen, setIsCsvModalOpen } = useLab();
  const { uploadCsv } = useData();
  const [csvText, setCsvText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isCsvModalOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvText(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handlePasteDemoCsv = () => {
    // Generate small sample CSV
    const sample = `timestamp,open,high,low,close,volume\n` +
      `2024-01-02 09:30:00,100.0,101.5,99.8,101.2,120000\n` +
      `2024-01-03 09:30:00,101.2,102.8,100.9,102.5,145000\n` +
      `2024-01-04 09:30:00,102.5,103.2,101.5,101.8,98000\n` +
      `2024-01-05 09:30:00,101.8,102.0,99.5,100.1,165000\n` +
      `2024-01-08 09:30:00,100.1,101.4,99.9,101.0,110000\n` +
      `2024-01-09 09:30:00,101.0,103.0,100.8,102.7,130000`;
    setCsvText(sample);
  };

  const handleSubmit = async () => {
    if (!csvText.trim()) return;
    setIsUploading(true);
    setErrorMsg(null);
    try {
      await uploadCsv(csvText);
      setIsCsvModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to parse CSV");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-[#0D111D] border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E293B] bg-[#090D16]">
          <div className="flex items-center gap-2.5">
            <Upload className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
                Upload Custom Quant Dataset (CSV)
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Supports OHLCV, ticks, returns, signals, and factor panels
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsCsvModalOpen(false)}
            className="p-1 rounded text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111827] hover:bg-[#1E293B] border border-[#1E293B] text-xs font-mono text-cyan-400 cursor-pointer transition-colors">
              <FileText className="w-3.5 h-3.5" />
              <span>Browse CSV file...</span>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>

            <button
              onClick={handlePasteDemoCsv}
              className="text-xs font-mono text-slate-400 hover:text-white underline"
            >
              Paste Sample CSV
            </button>
          </div>

          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={10}
            placeholder="timestamp,open,high,low,close,volume&#10;2024-01-02,100.0,101.5,99.8,101.2,150000&#10;2024-01-03,101.2,102.5,100.5,102.0,120000"
            className="w-full p-3 rounded-xl bg-[#090D16] border border-[#1E293B] text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
          />

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs font-mono text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#1E293B] bg-[#090D16] flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-500">
            Auto-detects date/timestamp, prices, returns & volume columns
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCsvModalOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isUploading || !csvText.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-mono font-medium bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white disabled:opacity-50 cursor-pointer"
            >
              {isUploading ? "Ingesting..." : "Load Dataset"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
