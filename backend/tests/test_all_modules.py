import pytest
import numpy as np
import pandas as pd
from scipy import stats
import statsmodels.api as sm
from statsmodels.tsa.stattools import acf, adfuller, coint
from statsmodels.stats.diagnostic import acorr_ljungbox, het_arch
from statsmodels.stats.multitest import multipletests

from engine.data_loader import generate_synthetic_quant_dataset, compute_data_quality_report
from engine.module1_volatility import analyze_volatility_clustering
from engine.module2_seasonality import analyze_intraday_seasonality
from engine.module3_mean_reversion import analyze_mean_reversion, compute_hurst_exponent
from engine.module4_factor_neutrality import analyze_factor_neutrality, get_builtin_factor_data
from engine.module5_regime_momentum import analyze_regime_momentum
from engine.module6_overnight_effect import analyze_overnight_effect
from engine.module7_signal_decay import analyze_signal_decay
from engine.module8_transaction_costs import analyze_transaction_costs
from engine.module9_cross_sectional_ic import analyze_cross_sectional_ic, generate_synthetic_cross_section
from engine.module10_triple_barrier import analyze_triple_barrier
from engine.custom_calculator import evaluate_custom_metric

# ----------------- DATA LOADER TESTS -----------------
def test_synthetic_data_generator():
    df = generate_synthetic_quant_dataset(n_days=100, intraday_bars_per_day=12, seed=42)
    assert len(df) > 0
    assert "close" in df.columns
    assert "return" in df.columns
    assert not df["close"].isna().any()
    report = compute_data_quality_report(df)
    assert report["status"] in ["PASSED", "WARNING"]
    assert report["n_samples"] == len(df)

