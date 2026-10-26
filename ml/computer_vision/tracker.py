"""
Temporal Smoothing and Centroid Tracker for queue occupancy monitoring.
Filters transient false positives/negatives across video frames.
"""
from typing import List, Tuple, Dict, Any, Optional
from collections import deque
import numpy as np


class TemporalSmoother:
    """Maintains a rolling window of queue occupancy counts to reduce flicker and noise."""

    def __init__(self, window_size: int = 5, alpha: float = 0.4):
        self.window_size = window_size
        self.alpha = alpha
        self.history: deque = deque(maxlen=window_size)
        self.smoothed_value: float = 0.0

    def update(self, raw_count: int) -> float:
        """Add new frame observation and return temporally smoothed count."""
        self.history.append(raw_count)
        if len(self.history) == 1:
            self.smoothed_value = float(raw_count)
        else:
            # Exponential smoothing combined with rolling median
            rolling_median = float(np.median(list(self.history)))
            self.smoothed_value = self.alpha * rolling_median + (1.0 - self.alpha) * self.smoothed_value
        return round(self.smoothed_value, 1)

    def get_latest(self) -> float:
        return round(self.smoothed_value, 1)

    def reset(self):
        self.history.clear()
        self.smoothed_value = 0.0


class CentroidTracker:
    """Simple centroid-distance tracker to associate detected persons across frames."""

    def __init__(self, max_disappeared: int = 10, max_distance: float = 60.0):
        self.next_object_id = 1
        self.objects: Dict[int, Tuple[int, int]] = {}
        self.disappeared: Dict[int, int] = {}
        self.max_disappeared = max_disappeared
        self.max_distance = max_distance

    def update(self, detections: List[Dict[str, Any]]) -> Dict[int, Tuple[int, int]]:
        """Match frame detections to existing tracked persons by centroid distance."""
        if not detections:
            # Mark all existing as disappeared
            for object_id in list(self.disappeared.keys()):
                self.disappeared[object_id] += 1
                if self.disappeared[object_id] > self.max_disappeared:
                    del self.objects[object_id]
                    del self.disappeared[object_id]
            return self.objects

        input_centroids = np.array([d["center"] for d in detections])

        if len(self.objects) == 0:
            for c in input_centroids:
                self.objects[self.next_object_id] = (int(c[0]), int(c[1]))
                self.disappeared[self.next_object_id] = 0
                self.next_object_id += 1
            return self.objects

        # Compute pairwise Euclidean distances
        object_ids = list(self.objects.keys())
        object_centroids = np.array([self.objects[oid] for oid in object_ids])

        # Distance matrix
        dists = np.linalg.norm(object_centroids[:, np.newaxis] - input_centroids, axis=2)

        rows = dists.min(axis=1).argsort()
        cols = dists.argmin(axis=1)[rows]

        used_rows = set()
        used_cols = set()

        for row, col in zip(rows, cols):
            if row in used_rows or col in used_cols:
                continue
            if dists[row, col] > self.max_distance:
                continue

            object_id = object_ids[row]
            self.objects[object_id] = (int(input_centroids[col][0]), int(input_centroids[col][1]))
            self.disappeared[object_id] = 0
            used_rows.add(row)
            used_cols.add(col)

        unused_rows = set(range(dists.shape[0])) - used_rows
        for row in unused_rows:
            object_id = object_ids[row]
            self.disappeared[object_id] += 1
            if self.disappeared[object_id] > self.max_disappeared:
                del self.objects[object_id]
                del self.disappeared[object_id]

        unused_cols = set(range(dists.shape[1])) - used_cols
        for col in unused_cols:
            self.objects[self.next_object_id] = (int(input_centroids[col][0]), int(input_centroids[col][1]))
            self.disappeared[self.next_object_id] = 0
            self.next_object_id += 1

        return self.objects
