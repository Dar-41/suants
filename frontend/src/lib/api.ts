import {
  DatasetPayload,
  DataQualityReport,
  Module1Result,
  Module2Result,
  Module3Result,
  Module4Result,
  Module5Result,
  Module6Result,
  Module7Result,
  Module8Result,
  Module9Result,
  Module10Result,
  CustomMetricResult
} from "./types";

const API_BASE = "";

async function postJSON<T>(endpoint: string, body: any): Promise<T> {
  const resp = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`API Error [${resp.status}]: ${errText}`);
  }
  return resp.json();
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { method: "GET", cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchSyntheticDataset(n_days = 500, intraday_bars = 24): Promise<DatasetPayload> {
  const res = await fetch(`${API_BASE}/api/data/synthetic?n_days=${n_days}&intraday_bars=${intraday_bars}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch synthetic dataset");
  return res.json();
}

export async function fetchPresetDataset(symbol: string): Promise<DatasetPayload> {
  const res = await fetch(`${API_BASE}/api/data/preset?symbol=${encodeURIComponent(symbol)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch preset ${symbol}`);
  return res.json();
}

export async function uploadCustomCSV(csv_text: string): Promise<DatasetPayload> {
  return postJSON<DatasetPayload>("/api/data/upload", { csv_text });
}

export async function runModule1(returns: number[], max_lag = 40, garch_type = "GARCH"): Promise<Module1Result> {
  return postJSON<Module1Result>("/api/module1/volatility", { returns, max_lag, garch_type });
}

export async function runModule2(records: any[], bucket_minutes = 30, fourier_terms = 4): Promise<Module2Result> {
  return postJSON<Module2Result>("/api/module2/seasonality", { records, bucket_minutes, fourier_terms });
}

export async function runModule3(
  prices_y: number[],
  prices_x?: number[],
  lookback = 30,
  entry_z = 2.0,
  stop_loss_z = 3.5
): Promise<Module3Result> {
  return postJSON<Module3Result>("/api/module3/mean-reversion", {
    prices_y,
    prices_x,
    lookback,
    entry_z,
    stop_loss_z,
  });
}

export async function runModule4(returns: number[], rolling_window = 60, factor_names?: string[]): Promise<Module4Result> {
  return postJSON<Module4Result>("/api/module4/factor-neutrality", { returns, rolling_window, factor_names });
}

export async function runModule5(
  returns: number[],
  n_regimes = 3,
  lookback_mom = 21,
  holding_mom = 5
): Promise<Module5Result> {
  return postJSON<Module5Result>("/api/module5/regime-momentum", {
    returns,
    n_regimes,
    lookback_mom,
    holding_mom,
  });
}

export async function runModule6(records: any[], bootstrap_iterations = 1000): Promise<Module6Result> {
  return postJSON<Module6Result>("/api/module6/overnight-effect", { records, bootstrap_iterations });
}

export async function runModule7(
  returns: number[],
  signal?: number[],
  max_horizon = 25,
  signal_lookback = 10
): Promise<Module7Result> {
  return postJSON<Module7Result>("/api/module7/signal-decay", {
    returns,
    signal,
    max_horizon,
    signal_lookback,
  });
}

export async function runModule8(
  returns: number[],
  positions?: number[],
  spread_bps = 3.0,
  slippage_bps = 2.0,
  commission_bps = 1.0,
  adv_shares = 5000000,
  target_aum_usd = 25000000,
  asset_price = 100.0
): Promise<Module8Result> {
  return postJSON<Module8Result>("/api/module8/transaction-costs", {
    returns,
    positions,
    spread_bps,
    slippage_bps,
    commission_bps,
    adv_shares,
    target_aum_usd,
    asset_price,
  });
}

export async function runModule9(
  factor_matrix?: number[][],
  return_matrix?: number[][],
  n_quantiles = 10,
  horizons?: number[]
): Promise<Module9Result> {
  return postJSON<Module9Result>("/api/module9/cross-sectional-ic", {
    factor_matrix,
    return_matrix,
    n_quantiles,
    horizons,
  });
}

export async function runModule10(
  prices: number[],
  pt_mult = 2.0,
  sl_mult = 1.5,
  vertical_bars = 15,
  ewma_span = 20,
  sampling_freq = 3
): Promise<Module10Result> {
  return postJSON<Module10Result>("/api/module10/triple-barrier", {
    prices,
    pt_mult,
    sl_mult,
    vertical_bars,
    ewma_span,
    sampling_freq,
  });
}

export async function runCustomMetric(expression: string, records: any[]): Promise<CustomMetricResult> {
  return postJSON<CustomMetricResult>("/api/custom-metric", { expression, records });
}

export async function exportReportDossierHtml(payload: {
  module_id: number;
  module_name: string;
  paper_reference: string;
  dataset_name: string;
  kpis: Record<string, any>;
  verdict: string;
  parameters: Record<string, any>;
  sample_size: number;
}): Promise<string> {
  const resp = await fetch(`${API_BASE}/api/export-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error("Failed to export report");
  return resp.text();
}
