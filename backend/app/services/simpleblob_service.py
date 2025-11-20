"""SimpleBlob detection service"""
import cv2
import numpy as np
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class SimpleBlobService:
    """Service for OpenCV SimpleBlobDetector"""

    def detect(
        self,
        image: np.ndarray,
        params: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Detect blobs using OpenCV SimpleBlobDetector

        Args:
            image: grayscale numpy array (H, W) or color (H, W, 3)
            params: detection parameters

        Returns:
            List of circle annotations
        """
        try:
            # Convert to grayscale if needed
            if len(image.shape) == 3:
                image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

            # Setup parameters
            detector_params = cv2.SimpleBlobDetector_Params()

            detector_params.blobColor = params.get('blob_color', 255)
            detector_params.minThreshold = params.get('min_threshold', 40)
            detector_params.maxThreshold = params.get('max_threshold', 255)
            detector_params.thresholdStep = params.get('threshold_step', 10)
            detector_params.minDistBetweenBlobs = max(0.01, params.get('min_distance', 0.0))

            detector_params.filterByArea = params.get('filter_by_area', True)
            detector_params.minArea = params.get('min_area', 100)
            detector_params.maxArea = params.get('max_area', 10000)

            detector_params.filterByCircularity = params.get('filter_by_circularity', False)
            detector_params.minCircularity = params.get('min_circularity', 0.1)
            detector_params.maxCircularity = params.get('max_circularity', 1.0)

            detector_params.filterByConvexity = params.get('filter_by_convexity', False)
            detector_params.minConvexity = params.get('min_convexity', 0.87)
            detector_params.maxConvexity = params.get('max_convexity', 1.0)

            detector_params.filterByInertia = params.get('filter_by_inertia', False)
            detector_params.minInertiaRatio = params.get('min_inertia_ratio', 0.01)
            detector_params.maxInertiaRatio = params.get('max_inertia_ratio', 1.0)

            # Create detector
            detector = cv2.SimpleBlobDetector_create(detector_params)

            # Detect keypoints
            keypoints = detector.detect(image)

            # Convert to annotations
            annotations = []
            for kp in keypoints:
                x, y = kp.pt
                size = kp.size

                annotations.append({
                    "type": "circle",
                    "data": {
                        "x": float(x),
                        "y": float(y),
                        "size": float(size)
                    },
                    "confidence": 0.8,
                    "source": "simpleblob"
                })

            logger.info(f"Detected {len(annotations)} blobs")
            return annotations
        except Exception as e:
            logger.error(f"SimpleBlob detection failed: {e}")
            return []
