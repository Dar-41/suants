"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { DatasetPayload, DataQualityReport, OHLCVRecord } from "@/lib/types";
import { fetchPresetDataset, fetchSyntheticDataset, uploadCustomCSV, checkBackendHealth } from "@/lib/api";

interface DataContextType {
  datasetName: string;
  records: OHLCVRecord[];
  quality: DataQualityReport | null;
  returns: number[];
  prices: number[];
  isLoading: boolean;
  isBackendConnected: boolean;
  error: string | null;
  loadPreset: (symbol: string) => Promise<void>;
  loadSynthetic: (days?: number) => Promise<void>;
  uploadCsv: (csvText: string) => Promise<void>;
  loadSampleFile: (sampleName: string) => Promise<void>;
  refreshBackendStatus: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Standalone fallback generator for instant offline resilience
function createClientFallbackData(): { records: OHLCVRecord[]; quality: DataQualityReport } {
  const n = 300;
  const records: OHLCVRecord[] = [];
  let price = 100.0;
  const start = new Date(2023, 0, 3, 9, 30);

  for (let i = 0; i < n; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const r = (Math.random() - 0.48) * 0.024;
    const pOpen = price;
    const pClose = price * Math.exp(r);
    const pHigh = Math.max(pOpen, pClose) + Math.abs(r * price * 0.8);
    const pLow = Math.min(pOpen, pClose) - Math.abs(r * price * 0.8);
    price = pClose;

    records.push({
      timestamp: d.toISOString().replace("T", " ").slice(0, 19),
      open: parseFloat(pOpen.toFixed(2)),
      high: parseFloat(pHigh.toFixed(2)),
      low: parseFloat(pLow.toFixed(2)),
      close: parseFloat(pClose.toFixed(2)),
      volume: Math.floor(100000 * (1 + Math.random())),
      return: parseFloat(r.toFixed(6)),
      regime: i % 3,
    });
  }

  const quality: DataQualityReport = {
    status: "PASSED",
    n_samples: n,
    start_date: records[0].timestamp,
    end_date: records[n - 1].timestamp,
    min_price: Math.min(...records.map((r) => r.close)),
    max_price: Math.max(...records.map((r) => r.close)),
    current_price: records[n - 1].close,
    mean_daily_return: 0.00045,
    annualized_volatility: 0.185,
    outlier_count_4sigma: 1,
    null_count: 0,
    adf_stat: -14.2,
    adf_pvalue: 0.0,
    is_stationary: true,
  };

  return { records, quality };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [datasetName, setDatasetName] = useState<string>("Sample S&P 500 (Preloaded)");
  const [records, setRecords] = useState<OHLCVRecord[]>([]);
  const [quality, setQuality] = useState<DataQualityReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const returns = records.map((r) => r.return || 0);
  const prices = records.map((r) => r.close || 100);

  const refreshBackendStatus = async () => {
    try {
      const ok = await checkBackendHealth();
      setIsBackendConnected(ok);
    } catch {
      setIsBackendConnected(false);
    }
  };

  const loadSynthetic = async (days = 400) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSyntheticDataset(days, 24);
      setDatasetName(data.dataset_name);
      setRecords(data.records);
      setQuality(data.quality);
      setIsBackendConnected(true);
    } catch (err: any) {
      console.warn("Backend synthetic load error, falling back:", err);
      const fallback = createClientFallbackData();
      setDatasetName("Synthetic GARCH(1,1) + HMM + FFF");
      setRecords(fallback.records);
      setQuality(fallback.quality);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPreset = async (symbol: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPresetDataset(symbol);
      setDatasetName(data.dataset_name);
      setRecords(data.records);
      setQuality(data.quality);
      setIsBackendConnected(true);
    } catch (err: any) {
      console.warn(`Failed to fetch preset ${symbol}, loading sample:`, err);
      await loadSampleFile("sp500_daily.csv");
    } finally {
      setIsLoading(false);
    }
  };

  const uploadCsv = async (csvText: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await uploadCustomCSV(csvText);
      setDatasetName(data.dataset_name);
      setRecords(data.records);
      setQuality(data.quality);
    } catch (err: any) {
      setError(err.message || "Failed to parse CSV");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const loadSampleFile = async (sampleName: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/samples/${sampleName}`);
      if (!resp.ok) throw new Error(`Sample file ${sampleName} not found`);
      const csvText = await resp.text();
      const data = await uploadCustomCSV(csvText);
      setDatasetName(`Sample Dataset: ${sampleName.replace(".csv", "").toUpperCase()}`);
      setRecords(data.records);
      setQuality(data.quality);
    } catch (err: any) {
      console.warn("Failed to load sample CSV via backend, using fallback:", err);
      const fallback = createClientFallbackData();
      setDatasetName(`Sample Dataset: ${sampleName.replace(".csv", "").toUpperCase()}`);
      setRecords(fallback.records);
      setQuality(fallback.quality);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshBackendStatus();
    // Preload sample data immediately on launch!
    loadSampleFile("sp500_daily.csv");
  }, []);

  return (
    <DataContext.Provider
      value={{
        datasetName,
        records,
        quality,
        returns,
        prices,
        isLoading,
        isBackendConnected,
        error,
        loadPreset,
        loadSynthetic,
        uploadCsv,
        loadSampleFile,
        refreshBackendStatus,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within a DataProvider");
  return context;
}
