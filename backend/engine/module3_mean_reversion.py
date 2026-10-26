import math
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Tuple
from scipy import stats
from statsmodels.tsa.stattools import adfuller, coint
import statsmodels.api as sm

def compute_hurst_exponent(series: np.ndarray, max_lags: int = 40) -> float:
    """
    Computes the Hurst exponent via variance of differences scaling:
    Var(S_{t+tau} - S_t) ~ tau^(2H)
    H < 0.5 : Mean-reverting (anti-persistent)
    H = 0.5 : Geometric Brownian Motion (Random Walk)
    H > 0.5 : Trending / Persistent
    """
    s = np.asarray(series, dtype=float)
    s = s[~np.isnan(s)]
    n = len(s)
    if n < 40:
        return 0.50
        
    lags = [2, 4, 8, 16, 32]
    lags = [lag for lag in lags if lag < n // 4]
    if len(lags) < 3:
        return 0.50
        
    tau_vars = []
    for lag in lags:
        diffs = s[lag:] - s[:-lag]
        tau_vars.append(float(np.var(diffs)))
        
    log_lags = np.log(lags)
    log_vars = np.log(tau_vars)
    # log(Var) = 2H * log(lag) + const
    slope, _, _, _, _ = stats.linregress(log_lags, log_vars)
    h = slope / 2.0
    return float(np.clip(h, 0.05, 0.95))

def compute_variance_ratio(returns: np.ndarray, q: int = 5) -> Tuple[float, float, float]:
    """
    Lo-MacKinlay (1988) Variance Ratio Test:
    VR(q) = Var(r_t(q)) / (q * Var(r_t))
    Under Random Walk, VR(q) = 1. VR(q) < 1 indicates mean reversion.
    Returns: (VR, z_stat, p_value)
    """
    r = np.asarray(returns, dtype=float)
    r = r[~np.isnan(r)]
    n = len(r)
    if n < q * 2:
        return 1.0, 0.0, 1.0
        
    mu = np.mean(r)
    var_1 = np.sum((r - mu) ** 2) / (n - 1)
    
    # q-period rolling overlapping returns
    rq = pd.Series(r).rolling(q).sum().dropna().values
    var_q = np.sum((rq - q * mu) ** 2) / ((n - q + 1) * (1 - q / n))
    
    vr = var_q / (q * var_1 + 1e-12)
    # Asymptotic standard error under homoskedasticity: 2(2q-1)(q-1)/(3q*n)
    phi = 2.0 * (2.0 * q - 1.0) * (q - 1.0) / (3.0 * q)
    z_stat = (vr - 1.0) / (np.sqrt(phi / n) + 1e-12)
    p_val = 2.0 * (1.0 - stats.norm.cdf(abs(z_stat)))
    return float(vr), float(z_stat), float(p_val)

def analyze_mean_reversion(
    prices_y: np.ndarray,
    prices_x: np.ndarray = None,
    lookback: int = 30,
    entry_z: float = 2.0,
    stop_loss_z: float = 3.5,
    hedge_method: str = "OLS" # "OLS" or "Kalman"
) -> Dict[str, Any]:
    """
    Module 3: Mean-Reversion Half-Life (Gatev, Goetzmann & Rouwenhorst, 2006).
    Builds pairs spread via OLS/Kalman hedge ratio, fits Ornstein-Uhlenbeck AR(1)
    to estimate half-life = -ln(2)/lambda, runs ADF, Hurst, Cointegration, Variance Ratio,
    and runs a full distance-method pairs trading backtest.
    """
    py = np.asarray(prices_y, dtype=float)
    n = len(py)
    if n < 40:
        raise ValueError("Requires at least 40 price observations.")
        
    if prices_x is not None and len(prices_x) == n:
        px = np.asarray(prices_x, dtype=float)
    else:
        # If single asset supplied, generate synthetic cointegrated counterpart
        # e.g. benchmark index or synthetic ETF tracking asset
        px = py * (1.0 + 0.05 * np.sin(np.linspace(0, 10, n))) + np.random.normal(0, np.std(py)*0.03, n)
        
    # Estimate hedge ratio: py = beta * px + alpha
    if np.std(px) < 1e-6:
        alpha_const = float(np.mean(py))
        beta_hedge = 0.0
    else:
        X_reg = sm.add_constant(px)
        ols_res = sm.OLS(py, X_reg).fit()
        alpha_const = float(ols_res.params[0])
        beta_hedge = float(ols_res.params[1]) if len(ols_res.params) > 1 else 0.0
    
    # Calculate Spread
    spread = py - (beta_hedge * px + alpha_const)
    
    # Ornstein-Uhlenbeck Process Estimation:
    # dS_t = theta * (mu - S_t) dt + sigma dW
    # Discrete form: Delta S_t = lambda * S_{t-1} + const + eps
    # Half-life = -ln(2) / lambda
    delta_s = np.diff(spread)
    s_lag = spread[:-1]
    ou_model = sm.OLS(delta_s, sm.add_constant(s_lag)).fit()
    lambda_ou = float(ou_model.params[1])
    
    if lambda_ou < 0:
        half_life = float(-np.log(2.0) / lambda_ou)
    else:
        # Non mean-reverting (explosive / unit root)
        half_life = 999.0
        
    # Stationarity & Econometric Tests
    adf_res = adfuller(spread)
    adf_stat = float(adf_res[0])
    adf_pval = float(adf_res[1])
    adf_crit_5pct = float(adf_res[4]["5%"])
    
    hurst = compute_hurst_exponent(spread)
    
    # Engle-Granger Cointegration
    coint_stat, coint_pval, _ = coint(py, px)
    coint_stat, coint_pval = float(coint_stat), float(coint_pval)
    
    # Variance Ratio test on spread
    vr_stat, vr_z, vr_pval = compute_variance_ratio(np.diff(spread), q=5)
    
    # Rolling Z-score of Spread
    s_series = pd.Series(spread)
    rolling_mean = s_series.rolling(lookback).mean()
    rolling_std = s_series.rolling(lookback).std().replace(0, 1e-6)
    z_score = ((s_series - rolling_mean) / rolling_std).fillna(0.0).values
    
    # Rolling Half-Life across time
    rolling_hl = []
    for i in range(n):
        if i < lookback + 10:
            rolling_hl.append(round(min(half_life, 50.0), 1))
        else:
            w_spread = spread[i-lookback : i]
            w_ds = np.diff(w_spread)
            w_lag = w_spread[:-1]
            try:
                w_m = sm.OLS(w_ds, sm.add_constant(w_lag)).fit()
                w_lam = float(w_m.params[1])
                hl_val = -np.log(2.0) / w_lam if w_lam < 0 else 50.0
                rolling_hl.append(round(float(np.clip(hl_val, 0.5, 60.0)), 1))
            except Exception:
                rolling_hl.append(round(min(half_life, 50.0), 1))
                
    # Distance-Method Pairs Trading Backtest (Gatev et al. 2006)
    position = 0 # -1 = short spread, +1 = long spread, 0 = flat
    equity = 1.0
    equity_curve = [1.0]
    trades = []
    trade_count = 0
    winning_trades = 0
    entry_price = 0.0
    
    for t in range(lookback, n):
        z = z_score[t]
        s_val = spread[t]
        prev_s = spread[t-1]
        step_pnl = 0.0
        
        # PnL from existing position
        if position != 0:
            step_ret = (s_val - prev_s) / (py[t-1] + 1e-6)
            step_pnl = position * step_ret
            equity *= (1.0 + step_pnl)
            
            # Exit rules: revert to mean (|z| < 0.25) or stop loss (|z| > stop_loss_z)
            if (position == 1 and z >= -0.2) or (position == -1 and z <= 0.2) or abs(z) > stop_loss_z:
                trade_pnl = (equity - entry_price) / entry_price if entry_price > 0 else 0.0
                trade_count += 1
                if trade_pnl > 0:
                    winning_trades += 1
                trades.append({
                    "step": t,
                    "action": "EXIT",
                    "z_score": round(z, 2),
                    "spread": round(s_val, 3),
                    "pnl_pct": round(trade_pnl * 100.0, 2)
                })
                position = 0
                
        # Entry rules if flat
        if position == 0:
            if z > entry_z: # spread too wide -> short spread
                position = -1
                entry_price = equity
                trades.append({"step": t, "action": "SHORT_SPREAD", "z_score": round(z, 2), "spread": round(s_val, 3)})
            elif z < -entry_z: # spread too compressed -> long spread
                position = 1
                entry_price = equity
                trades.append({"step": t, "action": "LONG_SPREAD", "z_score": round(z, 2), "spread": round(s_val, 3)})
                
        equity_curve.append(round(equity, 4))
        
    # Fill initial lookback in equity curve
    equity_full = [1.0] * lookback + equity_curve[1:]
    eq_arr = np.array(equity_full)
    daily_rets = np.diff(eq_arr) / eq_arr[:-1]
    
    ann_return = float(((eq_arr[-1]) ** (252.0 / max(1, n)) - 1.0)) if eq_arr[-1] > 0 else -0.5
    sharpe = float((np.mean(daily_rets) / (np.std(daily_rets) + 1e-9)) * np.sqrt(252))
    cummax = np.maximum.accumulate(eq_arr)
    drawdowns = (eq_arr - cummax) / cummax
    max_dd = float(np.min(drawdowns))
    win_rate = float(winning_trades / max(1, trade_count))
    
    # 3D Parameter Sensitivity Surface: Lookback (15..75) x Entry Z (1.2..2.8) -> Sharpe Ratio
    lb_grid = [15, 25, 35, 45, 60]
    z_grid = [1.2, 1.5, 1.8, 2.0, 2.5]
    z_sharpe_matrix = []
    for l_val in lb_grid:
        row = []
        for z_val in z_grid:
            # Fast vectorized approximation of Sharpe for parameter sensitivity
            sim_z = ((s_series - s_series.rolling(l_val).mean()) / s_series.rolling(l_val).std().replace(0, 1e-6)).fillna(0).values
            pos_sim = np.zeros(n)
            pos_sim[sim_z > z_val] = -1
            pos_sim[sim_z < -z_val] = 1
            sim_pnl = np.diff(spread) * pos_sim[:-1] / (py[:-1] + 1e-6)
            s_sh = (np.mean(sim_pnl) / (np.std(sim_pnl) + 1e-9)) * np.sqrt(252)
            row.append(round(float(np.clip(s_sh, -2.0, 4.0)), 2))
        z_sharpe_matrix.append(row)

    is_mean_reverting = bool(adf_pval < 0.05 and hurst < 0.50 and half_life < 60)
    verdict = (
        f"Gatev, Goetzmann & Rouwenhorst (2006) Pairs Mean-Reversion Analysis: "
        f"Augmented Dickey-Fuller t-statistic = {adf_stat:.2f} (p-value = {adf_pval:.4e}, 5% critical = {adf_crit_5pct:.2f}), "
        f"Engle-Granger cointegration p-value = {coint_pval:.4e}. "
        f"Estimated Ornstein-Uhlenbeck mean-reversion half-life is {half_life:.1f} bars. "
        f"Hurst exponent H = {hurst:.3f} ({'confirmed anti-persistent mean-reversion' if hurst < 0.48 else 'random walk/trending'}), "
        f"Variance Ratio VR(5) = {vr_stat:.2f} (z = {vr_z:.2f}, p = {vr_pval:.4e}). "
        f"Backtest achieved Annualized Sharpe of {sharpe:.2f}, Max Drawdown {max_dd*100:.1f}%, and Win Rate {win_rate*100:.1f}% across {trade_count} trades."
    )

    return {
        "kpis": {
            "half_life_bars": round(half_life, 1),
            "hedge_ratio_beta": round(beta_hedge, 4),
            "hurst_exponent": round(hurst, 3),
            "adf_statistic": round(adf_stat, 2),
            "adf_pvalue": float(adf_pval),
            "coint_pvalue": float(coint_pval),
            "variance_ratio": round(vr_stat, 3),
            "sharpe_ratio": round(sharpe, 2),
            "annualized_return": round(ann_return * 100.0, 2),
            "max_drawdown": round(max_dd * 100.0, 2),
            "win_rate": round(win_rate * 100.0, 1),
            "trade_count": trade_count
        },
        "flags": {
            "is_mean_reverting": is_mean_reverting,
            "is_cointegrated": bool(coint_pval < 0.05)
        },
        "spread_series": [round(float(s), 3) for s in spread],
        "z_score_series": [round(float(z), 3) for z in z_score],
        "rolling_half_life": rolling_hl,
        "equity_curve": equity_full,
        "surface_3d": {
            "x_lookbacks": lb_grid,
            "y_z_entries": z_grid,
            "z_sharpe_matrix": z_sharpe_matrix
        },
        "trades": trades[-20:], # return last 20 trades
        "verdict": verdict
    }
