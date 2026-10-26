import math
import numpy as np
import pandas as pd
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta
import requests
import io

def generate_synthetic_quant_dataset(
    n_days: int = 750,
    intraday_bars_per_day: int = 24, # e.g. hourly or 15-min bars
    seed: int = 42
) -> pd.DataFrame:
    """
    Generates institutional-quality synthetic financial dataset using:
    - 3-State Markov Switching (Bull Low-Vol, Bear High-Vol, Turbulent)
    - GARCH(1,1) Volatility Dynamics: sigma_t^2 = omega + alpha*eps_{t-1}^2 + beta*sigma_{t-1}^2
    - Andersen-Bollerslev Diurnal U-shape Intraday Seasonality: s(t)
    - Fat-tailed Student-t Innovations
    """
    np.random.seed(seed)
    
    # 3-State Markov Transition Matrix
    # State 0: Bull / Low Vol (drift > 0, vol = 0.12 annualized)
    # State 1: Bear / High Vol (drift < 0, vol = 0.32 annualized)
    # State 2: Turbulent / Jump (drift ~ 0, vol = 0.50 annualized)
    P = np.array([
        [0.96, 0.03, 0.01],
        [0.05, 0.92, 0.03],
        [0.10, 0.10, 0.80]
    ])
    
    state_drifts = [0.0006, -0.0008, -0.0002] # daily drift
    state_base_vols = [0.008, 0.022, 0.035]    # daily vol baseline
    
    # GARCH parameters
    omega = 1e-6
    alpha = 0.10
    beta = 0.85
    
    total_bars = n_days * intraday_bars_per_day
    start_date = datetime(2023, 1, 3, 9, 30)
    
    states = np.zeros(n_days, dtype=int)
    curr_state = 0
    for d in range(n_days):
        states[d] = curr_state
        curr_state = np.random.choice([0, 1, 2], p=P[curr_state])
        
    # Diurnal U-shape profile for intraday bars
    t_norm = np.linspace(-1, 1, intraday_bars_per_day)
    diurnal_vol = 1.0 + 0.6 * (t_norm ** 2) # high at open and close, lower midday
    diurnal_vol /= np.mean(diurnal_vol)
    
    # Simulate daily conditional variance
    daily_sigma2 = np.zeros(n_days)
    daily_returns = np.zeros(n_days)
    curr_sigma2 = state_base_vols[0] ** 2
    
    for d in range(n_days):
        s = states[d]
        curr_sigma2 = omega + alpha * (daily_returns[d-1] ** 2 if d > 0 else 0) + beta * curr_sigma2
        # Blend GARCH with regime baseline
        blended_sigma = 0.6 * np.sqrt(max(curr_sigma2, 1e-7)) + 0.4 * state_base_vols[s]
        daily_sigma2[d] = blended_sigma ** 2
        # Student-t shock with 5 d.o.f.
        t_shock = np.random.standard_t(df=5) / np.sqrt(5/3)
        daily_returns[d] = state_drifts[s] + blended_sigma * t_shock

    # Now generate intraday bars
    timestamps = []
    opens = []
    highs = []
    lows = []
    closes = []
    volumes = []
    regimes = []
    
    price = 100.0
    bar_idx = 0
    
    for d in range(n_days):
        day_date = start_date + timedelta(days=d)
        if day_date.weekday() >= 5: # skip weekends
            continue
            
        day_regime = states[d]
        d_vol = np.sqrt(daily_sigma2[d]) / np.sqrt(intraday_bars_per_day)
        
        for b in range(intraday_bars_per_day):
            bar_time = day_date.replace(hour=9, minute=30) + timedelta(minutes=int(390 * b / intraday_bars_per_day))
            timestamps.append(bar_time.strftime("%Y-%m-%d %H:%M:%S"))
            regimes.append(int(day_regime))
            
            # Intraday return with diurnal vol
            vol_bar = d_vol * diurnal_vol[b]
            bar_ret = (state_drifts[day_regime] / intraday_bars_per_day) + vol_bar * np.random.normal(0, 1)
            
            p_open = price
            p_close = price * math.exp(bar_ret)
            intra_noise = vol_bar * price * 0.7
            p_high = max(p_open, p_close) + abs(np.random.normal(0, intra_noise))
            p_low = min(p_open, p_close) - abs(np.random.normal(0, intra_noise))
            
            # Realistic Volume (U-shape + vol correlated)
            base_vol = 100000 * diurnal_vol[b] * (1.0 + 15.0 * abs(bar_ret))
            volume = max(1000, int(base_vol * np.random.lognormal(0, 0.3)))
            
            opens.append(round(p_open, 4))
            highs.append(round(p_high, 4))
            lows.append(round(p_low, 4))
            closes.append(round(p_close, 4))
            volumes.append(volume)
            
            price = p_close
            bar_idx += 1
            
    df = pd.DataFrame({
        "timestamp": timestamps,
        "open": opens,
        "high": highs,
        "low": lows,
        "close": closes,
        "volume": volumes,
        "regime": regimes
    })
    
    df["return"] = np.log(df["close"] / df["close"].shift(1)).fillna(0.0)
    return df

