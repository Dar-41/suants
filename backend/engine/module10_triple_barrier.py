import math
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from scipy import stats

def analyze_triple_barrier(
    prices: np.ndarray,
    pt_mult: float = 2.0,      # Profit-Take barrier multiplier
    sl_mult: float = 1.5,      # Stop-Loss barrier multiplier
    vertical_bars: int = 15,   # Maximum holding time barrier
    ewma_span: int = 20,       # Volatility target span
    sampling_freq: int = 3     # Run barrier check every N bars
) -> Dict[str, Any]:
    """
    Module 10: Triple-Barrier Label Explorer (Marcos López de Prado, AFML).
    Applies dynamic volatility-scaled horizontal barriers and vertical time barriers.
    Calculates label classifications (+1, -1, 0), sample concurrency, average uniqueness scores,
    sample weights, holding time distributions, and 3D PT x SL response surfaces.
    """
    p = np.asarray(prices, dtype=float)
    p = p[~np.isnan(p)]
    n = len(p)
    if n < 50:
        raise ValueError("Requires at least 50 price observations.")
        
    # 1. Dynamic Volatility Target via EWMA of log returns
    log_rets = pd.Series(np.diff(np.log(p), prepend=np.log(p[0])))
    daily_vol = log_rets.ewm(span=ewma_span).std().fillna(log_rets.std()).values
    daily_vol = np.maximum(daily_vol, 0.002) # clip floor
    
    # 2. Triple Barrier Search
    events = []
    active_intervals = [] # list of (t_start, t_end)
    labels = []
    returns_at_exit = []
    holding_times = []
    
    for t0 in range(0, n - vertical_bars, sampling_freq):
        price_0 = p[t0]
        vol_0 = daily_vol[t0]
        
        upper_barrier = price_0 * (1.0 + pt_mult * vol_0)
        lower_barrier = price_0 * (1.0 - sl_mult * vol_0)
        
        hit_label = 0 # default vertical expiration
        touch_t = t0 + vertical_bars
        exit_price = p[touch_t]
        
        for step in range(1, vertical_bars + 1):
            curr_idx = t0 + step
            curr_price = p[curr_idx]
            
            # Check upper barrier touch
            if curr_price >= upper_barrier:
                hit_label = 1
                touch_t = curr_idx
                exit_price = curr_price
                break
            # Check lower barrier touch
            elif curr_price <= lower_barrier:
                hit_label = -1
                touch_t = curr_idx
                exit_price = curr_price
                break
                
        h_time = touch_t - t0
        ret_val = (exit_price / price_0) - 1.0
        
        events.append({
            "t_entry": t0,
            "t_exit": touch_t,
            "entry_price": round(price_0, 2),
            "exit_price": round(exit_price, 2),
            "upper_barrier": round(upper_barrier, 2),
            "lower_barrier": round(lower_barrier, 2),
            "label": hit_label,
            "holding_time": h_time,
            "return_pct": round(ret_val * 100.0, 2)
        })
        active_intervals.append((t0, touch_t))
        labels.append(hit_label)
        returns_at_exit.append(ret_val)
        holding_times.append(h_time)
        
    num_events = len(labels)
    if num_events == 0:
        raise ValueError("No events generated with current parameters.")
        
    # 3. Sample Concurrency and Uniqueness (López de Prado AFML Chapter 4)
    # Compute concurrency array c_t: number of concurrent active labels at time t
    concurrency = np.zeros(n)
    for (t_start, t_end) in active_intervals:
        concurrency[t_start : t_end + 1] += 1
    concurrency = np.maximum(concurrency, 1.0)
    
    # Compute average uniqueness u_i for each event i:
    # u_i = 1 / (t_end - t_start + 1) * sum_{t=t_start}^{t_end} (1 / c_t)
    uniqueness_scores = []
    for (t_start, t_end) in active_intervals:
        window_inv_c = 1.0 / concurrency[t_start : t_end + 1]
        u_i = float(np.mean(window_inv_c))
        uniqueness_scores.append(u_i)
        
    mean_uniqueness = float(np.mean(uniqueness_scores))
    
    # Sample Weights for ML: w_i = u_i * |r_i|
    abs_returns = np.abs(np.array(returns_at_exit))
    sample_weights = np.array(uniqueness_scores) * abs_returns
    sum_w = np.sum(sample_weights)
    if sum_w > 0:
        sample_weights = (sample_weights / sum_w) * num_events
    sample_weights = [round(float(w), 4) for w in sample_weights]
    
    # 4. Label Distributions
    label_arr = np.array(labels)
    n_pt = int(np.sum(label_arr == 1))
    n_sl = int(np.sum(label_arr == -1))
    n_vert = int(np.sum(label_arr == 0))
    
    pct_pt = round((n_pt / num_events) * 100.0, 1)
    pct_sl = round((n_sl / num_events) * 100.0, 1)
    pct_vert = round((n_vert / num_events) * 100.0, 1)
    
    # Mean holding time by label type
    ht_pt = float(np.mean(np.array(holding_times)[label_arr == 1])) if n_pt > 0 else 0.0
    ht_sl = float(np.mean(np.array(holding_times)[label_arr == -1])) if n_sl > 0 else 0.0
    ht_vert = float(np.mean(np.array(holding_times)[label_arr == 0])) if n_vert > 0 else float(vertical_bars)
    
    # Strategy Return / Sharpe from Labels
    r_arr = np.array(returns_at_exit)
    m_ret = float(np.mean(r_arr))
    s_ret = float(np.std(r_arr, ddof=1)) + 1e-9
    event_sharpe = float((m_ret / s_ret) * np.sqrt(252.0 / max(1, np.mean(holding_times))))
    
    # 5. 3D Parameter Surface: PT Mult (1.0..3.5) x SL Mult (1.0..3.5) -> Win/Loss Ratio or Expected Return
    pt_grid = [1.0, 1.5, 2.0, 2.5, 3.2]
    sl_grid = [1.0, 1.5, 2.0, 2.5, 3.2]
    surface_z = []
    
    for pt_val in pt_grid:
        row = []
        for sl_val in sl_grid:
            # Fast vectorized scan for surface
            sim_pt_hits = 0
            sim_sl_hits = 0
            for t0 in range(0, min(n - vertical_bars, 200), sampling_freq * 2):
                p0 = p[t0]
                v0 = daily_vol[t0]
                up = p0 * (1.0 + pt_val * v0)
                dn = p0 * (1.0 - sl_val * v0)
                sub_p = p[t0+1 : t0+vertical_bars+1]
                up_idx = np.where(sub_p >= up)[0]
                dn_idx = np.where(sub_p <= dn)[0]
                first_up = up_idx[0] if len(up_idx) > 0 else 999
                first_dn = dn_idx[0] if len(dn_idx) > 0 else 999
                if first_up < first_dn:
                    sim_pt_hits += 1
                elif first_dn < first_up:
                    sim_sl_hits += 1
            ratio = sim_pt_hits / max(1, sim_sl_hits)
            row.append(round(float(ratio), 2))
        surface_z.append(row)

    is_balanced = bool(abs(pct_pt - pct_sl) < 25.0)
    verdict = (
        f"López de Prado (AFML) Triple-Barrier Labeling Diagnostics: "
        f"Evaluated {num_events} barrier event paths with PT multiplier = {pt_mult:.1f}σ, SL multiplier = {sl_mult:.1f}σ, and Vertical expiry = {vertical_bars} bars. "
        f"Label distribution: Profit-Take (+1) = {pct_pt}% ({n_pt} hits, avg hold {ht_pt:.1f} bars), "
        f"Stop-Loss (-1) = {pct_sl}% ({n_sl} hits, avg hold {ht_sl:.1f} bars), "
        f"Vertical Expiration (0) = {pct_vert}% ({n_vert} hits, avg hold {ht_vert:.1f} bars). "
        f"Average sample uniqueness is {mean_uniqueness:.3f} (concurrency range 1 to {int(np.max(concurrency))}). "
        f"Labeled trade population generates an annualized Sharpe of {event_sharpe:.2f} with average return of {m_ret*100:.2f}% per bet. "
        f"Dataset balance is {'optimally calibrated for machine learning classifiers' if is_balanced else 'skewed: adjust PT/SL multipliers to balance label classes'}."
    )

    return {
        "kpis": {
            "total_events": num_events,
            "profit_take_pct": pct_pt,
            "stop_loss_pct": pct_sl,
            "vertical_expiry_pct": pct_vert,
            "average_uniqueness": round(mean_uniqueness, 3),
            "max_concurrency": int(np.max(concurrency)),
            "event_sharpe": round(event_sharpe, 2),
            "avg_holding_time": round(float(np.mean(holding_times)), 1),
            "avg_profit_hold_time": round(ht_pt, 1),
            "avg_stop_hold_time": round(ht_sl, 1)
        },
        "flags": {
            "is_label_balanced": is_balanced,
            "has_high_uniqueness": bool(mean_uniqueness > 0.60)
        },
        "distribution": {
            "labels": ["Profit-Take (+1)", "Stop-Loss (-1)", "Vertical Expiry (0)"],
            "counts": [n_pt, n_sl, n_vert],
            "percentages": [pct_pt, pct_sl, pct_vert],
            "avg_holding_bars": [round(ht_pt, 1), round(ht_sl, 1), round(ht_vert, 1)]
        },
        "sample_events": events[:35], # First 35 events for price path overlay chart
        "surface_3d": {
            "x_profit_takes": pt_grid,
            "y_stop_losses": sl_grid,
            "z_matrix": surface_z
        },
        "verdict": verdict
    }
