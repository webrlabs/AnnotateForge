"""YOLO object detection service"""
from ultralytics import YOLO
import numpy as np
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class YOLOService:
    """Service for YOLO object detection"""

    def __init__(self, model_path: str = "yolo26n.pt"):
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

            if len(results) > 0:
                # Check if this is an OBB model (has .obb attribute with results)
                if hasattr(results[0], 'obb') and results[0].obb is not None and len(results[0].obb) > 0:
                    obb_results = results[0].obb
                    for obb in obb_results:
                        # OBB provides xyxyxyxy (4 corner points)
                        corners_tensor = obb.xyxyxyxy[0].cpu().numpy()
                        conf = float(obb.conf[0])
                        cls = int(obb.cls[0])

                        # corners_tensor is shape (4, 2) - four corner points
                        # Convert OBB to a line annotation using the longest axis
                        corners = corners_tensor.tolist()

                        # Calculate midpoints of opposing sides to get the line
                        # Corners are ordered: top-left, top-right, bottom-right, bottom-left
                        mid_start = [
                            (corners[0][0] + corners[3][0]) / 2,
                            (corners[0][1] + corners[3][1]) / 2,
                        ]
                        mid_end = [
                            (corners[1][0] + corners[2][0]) / 2,
                            (corners[1][1] + corners[2][1]) / 2,
                        ]

                        # Check which axis is longer and use that as the line
                        side1_len = ((corners[1][0] - corners[0][0])**2 + (corners[1][1] - corners[0][1])**2)**0.5
                        side2_len = ((corners[3][0] - corners[0][0])**2 + (corners[3][1] - corners[0][1])**2)**0.5

                        if side2_len > side1_len:
                            # Vertical-ish: use midpoints of top and bottom sides
                            mid_start = [
                                (corners[0][0] + corners[1][0]) / 2,
                                (corners[0][1] + corners[1][1]) / 2,
                            ]
                            mid_end = [
                                (corners[2][0] + corners[3][0]) / 2,
                                (corners[2][1] + corners[3][1]) / 2,
                            ]

                        annotations.append({
                            "type": "line",
                            "data": {
                                "start": mid_start,
                                "end": mid_end,
                            },
                            "confidence": conf,
                            "source": "yolo",
                            "class_label": self.model.names[cls]
                        })

                elif len(results[0].boxes) > 0:
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
