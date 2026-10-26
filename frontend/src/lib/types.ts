export interface OHLCVRecord {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  return: number;
  regime?: number;
}

export interface DataQualityReport {
  status: "PASSED" | "WARNING" | "FAILED";
  n_samples: number;
  start_date: string;
  end_date: string;
  min_price: number;
  max_price: number;
  current_price: number;
  mean_daily_return: number;
  annualized_volatility: number;
  outlier_count_4sigma: number;
  null_count: number;
  adf_stat: number;
  adf_pvalue: number;
  is_stationary: boolean;
}

export interface DatasetPayload {
  dataset_name: string;
  quality: DataQualityReport;
  records: OHLCVRecord[];
  fallback_notice?: string;
}

// Module 1 Types
export interface Module1Result {
  kpis: {
    annualized_vol: number;
    excess_kurtosis: number;
    skewness: number;
    jarque_bera_stat: number;
    jarque_bera_pval: number;
    arch_lm_stat: number;
    arch_lm_pval: number;
    ljung_box_stat_10: number;
    ljung_box_pval_10: number;
    garch_persistence: number;
    garch_half_life: number;
    garch_alpha: number;
    garch_beta: number;
    power_law_gamma: number;
    power_law_r2: number;
    leverage_effect_corr: number;
  };
  flags: {
    has_volatility_clustering: boolean;
    has_fat_tails: boolean;
    has_leverage_effect: boolean;
  };
  acf_data: {
    lags: number[];
    acf_raw: number[];
    acf_abs: number[];
    acf_sq: number[];
    bartlett_band: number;
  };
  conditional_volatility: number[];
  regimes: string[];
  qq_plot: {
    theoretical: number[];
    sample: number[];
  };
  surface_3d: {
    x_lags: number[];
    y_powers: number[];
    z_matrix: number[][];
  };
  verdict: string;
}

// Module 2 Types
export interface Module2Result {
  kpis: {
    u_shape_ratio: number;
    anova_f_stat: number;
    anova_p_val: number;
    fff_r_squared: number;
    open_mid_t_stat: number;
    open_mid_p_val: number;
    highest_vol_bucket: string;
    lowest_vol_bucket: string;
  };
  flags: {
    has_intraday_seasonality: boolean;
    has_u_shape: boolean;
  };
  buckets: {
    labels: string[];
    mean_returns_bps: number[];
    mean_vols_pct: number[];
    mean_volumes: number[];
    fff_fitted_vols: number[];
  };
  surface_3d: {
    x_buckets: string[];
    y_weekdays: string[];
    z_matrix: number[][];
  };
  session_summary: Record<string, number>;
  verdict: string;
}

// Module 3 Types
export interface Module3Result {
  kpis: {
    half_life_bars: number;
    hedge_ratio_beta: number;
    hurst_exponent: number;
    adf_statistic: number;
    adf_pvalue: number;
    coint_pvalue: number;
    variance_ratio: number;
    sharpe_ratio: number;
    annualized_return: number;
    max_drawdown: number;
    win_rate: number;
    trade_count: number;
  };
  flags: {
    is_mean_reverting: boolean;
    is_cointegrated: boolean;
  };
  spread_series: number[];
  z_score_series: number[];
  rolling_half_life: number[];
  equity_curve: number[];
  surface_3d: {
    x_lookbacks: number[];
    y_z_entries: number[];
    z_sharpe_matrix: number[][];
  };
  trades: Array<{
    step: number;
    action: string;
    z_score: number;
    spread: number;
    pnl_pct?: number;
  }>;
  verdict: string;
}

// Module 4 Types
export interface Module4Result {
  kpis: {
    annualized_alpha_pct: number;
    alpha_t_stat: number;
    alpha_p_value: number;
    r_squared: number;
    adj_r_squared: number;
    newey_west_lags: number;
    market_beta: number;
    smb_beta: number;
    hml_beta: number;
    mom_beta: number;
  };
  flags: {
    has_significant_alpha: boolean;
    is_factor_neutral: boolean;
  };
  betas: Record<string, number>;
  beta_tstats: Record<string, number>;
  beta_pvals: Record<string, number>;
  confidence_intervals: {
    low: Record<string, number>;
    high: Record<string, number>;
  };
  waterfall_attribution: Record<string, number>;
  cumulative_curves: {
    raw_strategy: number[];
    residual_alpha: number[];
  };
  surface_3d: {
    x_time_steps: number[];
    y_factors: string[];
    z_matrix: number[][];
  };
  verdict: string;
}

// Module 5 Types
export interface Module5Result {
  kpis: {
    overall_sharpe: number;
    overall_return_pct: number;
    overall_vol_pct: number;
    bull_regime_sharpe: number;
    bear_regime_sharpe: number;
    momentum_crashes_detected: number;
    lookback_bars: number;
    holding_bars: number;
  };
  flags: {
    has_momentum_crash_risk: boolean;
    is_regime_dependent: boolean;
  };
  regime_stats: Record<string, {
    sample_count: number;
    frequency_pct: number;
    annualized_return_pct: number;
    annualized_vol_pct: number;
    sharpe_ratio: number;
    sortino_ratio: number;
    skewness: number;
  }>;
  transition_matrix: {
    labels: string[];
    matrix: number[][];
  };
  regime_timeline: number[];
  cumulative_curves: {
    momentum: number[];
    market_benchmark: number[];
  };
  surface_3d: {
    x_lookbacks: number[];
    y_holdings: number[];
    z_bull: number[][];
    z_bear: number[][];
  };
  verdict: string;
}