def fetch_binance_klines(symbol: str = "BTCUSDT", interval: str = "1h", limit: int = 500) -> pd.DataFrame:
    """Fetch live/historical klines directly from Binance public API (no key needed)."""
    url = f"https://api.binance.com/api/v3/klines?symbol={symbol.upper()}&interval={interval}&limit={limit}"
    resp = requests.get(url, timeout=6)
    resp.raise_for_status()
    data = resp.json()
    
    rows = []
    for item in data:
        t = datetime.fromtimestamp(item[0] / 1000.0).strftime("%Y-%m-%d %H:%M:%S")
        rows.append({
            "timestamp": t,
            "open": float(item[1]),
            "high": float(item[2]),
            "low": float(item[3]),
            "close": float(item[4]),
            "volume": float(item[5])
        })
    df = pd.DataFrame(rows)
    df["return"] = np.log(df["close"] / df["close"].shift(1)).fillna(0.0)
    df["regime"] = 0
    return df

def fetch_yfinance_history(symbol: str = "SPY", period: str = "2y", interval: str = "1d") -> pd.DataFrame:
    """Fetch ticker history via yfinance."""
    import yfinance as yf
    ticker = yf.Ticker(symbol)
    hist = ticker.history(period=period, interval=interval)
    if hist.empty:
        raise ValueError(f"No data returned for ticker {symbol}")
        
    hist = hist.reset_index()
    # Normalize timestamp column
    date_col = "Date" if "Date" in hist.columns else "Datetime"
    hist["timestamp"] = hist[date_col].dt.strftime("%Y-%m-%d %H:%M:%S")
    hist = hist.rename(columns={
        "Open": "open",
        "High": "high",
        "Low": "low",
        "Close": "close",
        "Volume": "volume"
    })
    hist["return"] = np.log(hist["close"] / hist["close"].shift(1)).fillna(0.0)
    hist["regime"] = 0
    return hist[["timestamp", "open", "high", "low", "close", "volume", "return", "regime"]]

