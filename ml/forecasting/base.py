"""
Abstract Base Forecaster Interface.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, List
import numpy as np


class BaseForecaster(ABC):
    """Abstract base class for all queue demand forecasters."""

    def __init__(self, name: str):
        self.name = name
        self.is_trained = False

    @abstractmethod
    def fit(self, X_train: np.ndarray, y_train: np.ndarray, **kwargs) -> "BaseForecaster":
        """Fit model to training sequences/features."""
        pass

    @abstractmethod
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Predict target arrivals for input features."""
        pass

    def evaluate(self, X_test: np.ndarray, y_test: np.ndarray, hours: np.ndarray = None) -> Dict[str, Any]:
        """Evaluate forecaster on test set using standard metrics."""
        from ml.evaluation.metrics import compute_forecast_metrics
        preds = self.predict(X_test)
        metrics = compute_forecast_metrics(y_test, preds, hours=hours)
        metrics["model_name"] = self.name
        return metrics
