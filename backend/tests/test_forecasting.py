"""
Automated unit tests: Time-Series Forecasting models, evaluation metrics, and prediction.
"""
import pytest
import numpy as np
from ml.forecasting.baseline import HistoricalTimeOfDayForecaster, ExponentialSmoothingForecaster
from ml.forecasting.traditional import RandomForestForecaster, GradientBoostingForecaster
from ml.forecasting.deep_learning import LSTMForecaster, TCNForecaster
from ml.evaluation.metrics import compute_forecast_metrics


def test_compute_forecast_metrics():
    y_true = np.array([10.0, 15.0, 20.0, 25.0])
    y_pred = np.array([12.0, 14.0, 18.0, 26.0])
    hours = np.array([10, 11, 14, 18])  # 10, 11, 14 are peak; 18 is off-peak

    metrics = compute_forecast_metrics(y_true, y_pred, hours=hours)
    assert "mae" in metrics
    assert "rmse" in metrics
    assert "smape" in metrics
    assert "wape" in metrics
    assert metrics["mae"] > 0
    assert metrics["sample_count"] == 4
    assert "peak_mae" in metrics
    assert "off_peak_mae" in metrics


def test_baseline_forecaster():
    # 30 observations with hours 9, 10, 11
    X = np.zeros((30, 11))
    X[:, 0] = np.repeat([9, 10, 11], 10)
    y = np.repeat([15.0, 25.0, 18.0], 10)

    model = HistoricalTimeOfDayForecaster()
    model.fit(X, y)
    preds = model.predict(X[:3])
    assert len(preds) == 3
    assert np.isclose(preds[0], 15.0)


def test_random_forest_forecaster():
    X = np.random.rand(50, 11).astype(np.float32)
    y = (X[:, 0] * 5.0 + X[:, 3] * 3.0).astype(np.float32)

    rf = RandomForestForecaster(n_estimators=20, random_state=42)
    rf.fit(X[:40], y[:40])
    preds = rf.predict(X[40:])
    assert len(preds) == 10
    assert np.all(preds >= 0.0)
    assert len(rf.feature_importances_) == 11


def test_lstm_forecaster():
    X = np.random.rand(40, 11).astype(np.float32)
    y = (X[:, 0] * 2.0).astype(np.float32)

    lstm = LSTMForecaster(seq_len=4, epochs=5)
    lstm.fit(X[:30], y[:30])
    preds = lstm.predict(X[30:])
    assert len(preds) == 10
    assert np.all(preds >= 0.0)