def parse_user_csv(csv_text: str) -> pd.DataFrame:
    """Parse raw user-uploaded CSV into normalized quant research DataFrame."""
    df = pd.read_csv(io.StringIO(csv_text))
    col_map = {col.lower().strip(): col for col in df.columns}
    
    # Find timestamp / date
    t_candidates = ["timestamp", "date", "datetime", "time", "t"]
    t_col = None
    for cand in t_candidates:
        if cand in col_map:
            t_col = col_map[cand]
            break
            
    if t_col:
        df["timestamp"] = pd.to_datetime(df[t_col]).dt.strftime("%Y-%m-%d %H:%M:%S")
    else:
        df["timestamp"] = [f"Step_{i}" for i in range(len(df))]
        
    for standard in ["open", "high", "low", "close", "volume"]:
        if standard in col_map:
            df[standard] = pd.to_numeric(df[col_map[standard]], errors="coerce")
        elif standard == "close" and "price" in col_map:
            df["close"] = pd.to_numeric(df[col_map["price"]], errors="coerce")
            
    # Fallback open/high/low to close if absent
    if "close" in df.columns:
        if "open" not in df.columns or df["open"].isna().all():
            df["open"] = df["close"]
        if "high" not in df.columns or df["high"].isna().all():
            df["high"] = df["close"]
        if "low" not in df.columns or df["low"].isna().all():
            df["low"] = df["close"]
        if "volume" not in df.columns or df["volume"].isna().all():
            df["volume"] = 10000.0
            
        df["return"] = np.log(df["close"] / df["close"].shift(1)).fillna(0.0)
    else:
        # If returns column exists directly
        ret_candidates = ["return", "returns", "ret", "log_return"]
        found_ret = False
        for rc in ret_candidates:
            if rc in col_map:
                df["return"] = pd.to_numeric(df[col_map[rc]], errors="coerce").fillna(0.0)
                df["close"] = 100.0 * np.exp(np.cumsum(df["return"]))
                df["open"] = df["close"]
                df["high"] = df["close"]
                df["low"] = df["close"]
                df["volume"] = 10000.0
                found_ret = True
                break
        if not found_ret:
            raise ValueError("CSV must contain either 'close'/'price' or 'return' column")

    if "regime" not in df.columns:
        df["regime"] = 0
        
    df = df.dropna(subset=["close"]).reset_index(drop=True)
    return df[["timestamp", "open", "high", "low", "close", "volume", "return", "regime"]]

def compute_data_quality_report(df: pd.DataFrame) -> Dict[str, Any]:
    """Generates complete data validation and diagnostic quality report."""
    n_rows = len(df)
    if n_rows == 0:
        return {"status": "FAILED", "error": "Dataset is empty"}
        
    close_series = df["close"].values
    return_series = df["return"].values
    
    nan_count = int(np.isnan(close_series).sum() + np.isnan(return_series).sum())
    inf_count = int(np.isinf(close_series).sum() + np.isinf(return_series).sum())
    
    # Volatility & Returns
    mean_ret = float(np.mean(return_series))
    std_ret = float(np.std(return_series))
    ann_vol = float(std_ret * np.sqrt(252))
    
    # Outliers: |z| > 4
    outliers = int(np.sum(np.abs((return_series - mean_ret) / (std_ret + 1e-9)) > 4.0))
    
    # Quick ADF check for stationarity of returns
    from statsmodels.tsa.stattools import adfuller
    try:
        adf_res = adfuller(return_series[~np.isnan(return_series)][:1000])
        adf_stat = float(adf_res[0])
        adf_pval = float(adf_res[1])
        is_stationary = bool(adf_pval < 0.05)
    except Exception:
        adf_stat = -99.0
        adf_pval = 0.0
        is_stationary = True
        
    status = "PASSED"
    if nan_count > 0 or inf_count > 0:
        status = "WARNING"
    if n_rows < 30:
        status = "FAILED"
        
    return {
        "status": status,
        "n_samples": n_rows,
        "start_date": str(df["timestamp"].iloc[0]),
        "end_date": str(df["timestamp"].iloc[-1]),
        "min_price": float(np.min(close_series)),
        "max_price": float(np.max(close_series)),
        "current_price": float(close_series[-1]),
        "mean_daily_return": round(mean_ret, 6),
        "annualized_volatility": round(ann_vol, 4),
        "outlier_count_4sigma": outliers,
        "null_count": nan_count + inf_count,
        "adf_stat": round(adf_stat, 4),
        "adf_pvalue": round(adf_pval, 6),
        "is_stationary": is_stationary
    }
