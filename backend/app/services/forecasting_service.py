"""
Forecasting Service — model training and inference using scikit-learn.

Models implemented:
  - baseline: time-of-day historical average
  - ma: moving average / exponential smoothing
  - rf: Random Forest regressor
  - lstm: LSTM placeholder (requires PyTorch)

Uses chronological train/val/test splits to avoid data leakage.
"""
import os
import json
import math
import pickle
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.queue import QueueObservation
from app.models.analytics import ModelVersion
from app.schemas.schemas import ForecastPoint
from app.core.config import settings


FEATURE_COLS = [
    "hour", "day_of_week", "arrivals_lag1", "arrivals_lag2", "arrivals_lag4",
    "waiting_lag1", "waiting_lag2", "completions_lag1",
    "active_counters", "rolling_mean_arrivals_4", "rolling_std_arrivals_4",
]
TARGET_COL = "arrivals_in_interval"


def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Engineer features from a time-ordered DataFrame of QueueObservations."""
    df = df.sort_values("timestamp").copy()
    df["hour"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["arrivals_lag1"] = df["arrivals_in_interval"].shift(1)
    df["arrivals_lag2"] = df["arrivals_in_interval"].shift(2)
    df["arrivals_lag4"] = df["arrivals_in_interval"].shift(4)
    df["waiting_lag1"] = df["people_waiting"].shift(1)
    df["waiting_lag2"] = df["people_waiting"].shift(2)
    df["completions_lag1"] = df["completed_services"].shift(1)
    df["rolling_mean_arrivals_4"] = df["arrivals_in_interval"].rolling(4, min_periods=1).mean()
    df["rolling_std_arrivals_4"] = df["arrivals_in_interval"].rolling(4, min_periods=1).std().fillna(0)
    return df.dropna(subset=["arrivals_lag1"])


class ForecastingService:
    def __init__(self, session: Session):
        self.session = session

    def _load_observations(self, dept_id: int) -> pd.DataFrame:
        obs = self.session.execute(
            select(QueueObservation)
            .where(QueueObservation.department_id == dept_id)
            .order_by(QueueObservation.timestamp)
        ).scalars().all()

        if not obs:
            return pd.DataFrame()

        records = [{
            "timestamp": o.timestamp,
            "arrivals_in_interval": o.arrivals_in_interval,
            "people_waiting": o.people_waiting,
            "completed_services": o.completed_services,
            "active_counters": o.active_counters,
            "observed_waiting_time_seconds": o.observed_waiting_time_seconds or 0,
        } for o in obs]
        df = pd.DataFrame(records)
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
        return df

    def train(self, dept_id: int, model_type: str, model_version_id: int) -> dict:
        df = self._load_observations(dept_id)
        if len(df) < 20:
            raise ValueError(f"Insufficient data for training: {len(df)} observations (need >= 20)")

        df_feat = _build_features(df)
        if len(df_feat) < 10:
            raise ValueError("After feature engineering, insufficient rows remain")

        # Chronological split: 70% train, 15% val, 15% test
        n = len(df_feat)
        train_end = int(n * 0.70)
        val_end = int(n * 0.85)

        X = df_feat[FEATURE_COLS].values
        y = df_feat[TARGET_COL].values

        X_train, y_train = X[:train_end], y[:train_end]
        X_val, y_val = X[train_end:val_end], y[train_end:val_end]
        X_test, y_test = X[val_end:], y[val_end:]

        metrics = {}
        model_obj = None

        if model_type == "baseline":
            # Time-of-day historical average per hour
            hourly_mean = df_feat.groupby("hour")[TARGET_COL].mean().to_dict()
            model_obj = {"type": "baseline", "hourly_mean": hourly_mean}

            def predict_baseline(X_arr, hm):
                return np.array([hm.get(int(row[0]), 5.0) for row in X_arr])

            preds_test = predict_baseline(X_test, hourly_mean)

        elif model_type == "ma":
            # Exponential smoothing
            alpha = 0.3
            values = list(y_train) + list(y_val)
            smoothed = values[0]
            for v in values[1:]:
                smoothed = alpha * v + (1 - alpha) * smoothed
            model_obj = {"type": "ma", "last_smoothed": smoothed, "alpha": alpha}
            preds_test = np.full(len(y_test), smoothed)

        elif model_type in ("rf", "gb"):
            from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
            from sklearn.preprocessing import StandardScaler

            scaler = StandardScaler()
            X_train_s = scaler.fit_transform(X_train)
            X_test_s = scaler.transform(X_test)

            if model_type == "rf":
                clf = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
            else:
                clf = GradientBoostingRegressor(n_estimators=100, random_state=42)

            clf.fit(X_train_s, y_train)
            preds_test = clf.predict(X_test_s)
            model_obj = {"type": model_type, "model": clf, "scaler": scaler}

            # Feature importance
            metrics["feature_importance"] = {
                col: float(imp)
                for col, imp in zip(FEATURE_COLS, clf.feature_importances_)
            }

        elif model_type == "lstm":
            # LSTM using PyTorch
            try:
                import torch
                import torch.nn as nn

                class LSTMModel(nn.Module):
                    def __init__(self, input_size, hidden_size=64, num_layers=2):
                        super().__init__()
                        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=0.1)
                        self.fc = nn.Linear(hidden_size, 1)

                    def forward(self, x):
                        out, _ = self.lstm(x)
                        return self.fc(out[:, -1, :]).squeeze(-1)

                SEQ_LEN = 8
                def make_sequences(X_arr, y_arr, seq_len):
                    Xs, ys = [], []
                    for i in range(len(X_arr) - seq_len):
                        Xs.append(X_arr[i:i+seq_len])
                        ys.append(y_arr[i+seq_len])
                    return np.array(Xs, dtype=np.float32), np.array(ys, dtype=np.float32)

                from sklearn.preprocessing import StandardScaler
                scaler = StandardScaler()
                X_all = scaler.fit_transform(X)
                X_seq, y_seq = make_sequences(X_all, y, SEQ_LEN)

                split1 = int(len(X_seq) * 0.70)
                split2 = int(len(X_seq) * 0.85)
                X_tr = torch.tensor(X_seq[:split1])
                y_tr = torch.tensor(y_seq[:split1])
                X_te = torch.tensor(X_seq[split2:])
                y_te = y_seq[split2:]

                model_nn = LSTMModel(input_size=len(FEATURE_COLS))
                optimizer = torch.optim.Adam(model_nn.parameters(), lr=0.001)
                loss_fn = nn.MSELoss()

                for epoch in range(20):
                    model_nn.train()
                    optimizer.zero_grad()
                    pred = model_nn(X_tr)
                    loss = loss_fn(pred, y_tr)
                    loss.backward()
                    optimizer.step()

                model_nn.eval()
                with torch.no_grad():
                    preds_test = model_nn(X_te).numpy()

                y_test = y_te
                model_obj = {"type": "lstm", "model": model_nn, "scaler": scaler, "seq_len": SEQ_LEN}

            except ImportError:
                # Fallback to RF if torch not available
                from sklearn.ensemble import RandomForestRegressor
                from sklearn.preprocessing import StandardScaler
                scaler = StandardScaler()
                X_train_s = scaler.fit_transform(X_train)
                X_test_s = scaler.transform(X_test)
                clf = RandomForestRegressor(n_estimators=50, random_state=42)
                clf.fit(X_train_s, y_train)
                preds_test = clf.predict(X_test_s)
                model_obj = {"type": "rf", "model": clf, "scaler": scaler}
                metrics["lstm_fallback"] = "PyTorch not available; fell back to RandomForest"

        else:
            raise ValueError(f"Unknown model type: {model_type}")

        # Compute evaluation metrics
        if len(y_test) > 0 and preds_test is not None:
            mae = float(np.mean(np.abs(y_test - preds_test)))
            rmse = float(np.sqrt(np.mean((y_test - preds_test) ** 2)))
            smape = float(np.mean(
                2 * np.abs(y_test - preds_test) / (np.abs(y_test) + np.abs(preds_test) + 1e-8)
            ) * 100)
            metrics.update({"mae": mae, "rmse": rmse, "smape": smape, "test_samples": len(y_test)})

        # Persist model artifact
        mv = self.session.get(ModelVersion, model_version_id)
        if mv and mv.file_path:
            os.makedirs(os.path.dirname(mv.file_path), exist_ok=True)
            with open(mv.file_path, "wb") as f:
                pickle.dump(model_obj, f)

        return metrics

    def predict(self, dept_id: int, model_type: str, horizon_minutes: int = 60) -> List[ForecastPoint]:
        """Run inference for the latest trained model of the given type."""
        df = self._load_observations(dept_id)
        steps = horizon_minutes // 15

        if df.empty:
            # Return zero-filled predictions when no data
            now = datetime.now(timezone.utc)
            return [
                ForecastPoint(
                    timestamp=now + timedelta(minutes=15 * (i + 1)),
                    predicted_arrivals=0.0,
                    predicted_queue_length=0.0,
                    predicted_wait_minutes=0.0,
                )
                for i in range(steps)
            ]

        # Find latest ready model artifact
        mv = self.session.execute(
            select(ModelVersion)
            .where(
                ModelVersion.department_id == dept_id,
                ModelVersion.model_type == model_type,
                ModelVersion.status == "ready",
            )
            .order_by(ModelVersion.trained_at.desc())
        ).scalars().first()

        model_obj = None
        if mv and mv.file_path and os.path.exists(mv.file_path):
            with open(mv.file_path, "rb") as f:
                model_obj = pickle.load(f)

        df_feat = _build_features(df)
        now = datetime.now(timezone.utc)
        predictions = []

        # Rolling forecast
        last_known = df_feat.iloc[-1].copy() if not df_feat.empty else None
        recent_arrivals = list(df["arrivals_in_interval"].tail(10))
        recent_waiting = list(df["people_waiting"].tail(10))
        recent_completions = list(df["completed_services"].tail(10))
        avg_counters = float(df["active_counters"].tail(10).mean()) if not df.empty else 2.0
        avg_service = float(df["observed_waiting_time_seconds"].tail(10).mean()) if "observed_waiting_time_seconds" in df.columns else 300.0

        for i in range(steps):
            ts = now + timedelta(minutes=15 * (i + 1))
            hour = ts.hour
            day = ts.weekday()
            arr_l1 = recent_arrivals[-1] if recent_arrivals else 5
            arr_l2 = recent_arrivals[-2] if len(recent_arrivals) >= 2 else arr_l1
            arr_l4 = recent_arrivals[-4] if len(recent_arrivals) >= 4 else arr_l1
            wait_l1 = recent_waiting[-1] if recent_waiting else 5
            wait_l2 = recent_waiting[-2] if len(recent_waiting) >= 2 else wait_l1
            comp_l1 = recent_completions[-1] if recent_completions else 3
            roll_mean = sum(recent_arrivals[-4:]) / min(4, len(recent_arrivals))
            roll_std = float(np.std(recent_arrivals[-4:])) if len(recent_arrivals) >= 2 else 1.0

            feat = np.array([[hour, day, arr_l1, arr_l2, arr_l4,
                               wait_l1, wait_l2, comp_l1,
                               avg_counters, roll_mean, roll_std]], dtype=np.float32)

            # Predict
            if model_obj is None:
                # No trained model: use time-of-day heuristic
                peak_hours = {9, 10, 11, 14, 15, 16}
                base = 12.0 if hour in peak_hours else 5.0
                pred_arrivals = base
            elif model_obj["type"] == "baseline":
                pred_arrivals = model_obj["hourly_mean"].get(hour, 5.0)
            elif model_obj["type"] == "ma":
                alpha = model_obj["alpha"]
                pred_arrivals = alpha * arr_l1 + (1 - alpha) * model_obj["last_smoothed"]
            elif model_obj["type"] in ("rf", "gb"):
                scaler = model_obj["scaler"]
                clf = model_obj["model"]
                pred_arrivals = float(clf.predict(scaler.transform(feat))[0])
            elif model_obj["type"] == "lstm":
                import torch
                scaler = model_obj["scaler"]
                seq_len = model_obj.get("seq_len", 8)
                # build sequence from recent features
                feat_scaled = scaler.transform(feat)
                pred_arrivals = float(model_obj["model"](torch.tensor(feat_scaled.reshape(1, 1, -1))).item())
            else:
                pred_arrivals = arr_l1

            pred_arrivals = max(0.0, pred_arrivals)

            # Estimate queue length using M/M/c approximation
            mu = 1 / (avg_service / 60 / 15)  # service capacity per 15 min per counter
            total_capacity = avg_counters * mu
            arrivals_per_interval = pred_arrivals
            prev_queue = wait_l1
            new_departures = min(prev_queue + arrivals_per_interval, total_capacity)
            pred_queue = max(0.0, prev_queue + arrivals_per_interval - new_departures)

            # Waiting time estimate (M/M/c approximation)
            lam = arrivals_per_interval / 15 / 60  # per second
            mu_sec = 1 / max(avg_service, 1)
            c = max(1, int(avg_counters))
            rho = lam / (c * mu_sec)
            rho = min(rho, 0.99)
            wait_sec = (rho / (c * mu_sec * (1 - rho))) if rho < 1 else avg_service * 2
            wait_min = float(wait_sec / 60)

            predictions.append(ForecastPoint(
                timestamp=ts,
                predicted_arrivals=round(pred_arrivals, 2),
                predicted_queue_length=round(pred_queue, 2),
                predicted_wait_minutes=round(min(wait_min, 60), 2),
            ))

            recent_arrivals.append(pred_arrivals)
            recent_waiting.append(pred_queue)
            recent_completions.append(new_departures)

        return predictions

    def get_feature_importance(self, model_id: int) -> list:
        mv = self.session.get(ModelVersion, model_id)
        if not mv or not mv.file_path or not os.path.exists(mv.file_path):
            return []
        with open(mv.file_path, "rb") as f:
            model_obj = pickle.load(f)
        if model_obj["type"] not in ("rf", "gb"):
            return [{"feature": col, "importance": None, "note": "Only tree models support feature importance"} for col in FEATURE_COLS]
        clf = model_obj["model"]
        return [
            {"feature": col, "importance": float(imp)}
            for col, imp in sorted(
                zip(FEATURE_COLS, clf.feature_importances_),
                key=lambda x: -x[1]
            )
        ]
