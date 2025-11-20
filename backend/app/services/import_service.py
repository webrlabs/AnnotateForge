"""Import service for loading annotations from various formats"""
from typing import List, Dict, Any, Tuple, Optional
import zipfile
import io
import os
import json
import shutil
from pathlib import Path
from uuid import UUID, uuid4
from datetime import datetime


class ImportService:
    """Service for importing annotations from various formats"""

    def __init__(self):
        pass

    def parse_yolo_detection(self, label_content: str, img_width: int, img_height: int, class_names: List[str]) -> List[Dict[str, Any]]:
        """
        Parse YOLO detection format (bounding boxes)

        Format: class_id x_center y_center width height (all normalized 0-1)

        Args:
            label_content: Content of the label file
            img_width: Image width in pixels
            img_height: Image height in pixels
            class_names: List of class names (index = class_id)

        Returns:
            List of annotation dictionaries
        """
        annotations = []
        lines = label_content.strip().split('\n')

        for line in lines:
            if not line.strip():
                continue

            parts = line.strip().split()
            if len(parts) < 5:
                continue

            class_id = int(parts[0])
            x_center_norm = float(parts[1])
            y_center_norm = float(parts[2])
            width_norm = float(parts[3])
            height_norm = float(parts[4])

            # Convert normalized to pixel coordinates
            x_center = x_center_norm * img_width
            y_center = y_center_norm * img_height
            width = width_norm * img_width
            height = height_norm * img_height

            # Calculate corners for rectangle
            x_min = x_center - width / 2
            y_min = y_center - height / 2
            x_max = x_center + width / 2
            y_max = y_center + height / 2

            corners = [
                [x_min, y_min],
                [x_max, y_min],
                [x_max, y_max],
                [x_min, y_max]
            ]

            class_label = class_names[class_id] if class_id < len(class_names) else None

            annotations.append({
                'type': 'box',
                'data': {'corners': corners},
                'class_label': class_label,
                'confidence': 1.0
            })

        return annotations

    def parse_yolo_segmentation(self, label_content: str, img_width: int, img_height: int, class_names: List[str]) -> List[Dict[str, Any]]:
        """
        Parse YOLO segmentation format (polygons)

        Format: class_id x1 y1 x2 y2 x3 y3 ... (all normalized 0-1)

        Args:
            label_content: Content of the label file
            img_width: Image width in pixels
            img_height: Image height in pixels
            class_names: List of class names (index = class_id)

        Returns:
            List of annotation dictionaries
        """
        annotations = []
        lines = label_content.strip().split('\n')

        for line in lines:
            if not line.strip():
                continue

            parts = line.strip().split()
            if len(parts) < 7:  # At least class_id + 3 points (6 coords)
                continue

            class_id = int(parts[0])
            coords = [float(x) for x in parts[1:]]

            # Convert pairs of normalized coords to pixel coordinates
            points = []
            for i in range(0, len(coords), 2):
                if i + 1 < len(coords):
                    x = coords[i] * img_width
                    y = coords[i + 1] * img_height
                    points.append([x, y])

            class_label = class_names[class_id] if class_id < len(class_names) else None

            annotations.append({
                'type': 'polygon',
                'data': {'points': points},
                'class_label': class_label,
                'confidence': 1.0
            })

        return annotations

    def parse_coco_annotations(self, coco_data: Dict[str, Any], image_filename: str, img_width: int, img_height: int) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """
        Parse COCO format annotations for a specific image

        Args:
            coco_data: Full COCO JSON data
            image_filename: Filename of the image to get annotations for
            img_width: Image width in pixels
            img_height: Image height in pixels

        Returns:
            Tuple of (list of annotations, image_class if any)
        """
        # Find image in COCO data
        image_id = None
        for img in coco_data.get('images', []):
            if img['file_name'] == image_filename:
                image_id = img['id']
                break

        if image_id is None:
            return [], None

        # Create category mapping
        categories = {cat['id']: cat['name'] for cat in coco_data.get('categories', [])}

        # Get annotations for this image
        annotations = []
        for ann in coco_data.get('annotations', []):
            if ann['image_id'] != image_id:
                continue

            category_id = ann.get('category_id')
            class_label = categories.get(category_id)

            # Check if we have segmentation or just bbox
            if 'segmentation' in ann and ann['segmentation']:
                # Use polygon segmentation
                segmentation = ann['segmentation']

                # COCO can have multiple polygons per annotation
                # For simplicity, use the first one
                if isinstance(segmentation, list) and len(segmentation) > 0:
                    coords = segmentation[0]

                    # Convert flat list to points
                    points = []
                    for i in range(0, len(coords), 2):
                        if i + 1 < len(coords):
                            points.append([coords[i], coords[i + 1]])

                    annotations.append({
                        'type': 'polygon',
                        'data': {'points': points},
                        'class_label': class_label,
                        'confidence': ann.get('score', 1.0)
                    })

            elif 'bbox' in ann:
                # Use bounding box [x, y, width, height]
                bbox = ann['bbox']
                x, y, width, height = bbox

                corners = [
                    [x, y],
                    [x + width, y],
                    [x + width, y + height],
                    [x, y + height]
                ]

                annotations.append({
                    'type': 'box',
                    'data': {'corners': corners},
                    'class_label': class_label,
                    'confidence': ann.get('score', 1.0)
                })

        return annotations, None

    def extract_zip(self, zip_data: bytes, extract_dir: str) -> str:
        """
        Extract ZIP file to a directory

        Args:
            zip_data: ZIP file bytes
            extract_dir: Directory to extract to

        Returns:
            Path to extracted directory
        """
        # Create unique extraction directory
        extract_path = os.path.join(extract_dir, str(uuid4()))
        os.makedirs(extract_path, exist_ok=True)

        # Extract ZIP
        with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zip_file:
            zip_file.extractall(extract_path)

        return extract_path

    def find_files_by_extension(self, directory: str, extensions: List[str]) -> List[str]:
        """
        Find all files with given extensions in directory and subdirectories

        Args:
            directory: Directory to search
            extensions: List of extensions (e.g., ['.jpg', '.png'])

        Returns:
            List of file paths
        """
        files = []
        for root, _, filenames in os.walk(directory):
            for filename in filenames:
                if any(filename.lower().endswith(ext) for ext in extensions):
                    files.append(os.path.join(root, filename))
        return files

    def parse_classes_file(self, classes_path: str) -> List[str]:
        """
        Parse classes.txt file

        Args:
            classes_path: Path to classes.txt

        Returns:
            List of class names
        """
        with open(classes_path, 'r') as f:
            return [line.strip() for line in f if line.strip()]

    def import_yolo_dataset(self, zip_data: bytes, format: str, temp_dir: str) -> Dict[str, Any]:
        """
        Import YOLO format dataset from ZIP file

        Args:
            zip_data: ZIP file bytes
            format: YOLO format type ('detection' or 'segmentation')
            temp_dir: Temporary directory for extraction

        Returns:
            Dictionary with import results
        """
        # Extract ZIP
        extract_path = self.extract_zip(zip_data, temp_dir)

        try:
            # Find classes.txt
            classes_path = None
            for root, _, files in os.walk(extract_path):
                if 'classes.txt' in files:
                    classes_path = os.path.join(root, 'classes.txt')
                    break

            if not classes_path:
                raise ValueError("classes.txt not found in ZIP file")

            class_names = self.parse_classes_file(classes_path)

            # Find images and labels directories
            images_dir = None
            labels_dir = None

            for root, dirs, _ in os.walk(extract_path):
                if 'images' in dirs and images_dir is None:
                    images_dir = os.path.join(root, 'images')
                if 'labels' in dirs and labels_dir is None:
                    labels_dir = os.path.join(root, 'labels')

            if not images_dir:
                raise ValueError("images directory not found in ZIP file")

            # Find all images
            image_files = self.find_files_by_extension(images_dir, ['.jpg', '.jpeg', '.png', '.bmp'])

            results = {
                'class_names': class_names,
                'images': [],
                'total_annotations': 0
            }

            # Process each image
            for image_path in image_files:
                from PIL import Image

                # Get image info
                img = Image.open(image_path)
                img_width, img_height = img.size
                img_format = img.format
                img.close()

                filename = os.path.basename(image_path)
                base_name = os.path.splitext(filename)[0]

                # Find corresponding label file
                annotations = []
                if labels_dir:
                    label_path = os.path.join(labels_dir, f"{base_name}.txt")
                    if os.path.exists(label_path):
                        with open(label_path, 'r') as f:
                            label_content = f.read()

                        if format == 'detection':
                            annotations = self.parse_yolo_detection(label_content, img_width, img_height, class_names)
                        elif format == 'segmentation':
                            annotations = self.parse_yolo_segmentation(label_content, img_width, img_height, class_names)

                results['images'].append({
                    'path': image_path,
                    'filename': filename,
                    'width': img_width,
                    'height': img_height,
                    'format': img_format,
                    'annotations': annotations
                })
                results['total_annotations'] += len(annotations)

            return results

        finally:
            # Cleanup will be done by caller
            pass

    def import_coco_dataset(self, zip_data: bytes, temp_dir: str) -> Dict[str, Any]:
        """
        Import COCO format dataset from ZIP file

        Args:
            zip_data: ZIP file bytes
            temp_dir: Temporary directory for extraction

        Returns:
            Dictionary with import results
        """
        # Extract ZIP
        extract_path = self.extract_zip(zip_data, temp_dir)

        try:
            # Find annotations.json
            annotations_path = None
            for root, _, files in os.walk(extract_path):
                if 'annotations.json' in files:
                    annotations_path = os.path.join(root, 'annotations.json')
                    break

            if not annotations_path:
                raise ValueError("annotations.json not found in ZIP file")

            # Load COCO data
            with open(annotations_path, 'r') as f:
                coco_data = json.load(f)

            # Get class names from categories
            class_names = [cat['name'] for cat in coco_data.get('categories', [])]

            # Find images directory
            images_dir = None
            for root, dirs, _ in os.walk(extract_path):
                if 'images' in dirs:
                    images_dir = os.path.join(root, 'images')
                    break

            if not images_dir:
                raise ValueError("images directory not found in ZIP file")

            results = {
                'class_names': class_names,
                'images': [],
                'total_annotations': 0
            }

            # Process each image from COCO data
            for img_info in coco_data.get('images', []):
                from PIL import Image

                filename = img_info['file_name']
                image_path = os.path.join(images_dir, filename)

                if not os.path.exists(image_path):
                    continue

                # Get image dimensions and format from COCO or file
                img_width = img_info.get('width')
                img_height = img_info.get('height')
                img_format = None

                if not img_width or not img_height:
                    img = Image.open(image_path)
                    img_width, img_height = img.size
                    img_format = img.format
                    img.close()
                else:
                    # Still get format even if dimensions are in COCO
                    img = Image.open(image_path)
                    img_format = img.format
                    img.close()

                # Parse annotations for this image
                annotations, image_class = self.parse_coco_annotations(
                    coco_data, filename, img_width, img_height
                )

                results['images'].append({
                    'path': image_path,
                    'filename': filename,
                    'width': img_width,
                    'height': img_height,
                    'format': img_format,
                    'annotations': annotations,
                    'image_class': image_class
                })
                results['total_annotations'] += len(annotations)

            return results

        finally:
            # Cleanup will be done by caller
            pass
