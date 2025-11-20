"""Export service for converting annotations to various formats"""
from typing import List, Dict, Any, Tuple
import zipfile
import io
import os
import json
from datetime import datetime
from uuid import UUID


class ExportService:
    """Service for exporting annotations in various formats"""

    def __init__(self):
        pass

    def annotation_to_bbox(self, annotation: Dict[str, Any], img_width: int, img_height: int) -> Tuple[float, float, float, float]:
        """
        Convert any annotation type to a bounding box (x_center, y_center, width, height) normalized 0-1

        Args:
            annotation: Annotation data
            img_width: Image width in pixels
            img_height: Image height in pixels

        Returns:
            Tuple of (x_center, y_center, width, height) all normalized 0-1
        """
        ann_type = annotation['type']
        data = annotation['data']

        if ann_type == 'circle':
            # Circle: center + radius
            x, y, size = data['x'], data['y'], data['size']
            x_min = x - size
            y_min = y - size
            x_max = x + size
            y_max = y + size

        elif ann_type in ['box', 'rectangle']:
            # Rectangle: corners
            corners = data['corners']
            xs = [c[0] for c in corners]
            ys = [c[1] for c in corners]
            x_min = min(xs)
            y_min = min(ys)
            x_max = max(xs)
            y_max = max(ys)

        elif ann_type == 'polygon':
            # Polygon: get bounding box from all points
            points = data['points']
            xs = [p[0] for p in points]
            ys = [p[1] for p in points]
            x_min = min(xs)
            y_min = min(ys)
            x_max = max(xs)
            y_max = max(ys)

        else:
            raise ValueError(f"Unknown annotation type: {ann_type}")

        # Calculate center and size
        width = x_max - x_min
        height = y_max - y_min
        x_center = x_min + width / 2
        y_center = y_min + height / 2

        # Normalize to 0-1
        x_center_norm = x_center / img_width
        y_center_norm = y_center / img_height
        width_norm = width / img_width
        height_norm = height / img_height

        return (x_center_norm, y_center_norm, width_norm, height_norm)

    def annotation_to_polygon(self, annotation: Dict[str, Any], img_width: int, img_height: int) -> List[float]:
        """
        Convert any annotation type to a polygon (list of x,y coordinates) normalized 0-1

        Args:
            annotation: Annotation data
            img_width: Image width in pixels
            img_height: Image height in pixels

        Returns:
            List of normalized coordinates [x1, y1, x2, y2, ...]
        """
        ann_type = annotation['type']
        data = annotation['data']

        if ann_type == 'circle':
            # Approximate circle with 16-point polygon
            import math
            x, y, size = data['x'], data['y'], data['size']
            points = []
            num_points = 16
            for i in range(num_points):
                angle = 2 * math.pi * i / num_points
                px = x + size * math.cos(angle)
                py = y + size * math.sin(angle)
                points.extend([px / img_width, py / img_height])
            return points

        elif ann_type in ['box', 'rectangle']:
            # Rectangle: use corners as polygon
            corners = data['corners']
            points = []
            for corner in corners:
                points.extend([corner[0] / img_width, corner[1] / img_height])
            return points

        elif ann_type == 'polygon':
            # Polygon: normalize points
            points = []
            for point in data['points']:
                points.extend([point[0] / img_width, point[1] / img_height])
            return points

        else:
            raise ValueError(f"Unknown annotation type: {ann_type}")

    def export_yolo_detection(self, images: List[Any], annotations_by_image: Dict[UUID, List[Any]],
                             class_names: List[str], storage_dir: str) -> bytes:
        """
        Export annotations in YOLO detection format (bounding boxes)

        Format: class_id x_center y_center width height (all normalized 0-1)

        Args:
            images: List of Image objects
            annotations_by_image: Dict mapping image_id to list of annotations
            class_names: List of class names (index = class_id)
            storage_dir: Directory where images are stored

        Returns:
            Bytes of zip file containing images, labels and classes.txt
        """
        # Create class name to ID mapping
        class_to_id = {name: idx for idx, name in enumerate(class_names)}

        # Create zip file in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Write classes.txt
            classes_content = '\n'.join(class_names)
            zip_file.writestr('classes.txt', classes_content)

            # Write images and label files
            for image in images:
                # Copy image file
                image_path = image.original_path.replace("/storage/", storage_dir + "/")
                if os.path.exists(image_path):
                    zip_file.write(image_path, f"images/{image.filename}")

                # Generate label content
                annotations = annotations_by_image.get(image.id, [])
                lines = []
                for ann in annotations:
                    # Skip annotations without class labels
                    if not ann.class_label or ann.class_label not in class_to_id:
                        continue

                    class_id = class_to_id[ann.class_label]

                    # Convert to bounding box
                    x_center, y_center, width, height = self.annotation_to_bbox(
                        {'type': ann.type, 'data': ann.data},
                        image.width,
                        image.height
                    )

                    # Format: class_id x_center y_center width height
                    lines.append(f"{class_id} {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}")

                # Write label file (even if empty)
                label_filename = f"labels/{os.path.splitext(image.filename)[0]}.txt"
                zip_file.writestr(label_filename, '\n'.join(lines))

        zip_buffer.seek(0)
        return zip_buffer.read()

    def export_yolo_segmentation(self, images: List[Any], annotations_by_image: Dict[UUID, List[Any]],
                                 class_names: List[str], storage_dir: str) -> bytes:
        """
        Export annotations in YOLO segmentation format (polygons)

        Format: class_id x1 y1 x2 y2 x3 y3 ... (all normalized 0-1)

        Args:
            images: List of Image objects
            annotations_by_image: Dict mapping image_id to list of annotations
            class_names: List of class names (index = class_id)
            storage_dir: Directory where images are stored

        Returns:
            Bytes of zip file containing images, labels and classes.txt
        """
        # Create class name to ID mapping
        class_to_id = {name: idx for idx, name in enumerate(class_names)}

        # Create zip file in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Write classes.txt
            classes_content = '\n'.join(class_names)
            zip_file.writestr('classes.txt', classes_content)

            # Write images and label files
            for image in images:
                # Copy image file
                image_path = image.original_path.replace("/storage/", storage_dir + "/")
                if os.path.exists(image_path):
                    zip_file.write(image_path, f"images/{image.filename}")

                # Generate label content
                annotations = annotations_by_image.get(image.id, [])
                lines = []
                for ann in annotations:
                    # Skip annotations without class labels
                    if not ann.class_label or ann.class_label not in class_to_id:
                        continue

                    class_id = class_to_id[ann.class_label]

                    # Convert to polygon
                    polygon_coords = self.annotation_to_polygon(
                        {'type': ann.type, 'data': ann.data},
                        image.width,
                        image.height
                    )

                    # Format: class_id x1 y1 x2 y2 x3 y3 ...
                    coords_str = ' '.join([f"{coord:.6f}" for coord in polygon_coords])
                    lines.append(f"{class_id} {coords_str}")

                # Write label file (even if empty)
                label_filename = f"labels/{os.path.splitext(image.filename)[0]}.txt"
                zip_file.writestr(label_filename, '\n'.join(lines))

        zip_buffer.seek(0)
        return zip_buffer.read()

    def export_yolo_classification(self, images: List[Any], class_names: List[str], storage_dir: str) -> bytes:
        """
        Export for YOLO classification (image-level labels only)

        Creates a structure with images and a mapping file

        Args:
            images: List of Image objects
            class_names: List of class names
            storage_dir: Directory where images are stored

        Returns:
            Bytes of zip file containing images and classification structure
        """
        # Create zip file in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Write classes.txt
            classes_content = '\n'.join(class_names)
            zip_file.writestr('classes.txt', classes_content)

            # Copy images and create mapping
            mapping_lines = []
            for image in images:
                # Copy image file
                image_path = image.original_path.replace("/storage/", storage_dir + "/")
                if os.path.exists(image_path):
                    zip_file.write(image_path, f"images/{image.filename}")

                # Add to mapping if image has a class
                if image.image_class:
                    mapping_lines.append(f"{image.filename},{image.image_class}")

            zip_file.writestr('image_class_mapping.txt', '\n'.join(mapping_lines))

        zip_buffer.seek(0)
        return zip_buffer.read()

    def export_coco(self, project_name: str, images: List[Any], annotations_by_image: Dict[UUID, List[Any]],
                   class_names: List[str], storage_dir: str) -> bytes:
        """
        Export annotations in COCO format (JSON)

        Args:
            project_name: Name of the project
            images: List of Image objects
            annotations_by_image: Dict mapping image_id to list of annotations
            class_names: List of class names
            storage_dir: Directory where images are stored

        Returns:
            Bytes of zip file containing images and COCO JSON
        """
        # Create class name to ID mapping
        class_to_id = {name: idx + 1 for idx, name in enumerate(class_names)}  # COCO uses 1-indexed categories

        # Build COCO structure
        coco_data = {
            "info": {
                "description": f"{project_name} - Exported from LabelFlow",
                "url": "",
                "version": "1.0",
                "year": datetime.now().year,
                "contributor": "LabelFlow",
                "date_created": datetime.now().isoformat()
            },
            "licenses": [
                {
                    "id": 1,
                    "name": "Unknown",
                    "url": ""
                }
            ],
            "images": [],
            "annotations": [],
            "categories": []
        }

        # Add categories
        for class_name in class_names:
            coco_data["categories"].append({
                "id": class_to_id[class_name],
                "name": class_name,
                "supercategory": ""
            })

        # Add images and annotations
        annotation_id = 1
        for img_idx, image in enumerate(images, start=1):
            # Add image info
            coco_data["images"].append({
                "id": img_idx,
                "file_name": image.filename,
                "width": image.width,
                "height": image.height,
                "date_captured": image.created_at.isoformat() if hasattr(image.created_at, 'isoformat') else str(image.created_at),
                "license": 1
            })

            # Add annotations for this image
            annotations = annotations_by_image.get(image.id, [])
            for ann in annotations:
                # Skip annotations without class labels
                if not ann.class_label or ann.class_label not in class_to_id:
                    continue

                category_id = class_to_id[ann.class_label]

                # Convert annotation based on type
                if ann.type == 'circle':
                    # Convert circle to polygon segmentation
                    import math
                    x, y, size = ann.data['x'], ann.data['y'], ann.data['size']
                    num_points = 16
                    segmentation = []
                    for i in range(num_points):
                        angle = 2 * math.pi * i / num_points
                        px = x + size * math.cos(angle)
                        py = y + size * math.sin(angle)
                        segmentation.extend([px, py])

                    # Bounding box
                    bbox = [x - size, y - size, size * 2, size * 2]
                    area = math.pi * size * size

                elif ann.type in ['box', 'rectangle']:
                    # Convert rectangle
                    corners = ann.data['corners']
                    xs = [c[0] for c in corners]
                    ys = [c[1] for c in corners]
                    x_min, x_max = min(xs), max(xs)
                    y_min, y_max = min(ys), max(ys)
                    width = x_max - x_min
                    height = y_max - y_min

                    # Segmentation (polygon from corners)
                    segmentation = []
                    for corner in corners:
                        segmentation.extend([corner[0], corner[1]])

                    bbox = [x_min, y_min, width, height]
                    area = width * height

                elif ann.type == 'polygon':
                    # Use polygon points
                    points = ann.data['points']
                    segmentation = []
                    for point in points:
                        segmentation.extend([point[0], point[1]])

                    # Calculate bounding box
                    xs = [p[0] for p in points]
                    ys = [p[1] for p in points]
                    x_min, x_max = min(xs), max(xs)
                    y_min, y_max = min(ys), max(ys)
                    width = x_max - x_min
                    height = y_max - y_min
                    bbox = [x_min, y_min, width, height]
                    area = width * height  # Approximate

                else:
                    continue

                # Add COCO annotation
                coco_data["annotations"].append({
                    "id": annotation_id,
                    "image_id": img_idx,
                    "category_id": category_id,
                    "bbox": bbox,
                    "area": area,
                    "segmentation": [segmentation],  # List of polygons
                    "iscrowd": 0
                })
                annotation_id += 1

        # Create zip file
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Write COCO JSON
            coco_json = json.dumps(coco_data, indent=2)
            zip_file.writestr('annotations.json', coco_json)

            # Copy images
            for image in images:
                image_path = image.original_path.replace("/storage/", storage_dir + "/")
                if os.path.exists(image_path):
                    zip_file.write(image_path, f"images/{image.filename}")

        zip_buffer.seek(0)
        return zip_buffer.read()
