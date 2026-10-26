"""
Q-Sense Preprocessing and Feature Engineering Module.
"""
from datetime import datetime, timezone
from typing import Tuple, List, Dict, Any, Optional
import numpy as np
import pandas as pd


FEATURE_COLUMNS = [
    "hour",
    "day_of_week",
    "is_peak_hour",
    "arrivals_lag1",
    "arrivals_lag2",
    "arrivals_lag4",
    "waiting_lag1",
    "waiting_lag2",
    "completions_lag1",
    "active_counters",
    "rolling_mean_arrivals_4",
    "rolling_std_arrivals_4",
]

TARGET_COLUMN = "arrivals_in_interval"


def clean_and_normalize_records(records: List[Dict[str, Any]]) -> pd.DataFrame:
    """
    Convert raw observation records into a sorted, normalized pandas DataFrame.
    Guarantees UTC timestamps and sorted chronological order.
    """
    if not records:
        return pd.DataFrame()

    df = pd.DataFrame(records)
    if "timestamp" not in df.columns:
        raise ValueError("Records must contain 'timestamp' field")

    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df.sort_values("timestamp").reset_index(drop=True)

    numeric_cols = [
        "arrivals_in_interval",
        "people_waiting",
        "completed_services",
        "active_counters",
        "observed_waiting_time_seconds",
        "avg_service_time_seconds",
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
        else:
            df[col] = 0.0

    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Generate time-series lag and rolling window features from chronological observations.
    All features are derived strictly from data available at or before the timestamp.
    """
    if df.empty or len(df) < 5:
        return pd.DataFrame()

    df = df.sort_values("timestamp").copy()
    df["hour"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["is_peak_hour"] = df["hour"].apply(lambda h: 1.0 if (9 <= h <= 11 or 14 <= h <= 16) else 0.0)

    # Lags (15-min intervals: lag1 = -15m, lag2 = -30m, lag4 = -1h)
    df["arrivals_lag1"] = df["arrivals_in_interval"].shift(1)
    df["arrivals_lag2"] = df["arrivals_in_interval"].shift(2)
    df["arrivals_lag4"] = df["arrivals_in_interval"].shift(4)

    df["waiting_lag1"] = df["people_waiting"].shift(1)
    df["waiting_lag2"] = df["people_waiting"].shift(2)
    df["completions_lag1"] = df["completed_services"].shift(1)

    # Rolling window aggregations
    df["rolling_mean_arrivals_4"] = df["arrivals_in_interval"].rolling(4, min_periods=1).mean()
    df["rolling_std_arrivals_4"] = df["arrivals_in_interval"].rolling(4, min_periods=1).std().fillna(0.0)

    # Drop early rows where essential lag4 is not yet defined
    processed = df.dropna(subset=["arrivals_lag4"]).copy().reset_index(drop=True)
    processed[FEATURE_COLUMNS] = processed[FEATURE_COLUMNS].fillna(0.0)
    return processed


def chronological_split(
    df: pd.DataFrame,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Chronological train/val/test split to prevent temporal data leakage.
    Returns (X_train, y_train, X_val, y_val, X_test, y_test).
    """
    n = len(df)
    train_end = int(n * train_ratio)
    val_end = int(n * (train_ratio + val_ratio))

    X = df[FEATURE_COLUMNS].values.astype(np.float32)
    y = df[TARGET_COLUMN].values.astype(np.float32)

    X_train, y_train = X[:train_end], y[:train_end]
    X_val, y_val = X[train_end:val_end], y[train_end:val_end]
    X_test, y_test = X[val_end:], y[val_end:]

    return X_train, y_train, X_val, y_val, X_test, y_test
