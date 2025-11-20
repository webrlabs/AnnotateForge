"""Tests for audit logging"""
import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.services.audit_service import AuditService


def test_audit_service_log_create(db_session: Session, test_user, test_project, test_image):
    """Test logging a create action"""
    resource_id = uuid4()

    audit_entry = AuditService.log_create(
        db=db_session,
        user=test_user,
        resource_type="annotation",
        resource_id=resource_id,
        data={"type": "circle", "x": 100, "y": 100}
    )

    db_session.commit()

    assert audit_entry.user_id == test_user.id
    assert audit_entry.action == "create"
    assert audit_entry.resource_type == "annotation"
    assert audit_entry.resource_id == resource_id
    assert audit_entry.changes["created"]["type"] == "circle"


def test_audit_service_log_update(db_session: Session, test_user):
    """Test logging an update action"""
    resource_id = uuid4()

    audit_entry = AuditService.log_update(
        db=db_session,
        user=test_user,
        resource_type="annotation",
        resource_id=resource_id,
        old_data={"class_label": "old_label"},
        new_data={"class_label": "new_label"}
    )

    db_session.commit()

    assert audit_entry.action == "update"
    assert audit_entry.changes["old"]["class_label"] == "old_label"
    assert audit_entry.changes["new"]["class_label"] == "new_label"


def test_audit_service_log_delete(db_session: Session, test_user):
    """Test logging a delete action"""
    resource_id = uuid4()

    audit_entry = AuditService.log_delete(
        db=db_session,
        user=test_user,
        resource_type="annotation",
        resource_id=resource_id,
        data={"type": "polygon", "class_label": "particle"}
    )

    db_session.commit()

    assert audit_entry.action == "delete"
    assert audit_entry.changes["deleted"]["type"] == "polygon"


def test_annotation_create_logs_audit(client: TestClient, auth_token, test_project, test_image, db_session: Session):
    """Test that creating an annotation logs to audit_log"""
    # Count initial audit log entries
    initial_count = db_session.query(AuditLog).count()

    # Create annotation
    response = client.post(
        f"/api/v1/annotations/images/{test_image.id}/annotations",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={
            "type": "circle",
            "data": {"x": 100, "y": 100, "size": 50},
            "source": "manual",
            "class_label": "particle"
        }
    )

    assert response.status_code == 201

    # Verify audit log was created
    final_count = db_session.query(AuditLog).count()
    assert final_count == initial_count + 1

    # Verify audit log details
    audit_entry = db_session.query(AuditLog).order_by(AuditLog.timestamp.desc()).first()
    assert audit_entry.action == "create"
    assert audit_entry.resource_type == "annotation"
    assert audit_entry.changes["created"]["type"] == "circle"


def test_annotation_update_logs_audit(
    client: TestClient,
    auth_token,
    test_project,
    test_image,
    test_annotation,
    db_session: Session
):
    """Test that updating an annotation logs to audit_log"""
    initial_count = db_session.query(AuditLog).count()

    # Update annotation
    response = client.put(
        f"/api/v1/annotations/{test_annotation.id}",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={
            "class_label": "updated_label"
        }
    )

    assert response.status_code == 200

    # Verify audit log was created
    final_count = db_session.query(AuditLog).count()
    assert final_count == initial_count + 1

    # Verify audit log details
    audit_entry = db_session.query(AuditLog).order_by(AuditLog.timestamp.desc()).first()
    assert audit_entry.action == "update"
    assert audit_entry.resource_type == "annotation"
    assert audit_entry.changes["new"]["class_label"] == "updated_label"


def test_annotation_delete_logs_audit(
    client: TestClient,
    auth_token,
    test_project,
    test_image,
    test_annotation,
    db_session: Session
):
    """Test that deleting an annotation logs to audit_log"""
    initial_count = db_session.query(AuditLog).count()
    annotation_id = test_annotation.id

    # Delete annotation
    response = client.delete(
        f"/api/v1/annotations/{annotation_id}",
        headers={"Authorization": f"Bearer {auth_token}"}
    )

    assert response.status_code == 204

    # Verify audit log was created
    final_count = db_session.query(AuditLog).count()
    assert final_count == initial_count + 1

    # Verify audit log details
    audit_entry = db_session.query(AuditLog).order_by(AuditLog.timestamp.desc()).first()
    assert audit_entry.action == "delete"
    assert audit_entry.resource_type == "annotation"
    assert str(audit_entry.resource_id) == str(annotation_id)
