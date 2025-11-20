"""Image processing service"""
import cv2
import numpy as np
from PIL import Image
from io import BytesIO
import logging

logger = logging.getLogger(__name__)


class ImageProcessor:
    """Service for image processing operations"""

    def apply_clahe(
        self,
        image: np.ndarray,
        clip_limit: float = 2.0,
        tile_grid_size: int = 8
    ) -> np.ndarray:
        """
        Apply Contrast Limited Adaptive Histogram Equalization

        Args:
            image: Input image
            clip_limit: CLAHE clip limit
            tile_grid_size: Size of grid for histogram equalization

        Returns:
            Enhanced image
        """
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            clahe = cv2.createCLAHE(
                clipLimit=clip_limit,
                tileGridSize=(tile_grid_size, tile_grid_size)
            )
            enhanced = clahe.apply(gray)
            return cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)
        except Exception as e:
            logger.error(f"CLAHE failed: {e}")
            return image

    def adjust_brightness_contrast(
        self,
        image: np.ndarray,
        brightness: int = 0,
        contrast: int = 0
    ) -> np.ndarray:
        """
        Adjust brightness and contrast

        Args:
            image: Input image
            brightness: Brightness adjustment (-127 to 127)
            contrast: Contrast adjustment (-127 to 127)

        Returns:
            Adjusted image
        """
        try:
            result = image.copy()

            if brightness != 0:
                if brightness > 0:
                    shadow = brightness
                    highlight = 255
                else:
                    shadow = 0
                    highlight = 255 + brightness
                alpha_b = (highlight - shadow) / 255
                gamma_b = shadow
                result = cv2.addWeighted(result, alpha_b, result, 0, gamma_b)

            if contrast != 0:
                alpha_c = 131 * (contrast + 127) / (127 * (131 - contrast))
                gamma_c = 127 * (1 - alpha_c)
                result = cv2.addWeighted(result, alpha_c, result, 0, gamma_c)

            return result
        except Exception as e:
            logger.error(f"Brightness/contrast adjustment failed: {e}")
            return image

    def generate_thumbnail(
        self,
        image: np.ndarray,
        size: int = 256
    ) -> bytes:
        """
        Generate thumbnail and return as JPEG bytes

        Args:
            image: Input image
            size: Maximum dimension for thumbnail

        Returns:
            JPEG bytes
        """
        try:
            # Resize maintaining aspect ratio
            h, w = image.shape[:2]
            if h > w:
                new_h = size
                new_w = int(w * (size / h))
            else:
                new_w = size
                new_h = int(h * (size / w))

            resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)

            # Convert to PIL and save as JPEG
            pil_image = Image.fromarray(cv2.cvtColor(resized, cv2.COLOR_BGR2RGB))
            buffer = BytesIO()
            pil_image.save(buffer, format='JPEG', quality=85)

            return buffer.getvalue()
        except Exception as e:
            logger.error(f"Thumbnail generation failed: {e}")
            return b""

    def load_image(self, path: str) -> np.ndarray:
        """
        Load image from file path

        Args:
            path: Path to image file

        Returns:
            Image as numpy array
        """
        try:
            image = cv2.imread(path)
            if image is None:
                raise ValueError(f"Failed to load image: {path}")
            return image
        except Exception as e:
            logger.error(f"Image loading failed: {e}")
            raise
