import math
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from scipy import stats

def analyze_overnight_effect(
    df: pd.DataFrame,
    bootstrap_iterations: int = 1000,
    seed: int = 42
) -> Dict[str, Any]:
    """
    Module 6: The Overnight Effect (Cooper, Cliff & Gulen, 2008).
    Decomposes total daily returns into Overnight (Close-to-Open) and Intraday (Open-to-Close).
    Calculates cumulative compounded divergence, annualized Sharpe ratios, paired t-tests,
    bootstrap difference distributions, weekday/month breakdowns, and 3D surface.
    """
    data = df.copy()
    req_cols = ["timestamp", "open", "close"]
    for c in req_cols:
        if c not in data.columns:
            raise ValueError(f"Missing required column: {c}")
            
    data["dt"] = pd.to_datetime(data["timestamp"])
    data = data.sort_values("dt").reset_index(drop=True)
    
    # Overnight return: Open_t / Close_{t-1} - 1
    # Intraday return: Close_t / Open_t - 1
    # Total return: Close_t / Close_{t-1} - 1
    prev_close = data["close"].shift(1)
    
    data["ret_overnight"] = (data["open"] / prev_close) - 1.0
    data["ret_intraday"] = (data["close"] / data["open"]) - 1.0
    data["ret_total"] = (data["close"] / prev_close) - 1.0
    
    # Drop first row where prev_close is NaN
    valid = data.dropna(subset=["ret_overnight", "ret_intraday", "ret_total"]).copy()
    n = len(valid)
    if n < 30:
        raise ValueError("Requires at least 30 observations with open and close prices.")
        
    on_ret = valid["ret_overnight"].values
    id_ret = valid["ret_intraday"].values
    tot_ret = valid["ret_total"].values
    
    # Statistical moments and Sharpe
    def calc_stats(arr):
        m = float(np.mean(arr))
        s = float(np.std(arr, ddof=1)) + 1e-9
        ann_ret = float(m * 252.0)
        ann_vol = float(s * np.sqrt(252.0))
        sh = float(ann_ret / ann_vol)
        sk = float(stats.skew(arr))
        kt = float(stats.kurtosis(arr, fisher=False))
        return {
            "mean_bps": round(m * 10000.0, 2),
            "ann_ret_pct": round(ann_ret * 100.0, 2),
            "ann_vol_pct": round(ann_vol * 100.0, 2),
            "sharpe": round(sh, 2),
            "skewness": round(sk, 2),
            "kurtosis": round(kt, 2)
        }
        
    stats_on = calc_stats(on_ret)
    stats_id = calc_stats(id_ret)
    stats_tot = calc_stats(tot_ret)
    
    # Paired Student's t-test: H0: mean(ret_overnight) == mean(ret_intraday)
    t_stat, p_val = stats.ttest_rel(on_ret, id_ret)
    t_stat, p_val = float(t_stat), float(p_val)
    
    # Bootstrap Reality Check on Mean Difference: (mu_ON - mu_ID)
    np.random.seed(seed)
    diff = on_ret - id_ret
    boot_diffs = []
    for _ in range(bootstrap_iterations):
        sample = np.random.choice(diff, size=n, replace=True)
        boot_diffs.append(float(np.mean(sample) * 10000.0)) # in bps
        
    boot_diffs = np.array(boot_diffs)
    boot_ci_low = float(np.percentile(boot_diffs, 2.5))
    boot_ci_high = float(np.percentile(boot_diffs, 97.5))
    boot_p_diff_positive = float(np.mean(boot_diffs > 0.0))
    
    # Cumulative Curves
    cum_on = np.cumprod(1.0 + on_ret).tolist()
    cum_id = np.cumprod(1.0 + id_ret).tolist()
    cum_tot = np.cumprod(1.0 + tot_ret).tolist()
    
    # Breakdown by Weekday (Monday to Friday)
    valid["weekday"] = valid["dt"].dt.day_name()
    weekdays_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    existing_wd = [w for w in weekdays_order if w in valid["weekday"].unique()]
    
    wd_on = valid.groupby("weekday")["ret_overnight"].mean().reindex(existing_wd) * 10000.0
    wd_id = valid.groupby("weekday")["ret_intraday"].mean().reindex(existing_wd) * 10000.0
    
    weekday_summary = {
        "labels": existing_wd,
        "overnight_bps": [round(float(v), 2) for v in wd_on.fillna(0.0)],
        "intraday_bps": [round(float(v), 2) for v in wd_id.fillna(0.0)]
    }
    
    # Breakdown by Year
    valid["year"] = valid["dt"].dt.year
    years = sorted(valid["year"].unique().tolist())
    yr_on = valid.groupby("year")["ret_overnight"].mean().reindex(years) * 252.0 * 100.0
    yr_id = valid.groupby("year")["ret_intraday"].mean().reindex(years) * 252.0 * 100.0
    
    year_summary = {
        "years": [int(y) for y in years],
        "overnight_ann_pct": [round(float(v), 2) for v in yr_on.fillna(0.0)],
        "intraday_ann_pct": [round(float(v), 2) for v in yr_id.fillna(0.0)]
    }
    
    # 3D Surface: Year x Weekday x Mean Overnight Return (bps)
    pivot_3d = valid.pivot_table(
        index="year",
        columns="weekday",
        values="ret_overnight",
        aggfunc="mean"
    ).reindex(index=years, columns=existing_wd).fillna(0.0) * 10000.0
    
    surface_z = [[round(float(val), 2) for val in row] for row in pivot_3d.values]
    
    is_on_dominant = bool(stats_on["sharpe"] > stats_id["sharpe"] and stats_on["mean_bps"] > stats_id["mean_bps"])
    is_stat_sig = bool(p_val < 0.05)
    
    verdict = (
        f"Cooper, Cliff & Gulen (2008) Overnight vs Intraday Return Anomaly: "
        f"Overnight returns delivered {stats_on['ann_ret_pct']}% annualized (Sharpe = {stats_on['sharpe']}) "
        f"compared to Intraday's {stats_id['ann_ret_pct']}% annualized (Sharpe = {stats_id['sharpe']}). "
        f"Paired t-test t-statistic is {t_stat:.2f} (p-value = {p_val:.4e}), "
        f"{'statistically confirming significant overnight drift superiority' if is_stat_sig else 'showing insignificant difference between sessions'}. "
        f"Bootstrap difference 95% CI is [{boot_ci_low:.1f} bps, {boot_ci_high:.1f} bps] with {boot_p_diff_positive*100:.1f}% probability that overnight outperforms intraday."
    )

    return {
        "kpis": {
            "overnight_ann_return_pct": stats_on["ann_ret_pct"],
            "overnight_sharpe": stats_on["sharpe"],
            "intraday_ann_return_pct": stats_id["ann_ret_pct"],
            "intraday_sharpe": stats_id["sharpe"],
            "paired_t_stat": round(t_stat, 2),
            "paired_p_val": float(p_val),
            "boot_ci_low_bps": round(boot_ci_low, 1),
            "boot_ci_high_bps": round(boot_ci_high, 1),
            "total_ann_return_pct": stats_tot["ann_ret_pct"],
            "total_sharpe": stats_tot["sharpe"]
        },
        "flags": {
            "has_overnight_dominance": is_on_dominant,
            "is_statistically_significant": is_stat_sig
        },
        "stats_table": {
            "overnight": stats_on,
            "intraday": stats_id,
            "total": stats_tot
        },
        "cumulative_curves": {
            "overnight": [round(float(x), 4) for x in cum_on],
            "intraday": [round(float(x), 4) for x in cum_id],
            "total": [round(float(x), 4) for x in cum_tot]
        },
        "weekday_summary": weekday_summary,
        "year_summary": year_summary,
        "surface_3d": {
            "x_weekdays": existing_wd,
            "y_years": [int(y) for y in years],
            "z_matrix": surface_z
        },
        "verdict": verdict
    }
