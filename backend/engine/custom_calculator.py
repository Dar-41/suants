import ast
import math
import numpy as np
import pandas as pd
from typing import Dict, Any, List
from scipy import stats

SAFE_BUILTINS = {
    "abs": abs,
    "round": round,
    "min": min,
    "max": max,
    "sum": sum,
    "len": len,
    "float": float,
    "int": int,
    "math": math,
    "np": np,
    "stats": stats,
    "mean": np.mean,
    "std": np.std,
    "var": np.var,
    "median": np.median,
    "percentile": np.percentile,
    "skew": stats.skew,
    "kurtosis": stats.kurtosis,
    "sqrt": np.sqrt,
    "exp": np.exp,
    "log": np.log
}

class ASTSecurityChecker(ast.NodeVisitor):
    FORBIDDEN_NAMES = {"__import__", "eval", "exec", "open", "os", "sys", "subprocess", "builtins", "globals", "locals"}
    
    def visit_Import(self, node):
        raise ValueError("Import statements are not allowed for security reasons.")
        
    def visit_ImportFrom(self, node):
        raise ValueError("Import statements are not allowed for security reasons.")
        
    def visit_Name(self, node):
        if node.id in self.FORBIDDEN_NAMES or node.id.startswith("__"):
            raise ValueError(f"Access to '{node.id}' is restricted.")
        self.generic_visit(node)
        
    def visit_Attribute(self, node):
        if node.attr.startswith("__"):
            raise ValueError(f"Access to private attribute '{node.attr}' is restricted.")
        self.generic_visit(node)

def evaluate_custom_metric(
    expression: str,
    df: pd.DataFrame
) -> Dict[str, Any]:
    """
    Safely executes user-defined quant metric expressions on active dataset.
    Exposes variables:
      - returns: np.ndarray
      - prices / close: np.ndarray
      - volume: np.ndarray
      - high, low, open: np.ndarray
    """
    # 1. AST Static Security Audit
    try:
        tree = ast.parse(expression, mode='eval')
        checker = ASTSecurityChecker()
        checker.visit(tree)
    except Exception as e:
        return {
            "success": False,
            "error": f"Syntax or Security Error: {str(e)}",
            "formula": expression
        }
        
    # 2. Prepare Context Variables
    r = df["return"].values if "return" in df.columns else np.diff(np.log(df["close"].values), prepend=0)
    p = df["close"].values if "close" in df.columns else np.ones(len(df))
    v = df["volume"].values if "volume" in df.columns else np.ones(len(df))
    
    local_env = {
        "returns": r,
        "ret": r,
        "r": r,
        "prices": p,
        "price": p,
        "close": p,
        "p": p,
        "volume": v,
        "vol": v,
        "v": v,
        "open": df["open"].values if "open" in df.columns else p,
        "high": df["high"].values if "high" in df.columns else p,
        "low": df["low"].values if "low" in df.columns else p,
        "n": len(df)
    }
    
    eval_scope = dict(SAFE_BUILTINS)
    eval_scope.update(local_env)
    
    # 3. Execution
    try:
        compiled_code = compile(tree, filename="<custom_metric>", mode="eval")
        result = eval(compiled_code, {"__builtins__": {}}, eval_scope)
        
        # Format output
        is_series = isinstance(result, (np.ndarray, list, pd.Series))
        if is_series:
            res_arr = np.asarray(result, dtype=float)
            scalar_summary = float(np.nanmean(res_arr))
            series_sample = [round(float(x), 4) for x in res_arr[-20:]]
            std_val = float(np.nanstd(res_arr))
        else:
            scalar_summary = float(result)
            series_sample = [round(scalar_summary, 4)]
            std_val = 0.0
            
        # Statistical significance t-test against 0
        if is_series and len(res_arr) > 5 and std_val > 1e-9:
            t_stat = (scalar_summary / (std_val / np.sqrt(len(res_arr))))
            p_val = float(2.0 * (1.0 - stats.t.cdf(abs(t_stat), df=len(res_arr) - 1)))
        else:
            t_stat = 0.0
            p_val = 1.0
            
        is_stat_sig = bool(p_val < 0.05)
        
        return {
            "success": True,
            "formula": expression,
            "sample_size": len(df),
            "value": round(scalar_summary, 6),
            "is_series": is_series,
            "series_sample": series_sample,
            "t_statistic": round(t_stat, 2),
            "p_value": float(p_val),
            "is_statistically_significant": is_stat_sig,
            "verdict": f"Metric evaluated successfully: {scalar_summary:.6f} ({'p < 0.05 significant' if is_stat_sig else 'p >= 0.05 not significant'})."
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Evaluation Exception: {str(e)}",
            "formula": expression
        }
