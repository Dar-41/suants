import math
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from scipy import stats

def analyze_transaction_costs(
    returns: np.ndarray,
    positions: Optional[np.ndarray] = None,
    spread_bps: float = 3.0,
    slippage_bps: float = 2.0,
    commission_bps: float = 1.0,
    adv_shares: float = 5_000_000.0,
    target_aum_usd: float = 25_000_000.0,
    asset_price: float = 100.0
) -> Dict[str, Any]:
    """
    Module 8: Transaction Cost Sensitivity (Kourtis, 2014; Almgren & Chriss, 2000).
    Evaluates institutional execution frictions: Bid-Ask Spread, Linear Slippage,
    Fixed Brokerage Commissions, and Non-Linear Square-Root Market Impact.
    Computes Breakeven Friction Cost, Turnover Drag, Scalable Capacity AUM, and 3D response surfaces.
    """
    r = np.asarray(returns, dtype=float)
    r = r[~np.isnan(r)]
    n = len(r)
    if n < 40:
        raise ValueError("Requires at least 40 return observations.")
        
    s_r = pd.Series(r)
    # If positions not supplied, generate typical momentum/mean-reversion position signal
    if positions is None or len(positions) != n:
        sig = s_r.rolling(10).mean().fillna(0.0).values
        pos = np.clip(sig / (np.std(sig) + 1e-6), -1.0, 1.0)
    else:
        pos = np.asarray(positions, dtype=float)
        
    # Turnover at each period: Delta pos = |pos_t - pos_{t-1}|
    delta_pos = np.abs(np.diff(pos, prepend=pos[0]))
    mean_turnover_per_bar = float(np.mean(delta_pos))
    annual_turnover = float(mean_turnover_per_bar * 252.0) # e.g. 12x per year
    
    # Gross Strategy Returns: pos_{t-1} * r_t
    gross_returns = np.zeros(n)
    gross_returns[1:] = pos[:-1] * r[1:]
    
    # Market Impact Model (Square-Root Law):
    # Impact = Y * sigma * sqrt(OrderSize / ADV)
    # Typical institutional Y ~ 0.5 - 0.7
    daily_vol = float(np.std(r))
    order_shares = (target_aum_usd * mean_turnover_per_bar) / max(asset_price, 1.0)
    participation_rate = order_shares / max(adv_shares, 1000.0)
    market_impact_bps = 0.6 * (daily_vol * 10000.0) * np.sqrt(min(participation_rate, 0.25))
    
    # Total one-way cost in bps
    base_linear_bps = (spread_bps * 0.5) + slippage_bps + commission_bps
    total_one_way_cost_bps = base_linear_bps + market_impact_bps
    total_one_way_cost_dec = total_one_way_cost_bps / 10000.0
    
    # Net Strategy Returns: gross_return_t - (delta_pos_t * total_one_way_cost)
    cost_series_dec = delta_pos * total_one_way_cost_dec
    net_returns = gross_returns - cost_series_dec
    
    # Gross vs Net KPIs
    gross_mean = float(np.mean(gross_returns))
    gross_std = float(np.std(gross_returns, ddof=1)) + 1e-9
    gross_ann_ret = float(gross_mean * 252.0)
    gross_ann_vol = float(gross_std * np.sqrt(252.0))
    gross_sharpe = float(gross_ann_ret / gross_ann_vol)
    
    net_mean = float(np.mean(net_returns))
    net_std = float(np.std(net_returns, ddof=1)) + 1e-9
    net_ann_ret = float(net_mean * 252.0)
    net_ann_vol = float(net_std * np.sqrt(252.0))
    net_sharpe = float(net_ann_ret / net_ann_vol)
    
    annual_cost_drag_bps = float(np.mean(cost_series_dec) * 252.0 * 10000.0)
    
    # Breakeven Transaction Cost C*:
    # where Net Mean Return = 0 => gross_mean - mean_turnover * C* = 0 => C* = gross_mean / mean_turnover
    if mean_turnover_per_bar > 1e-6 and gross_mean > 0:
        breakeven_cost_bps = float((gross_mean / mean_turnover_per_bar) * 10000.0)
    else:
        breakeven_cost_bps = 0.0
        
    # Scalable Capacity Estimate ($ AUM):
    # Solve for AUM where net alpha reaches zero under square-root market impact:
    # gross_mean - mean_turnover * [base_linear + 0.6*vol*sqrt((AUM*turnover/price)/ADV)] = 0
    residual_margin_dec = (gross_mean / max(mean_turnover_per_bar, 1e-5)) - (base_linear_bps / 10000.0)
    if residual_margin_dec > 0 and daily_vol > 1e-5:
        # (residual_margin / (0.6 * daily_vol))^2 = (AUM * turnover / price) / ADV
        ratio = residual_margin_dec / (0.6 * daily_vol)
        max_order_shares = (ratio ** 2) * adv_shares
        capacity_aum_usd = float(min(1e10, (max_order_shares * asset_price) / max(mean_turnover_per_bar, 1e-4)))
    else:
        capacity_aum_usd = 0.0
        
    # Cost Waterfall (bps / year)
    spread_drag = float(spread_bps * 0.5 * annual_turnover)
    slippage_drag = float(slippage_bps * annual_turnover)
    commission_drag = float(commission_bps * annual_turnover)
    impact_drag = float(market_impact_bps * annual_turnover)
    
    waterfall = {
        "Bid-Ask Spread Drag": round(spread_drag, 1),
        "Execution Slippage Drag": round(slippage_drag, 1),
        "Brokerage Commission Drag": round(commission_drag, 1),
        "Square-Root Market Impact Drag": round(impact_drag, 1),
        "Total Annual Cost Drag": round(annual_cost_drag_bps, 1)
    }
    
    # Cumulative curves across cost tiers (Gross, 5 bps, 15 bps, Current Net)
    cum_gross = np.cumprod(1.0 + gross_returns).tolist()
    cum_net = np.cumprod(1.0 + net_returns).tolist()
    
    # Net Sharpe vs Cost Curve (0 to 35 bps)
    cost_sweep_bps = [0.0, 2.0, 5.0, 10.0, 15.0, 20.0, 25.0, 30.0, 35.0]
    sharpe_sweep = []
    for c_bps in cost_sweep_bps:
        r_sweep = gross_returns - (delta_pos * (c_bps / 10000.0))
        sh_val = (np.mean(r_sweep) / (np.std(r_sweep) + 1e-9)) * np.sqrt(252.0)
        sharpe_sweep.append(round(float(sh_val), 2))
        
    # 3D Surface: Spread (1..15 bps) x Slippage (0..10 bps) -> Net Sharpe
    spread_grid = [1.0, 3.0, 6.0, 10.0, 15.0]
    slip_grid = [0.0, 2.0, 4.0, 6.0, 8.0]
    surface_z = []
    for sp in spread_grid:
        row = []
        for sl in slip_grid:
            tot_c = ((sp * 0.5) + sl + commission_bps + market_impact_bps) / 10000.0
            r_c = gross_returns - (delta_pos * tot_c)
            sh_val = (np.mean(r_c) / (np.std(r_c) + 1e-9)) * np.sqrt(252.0)
            row.append(round(float(sh_val), 2))
        surface_z.append(row)

    is_viable = bool(net_sharpe > 0.5 and total_one_way_cost_bps < breakeven_cost_bps)
    verdict = (
        f"Kourtis (2014) Transaction Cost & Market Impact Capacity Analysis: "
        f"Gross Sharpe of {gross_sharpe:.2f} decays to Net Sharpe of {net_sharpe:.2f} under base frictions of {total_one_way_cost_bps:.1f} bps one-way "
        f"(Spread: {spread_bps*0.5:.1f} bps, Slippage: {slippage_bps:.1f} bps, Comm: {commission_bps:.1f} bps, Non-linear Impact: {market_impact_bps:.1f} bps). "
        f"Annualized strategy turnover is {annual_turnover:.1f}x, generating total cost drag of {annual_cost_drag_bps:.0f} bps/year. "
        f"Theoretical Breakeven Cost is {breakeven_cost_bps:.1f} bps one-way. "
        f"Estimated Maximum Scalable Capacity before alpha exhaustion is ${capacity_aum_usd/1e6:.1f}M AUM. "
        f"Strategy is {'institutionally viable after all execution costs' if is_viable else 'cost-prohibitive: alpha eroded by turnover drag'}."
    )

    return {
        "kpis": {
            "gross_sharpe": round(gross_sharpe, 2),
            "net_sharpe": round(net_sharpe, 2),
            "breakeven_cost_bps": round(breakeven_cost_bps, 1),
            "total_one_way_cost_bps": round(total_one_way_cost_bps, 1),
            "annual_turnover_x": round(annual_turnover, 1),
            "annual_cost_drag_bps": round(annual_cost_drag_bps, 0),
            "market_impact_bps": round(market_impact_bps, 2),
            "capacity_aum_millions": round(capacity_aum_usd / 1e6, 2)
        },
        "flags": {
            "is_cost_viable": is_viable,
            "has_high_turnover": bool(annual_turnover > 20.0)
        },
        "waterfall": waterfall,
        "cost_sweep": {
            "costs_bps": cost_sweep_bps,
            "net_sharpes": sharpe_sweep,
            "breakeven_cost_bps": round(breakeven_cost_bps, 1)
        },
        "cumulative_curves": {
            "gross": [round(float(x), 4) for x in cum_gross],
            "net": [round(float(x), 4) for x in cum_net]
        },
        "surface_3d": {
            "x_spreads_bps": spread_grid,
            "y_slippages_bps": slip_grid,
            "z_matrix": surface_z
        },
        "verdict": verdict
    }
