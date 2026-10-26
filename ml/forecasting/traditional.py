"""
Traditional Machine Learning Regressors:
  - Random Forest Regressor
  - Gradient Boosting Regressor
"""
from typing import Dict, Any, List, Optional
import numpy as np
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from ml.forecasting.base import BaseForecaster
from ml.preprocessing.features import FEATURE_COLUMNS


class RandomForestForecaster(BaseForecaster):
    """Random Forest regressor with standardized features and feature importance."""

    def __init__(self, n_estimators: int = 100, max_depth: Optional[int] = 12, random_state: int = 42):
        super().__init__("Random Forest Regressor")
        self.scaler = StandardScaler()
        self.model = RandomForestRegressor(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=random_state,
            n_jobs=-1,
        )
        self.feature_importances_: Dict[str, float] = {}

    def fit(self, X_train: np.ndarray, y_train: np.ndarray, **kwargs) -> "RandomForestForecaster":
        X_scaled = self.scaler.fit_transform(X_train)
        self.model.fit(X_scaled, y_train)
        self.feature_importances_ = {
            col: round(float(imp), 4)
            for col, imp in zip(FEATURE_COLUMNS, self.model.feature_importances_)
        }
        self.is_trained = True
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        if not self.is_trained:
            raise RuntimeError("Model must be fitted before predict()")
        X_scaled = self.scaler.transform(X)
        preds = self.model.predict(X_scaled)
        return np.maximum(0.0, preds.astype(np.float32))


class GradientBoostingForecaster(BaseForecaster):
    """Gradient Boosting regressor with early stopping option."""

    def __init__(self, n_estimators: int = 100, learning_rate: float = 0.05, max_depth: int = 4, random_state: int = 42):
        super().__init__("Gradient Boosting Regressor")
        self.scaler = StandardScaler()
        self.model = GradientBoostingRegressor(
            n_estimators=n_estimators,
            learning_rate=learning_rate,
            max_depth=max_depth,
            random_state=random_state,
        )
        self.feature_importances_: Dict[str, float] = {}

    def fit(self, X_train: np.ndarray, y_train: np.ndarray, **kwargs) -> "GradientBoostingForecaster":
        X_scaled = self.scaler.fit_transform(X_train)
        self.model.fit(X_scaled, y_train)
        self.feature_importances_ = {
            col: round(float(imp), 4)
            for col, imp in zip(FEATURE_COLUMNS, self.model.feature_importances_)
        }
        self.is_trained = True
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        if not self.is_trained:
            raise RuntimeError("Model must be fitted before predict()")
        X_scaled = self.scaler.transform(X)
        preds = self.model.predict(X_scaled)
        return np.maximum(0.0, preds.astype(np.float32))
