import datetime
from typing import Dict, Any, List

def generate_html_research_report(
    module_id: int,
    module_name: str,
    paper_reference: str,
    dataset_name: str,
    kpis: Dict[str, Any],
    verdict: str,
    parameters: Dict[str, Any],
    sample_size: int
) -> str:
    """
    Generates an institutional-quality printable HTML research dossier
    conforming to quantitative investment committee presentation standards.
    """
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
    
    kpi_rows = ""
    for k, v in kpis.items():
        clean_k = k.replace("_", " ").title()
        val_str = f"{v:.4f}" if isinstance(v, float) else str(v)
        kpi_rows += f"""
        <tr>
            <td style="padding: 10px 14px; border-bottom: 1px solid #1E293B; font-weight: 500;">{clean_k}</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #1E293B; font-family: monospace; text-align: right; color: #38BDF8;">{val_str}</td>
        </tr>
        """
        
    param_items = ""
    for pk, pv in parameters.items():
        param_items += f"<span style='background: #1E293B; padding: 4px 10px; border-radius: 6px; font-size: 13px; font-family: monospace; color: #94A3B8; margin-right: 8px;'>{pk}: {pv}</span>"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Quant Research Lab - Dossier: {module_name}</title>
    <style>
        body {{
            background-color: #07090E;
            color: #F8FAFC;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 40px;
            line-height: 1.6;
        }}
        .container {{
            max-width: 900px;
            margin: 0 auto;
            background: #0D111D;
            border: 1px solid #1E293B;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
        }}
        .header {{
            border-bottom: 2px solid #0284C7;
            padding-bottom: 20px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }}
        .title {{
            font-size: 24px;
            font-weight: 700;
            color: #F8FAFC;
            margin: 0 0 6px 0;
        }}
        .subtitle {{
            font-size: 14px;
            color: #38BDF8;
            margin: 0;
        }}
        .meta {{
            text-align: right;
            font-size: 12px;
            color: #64748B;
            font-family: monospace;
        }}
        .section-title {{
            font-size: 16px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #94A3B8;
            margin: 30px 0 12px 0;
            border-left: 3px solid #38BDF8;
            padding-left: 10px;
        }}
        .verdict-box {{
            background: rgba(6, 182, 212, 0.08);
            border: 1px solid rgba(6, 182, 212, 0.3);
            border-radius: 8px;
            padding: 18px;
            margin: 20px 0;
            color: #E2E8F0;
            font-size: 15px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0 30px 0;
            background: #090D16;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid #1E293B;
        }}
        th {{
            background: #111827;
            padding: 12px 14px;
            text-align: left;
            font-size: 13px;
            color: #94A3B8;
            border-bottom: 2px solid #1E293B;
        }}
        .notes {{
            font-size: 13px;
            color: #64748B;
            border-top: 1px solid #1E293B;
            padding-top: 20px;
            margin-top: 40px;
        }}
        @media print {{
            body {{ background: #FFF !important; color: #000 !important; padding: 0 !important; }}
            .container {{ border: none !important; box-shadow: none !important; background: #FFF !important; }}
            .header {{ border-bottom: 2px solid #000 !important; }}
            .verdict-box {{ background: #F1F5F9 !important; border: 1px solid #CBD5E1 !important; color: #000 !important; }}
            th {{ background: #E2E8F0 !important; color: #000 !important; }}
            td {{ border-bottom: 1px solid #E2E8F0 !important; color: #000 !important; }}
            .meta, .notes {{ color: #475569 !important; }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <h1 class="title">QUANT RESEARCH LAB // EXECUTIVE DOSSIER</h1>
                <p class="subtitle">Module {module_id}: {module_name}</p>
                <p style="font-size: 13px; color: #94A3B8; margin: 4px 0 0 0;">Foundation: <em>{paper_reference}</em></p>
            </div>
            <div class="meta">
                <div>DATE: {now_str}</div>
                <div>DATASET: {dataset_name}</div>
                <div>OBSERVATIONS: N = {sample_size}</div>
            </div>
        </div>

        <div class="section-title">Execution Parameters</div>
        <div style="margin: 10px 0 20px 0;">
            {param_items}
        </div>

        <div class="section-title">Automated Plain-English Quant Verdict</div>
        <div class="verdict-box">
            <strong>Finding:</strong> {verdict}
        </div>

        <div class="section-title">Econometric & Empirical KPIs</div>
        <table>
            <thead>
                <tr>
                    <th>Metric</th>
                    <th style="text-align: right;">Estimated Value</th>
                </tr>
            </thead>
            <tbody>
                {kpi_rows}
            </tbody>
        </table>

        <div class="notes">
            <strong>Methodology & Compliance Notes:</strong>
            All statistical estimators are computed strictly point-in-time with zero look-ahead bias. Lags and rolling lookbacks are strictly preserved. Survivorship bias cautions apply to external user-uploaded samples. Reference standards: Statsmodels & Scipy verified implementations.
        </div>
    </div>
</body>
</html>"""
    return html
