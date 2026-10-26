"use client";

import React, { Suspense, lazy } from "react";
import { DataProvider } from "@/context/DataContext";
import { LabProvider, useLab } from "@/context/LabContext";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { HeroScene3D } from "@/components/hero/HeroScene3D";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { DataQualityModal } from "@/components/shared/DataQualityModal";
import { UploadCsvModal } from "@/components/shared/UploadCsvModal";
import { CustomMetricModal } from "@/components/shared/CustomMetricModal";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

// Lazy-load all modules so a crash in one does NOT break the whole app
const Module1Volatility = lazy(() =>
  import("@/components/modules/Module1Volatility").then((m) => ({ default: m.Module1Volatility }))
);
const Module2Seasonality = lazy(() =>
  import("@/components/modules/Module2Seasonality").then((m) => ({ default: m.Module2Seasonality }))
);
const Module3MeanReversion = lazy(() =>
  import("@/components/modules/Module3MeanReversion").then((m) => ({ default: m.Module3MeanReversion }))
);
const Module4FactorNeutrality = lazy(() =>
  import("@/components/modules/Module4FactorNeutrality").then((m) => ({
    default: m.Module4FactorNeutrality,
  }))
);
const Module5RegimeMomentum = lazy(() =>
  import("@/components/modules/Module5RegimeMomentum").then((m) => ({
    default: m.Module5RegimeMomentum,
  }))
);
const Module6OvernightEffect = lazy(() =>
  import("@/components/modules/Module6OvernightEffect").then((m) => ({
    default: m.Module6OvernightEffect,
  }))
);
const Module7SignalDecay = lazy(() =>
  import("@/components/modules/Module7SignalDecay").then((m) => ({ default: m.Module7SignalDecay }))
);
const Module8TransactionCosts = lazy(() =>
  import("@/components/modules/Module8TransactionCosts").then((m) => ({
    default: m.Module8TransactionCosts,
  }))
);
const Module9CrossSectionalIC = lazy(() =>
  import("@/components/modules/Module9CrossSectionalIC").then((m) => ({
    default: m.Module9CrossSectionalIC,
  }))
);
const Module10TripleBarrier = lazy(() =>
  import("@/components/modules/Module10TripleBarrier").then((m) => ({
    default: m.Module10TripleBarrier,
  }))
);

function ModuleSkeleton({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center p-16 bg-[#0D111D] border border-[#1E293B] rounded-2xl min-h-[400px]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-slate-400">Loading {name}...</span>
      </div>
    </div>
  );
}

function ModuleRouter() {
  const { activeModule } = useLab();

  const modules: Record<number, { component: React.ReactNode; name: string }> = {
    1: { component: <Module1Volatility />, name: "Volatility Clustering" },
    2: { component: <Module2Seasonality />, name: "Intraday Seasonality" },
    3: { component: <Module3MeanReversion />, name: "Mean Reversion Half-Life" },
    4: { component: <Module4FactorNeutrality />, name: "Factor Neutrality" },
    5: { component: <Module5RegimeMomentum />, name: "Regime Momentum" },
    6: { component: <Module6OvernightEffect />, name: "Overnight Effect" },
    7: { component: <Module7SignalDecay />, name: "Signal Decay" },
    8: { component: <Module8TransactionCosts />, name: "Transaction Costs" },
    9: { component: <Module9CrossSectionalIC />, name: "Cross-Sectional IC" },
    10: { component: <Module10TripleBarrier />, name: "Triple Barrier Labels" },
  };

  const current = modules[activeModule] || modules[1];

  return (
    <ErrorBoundary moduleName={current.name}>
      <Suspense fallback={<ModuleSkeleton name={current.name} />}>
        {current.component}
      </Suspense>
    </ErrorBoundary>
  );
}

function LabDashboard() {
  return (
    <div className="flex flex-col min-h-screen bg-[#07090E] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Bloomberg Global Data & Control Bar */}
      <ErrorBoundary moduleName="Header">
        <Header />
      </ErrorBoundary>

      {/* Hero 3D Volatility Manifold Scene */}
      <ErrorBoundary moduleName="HeroScene3D">
        <HeroScene3D />
      </ErrorBoundary>

      {/* Main Workspace: Left Sidebar + Active Module */}
      <div className="flex flex-1">
        <ErrorBoundary moduleName="Sidebar">
          <Sidebar />
        </ErrorBoundary>

        <main className="flex-1 p-6 lg:p-8 max-w-[1700px] overflow-y-auto">
          <ModuleRouter />
        </main>
      </div>

      {/* Modals & Overlays */}
      <ErrorBoundary moduleName="Modals">
        <CommandPalette />
        <DataQualityModal />
        <UploadCsvModal />
        <CustomMetricModal />
      </ErrorBoundary>
    </div>
  );
}

export default function Page() {
  return (
    <ErrorBoundary moduleName="App">
      <DataProvider>
        <LabProvider>
          <LabDashboard />
        </LabProvider>
      </DataProvider>
    </ErrorBoundary>
  );
}
