import math
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from engine.data_loader import (
    generate_synthetic_quant_dataset,
    fetch_binance_klines,
    fetch_yfinance_history,
    parse_user_csv,
    compute_data_quality_report
)
from engine.module1_volatility import analyze_volatility_clustering
from engine.module2_seasonality import analyze_intraday_seasonality
from engine.module3_mean_reversion import analyze_mean_reversion
from engine.module4_factor_neutrality import analyze_factor_neutrality
from engine.module5_regime_momentum import analyze_regime_momentum
from engine.module6_overnight_effect import analyze_overnight_effect
from engine.module7_signal_decay import analyze_signal_decay
from engine.module8_transaction_costs import analyze_transaction_costs
from engine.module9_cross_sectional_ic import analyze_cross_sectional_ic
from engine.module10_triple_barrier import analyze_triple_barrier
from engine.custom_calculator import evaluate_custom_metric
from engine.report_generator import generate_html_research_report

def sanitize_json_obj(obj: Any) -> Any:
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return 0.0
        return obj
    elif isinstance(obj, dict):
        return {k: sanitize_json_obj(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [sanitize_json_obj(v) for v in obj]
    elif isinstance(obj, np.ndarray):
        return sanitize_json_obj(obj.tolist())
    elif isinstance(obj, (np.floating, np.integer)):
        f = float(obj)
        return 0.0 if math.isnan(f) or math.isinf(f) else f
    elif isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    return obj

app = FastAPI(
    title="Quant Research Lab API",
    description="High-precision institutional econometrics and quantitative research engine",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory default dataset cache
DEFAULT_DATA = generate_synthetic_quant_dataset(n_days=700, intraday_bars_per_day=24, seed=42)

# Request Models
class DataQualityRequest(BaseModel):
    close: List[float]
    return_series: Optional[List[float]] = None
    timestamps: Optional[List[str]] = None

class UploadCSVRequest(BaseModel):
    csv_text: str

class Module1Request(BaseModel):
    returns: List[float]
    max_lag: Optional[int] = 40
    garch_type: Optional[str] = "GARCH"

class Module2Request(BaseModel):
    records: List[Dict[str, Any]]
    bucket_minutes: Optional[int] = 30
    fourier_terms: Optional[int] = 4

class Module3Request(BaseModel):
    prices_y: List[float]
    prices_x: Optional[List[float]] = None
    lookback: Optional[int] = 30
    entry_z: Optional[float] = 2.0
    stop_loss_z: Optional[float] = 3.5

class Module4Request(BaseModel):
    returns: List[float]
    rolling_window: Optional[int] = 60
    factor_names: Optional[List[str]] = None

class Module5Request(BaseModel):
    returns: List[float]
    n_regimes: Optional[int] = 3
    lookback_mom: Optional[int] = 21
    holding_mom: Optional[int] = 5

class Module6Request(BaseModel):
    records: List[Dict[str, Any]]
    bootstrap_iterations: Optional[int] = 1000

class Module7Request(BaseModel):
    returns: List[float]
    signal: Optional[List[float]] = None
    max_horizon: Optional[int] = 25
    signal_lookback: Optional[int] = 10

class Module8Request(BaseModel):
    returns: List[float]
    positions: Optional[List[float]] = None
    spread_bps: Optional[float] = 3.0
    slippage_bps: Optional[float] = 2.0
    commission_bps: Optional[float] = 1.0
    adv_shares: Optional[float] = 5000000.0
    target_aum_usd: Optional[float] = 25000000.0
    asset_price: Optional[float] = 100.0

class Module9Request(BaseModel):
    factor_matrix: Optional[List[List[float]]] = None
    return_matrix: Optional[List[List[float]]] = None
    n_quantiles: Optional[int] = 10
    horizons: Optional[List[int]] = None

class Module10Request(BaseModel):
    prices: List[float]
    pt_mult: Optional[float] = 2.0
    sl_mult: Optional[float] = 1.5
    vertical_bars: Optional[int] = 15
    ewma_span: Optional[int] = 20
    sampling_freq: Optional[int] = 3

class CustomMetricRequest(BaseModel):
    expression: str
    records: List[Dict[str, Any]]

class ReportRequest(BaseModel):
    module_id: int
    module_name: str
    paper_reference: str
    dataset_name: str
    kpis: Dict[str, Any]
    verdict: str
    parameters: Dict[str, Any]
    sample_size: int

# Health
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Quant Research Lab Engine", "version": "1.0.0"}

# Data endpoints
@app.get("/api/data/synthetic")
def get_synthetic(n_days: int = 500, intraday_bars: int = 24):
    df = generate_synthetic_quant_dataset(n_days=n_days, intraday_bars_per_day=intraday_bars)
    quality = compute_data_quality_report(df)
    return sanitize_json_obj({
        "dataset_name": f"Synthetic Multi-Regime ({n_days}d)",
        "quality": quality,
        "records": df.to_dict(orient="records")
    })

@app.get("/api/data/preset")
def get_preset(symbol: str = "SPY"):
    sym = symbol.upper()
    try:
        if sym in ["BTCUSDT", "ETHUSDT", "SOLUSDT"]:
            df = fetch_binance_klines(symbol=sym, interval="1h", limit=500)
        else:
            df = fetch_yfinance_history(ticker=sym, period="2y", interval="1d")
        
        quality = compute_data_quality_report(df)
        return sanitize_json_obj({
            "dataset_name": f"{sym} Market Feed",
            "quality": quality,
            "records": df.to_dict(orient="records")
        })
    except Exception as e:
        df = generate_synthetic_quant_dataset(n_days=300, intraday_bars_per_day=24, seed=abs(hash(sym)) % 1000)
        quality = compute_data_quality_report(df)
        return sanitize_json_obj({
            "dataset_name": f"{sym} (Synthetic Approximation)",
            "quality": quality,
            "records": df.to_dict(orient="records"),
            "fallback_notice": str(e)
        })

@app.post("/api/data/upload")
def upload_csv(req: UploadCSVRequest):
    try:
        df = parse_user_csv(req.csv_text)
        quality = compute_data_quality_report(df)
        return sanitize_json_obj({
            "dataset_name": "Custom Uploaded Dataset",
            "quality": quality,
            "records": df.to_dict(orient="records")
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

# Module Endpoints
@app.post("/api/module1/volatility")
def run_module1(req: Module1Request):
    try:
        res = analyze_volatility_clustering(
            returns=np.array(req.returns),
            max_lag=req.max_lag or 40,
            garch_type=req.garch_type or "GARCH"
        )
        return sanitize_json_obj(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/module2/seasonality")
def run_module2(req: Module2Request):
    try:
        df = pd.DataFrame(req.records)
        res = analyze_intraday_seasonality(
            df=df,
            bucket_minutes=req.bucket_minutes or 30,
            fourier_terms=req.fourier_terms or 4
        )
        return sanitize_json_obj(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/module3/mean-reversion")
def run_module3(req: Module3Request):
    try:
        res = analyze_mean_reversion(
            prices_y=np.array(req.prices_y),
            prices_x=np.array(req.prices_x) if req.prices_x else None,
            lookback=req.lookback or 30,
            entry_z=req.entry_z or 2.0,
            stop_loss_z=req.stop_loss_z or 3.5
        )
        return sanitize_json_obj(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/module4/factor-neutrality")
def run_module4(req: Module4Request):
    try:
        res = analyze_factor_neutrality(
            returns=np.array(req.returns),
            rolling_window=req.rolling_window or 60,
            factor_names=req.factor_names
        )
        return sanitize_json_obj(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/module5/regime-momentum")
def run_module5(req: Module5Request):
    try:
        res = analyze_regime_momentum(
            returns=np.array(req.returns),
            n_regimes=req.n_regimes or 3,
            lookback_mom=req.lookback_mom or 21,
            holding_mom=req.holding_mom or 5
        )
        return sanitize_json_obj(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/module6/overnight-effect")
def run_module6(req: Module6Request):
    try:
        df = pd.DataFrame(req.records)
        res = analyze_overnight_effect(
            df=df,
            bootstrap_iterations=req.bootstrap_iterations or 1000
        )
        return sanitize_json_obj(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/module7/signal-decay")
def run_module7(req: Module7Request):
    try:
        res = analyze_signal_decay(
            returns=np.array(req.returns),
            signal=np.array(req.signal) if req.signal else None,
            max_horizon=req.max_horizon or 25,
            signal_lookback=req.signal_lookback or 10
        )
        return sanitize_json_obj(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/module8/transaction-costs")
def run_module8(req: Module8Request):
    try:
        res = analyze_transaction_costs(
            returns=np.array(req.returns),
            positions=np.array(req.positions) if req.positions else None,
            spread_bps=req.spread_bps or 3.0,
            slippage_bps=req.slippage_bps or 2.0,
            commission_bps=req.commission_bps or 1.0,
            adv_shares=req.adv_shares or 5000000.0,
            target_aum_usd=req.target_aum_usd or 25000000.0,
            asset_price=req.asset_price or 100.0
        )
        return sanitize_json_obj(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/module9/cross-sectional-ic")
def run_module9(req: Module9Request):
    try:
        F = np.array(req.factor_matrix) if req.factor_matrix else None
        R = np.array(req.return_matrix) if req.return_matrix else None
        res = analyze_cross_sectional_ic(
            factor_matrix=F,
            return_matrix=R,
            n_quantiles=req.n_quantiles or 10,
            horizons=req.horizons
        )
        return sanitize_json_obj(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/module10/triple-barrier")
def run_module10(req: Module10Request):
    try:
        res = analyze_triple_barrier(
            prices=np.array(req.prices),
            pt_mult=req.pt_mult or 2.0,
            sl_mult=req.sl_mult or 1.5,
            vertical_bars=req.vertical_bars or 15,
            ewma_span=req.ewma_span or 20,
            sampling_freq=req.sampling_freq or 3
        )
        return sanitize_json_obj(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/custom-metric")
def run_custom_metric(req: CustomMetricRequest):
    df = pd.DataFrame(req.records)
    res = evaluate_custom_metric(req.expression, df)
    return sanitize_json_obj(res)

@app.post("/api/export-report", response_class=HTMLResponse)
def export_report(req: ReportRequest):
    html_content = generate_html_research_report(
        module_id=req.module_id,
        module_name=req.module_name,
        paper_reference=req.paper_reference,
        dataset_name=req.dataset_name,
        kpis=req.kpis,
        verdict=req.verdict,
        parameters=req.parameters,
        sample_size=req.sample_size
    )
    return HTMLResponse(content=html_content)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
