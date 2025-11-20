"""
Tests for annotation CRUD operations
"""
import pytest
from uuid import uuid4


class TestAnnotationAPI:
    """Tests for annotation API endpoints"""

    def test_create_circle_annotation(self, client, auth_headers, test_image):
        """Test creating a circle annotation"""
        response = client.post(
            f"/api/v1/images/{test_image.id}/annotations",
            json={
                "type": "circle",
                "data": {"x": 100, "y": 100, "size": 50},
                "class_label": "particle"
            },
            headers=auth_headers
        )

        assert response.status_code == 201
        data = response.json()
        assert data["type"] == "circle"
        assert data["data"]["x"] == 100
        assert data["data"]["y"] == 100
        assert data["data"]["size"] == 50
        assert data["class_label"] == "particle"
        assert data["source"] == "manual"
        assert "id" in data

    def test_create_box_annotation(self, client, auth_headers, test_image):
        """Test creating a box annotation"""
        response = client.post(
            f"/api/v1/images/{test_image.id}/annotations",
            json={
                "type": "box",
                "data": {
                    "corners": [[100, 100], [200, 100], [200, 200], [100, 200]]
                },
                "class_label": "rock"
            },
            headers=auth_headers
        )

        assert response.status_code == 201
        data = response.json()
        assert data["type"] == "box"
        assert len(data["data"]["corners"]) == 4
        assert data["class_label"] == "rock"

    def test_create_polygon_annotation(self, client, auth_headers, test_image):
        """Test creating a polygon annotation"""
        response = client.post(
            f"/api/v1/images/{test_image.id}/annotations",
            json={
                "type": "polygon",
                "data": {
                    "points": [[10, 10], [50, 10], [30, 50]]
                },
                "class_label": "water"
            },
            headers=auth_headers
        )

        assert response.status_code == 201
        data = response.json()
        assert data["type"] == "polygon"
        assert len(data["data"]["points"]) == 3

    def test_create_annotation_without_auth(self, client, test_image):
        """Test creating annotation without authentication fails"""
        response = client.post(
            f"/api/v1/images/{test_image.id}/annotations",
            json={
                "type": "circle",
                "data": {"x": 100, "y": 100, "size": 50}
            }
        )

        assert response.status_code == 401

    def test_create_annotation_invalid_type(self, client, auth_headers, test_image):
        """Test creating annotation with invalid type"""
        response = client.post(
            f"/api/v1/images/{test_image.id}/annotations",
            json={
                "type": "invalid",
                "data": {"x": 100, "y": 100}
            },
            headers=auth_headers
        )

        assert response.status_code == 422

    def test_get_annotations_for_image(self, client, auth_headers, test_image, test_annotation):
        """Test getting all annotations for an image"""
        response = client.get(
            f"/api/v1/images/{test_image.id}/annotations",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        # Should include our test annotation
        assert any(ann["id"] == str(test_annotation.id) for ann in data)

    def test_get_annotation_by_id(self, client, auth_headers, test_annotation):
        """Test getting a specific annotation"""
        response = client.get(
            f"/api/v1/annotations/{test_annotation.id}",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_annotation.id)
        assert data["type"] == "circle"

    def test_get_nonexistent_annotation(self, client, auth_headers):
        """Test getting annotation that doesn't exist"""
        fake_id = str(uuid4())
        response = client.get(
            f"/api/v1/annotations/{fake_id}",
            headers=auth_headers
        )

        assert response.status_code == 404

    def test_update_annotation(self, client, auth_headers, test_annotation):
        """Test updating an annotation"""
        response = client.put(
            f"/api/v1/annotations/{test_annotation.id}",
            json={
                "data": {"x": 150, "y": 150, "size": 60},
                "class_label": "rock"
            },
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["data"]["x"] == 150
        assert data["data"]["y"] == 150
        assert data["data"]["size"] == 60
        assert data["class_label"] == "rock"

    def test_update_annotation_class_only(self, client, auth_headers, test_annotation):
        """Test updating only the class label"""
        response = client.put(
            f"/api/v1/annotations/{test_annotation.id}",
            json={
                "class_label": "water"
            },
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["class_label"] == "water"
        # Original data should be unchanged
        assert data["data"]["x"] == 100

    def test_delete_annotation(self, client, auth_headers, test_image, db_session):
        """Test deleting an annotation"""
        # Create an annotation to delete
        from app.models.annotation import Annotation
        annotation = Annotation(
            image_id=test_image.id,
            type="circle",
            data={"x": 50, "y": 50, "size": 25},
            source="manual"
        )
        db_session.add(annotation)
        db_session.commit()
        db_session.refresh(annotation)
        annotation_id = annotation.id

        response = client.delete(
            f"/api/v1/annotations/{annotation_id}",
            headers=auth_headers
        )

        assert response.status_code == 204

        # Verify deletion
        response = client.get(
            f"/api/v1/annotations/{annotation_id}",
            headers=auth_headers
        )
        assert response.status_code == 404

    def test_delete_nonexistent_annotation(self, client, auth_headers):
        """Test deleting annotation that doesn't exist"""
        fake_id = str(uuid4())
        response = client.delete(
            f"/api/v1/annotations/{fake_id}",
            headers=auth_headers
        )

        assert response.status_code == 404

    def test_create_multiple_annotations(self, client, auth_headers, test_image):
        """Test creating multiple annotations for same image"""
        annotations = [
            {"type": "circle", "data": {"x": 100, "y": 100, "size": 50}},
            {"type": "circle", "data": {"x": 200, "y": 200, "size": 40}},
            {"type": "box", "data": {"corners": [[50, 50], [100, 50], [100, 100], [50, 100]]}},
        ]

        created_ids = []
        for ann_data in annotations:
            response = client.post(
                f"/api/v1/images/{test_image.id}/annotations",
                json=ann_data,
                headers=auth_headers
            )
            assert response.status_code == 201
            created_ids.append(response.json()["id"])

        # Verify all were created
        response = client.get(
            f"/api/v1/images/{test_image.id}/annotations",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3


class TestAnnotationValidation:
    """Tests for annotation data validation"""

    def test_circle_missing_fields(self, client, auth_headers, test_image):
        """Test circle annotation with missing required fields"""
        response = client.post(
            f"/api/v1/images/{test_image.id}/annotations",
            json={
                "type": "circle",
                "data": {"x": 100, "y": 100}  # Missing 'size'
            },
            headers=auth_headers
        )

        assert response.status_code == 400

    def test_box_invalid_corners(self, client, auth_headers, test_image):
        """Test box annotation with wrong number of corners"""
        response = client.post(
            f"/api/v1/images/{test_image.id}/annotations",
            json={
                "type": "box",
                "data": {"corners": [[0, 0], [100, 100]]}  # Need 4 corners
            },
            headers=auth_headers
        )

        assert response.status_code == 400

    def test_polygon_too_few_points(self, client, auth_headers, test_image):
        """Test polygon with less than 3 points"""
        response = client.post(
            f"/api/v1/images/{test_image.id}/annotations",
            json={
                "type": "polygon",
                "data": {"points": [[0, 0], [100, 100]]}  # Need at least 3
            },
            headers=auth_headers
        )

        assert response.status_code == 400
