"""SAM2 segmentation service"""
from ultralytics import SAM
import numpy as np
import cv2
from typing import List, Tuple, Dict, Any
import logging

logger = logging.getLogger(__name__)


class SAM2Service:
    """Service for SAM2 (Segment Anything Model 2) inference"""

    def __init__(self, model_path: str = "sam2.1_b.pt"):
        """
        Initialize SAM2 model

        Args:
            model_path: Path to SAM2 model weights
        """
        try:
            self.model = SAM(model_path)
            logger.info(f"SAM2 model loaded successfully: {model_path}")
        except Exception as e:
            logger.error(f"Failed to load SAM2 model: {e}")
            self.model = None

    def predict_with_points(
        self,
        image: np.ndarray,
        points: List[Tuple[int, int]],
        labels: List[int],
        multimask_output: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Predict masks from point prompts

        Args:
            image: numpy array (H, W, 3)
            points: list of (x, y) coordinates
            labels: list of 1 (positive) or 0 (negative)
            multimask_output: if True, returns 3 masks with different quality scores

        Returns:
            List of polygon annotations
        """
        if self.model is None:
            logger.error("SAM2 model not loaded")
            return []

        try:
            results = self.model(
                image,
                points=points,
                labels=labels,
                multimask_output=multimask_output
            )

            annotations = []
            for mask in results[0].masks:
                polygon = self._mask_to_polygon(mask.data.cpu().numpy())
                if polygon:
                    annotations.append({
                        "type": "polygon",
                        "data": {"points": polygon},
                        "confidence": float(mask.conf) if hasattr(mask, 'conf') else 0.95,
                        "source": "sam2"
                    })

            return annotations
        except Exception as e:
            logger.error(f"SAM2 inference failed: {e}")
            return []

    def predict_with_box(
        self,
        image: np.ndarray,
        bbox: Tuple[int, int, int, int]
    ) -> List[Dict[str, Any]]:
        """
        Predict mask from bounding box prompt

        Args:
            image: numpy array (H, W, 3)
            bbox: (x1, y1, x2, y2)

        Returns:
            List of polygon annotations
        """
        if self.model is None:
            logger.error("SAM2 model not loaded")
            return []

        try:
            results = self.model(image, bboxes=[bbox])

            annotations = []
            for mask in results[0].masks:
                polygon = self._mask_to_polygon(mask.data.cpu().numpy())
                if polygon:
                    annotations.append({
                        "type": "polygon",
                        "data": {"points": polygon},
                        "confidence": float(mask.conf) if hasattr(mask, 'conf') else 0.95,
                        "source": "sam2"
                    })

            return annotations
        except Exception as e:
            logger.error(f"SAM2 box inference failed: {e}")
            return []

    def _mask_to_polygon(self, mask: np.ndarray) -> List[List[int]]:
        """
        Convert binary mask to polygon points

        Args:
            mask: Binary mask array

        Returns:
            List of [x, y] points
        """
        try:
            # Ensure mask is 2D
            if len(mask.shape) > 2:
                mask = mask[0]

            # Convert to uint8
            mask = (mask * 255).astype(np.uint8)

            # Find contours
            contours, _ = cv2.findContours(
                mask,
                cv2.RETR_EXTERNAL,
                cv2.CHAIN_APPROX_SIMPLE
            )

            if not contours:
                return []

            # Get largest contour
            largest = max(contours, key=cv2.contourArea)

            # Simplify polygon
            epsilon = 0.005 * cv2.arcLength(largest, True)
            approx = cv2.approxPolyDP(largest, epsilon, True)

            # Convert to list of [x, y] points
            points = [[int(p[0][0]), int(p[0][1])] for p in approx]

            return points
        except Exception as e:
            logger.error(f"Mask to polygon conversion failed: {e}")
            return []
