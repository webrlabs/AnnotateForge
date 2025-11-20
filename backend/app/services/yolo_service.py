"""YOLO object detection service"""
from ultralytics import YOLO
import numpy as np
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class YOLOService:
    """Service for YOLO object detection"""

    def __init__(self, model_path: str = "yolov8n.pt"):
        """
        Initialize YOLO model

        Args:
            model_path: Path to YOLO model weights
        """
        try:
            self.model = YOLO(model_path)
            logger.info(f"YOLO model loaded successfully: {model_path}")
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            self.model = None

    def predict(
        self,
        image: np.ndarray,
        confidence: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        Predict objects in image

        Args:
            image: numpy array (H, W, 3)
            confidence: minimum confidence threshold

        Returns:
            List of box annotations
        """
        if self.model is None:
            logger.error("YOLO model not loaded")
            return []

        try:
            results = self.model(image, conf=confidence, verbose=False)

            annotations = []
            if len(results) > 0 and len(results[0].boxes) > 0:
                boxes = results[0].boxes
                for box in boxes:
                    xyxy = box.xyxy[0].cpu().numpy()
                    conf = float(box.conf[0])
                    cls = int(box.cls[0])

                    # Convert to corner format
                    corners = [
                        [float(xyxy[0]), float(xyxy[1])],  # top-left
                        [float(xyxy[2]), float(xyxy[1])],  # top-right
                        [float(xyxy[2]), float(xyxy[3])],  # bottom-right
                        [float(xyxy[0]), float(xyxy[3])],  # bottom-left
                    ]

                    annotations.append({
                        "type": "box",
                        "data": {"corners": corners},
                        "confidence": conf,
                        "source": "yolo",
                        "class_label": self.model.names[cls]
                    })

            return annotations
        except Exception as e:
            logger.error(f"YOLO inference failed: {e}")
            return []
