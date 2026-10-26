import math
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from scipy import stats

def generate_synthetic_cross_section(
    n_periods: int = 120,
    n_assets: int = 40,
    factor_quality: float = 0.08, # true IC baseline
    seed: int = 123
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generates synthetic cross-sectional panel of assets with known factor exposures
    and forward returns to benchmark cross-sectional factor studies.
    """
    np.random.seed(seed)
    # Common factor returns
    mkt = np.random.normal(0.0004, 0.01, n_periods)
    
    factor_matrix = np.zeros((n_periods, n_assets))
    return_matrix = np.zeros((n_periods, n_assets))
    
    # Asset betas
    betas = np.random.uniform(0.7, 1.3, n_assets)
    
    for t in range(n_periods):
        # Factor values across assets (standard normal cross-sectionally)
        f_vals = np.random.normal(0, 1, n_assets)
        factor_matrix[t] = f_vals
        
        # Forward returns: beta*market + factor_quality * factor_t + idiosyncratic noise
        if t + 1 < n_periods:
            idio_noise = np.random.normal(0, 0.015, n_assets)
            fwd_ret = betas * mkt[t] + factor_quality * f_vals * 0.03 + idio_noise
            return_matrix[t + 1] = fwd_ret
        
    return factor_matrix, return_matrix

def analyze_cross_sectional_ic(
    factor_matrix: Optional[np.ndarray] = None,
    return_matrix: Optional[np.ndarray] = None,
    n_quantiles: int = 10,
    horizons: Optional[List[int]] = None
) -> Dict[str, Any]:
    """
    Module 9: Cross-Sectional IC Study (Factor Research Literature).
    Computes per-period Spearman rank IC, Mean IC, IC Std, ICIR, t-stat, Hit Rate,
    1-lag IC Autocorrelation, Monotonic Quantile Portfolios (Q1-Q10), Long-Short Spread,
    Factor Turnover, and 3D Time x Horizon IC surface.
    """
    if horizons is None:
        horizons = [1, 2, 3, 5, 10, 15]
        
    if factor_matrix is None or return_matrix is None:
        F, R = generate_synthetic_cross_section(n_periods=150, n_assets=50, factor_quality=0.075)
    else:
        F = np.asarray(factor_matrix, dtype=float)
        R = np.asarray(return_matrix, dtype=float)
        
    n_periods, n_assets = F.shape
    if n_periods < 30 or n_assets < 5:
        raise ValueError(f"Insufficient cross-section dimensions: {n_periods} periods x {n_assets} assets.")
        
    # 1. Per-period Spearman Rank IC at h=1
    period_ics = []
    for t in range(n_periods - 1):
        f_t = F[t]
        r_fwd = R[t + 1] # forward 1-period return
        mask = (~np.isnan(f_t)) & (~np.isnan(r_fwd))
        if np.sum(mask) >= 5:
            sr, _ = stats.spearmanr(f_t[mask], r_fwd[mask])
            period_ics.append(float(sr))
        else:
            period_ics.append(0.0)
            
    period_ics = np.array(period_ics)
    t_len = len(period_ics)
    
    mean_ic = float(np.mean(period_ics))
    std_ic = float(np.std(period_ics, ddof=1)) + 1e-9
    icir = float(mean_ic / std_ic)
    ic_tstat = float(icir * np.sqrt(t_len))
    ic_pval = float(2.0 * (1.0 - stats.t.cdf(abs(ic_tstat), df=max(1, t_len - 1))))
    hit_rate = float(np.mean(period_ics > 0.0))
    
    # 1-lag IC Autocorrelation (Persistence)
    if t_len > 10:
        ic_ar1 = float(stats.pearsonr(period_ics[:-1], period_ics[1:])[0])
    else:
        ic_ar1 = 0.0
        
    # Rolling 20-period Mean IC
    s_ic = pd.Series(period_ics)
    rolling_ic = s_ic.rolling(15).mean().fillna(mean_ic).round(4).tolist()
    
    # 2. Quantile Portfolios Sorting (e.g. Deciles Q1..Q10)
    q_returns = {q: [] for q in range(1, n_quantiles + 1)}
    long_short_rets = []
    
    for t in range(n_periods - 1):
        f_t = F[t]
        r_fwd = R[t + 1]
        
        # Rank assets and assign to quantiles
        ranks = stats.rankdata(f_t)
        q_bins = pd.qcut(ranks, q=n_quantiles, labels=False, duplicates='drop')
        
        q1_ret = 0.0
        qN_ret = 0.0
        for q_idx in range(n_quantiles):
            mask_q = (q_bins == q_idx)
            m_ret = float(np.mean(r_fwd[mask_q])) if np.sum(mask_q) > 0 else 0.0
            q_returns[q_idx + 1].append(m_ret)
            if q_idx == 0:
                q1_ret = m_ret
            if q_idx == n_quantiles - 1:
                qN_ret = m_ret
                
        long_short_rets.append(qN_ret - q1_ret)
        
    mean_decile_returns_bps = [round(float(np.mean(q_returns[q])) * 10000.0, 2) for q in range(1, n_quantiles + 1)]
    
    # Monotonicity Test: Spearman correlation of quantile number (1..N) vs Mean Return
    quantile_indices = list(range(1, n_quantiles + 1))
    mono_corr, mono_pval = stats.spearmanr(quantile_indices, mean_decile_returns_bps)
    mono_corr, mono_pval = float(mono_corr), float(mono_pval)
    
    # Long-Short Cumulative Curve & Performance
    ls_arr = np.array(long_short_rets)
    cum_ls = np.cumprod(1.0 + ls_arr).tolist()
    ls_mean = float(np.mean(ls_arr))
    ls_std = float(np.std(ls_arr, ddof=1)) + 1e-9
    ls_sharpe = float((ls_mean / ls_std) * np.sqrt(252.0))
    ls_ann_ret = float(ls_mean * 252.0 * 100.0)
    
    # Factor Turnover (Rank Autocorrelation of Factor from t to t+1)
    factor_turnover_list = []
    for t in range(n_periods - 1):
        r_f_corr, _ = stats.spearmanr(F[t], F[t+1])
        factor_turnover_list.append(1.0 - max(0.0, float(r_f_corr)))
    mean_factor_turnover = float(np.mean(factor_turnover_list))
    
    # IC Decay across Horizons (h = 1, 2, 3, 5, 10, 15)
    horizon_mean_ics = []
    for h in horizons:
        h_ics = []
        for t in range(n_periods - h):
            f_t = F[t]
            # h-period forward return
            r_fwd_h = np.sum(R[t+1 : t+h+1], axis=0)
            sr, _ = stats.spearmanr(f_t, r_fwd_h)
            h_ics.append(sr)
        horizon_mean_ics.append(round(float(np.mean(h_ics)), 4))
        
    # 3D Surface: Time Step x Horizon x IC
    # Sample 10 time slices across sample
    sample_time_steps = np.linspace(0, t_len - max(horizons) - 1, 10, dtype=int)
    surface_z = []
    for t_step in sample_time_steps:
        row = []
        for h in horizons:
            sr, _ = stats.spearmanr(F[t_step], np.sum(R[t_step+1 : t_step+h+1], axis=0))
            row.append(round(float(sr), 4))
        surface_z.append(row)

    is_significant = bool(abs(mean_ic) > 0.03 and ic_pval < 0.01)
    is_monotonic = bool(mono_corr > 0.80 and mono_pval < 0.05)
    
    verdict = (
        f"Cross-Sectional Factor Evaluation across {n_assets} assets: "
        f"Mean Rank IC = {mean_ic:.4f} with standard deviation {std_ic:.4f}, producing an ICIR of {icir:.2f}. "
        f"IC t-statistic is {ic_tstat:.2f} (p-value = {ic_pval:.4e}, {'highly statistically significant' if is_significant else 'insignificant'}). "
        f"Factor hit rate is {hit_rate*100:.1f}%, and 1-lag IC persistence is {ic_ar1:.2f}. "
        f"Monotonicity correlation across {n_quantiles} quantiles is {mono_corr:.2f} (p = {mono_pval:.4e}, "
        f"{'strong strictly monotonic return dispersion' if is_monotonic else 'non-monotonic / noisy bucket returns'}). "
        f"Long-Short spread (Q{n_quantiles}-Q1) annualized return is {ls_ann_ret:.1f}% with Sharpe {ls_sharpe:.2f}."
    )

    return {
        "kpis": {
            "mean_rank_ic": round(mean_ic, 4),
            "ic_std": round(std_ic, 4),
            "icir": round(icir, 2),
            "ic_t_stat": round(ic_tstat, 2),
            "ic_p_value": float(ic_pval),
            "hit_rate_pct": round(hit_rate * 100.0, 1),
            "ic_persistence_ar1": round(ic_ar1, 3),
            "monotonicity_corr": round(mono_corr, 3),
            "long_short_sharpe": round(ls_sharpe, 2),
            "long_short_ann_ret_pct": round(ls_ann_ret, 1),
            "mean_factor_turnover": round(mean_factor_turnover, 3)
        },
        "flags": {
            "has_significant_ic": is_significant,
            "has_monotonic_sort": is_monotonic
        },
        "ic_time_series": {
            "steps": list(range(1, t_len + 1)),
            "ic_values": [round(float(x), 4) for x in period_ics],
            "rolling_mean_ic": rolling_ic
        },
        "quantiles": {
            "labels": [f"Q{q}" for q in quantile_indices],
            "mean_returns_bps": mean_decile_returns_bps,
            "monotonicity_r": round(mono_corr, 3)
        },
        "long_short_curve": [round(float(x), 4) for x in cum_ls],
        "ic_decay": {
            "horizons": horizons,
            "mean_ics": horizon_mean_ics
        },
        "surface_3d": {
            "x_horizons": horizons,
            "y_time_slices": [f"T{t}" for t in sample_time_steps],
            "z_matrix": surface_z
        },
        "verdict": verdict
    }
