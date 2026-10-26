"""
Queue Camera Stream and ROI Processing Service.
Handles frame acquisition, ROI filtering, visual annotation, and JPEG encoding.
"""
from typing import List, Tuple, Dict, Any, Optional
import time
import numpy as np
import cv2
from ml.computer_vision.detector import PersonDetector, SyntheticFrameGenerator
from ml.computer_vision.tracker import TemporalSmoother, CentroidTracker


class CameraStreamProcessor:
    """Processes video frames from a camera device, video file, or synthetic queue feed."""

    def __init__(
        self,
        source: Any = "synthetic",
        roi_normalized: Optional[Tuple[float, float, float, float]] = None,
        use_detector: bool = True,
    ):
        """
        source: 0 (webcam), path_to_video.mp4, or 'synthetic'
        roi_normalized: (x_min, y_min, x_max, y_max) between 0.0 and 1.0.
                        Defaults to (0.1, 0.35, 0.9, 0.95)
        """
        self.source = source
        self.roi_normalized = roi_normalized or (0.10, 0.35, 0.90, 0.95)
        self.use_detector = use_detector

        self.cap: Optional[cv2.VideoCapture] = None
        self.is_synthetic = (str(source).lower() == "synthetic")
        self.synth_gen = SyntheticFrameGenerator()
        self.detector = PersonDetector()
        self.smoother = TemporalSmoother(window_size=5, alpha=0.4)
        self.tracker = CentroidTracker()

        self.last_process_time = time.time()
        self.current_fps = 0.0
        self.frame_count = 0
        self.status = "initialized"
        self.last_raw_occupancy = 0
        self.last_smoothed_occupancy = 0.0

        if not self.is_synthetic:
            self._connect_stream()
        else:
            self.status = "synthetic_active"

    def _connect_stream(self):
        try:
            self.cap = cv2.VideoCapture(self.source)
            if self.cap.isOpened():
                self.status = "connected"
            else:
                self.status = "disconnected_fallback_synthetic"
                self.is_synthetic = True
        except Exception as e:
            self.status = f"error_{str(e)[:30]}"
            self.is_synthetic = True

    def set_roi(self, x_min: float, y_min: float, x_max: float, y_max: float):
        """Update Region of Interest coordinates (normalized 0.0 to 1.0)."""
        self.roi_normalized = (
            max(0.0, min(x_min, 1.0)),
            max(0.0, min(y_min, 1.0)),
            max(0.0, min(x_max, 1.0)),
            max(0.0, min(y_max, 1.0)),
        )

    def process_frame(self, target_person_count: Optional[int] = None) -> Dict[str, Any]:
        """
        Acquire and process one frame.
        Returns:
          {
            "raw_occupancy": int,
            "smoothed_occupancy": float,
            "fps": float,
            "status": str,
            "annotated_frame_bytes": bytes (JPEG),
            "roi": tuple,
            "detections": list,
          }
        """
        now = time.time()
        dt = now - self.last_process_time
        if dt > 0:
            self.current_fps = round(1.0 / dt, 1)
        self.last_process_time = now
        self.frame_count += 1

        # 1. Acquire frame
        frame = None
        detections = []
        if self.is_synthetic or self.cap is None or not self.cap.isOpened():
            count = target_person_count if target_person_count is not None else 6
            frame, detections = self.synth_gen.generate_frame(person_count=count)
        else:
            ret, frame = self.cap.read()
            if not ret or frame is None:
                # Video ended or camera disconnected -> fallback
                frame, detections = self.synth_gen.generate_frame(person_count=4)
                self.status = "stream_interrupted_synthetic_fallback"
            else:
                detections = self.detector.detect(frame)

        h, w = frame.shape[:2]

        # 2. Compute absolute ROI rectangle
        rx1 = int(self.roi_normalized[0] * w)
        ry1 = int(self.roi_normalized[1] * h)
        rx2 = int(self.roi_normalized[2] * w)
        ry2 = int(self.roi_normalized[3] * h)

        # 3. Filter detections by ROI
        in_roi_detections = []
        for det in detections:
            cx, cy = det["center"]
            if rx1 <= cx <= rx2 and ry1 <= cy <= ry2:
                in_roi_detections.append(det)

        raw_count = len(in_roi_detections)
        smoothed_count = self.smoother.update(raw_count)
        self.last_raw_occupancy = raw_count
        self.last_smoothed_occupancy = smoothed_count

        # 4. Annotate visual frame
        # Draw ROI Box (Teal dash / solid)
        cv2.rectangle(frame, (rx1, ry1), (rx2, ry2), (13, 148, 136), 2)
        cv2.putText(frame, "QUEUE REGION OF INTEREST (ROI)", (rx1 + 8, ry1 + 22), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (13, 148, 136), 2)

        # Draw person detection bounding boxes
        for det in in_roi_detections:
            bx, by, bw, bh = det["box"]
            cv2.rectangle(frame, (bx, by), (bx + bw, by + bh), (59, 130, 246), 2)
            cv2.circle(frame, det["center"], 4, (0, 255, 0), -1)

        # Draw metrics overlay HUD (top-left)
        cv2.rectangle(frame, (10, 10), (280, 85), (30, 41, 59), -1)
        cv2.putText(frame, f"Occupancy: {raw_count} (Smoothed: {smoothed_count})", (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
        cv2.putText(frame, f"Status: {self.status.upper()} | FPS: {self.current_fps}", (20, 58), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (148, 163, 184), 1)
        cv2.putText(frame, "Source: OpenCV CV Mon (No PII Retained)", (20, 76), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (203, 213, 225), 1)

        # 5. Encode frame to JPEG
        _, jpeg_buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        frame_bytes = jpeg_buf.tobytes()

        return {
            "raw_occupancy": raw_count,
            "smoothed_occupancy": smoothed_count,
            "fps": self.current_fps,
            "status": self.status,
            "annotated_frame_bytes": frame_bytes,
            "roi": self.roi_normalized,
            "detections": in_roi_detections,
        }

    def release(self):
        if self.cap and self.cap.isOpened():
            self.cap.release()
            self.cap = None
        self.status = "released"
