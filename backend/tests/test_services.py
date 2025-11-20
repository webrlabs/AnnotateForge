"""
Tests for AI and image processing services
"""
import pytest
import numpy as np
from unittest.mock import Mock, patch, MagicMock

from app.services.simpleblob_service import SimpleBlobService
from app.services.image_processor import ImageProcessor


class TestSimpleBlobService:
    """Tests for SimpleBlob detection service"""

    def test_detect_blobs_basic(self, test_numpy_image):
        """Test basic blob detection"""
        service = SimpleBlobService()

        # Convert to grayscale
        gray = np.mean(test_numpy_image, axis=2).astype(np.uint8)

        # Create image with white blobs on black background
        test_image = np.zeros((256, 256), dtype=np.uint8)
        # Add some circles
        import cv2
        cv2.circle(test_image, (50, 50), 20, 255, -1)
        cv2.circle(test_image, (150, 150), 15, 255, -1)

        params = {
            'min_threshold': 40,
            'max_threshold': 255,
            'min_area': 100,
            'max_area': 5000,
            'filter_by_area': True
        }

        results = service.detect(test_image, params)

        assert isinstance(results, list)
        # Should detect at least 1 blob
        assert len(results) >= 1

        # Check result format
        if len(results) > 0:
            blob = results[0]
            assert blob['type'] == 'circle'
            assert 'x' in blob['data']
            assert 'y' in blob['data']
            assert 'size' in blob['data']
            assert blob['source'] == 'simpleblob'
            assert 'confidence' in blob

    def test_detect_no_blobs(self):
        """Test detection with no blobs present"""
        service = SimpleBlobService()

        # Uniform gray image
        test_image = np.full((256, 256), 128, dtype=np.uint8)

        params = {
            'min_threshold': 40,
            'max_threshold': 255,
            'min_area': 100,
            'max_area': 1000
        }

        results = service.detect(test_image, params)

        assert isinstance(results, list)
        assert len(results) == 0

    def test_detect_with_filters(self):
        """Test detection with circularity filters"""
        service = SimpleBlobService()

        # Create image with circles
        test_image = np.zeros((256, 256), dtype=np.uint8)
        import cv2
        cv2.circle(test_image, (128, 128), 30, 255, -1)

        params = {
            'min_threshold': 40,
            'max_threshold': 255,
            'min_area': 100,
            'max_area': 10000,
            'filter_by_circularity': True,
            'min_circularity': 0.7
        }

        results = service.detect(test_image, params)

        assert isinstance(results, list)
        # Circles should be detected with circularity filter
        assert len(results) >= 1


class TestImageProcessor:
    """Tests for image processing service"""

    def test_adjust_brightness_positive(self, test_numpy_image):
        """Test increasing brightness"""
        processor = ImageProcessor()

        result = processor.adjust_brightness_contrast(
            test_numpy_image.copy(),
            brightness=50,
            contrast=0
        )

        assert result.shape == test_numpy_image.shape
        assert result.dtype == test_numpy_image.dtype
        # Brightened image should have higher mean
        assert np.mean(result) > np.mean(test_numpy_image)

    def test_adjust_brightness_negative(self, test_numpy_image):
        """Test decreasing brightness"""
        processor = ImageProcessor()

        result = processor.adjust_brightness_contrast(
            test_numpy_image.copy(),
            brightness=-50,
            contrast=0
        )

        assert result.shape == test_numpy_image.shape
        # Darkened image should have lower mean
        assert np.mean(result) < np.mean(test_numpy_image)

    def test_adjust_contrast(self, test_numpy_image):
        """Test adjusting contrast"""
        processor = ImageProcessor()

        result = processor.adjust_brightness_contrast(
            test_numpy_image.copy(),
            brightness=0,
            contrast=30
        )

        assert result.shape == test_numpy_image.shape
        assert result.dtype == test_numpy_image.dtype

    def test_generate_thumbnail(self, test_numpy_image):
        """Test thumbnail generation"""
        processor = ImageProcessor()

        thumbnail_bytes = processor.generate_thumbnail(test_numpy_image, size=128)

        assert isinstance(thumbnail_bytes, bytes)
        assert len(thumbnail_bytes) > 0

        # Verify it's valid JPEG
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(thumbnail_bytes))
        assert img.format == 'JPEG'
        # Check size (one dimension should be 128)
        assert max(img.size) == 128

    def test_apply_clahe(self, test_numpy_image):
        """Test CLAHE enhancement"""
        processor = ImageProcessor()

        result = processor.apply_clahe(
            test_numpy_image.copy(),
            clip_limit=2.0,
            tile_grid_size=8
        )

        assert result.shape == test_numpy_image.shape
        assert result.dtype == test_numpy_image.dtype


@pytest.mark.ai
@pytest.mark.slow
class TestSAM2Service:
    """Tests for SAM2 service (marked as slow, requires model)"""

    @pytest.mark.skip(reason="Requires SAM2 model download")
    def test_predict_with_points(self, test_numpy_image):
        """Test SAM2 prediction with point prompts"""
        from app.services.sam2_service import SAM2Service

        service = SAM2Service()

        results = service.predict_with_points(
            test_numpy_image,
            points=[[128, 128]],
            labels=[1]
        )

        assert isinstance(results, list)
        if len(results) > 0:
            ann = results[0]
            assert ann['type'] == 'polygon'
            assert 'points' in ann['data']
            assert ann['source'] == 'sam2'

    @pytest.mark.skip(reason="Requires SAM2 model download")
    def test_predict_with_box(self, test_numpy_image):
        """Test SAM2 prediction with box prompt"""
        from app.services.sam2_service import SAM2Service

        service = SAM2Service()

        results = service.predict_with_box(
            test_numpy_image,
            bbox=(50, 50, 150, 150)
        )

        assert isinstance(results, list)


@pytest.mark.ai
@pytest.mark.slow
class TestYOLOService:
    """Tests for YOLO service (marked as slow, requires model)"""

    @pytest.mark.skip(reason="Requires YOLO model download")
    def test_predict_objects(self, test_numpy_image):
        """Test YOLO object detection"""
        from app.services.yolo_service import YOLOService

        service = YOLOService()

        results = service.predict(test_numpy_image, confidence=0.5)

        assert isinstance(results, list)
        # Results may be empty if no objects detected
        if len(results) > 0:
            ann = results[0]
            assert ann['type'] == 'box'
            assert 'corners' in ann['data']
            assert ann['source'] == 'yolo'
            assert 'confidence' in ann