// Module 6 Types
export interface Module6Result {
  kpis: {
    overnight_ann_return_pct: number;
    overnight_sharpe: number;
    intraday_ann_return_pct: number;
    intraday_sharpe: number;
    paired_t_stat: number;
    paired_p_val: number;
    boot_ci_low_bps: number;
    boot_ci_high_bps: number;
    total_ann_return_pct: number;
    total_sharpe: number;
  };
  flags: {
    has_overnight_dominance: boolean;
    is_statistically_significant: boolean;
  };
  stats_table: {
    overnight: Record<string, number>;
    intraday: Record<string, number>;
    total: Record<string, number>;
  };
  cumulative_curves: {
    overnight: number[];
    intraday: number[];
    total: number[];
  };
  weekday_summary: {
    labels: string[];
    overnight_bps: number[];
    intraday_bps: number[];
  };
  year_summary: {
    years: number[];
    overnight_ann_pct: number[];
    intraday_ann_pct: number[];
  };
  surface_3d: {
    x_weekdays: string[];
    y_years: number[];
    z_matrix: number[][];
  };
  verdict: string;
}

// Module 7 Types
export interface Module7Result {
  kpis: {
    initial_ic_h1: number;
    peak_ic: number;
    signal_half_life_bars: number;
    decay_rate_lambda: number;
    decay_fit_r2: number;
    bootstrap_reality_check_pval: number;
    horizons_surviving_fdr: number;
    horizons_surviving_bonferroni: number;
  };
  flags: {
    is_genuine_alpha: boolean;
    has_fast_decay: boolean;
  };
  decay_curves: {
    horizons: number[];
    pearson_ic: number[];
    spearman_ic: number[];
    fitted_decay: number[];
    ci_low: number[];
    ci_high: number[];
  };
  multiple_testing: {
    horizons: number[];
    raw_pvalues: number[];
    bonferroni_pvalues: number[];
    fdr_qvalues: number[];
  };
  surface_3d: {
    x_horizons: number[];
    y_signal_lookbacks: number[];
    z_matrix: number[][];
  };
  verdict: string;
}

// Module 8 Types
export interface Module8Result {
  kpis: {
    gross_sharpe: number;
    net_sharpe: number;
    breakeven_cost_bps: number;
    total_one_way_cost_bps: number;
    annual_turnover_x: number;
    annual_cost_drag_bps: number;
    market_impact_bps: number;
    capacity_aum_millions: number;
  };
  flags: {
    is_cost_viable: boolean;
    has_high_turnover: boolean;
  };
  waterfall: Record<string, number>;
  cost_sweep: {
    costs_bps: number[];
    net_sharpes: number[];
    breakeven_cost_bps: number;
  };
  cumulative_curves: {
    gross: number[];
    net: number[];
  };
  surface_3d: {
    x_spreads_bps: number[];
    y_slippages_bps: number[];
    z_matrix: number[][];
  };
  verdict: string;
}

// Module 9 Types
export interface Module9Result {
  kpis: {
    mean_rank_ic: number;
    ic_std: number;
    icir: number;
    ic_t_stat: number;
    ic_p_value: number;
    hit_rate_pct: number;
    ic_persistence_ar1: number;
    monotonicity_corr: number;
    long_short_sharpe: number;
    long_short_ann_ret_pct: number;
    mean_factor_turnover: number;
  };
  flags: {
    has_significant_ic: boolean;
    has_monotonic_sort: boolean;
  };
  ic_time_series: {
    steps: number[];
    ic_values: number[];
    rolling_mean_ic: number[];
  };
  quantiles: {
    labels: string[];
    mean_returns_bps: number[];
    monotonicity_r: number;
  };
  long_short_curve: number[];
  ic_decay: {
    horizons: number[];
    mean_ics: number[];
  };
  surface_3d: {
    x_horizons: number[];
    y_time_slices: string[];
    z_matrix: number[][];
  };
  verdict: string;
}

// Module 10 Types
export interface Module10Result {
  kpis: {
    total_events: number;
    profit_take_pct: number;
    stop_loss_pct: number;
    vertical_expiry_pct: number;
    average_uniqueness: number;
    max_concurrency: number;
    event_sharpe: number;
    avg_holding_time: number;
    avg_profit_hold_time: number;
    avg_stop_hold_time: number;
  };
  flags: {
    is_label_balanced: boolean;
    has_high_uniqueness: boolean;
  };
  distribution: {
    labels: string[];
    counts: number[];
    percentages: number[];
    avg_holding_bars: number[];
  };
  sample_events: Array<{
    t_entry: number;
    t_exit: number;
    entry_price: number;
    exit_price: number;
    upper_barrier: number;
    lower_barrier: number;
    label: number;
    holding_time: number;
    return_pct: number;
  }>;
  surface_3d: {
    x_profit_takes: number[];
    y_stop_losses: number[];
    z_matrix: number[][];
  };
  verdict: string;
}

export interface CustomMetricResult {
  success: boolean;
  formula: string;
  value?: number;
  sample_size?: number;
  is_series?: boolean;
  series_sample?: number[];
  t_statistic?: number;
  p_value?: number;
  is_statistically_significant?: boolean;
  verdict?: string;
  error?: string;
}
