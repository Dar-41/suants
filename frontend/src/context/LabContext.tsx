"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface ModuleDefinition {
  id: number;
  shortcut: string;
  name: string;
  subtitle: string;
  paper: string;
  year: number;
  category: "Stylised Facts" | "Microstructure" | "Stat-Arb" | "Factor Models" | "Regimes" | "Anomalies" | "Alpha Decay" | "Execution" | "Cross-Section" | "ML Labeling";
  color: string;
}

export const MODULE_REGISTRY: ModuleDefinition[] = [
  {
    id: 1,
    shortcut: "1",
    name: "Volatility Clustering Detector",
    subtitle: "ACF Power-Law, GARCH(1,1), Leverage & Fat Tails",
    paper: "Rama Cont (2001)",
    year: 2001,
    category: "Stylised Facts",
    color: "#06B6D4",
  },
  {
    id: 2,
    shortcut: "2",
    name: "Intraday Seasonality Map",
    subtitle: "Flexible Fourier Form & Diurnal U-Shape Filter",
    paper: "Andersen & Bollerslev (1997)",
    year: 1997,
    category: "Microstructure",
    color: "#3B82F6",
  },
  {
    id: 3,
    shortcut: "3",
    name: "Mean-Reversion Half-Life",
    subtitle: "Ornstein-Uhlenbeck AR(1), ADF, Hurst & Pairs Backtest",
    paper: "Gatev, Goetzmann & Rouwenhorst (2006)",
    year: 2006,
    category: "Stat-Arb",
    color: "#10B981",
  },
  {
    id: 4,
    shortcut: "4",
    name: "Factor Neutrality Check",
    subtitle: "Fama-French Multi-Factor, Newey-West HAC & Attribution",
    paper: "Fama & French (1993)",
    year: 1993,
    category: "Factor Models",
    color: "#8B5CF6",
  },
  {
    id: 5,
    shortcut: "5",
    name: "Regime-Dependent Momentum",
    subtitle: "Gaussian HMM & Momentum Crash Diagnostics",
    paper: "Daniel & Moskowitz (2016)",
    year: 2016,
    category: "Regimes",
    color: "#EC4899",
  },
  {
    id: 6,
    shortcut: "6",
    name: "The Overnight Effect",
    subtitle: "Close-to-Open vs Open-to-Close Drift & Paired t-Test",
    paper: "Cooper, Cliff & Gulen (2008)",
    year: 2008,
    category: "Anomalies",
    color: "#F59E0B",
  },
  {
    id: 7,
    shortcut: "7",
    name: "Signal Decay Curve",
    subtitle: "Information Coefficient Half-Life, Bonferroni & BH-FDR",
    paper: "Bajgrowicz & Scaillet (2012)",
    year: 2012,
    category: "Alpha Decay",
    color: "#06B6D4",
  },
  {
    id: 8,
    shortcut: "8",
    name: "Transaction Cost Sensitivity",
    subtitle: "Square-Root Market Impact, Breakeven & Capacity",
    paper: "Kourtis (2014)",
    year: 2014,
    category: "Execution",
    color: "#EF4444",
  },
  {
    id: 9,
    shortcut: "9",
    name: "Cross-Sectional IC Study",
    subtitle: "Rank ICIR, Monotonic Deciles & Long-Short Spread",
    paper: "Factor Research Standards",
    year: 2007,
    category: "Cross-Section",
    color: "#14B8A6",
  },
  {
    id: 10,
    shortcut: "0",
    name: "Triple-Barrier Label Explorer",
    subtitle: "Dynamic Vol Barriers, Concurrency & Meta-Labeling",
    paper: "López de Prado (AFML)",
    year: 2018,
    category: "ML Labeling",
    color: "#A855F7",
  },
];

interface LabContextType {
  activeModule: number;
  setActiveModule: (id: number) => void;
  currentModuleDef: ModuleDefinition;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  isCustomMetricOpen: boolean;
  setIsCustomMetricOpen: (open: boolean) => void;
  isQualityModalOpen: boolean;
  setIsQualityModalOpen: (open: boolean) => void;
  isCsvModalOpen: boolean;
  setIsCsvModalOpen: (open: boolean) => void;
  isHero3DExpanded: boolean;
  setIsHero3DExpanded: (expanded: boolean) => void;
  exportSessionJson: () => void;
  importSessionJson: (jsonString: string) => void;
}

const LabContext = createContext<LabContextType | undefined>(undefined);

export function LabProvider({ children }: { children: ReactNode }) {
  const [activeModule, setActiveModule] = useState<number>(1);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isCustomMetricOpen, setIsCustomMetricOpen] = useState<boolean>(false);
  const [isQualityModalOpen, setIsQualityModalOpen] = useState<boolean>(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState<boolean>(false);
  const [isHero3DExpanded, setIsHero3DExpanded] = useState<boolean>(true);

  const currentModuleDef = MODULE_REGISTRY.find((m) => m.id === activeModule) || MODULE_REGISTRY[0];

  // Global hotkeys: Cmd/Ctrl+K, and numeric keys 1-9, 0
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        if (e.key >= "1" && e.key <= "9") {
          setActiveModule(parseInt(e.key));
        } else if (e.key === "0") {
          setActiveModule(10);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const exportSessionJson = () => {
    const sessionData = {
      timestamp: new Date().toISOString(),
      activeModule,
      version: "1.0.0",
    };
    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qrl-session-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSessionJson = (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      if (data.activeModule && data.activeModule >= 1 && data.activeModule <= 10) {
        setActiveModule(data.activeModule);
      }
    } catch {
      alert("Invalid session JSON format.");
    }
  };

  return (
    <LabContext.Provider
      value={{
        activeModule,
        setActiveModule,
        currentModuleDef,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        isCustomMetricOpen,
        setIsCustomMetricOpen,
        isQualityModalOpen,
        setIsQualityModalOpen,
        isCsvModalOpen,
        setIsCsvModalOpen,
        isHero3DExpanded,
        setIsHero3DExpanded,
        exportSessionJson,
        importSessionJson,
      }}
    >
      {children}
    </LabContext.Provider>
  );
}

export function useLab() {
  const context = useContext(LabContext);
  if (!context) throw new Error("useLab must be used within a LabProvider");
  return context;
}
