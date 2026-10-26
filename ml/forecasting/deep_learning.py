"""
Deep Learning Forecasters using PyTorch:
  1. LSTM Sequence Model (Long Short-Term Memory)
  2. Temporal Convolutional Network (TCN) Model
"""
from typing import Dict, Any, Tuple, Optional
import numpy as np
import torch
import torch.nn as nn
from sklearn.preprocessing import StandardScaler
from ml.forecasting.base import BaseForecaster
from ml.preprocessing.features import FEATURE_COLUMNS


def create_sequences(X: np.ndarray, y: np.ndarray, seq_len: int = 4) -> Tuple[np.ndarray, np.ndarray]:
    """Window flat feature arrays into sequences of length seq_len."""
    Xs, ys = [], []
    for i in range(len(X) - seq_len):
        Xs.append(X[i : i + seq_len])
        ys.append(y[i + seq_len])
    if not Xs:
        return np.empty((0, seq_len, X.shape[1]), dtype=np.float32), np.empty((0,), dtype=np.float32)
    return np.array(Xs, dtype=np.float32), np.array(ys, dtype=np.float32)


class _PyTorchLSTM(nn.Module):
    def __init__(self, input_dim: int, hidden_dim: int = 32, num_layers: int = 2, dropout: float = 0.1):
        super().__init__()
        self.lstm = nn.LSTM(input_dim, hidden_dim, num_layers=num_layers, batch_first=True, dropout=dropout if num_layers > 1 else 0.0)
        self.fc = nn.Sequential(
            nn.Linear(hidden_dim, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm(x)
        last_hidden = out[:, -1, :]
        return self.fc(last_hidden).squeeze(-1)


class LSTMForecaster(BaseForecaster):
    """LSTM Time-Series Deep Learning Model."""

    def __init__(self, seq_len: int = 4, hidden_dim: int = 32, epochs: int = 25, lr: float = 0.01, seed: int = 42):
        super().__init__("LSTM Deep Learning Time-Series Model")
        self.seq_len = seq_len
        self.hidden_dim = hidden_dim
        self.epochs = epochs
        self.lr = lr
        self.seed = seed
        self.scaler = StandardScaler()
        self.model: Optional[_PyTorchLSTM] = None
        self.input_dim = len(FEATURE_COLUMNS)

    def fit(self, X_train: np.ndarray, y_train: np.ndarray, **kwargs) -> "LSTMForecaster":
        torch.manual_seed(self.seed)
        np.random.seed(self.seed)

        X_scaled = self.scaler.fit_transform(X_train)
        X_seq, y_seq = create_sequences(X_scaled, y_train, self.seq_len)

        if len(X_seq) == 0:
            raise ValueError(f"Insufficient samples to create sequence of length {self.seq_len}")

        self.input_dim = X_train.shape[1]
        self.model = _PyTorchLSTM(self.input_dim, self.hidden_dim)
        optimizer = torch.optim.Adam(self.model.parameters(), lr=self.lr, weight_decay=1e-4)
        loss_fn = nn.MSELoss()

        X_t = torch.tensor(X_seq)
        y_t = torch.tensor(y_seq)

        self.model.train()
        for epoch in range(self.epochs):
            optimizer.zero_grad()
            preds = self.model(X_t)
            loss = loss_fn(preds, y_t)
            loss.backward()
            optimizer.step()

        self.is_trained = True
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        if not self.is_trained or self.model is None:
            raise RuntimeError("Model must be fitted before predict()")

        self.model.eval()
        X_scaled = self.scaler.transform(X)

        if len(X_scaled) < self.seq_len:
            # If fewer rows than seq_len, pad by repeating first row
            pad_needed = self.seq_len - len(X_scaled)
            padding = np.repeat(X_scaled[:1], pad_needed, axis=0)
            X_padded = np.vstack([padding, X_scaled])
            seqs = [X_padded]
            with torch.no_grad():
                out = self.model(torch.tensor(np.array(seqs, dtype=np.float32)))
            preds = np.repeat(out.numpy(), len(X))
            return np.maximum(0.0, preds)

        # Standard windowing
        seqs = []
        for i in range(len(X_scaled)):
            start_idx = max(0, i - self.seq_len + 1)
            window = X_scaled[start_idx : i + 1]
            if len(window) < self.seq_len:
                pad = np.repeat(window[:1], self.seq_len - len(window), axis=0)
                window = np.vstack([pad, window])
            seqs.append(window)

        with torch.no_grad():
            tensor_seqs = torch.tensor(np.array(seqs, dtype=np.float32))
            preds = self.model(tensor_seqs).numpy()

        return np.maximum(0.0, preds)


class _PyTorchTCN(nn.Module):
    """1D Dilated Temporal Convolutional Network block."""
    def __init__(self, input_dim: int, num_channels: int = 32, kernel_size: int = 2):
        super().__init__()
        self.conv1 = nn.Conv1d(input_dim, num_channels, kernel_size=kernel_size, padding="same", dilation=1)
        self.relu1 = nn.ReLU()
        self.conv2 = nn.Conv1d(num_channels, num_channels, kernel_size=kernel_size, padding="same", dilation=2)
        self.relu2 = nn.ReLU()
        self.fc = nn.Linear(num_channels, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x is (batch, seq_len, features) -> transpose to (batch, features, seq_len)
        x = x.transpose(1, 2)
        out = self.relu1(self.conv1(x))
        out = self.relu2(self.conv2(out))
        # Global average pool over sequence length
        pooled = torch.mean(out, dim=2)
        return self.fc(pooled).squeeze(-1)


class TCNForecaster(BaseForecaster):
    """Temporal Convolutional Network Forecaster."""

    def __init__(self, seq_len: int = 4, epochs: int = 25, lr: float = 0.01, seed: int = 42):
        super().__init__("Temporal Convolutional Network (TCN) Model")
        self.seq_len = seq_len
        self.epochs = epochs
        self.lr = lr
        self.seed = seed
        self.scaler = StandardScaler()
        self.model: Optional[_PyTorchTCN] = None

    def fit(self, X_train: np.ndarray, y_train: np.ndarray, **kwargs) -> "TCNForecaster":
        torch.manual_seed(self.seed)
        np.random.seed(self.seed)

        X_scaled = self.scaler.fit_transform(X_train)
        X_seq, y_seq = create_sequences(X_scaled, y_train, self.seq_len)

        if len(X_seq) == 0:
            raise ValueError(f"Insufficient samples for TCN sequence length {self.seq_len}")

        input_dim = X_train.shape[1]
        self.model = _PyTorchTCN(input_dim=input_dim, num_channels=32)
        optimizer = torch.optim.Adam(self.model.parameters(), lr=self.lr)
        loss_fn = nn.MSELoss()

        X_t = torch.tensor(X_seq)
        y_t = torch.tensor(y_seq)

        self.model.train()
        for epoch in range(self.epochs):
            optimizer.zero_grad()
            preds = self.model(X_t)
            loss = loss_fn(preds, y_t)
            loss.backward()
            optimizer.step()

        self.is_trained = True
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        if not self.is_trained or self.model is None:
            raise RuntimeError("Model must be fitted before predict()")

        self.model.eval()
        X_scaled = self.scaler.transform(X)

        seqs = []
        for i in range(len(X_scaled)):
            start_idx = max(0, i - self.seq_len + 1)
            window = X_scaled[start_idx : i + 1]
            if len(window) < self.seq_len:
                pad = np.repeat(window[:1], self.seq_len - len(window), axis=0)
                window = np.vstack([pad, window])
            seqs.append(window)

        with torch.no_grad():
            tensor_seqs = torch.tensor(np.array(seqs, dtype=np.float32))
            preds = self.model(tensor_seqs).numpy()

        return np.maximum(0.0, preds)