# ----------------- MODULE 1 TESTS: VOLATILITY CLUSTERING -----------------
def test_module1_volatility_clustering_reference():
    np.random.seed(42)
    # Simulate known GARCH(1,1) series
    r = np.random.normal(0, 0.015, 300)
    res = analyze_volatility_clustering(r, max_lag=20)
    
    # 1. Verify ACF against statsmodels
    ref_acf = acf(r, nlags=20, fft=True)
    for lag in range(21):
        assert abs(res["acf_data"]["acf_raw"][lag] - ref_acf[lag]) < 1e-3
        
    # 2. Verify Jarque-Bera against scipy.stats
    ref_jb_stat, ref_jb_pval = stats.jarque_bera(r)
    assert abs(res["kpis"]["jarque_bera_stat"] - ref_jb_stat) < 0.1
    assert abs(res["kpis"]["jarque_bera_pval"] - ref_jb_pval) < 1e-3
    
    # 3. Verify ARCH-LM against statsmodels
    ref_arch = het_arch(r, nlags=min(10, len(r)//5))
    assert abs(res["kpis"]["arch_lm_stat"] - ref_arch[0]) < 0.5
    
    # 4. Verify 3D surface dimensions
    assert len(res["surface_3d"]["z_matrix"]) == len(res["surface_3d"]["y_powers"])
    assert len(res["surface_3d"]["z_matrix"][0]) == len(res["surface_3d"]["x_lags"])

# ----------------- MODULE 2 TESTS: INTRADAY SEASONALITY -----------------
def test_module2_seasonality_reference():
    df = generate_synthetic_quant_dataset(n_days=40, intraday_bars_per_day=24, seed=42)
    res = analyze_intraday_seasonality(df, bucket_minutes=30, fourier_terms=4)
    
    assert "kpis" in res
    assert res["kpis"]["u_shape_ratio"] > 0
    assert res["kpis"]["fff_r_squared"] >= 0.0
    assert len(res["buckets"]["labels"]) > 0
    assert len(res["buckets"]["mean_vols_pct"]) == len(res["buckets"]["labels"])
    # 3D surface dimensions
    assert len(res["surface_3d"]["z_matrix"]) == len(res["surface_3d"]["y_weekdays"])
    assert len(res["surface_3d"]["z_matrix"][0]) == len(res["surface_3d"]["x_buckets"])

# ----------------- MODULE 3 TESTS: MEAN REVERSION HALF LIFE -----------------
def test_module3_mean_reversion_ou_process():
    # Construct pure Ornstein-Uhlenbeck AR(1) process with known phi = 0.85
    # S_t = 0.85 * S_{t-1} + eps => lambda = 0.85 - 1 = -0.15
    # Theoretical Half-Life = -ln(2) / ln(0.85) ~ 4.265 bars
    np.random.seed(99)
    n = 300
    spread = np.zeros(n)
    for t in range(1, n):
        spread[t] = 0.85 * spread[t-1] + np.random.normal(0, 0.5)
        
    prices_y = 100.0 + spread
    prices_x = 100.0 + 0.2 * np.random.normal(0, 1, n)
    
    res = analyze_mean_reversion(prices_y, prices_x, lookback=30)
    
    # Verify half-life is close to theoretical ~ 4.26 bars
    assert 2.0 <= res["kpis"]["half_life_bars"] <= 7.0
    
    # Verify ADF statistic against statsmodels adfuller
    ref_adf = adfuller(res["spread_series"])
    assert abs(res["kpis"]["adf_statistic"] - ref_adf[0]) < 0.2
    assert abs(res["kpis"]["adf_pvalue"] - ref_adf[1]) < 0.05
    
    # Verify Hurst Exponent is strictly < 0.5 (mean reverting)
    h_val = compute_hurst_exponent(spread)
    assert h_val < 0.50

# ----------------- MODULE 4 TESTS: FACTOR NEUTRALITY -----------------
def test_module4_factor_neutrality_newey_west():
    np.random.seed(42)
    n = 200
    factors = get_builtin_factor_data(n, seed=42)
    # Generate returns with exact known beta_mkt = 1.2, beta_smb = 0.5, alpha = 0.0002/day
    r = 0.0002 + 1.2 * factors["Mkt-RF"].values + 0.5 * factors["SMB"].values + np.random.normal(0, 0.005, n)
    
    res = analyze_factor_neutrality(r, factor_df=factors, rolling_window=50)
    
    # Verify Betas are within estimation error of true DGP
    assert abs(res["kpis"]["market_beta"] - 1.2) < 0.15
    assert abs(res["kpis"]["smb_beta"] - 0.5) < 0.15
    assert res["kpis"]["r_squared"] > 0.5

# ----------------- MODULE 5 TESTS: REGIME MOMENTUM -----------------
def test_module5_regime_momentum():
    np.random.seed(42)
    r = np.random.normal(0.0005, 0.015, 250)
    res = analyze_regime_momentum(r, n_regimes=3, lookback_mom=20, holding_mom=5)
    
    # Verify transition matrix rows sum to 1.0
    t_mat = np.array(res["transition_matrix"]["matrix"])
    for row in t_mat:
        assert abs(np.sum(row) - 1.0) < 1e-3
        
    assert len(res["regime_timeline"]) == len(r)
    assert "cumulative_curves" in res
    assert len(res["cumulative_curves"]["momentum"]) == len(r)

# ----------------- MODULE 6 TESTS: OVERNIGHT EFFECT -----------------
def test_module6_overnight_effect():
    df = generate_synthetic_quant_dataset(n_days=100, intraday_bars_per_day=24, seed=42)
    # Aggregate to daily OHLC
    data = df.copy()
    data["dt"] = pd.to_datetime(data["timestamp"])
    daily = data.groupby(data["dt"].dt.date).agg({
        "open": "first",
        "high": "max",
        "low": "min",
        "close": "last"
    }).reset_index()
    daily["timestamp"] = daily["dt"].astype(str)
    
    res = analyze_overnight_effect(daily, bootstrap_iterations=200)
    
    # Verify paired t-test matches scipy.stats.ttest_rel
    prev_close = daily["close"].shift(1)
    mask = ~prev_close.isna()
    on = ((daily["open"] / prev_close) - 1.0)[mask].values
    intra = ((daily["close"] / daily["open"]) - 1.0)[mask].values
    ref_t, ref_p = stats.ttest_rel(on, intra)
    assert abs(res["kpis"]["paired_t_stat"] - ref_t) < 0.1
    assert abs(res["kpis"]["paired_p_val"] - ref_p) < 1e-3

# ----------------- MODULE 7 TESTS: SIGNAL DECAY -----------------
def test_module7_signal_decay_fdr():
    np.random.seed(42)
    n = 200
    r = np.random.normal(0, 0.01, n)
    sig = pd.Series(r).rolling(5).mean().fillna(0).values
    res = analyze_signal_decay(r, signal=sig, max_horizon=15)
    
    # Verify Spearman rank IC at h=1 matches scipy
    fwd1 = pd.Series(r).rolling(1).sum().shift(-1).values
    mask = (~np.isnan(fwd1)) & (~np.isnan(sig))
    ref_sr, ref_p = stats.spearmanr(sig[mask], fwd1[mask])
    assert abs(res["decay_curves"]["spearman_ic"][0] - ref_sr) < 1e-3
    
    # Verify FDR correction matches statsmodels multipletests
    _, ref_fdr_p, _, _ = multipletests(res["multiple_testing"]["raw_pvalues"], method="fdr_bh")
    for i in range(len(ref_fdr_p)):
        assert abs(res["multiple_testing"]["fdr_qvalues"][i] - ref_fdr_p[i]) < 1e-4

# ----------------- MODULE 8 TESTS: TRANSACTION COSTS -----------------
def test_module8_transaction_costs():
    np.random.seed(42)
    n = 200
    # Positive drift returns
    r = np.random.normal(0.002, 0.01, n)
    # Long-only position so gross mean is positive
    pos = np.ones(n)
    res = analyze_transaction_costs(r, positions=pos, spread_bps=4.0, slippage_bps=2.0, commission_bps=1.0)
    
    # Gross Sharpe must be strictly higher than Net Sharpe when positive
    assert res["kpis"]["gross_sharpe"] >= res["kpis"]["net_sharpe"]
    # Capacity AUM must be non-negative
    assert res["kpis"]["capacity_aum_millions"] >= 0

# ----------------- MODULE 9 TESTS: CROSS-SECTIONAL IC -----------------
def test_module9_cross_sectional_ic():
    F, R = generate_synthetic_cross_section(n_periods=80, n_assets=30, factor_quality=0.10, seed=42)
    res = analyze_cross_sectional_ic(F, R, n_quantiles=5, horizons=[1, 2, 5])
    
    assert res["kpis"]["mean_rank_ic"] > 0
    assert "quantiles" in res
    assert len(res["quantiles"]["mean_returns_bps"]) == 5
    # Monotonicity correlation must be evaluated
    assert -1.0 <= res["kpis"]["monotonicity_corr"] <= 1.0

# ----------------- MODULE 10 TESTS: TRIPLE BARRIER -----------------
def test_module10_triple_barrier():
    np.random.seed(42)
    # Generate prices with geometric brownian motion
    p = 100.0 * np.exp(np.cumsum(np.random.normal(0.0005, 0.015, 200)))
    res = analyze_triple_barrier(p, pt_mult=2.0, sl_mult=1.5, vertical_bars=10, sampling_freq=2)
    
    assert res["kpis"]["total_events"] > 0
    # Sum of percentages should be ~100%
    pct_sum = res["kpis"]["profit_take_pct"] + res["kpis"]["stop_loss_pct"] + res["kpis"]["vertical_expiry_pct"]
    assert abs(pct_sum - 100.0) < 1.0
    # Average uniqueness must be in [0, 1]
    assert 0.0 <= res["kpis"]["average_uniqueness"] <= 1.0

# ----------------- CUSTOM CALCULATOR TESTS -----------------
def test_custom_metric_evaluator():
    df = pd.DataFrame({
        "return": [0.01, -0.02, 0.015, 0.03, -0.01],
        "close": [100.0, 98.0, 99.5, 102.5, 101.5],
        "volume": [1000, 1200, 1100, 1500, 1300]
    })
    
    # Valid expression
    res1 = evaluate_custom_metric("mean(returns) * 252", df)
    assert res1["success"] is True
    assert abs(res1["value"] - (np.mean(df["return"]) * 252)) < 1e-4
    
    # Security check: rejects forbidden imports
    res2 = evaluate_custom_metric("__import__('os').system('ls')", df)
    assert res2["success"] is False
    assert "Security" in res2["error"] or "restricted" in res2["error"]
