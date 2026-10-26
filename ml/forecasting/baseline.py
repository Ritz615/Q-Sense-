"""
Baseline forecasting models:
  1. Time-of-day historical mean baseline
  2. Exponential smoothing / Moving average baseline
"""
from typing import Dict, Any, Optional
import numpy as np
from ml.forecasting.base import BaseForecaster


class HistoricalTimeOfDayForecaster(BaseForecaster):
    """
    Predicts demand using the historical mean arrivals for each hour of the day.
    Feature 0 in FEATURE_COLUMNS is the hour index.
    """

    def __init__(self, default_arrival: float = 5.0):
        super().__init__("Historical Time-of-Day Baseline")
        self.default_arrival = default_arrival
        self.hourly_means: Dict[int, float] = {}

    def fit(self, X_train: np.ndarray, y_train: np.ndarray, **kwargs) -> "HistoricalTimeOfDayForecaster":
        hours = X_train[:, 0].astype(int)
        for h in range(24):
            mask = (hours == h)
            if np.any(mask):
                self.hourly_means[h] = float(np.mean(y_train[mask]))
            else:
                self.hourly_means[h] = self.default_arrival
        self.is_trained = True
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        hours = X[:, 0].astype(int)
        preds = np.array([self.hourly_means.get(int(h), self.default_arrival) for h in hours], dtype=np.float32)
        return np.maximum(0.0, preds)


class ExponentialSmoothingForecaster(BaseForecaster):
    """
    Single exponential smoothing forecaster using recency-weighted observations.
    """

    def __init__(self, alpha: float = 0.35, default_val: float = 5.0):
        super().__init__("Exponential Smoothing / Moving Average Baseline")
        self.alpha = alpha
        self.default_val = default_val
        self.smoothed_state: float = default_val

    def fit(self, X_train: np.ndarray, y_train: np.ndarray, **kwargs) -> "ExponentialSmoothingForecaster":
        if len(y_train) > 0:
            s = float(y_train[0])
            for val in y_train[1:]:
                s = self.alpha * float(val) + (1.0 - self.alpha) * s
            self.smoothed_state = s
        self.is_trained = True
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        # Use lag 1 arrivals if available (feature index 3: arrivals_lag1)
        if X.shape[1] > 3:
            lag1 = X[:, 3]
            preds = self.alpha * lag1 + (1.0 - self.alpha) * self.smoothed_state
            return np.maximum(0.0, preds.astype(np.float32))
        return np.full(len(X), max(0.0, self.smoothed_state), dtype=np.float32)
