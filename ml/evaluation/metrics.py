"""
Time-series forecasting evaluation metrics and diagnostic utilities.
"""
from typing import Dict, Any, List, Optional
import numpy as np


def compute_forecast_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    hours: Optional[np.ndarray] = None,
) -> Dict[str, Any]:
    """
    Compute standard forecasting evaluation metrics:
      - MAE: Mean Absolute Error
      - RMSE: Root Mean Squared Error
      - sMAPE: Symmetric Mean Absolute Percentage Error (%)
      - WAPE: Weighted Absolute Percentage Error (%)
      - Peak vs Off-peak MAE breakdown (if hours provided)
      - Residual mean and standard deviation
    """
    y_true = np.asarray(y_true, dtype=np.float64)
    y_pred = np.asarray(y_pred, dtype=np.float64)

    if len(y_true) == 0 or len(y_pred) == 0:
        return {
            "mae": 0.0,
            "rmse": 0.0,
            "smape": 0.0,
            "wape": 0.0,
            "sample_count": 0,
            "residual_mean": 0.0,
            "residual_std": 0.0,
        }

    residuals = y_pred - y_true
    mae = float(np.mean(np.abs(residuals)))
    rmse = float(np.sqrt(np.mean(residuals ** 2)))

    # sMAPE: 200 * |y_true - y_pred| / (|y_true| + |y_pred| + epsilon)
    denom = np.abs(y_true) + np.abs(y_pred)
    epsilon = 1e-5
    smape = float(np.mean(200.0 * np.abs(residuals) / np.maximum(denom, epsilon)))

    # WAPE: sum(|y_true - y_pred|) / sum(|y_true|)
    sum_true = float(np.sum(np.abs(y_true)))
    wape = float((np.sum(np.abs(residuals)) / sum_true * 100.0) if sum_true > 0 else 0.0)

    metrics = {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "smape": round(smape, 2),
        "wape": round(wape, 2),
        "sample_count": int(len(y_true)),
        "residual_mean": round(float(np.mean(residuals)), 4),
        "residual_std": round(float(np.std(residuals)), 4),
    }

    # Peak vs Off-peak breakdown
    if hours is not None and len(hours) == len(y_true):
        peak_mask = np.isin(hours, [9, 10, 11, 14, 15, 16])
        if np.any(peak_mask):
            metrics["peak_mae"] = round(float(np.mean(np.abs(residuals[peak_mask]))), 4)
            metrics["peak_sample_count"] = int(np.sum(peak_mask))
        if np.any(~peak_mask):
            metrics["off_peak_mae"] = round(float(np.mean(np.abs(residuals[~peak_mask]))), 4)
            metrics["off_peak_sample_count"] = int(np.sum(~peak_mask))

    return metrics
