"""
Person detection module using OpenCV with automatic fallback across builds.
Does NOT perform facial recognition or store citizen identities.
"""
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
import cv2


class PersonDetector:
    """Detects persons in video frames using OpenCV with resilient fallback."""

    def __init__(self, confidence_threshold: float = 0.2):
        self.confidence_threshold = confidence_threshold
        self.use_hog = hasattr(cv2, "HOGDescriptor")
        if self.use_hog:
            try:
                self.hog = cv2.HOGDescriptor()
                self.hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
                self.detector_name = "OpenCV HOG Pedestrian Detector (Linear SVM)"
            except Exception:
                self.use_hog = False
                self.detector_name = "OpenCV Silhouette & Contour Queue Detector"
        else:
            self.detector_name = "OpenCV Silhouette & Contour Queue Detector"

    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detect person bounding boxes in a BGR image frame.
        Returns list of dicts: {"box": (x, y, w, h), "center": (cx, cy), "confidence": float}
        """
        if frame is None or frame.size == 0:
            return []

        h, w = frame.shape[:2]
        scale = 640.0 / max(w, 1)
        if scale < 1.0:
            resized = cv2.resize(frame, (int(w * scale), int(h * scale)))
        else:
            resized = frame
            scale = 1.0

        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)

        if self.use_hog:
            try:
                boxes, weights = self.hog.detectMultiScale(
                    gray,
                    winStride=(8, 8),
                    padding=(4, 4),
                    scale=1.05,
                )
                detections = []
                for box, weight in zip(boxes, weights):
                    conf = float(weight[0]) if hasattr(weight, "__len__") else float(weight)
                    if conf >= self.confidence_threshold:
                        bx, by, bw, bh = box
                        orig_x = int(bx / scale)
                        orig_y = int(by / scale)
                        orig_w = int(bw / scale)
                        orig_h = int(bh / scale)
                        cx = orig_x + orig_w // 2
                        cy = orig_y + orig_h // 2
                        detections.append({
                            "box": (orig_x, orig_y, orig_w, orig_h),
                            "center": (cx, cy),
                            "confidence": round(conf, 3),
                        })
                return detections
            except Exception:
                pass

        # Resilient Silhouette / Contour Detection Fallback
        # Filters human-sized vertical contours (aspect ratio h/w between 1.5 and 4.5)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        thresh = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
        )
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        detections = []
        rh, rw = resized.shape[:2]
        min_area = (rh * rw) * 0.003
        max_area = (rh * rw) * 0.25

        for c in contours:
            area = cv2.contourArea(c)
            if min_area < area < max_area:
                bx, by, bw, bh = cv2.boundingRect(c)
                aspect_ratio = bh / max(bw, 1)
                # Human standing/sitting aspect ratio typically > 1.2
                if 1.2 <= aspect_ratio <= 4.8 and bh >= int(rh * 0.12):
                    orig_x = int(bx / scale)
                    orig_y = int(by / scale)
                    orig_w = int(bw / scale)
                    orig_h = int(bh / scale)
                    cx = orig_x + orig_w // 2
                    cy = orig_y + orig_h // 2
                    detections.append({
                        "box": (orig_x, orig_y, orig_w, orig_h),
                        "center": (cx, cy),
                        "confidence": round(min(0.95, area / max_area * 2.0), 2),
                    })

        return detections


class SyntheticFrameGenerator:
    """Generates realistic synthetic waiting queue video frames for testing without physical cameras."""

    def __init__(self, width: int = 640, height: int = 480):
        self.width = width
        self.height = height
        self.frame_idx = 0

    def generate_frame(self, person_count: int = 5) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
        """Produce a synthetic BGR frame containing waiting silhouettes in queue line."""
        frame = np.full((self.height, self.width, 3), (245, 247, 250), dtype=np.uint8)

        # Draw government office counter background
        cv2.rectangle(frame, (40, 40), (self.width - 40, 110), (220, 226, 235), -1)
        cv2.putText(frame, "DOCUMENT VERIFICATION - COUNTER 1 & 2", (60, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (51, 65, 85), 2)

        # Floor line / queue stanchions
        cv2.line(frame, (80, 200), (self.width - 80, 200), (200, 205, 215), 2)
        cv2.line(frame, (80, 360), (self.width - 80, 360), (200, 205, 215), 2)

        detections = []
        # Draw queue people moving slightly with time
        self.frame_idx += 1
        base_x = 120
        spacing = max(40, (self.width - 240) // max(person_count, 1))

        for i in range(person_count):
            jitter_x = int(4 * np.sin((self.frame_idx + i * 15) * 0.1))
            jitter_y = int(3 * np.cos((self.frame_idx + i * 20) * 0.08))

            cx = min(self.width - 60, base_x + i * spacing + jitter_x)
            cy = 280 + jitter_y

            w, h = 44, 110
            x = cx - w // 2
            y = cy - h // 2

            # Head
            cv2.circle(frame, (cx, y + 20), 16, (70, 80, 95), -1)
            # Torso
            cv2.rectangle(frame, (x + 6, y + 36), (x + w - 6, y + h), (40, 50, 65), -1)

            detections.append({
                "box": (x, y, w, h),
                "center": (cx, cy),
                "confidence": round(0.85 + 0.1 * np.sin(i), 2),
            })

        return frame, detections
