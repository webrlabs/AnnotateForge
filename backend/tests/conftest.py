"""
Test fixtures and configuration for pytest
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import numpy as np
from PIL import Image
import io

from app.main import app
from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.models.user import User
from app.models.project import Project
from app.models.image import Image as ImageModel
from app.models.annotation import Annotation


# Test database URL (in-memory SQLite)
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

# Create test engine
engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Test session factory
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test"""
    # Create all tables
    Base.metadata.create_all(bind=engine)

    # Create session
    session = TestingSessionLocal()

    try:
        yield session
    finally:
        session.close()
        # Drop all tables after test
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with database override"""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db_session):
    """Create a test user"""
    from app.core.security import get_password_hash

    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=get_password_hash("testpass123"),
        is_active=True,
        is_admin=False
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def admin_user(db_session):
    """Create an admin test user"""
    from app.core.security import get_password_hash

    user = User(
        username="admin",
        email="admin@example.com",
        hashed_password=get_password_hash("adminpass123"),
        is_active=True,
        is_admin=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_token(test_user):
    """Create an auth token for test user"""
    return create_access_token(data={"sub": str(test_user.id)})


@pytest.fixture
def auth_headers(auth_token):
    """Create authorization headers"""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def admin_token(admin_user):
    """Create an auth token for admin user"""
    return create_access_token(data={"sub": str(admin_user.id)})


@pytest.fixture
def admin_headers(admin_token):
    """Create admin authorization headers"""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def test_project(db_session, test_user):
    """Create a test project"""
    project = Project(
        name="Test Project",
        description="A test project",
        classes=["particle", "rock", "water"],
        created_by=test_user.id
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project


@pytest.fixture
def test_image(db_session, test_project, test_user):
    """Create a test image"""
    image = ImageModel(
        project_id=test_project.id,
        filename="test_image.png",
        original_path="/storage/test_image.png",
        thumbnail_path="/storage/thumbnails/test_image.jpg",
        width=1920,
        height=1080,
        file_size=1024000,
        format="PNG",
        uploaded_by=test_user.id
    )
    db_session.add(image)
    db_session.commit()
    db_session.refresh(image)
    return image


@pytest.fixture
def test_annotation(db_session, test_image):
    """Create a test annotation"""
    annotation = Annotation(
        image_id=test_image.id,
        type="circle",
        data={"x": 100, "y": 100, "size": 50},
        source="manual",
        class_label="particle",
        confidence=None
    )
    db_session.add(annotation)
    db_session.commit()
    db_session.refresh(annotation)
    return annotation


@pytest.fixture
def test_numpy_image():
    """Create a test numpy image (RGB)"""
    # Create a 256x256 RGB image
    image = np.random.randint(0, 255, (256, 256, 3), dtype=np.uint8)
    return image


@pytest.fixture
def test_pil_image():
    """Create a test PIL image"""
    # Create a 256x256 RGB image
    image = Image.new('RGB', (256, 256), color='white')
    return image


@pytest.fixture
def test_image_bytes():
    """Create test image as bytes (PNG format)"""
    image = Image.new('RGB', (256, 256), color='blue')
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer.getvalue()


@pytest.fixture
def mock_sam2_results():
    """Mock SAM2 inference results"""
    return [
        {
            "type": "polygon",
            "data": {
                "points": [[10, 10], [50, 10], [50, 50], [10, 50]]
            },
            "confidence": 0.95,
            "source": "sam2"
        }
    ]


@pytest.fixture
def mock_yolo_results():
    """Mock YOLO inference results"""
    return [
        {
            "type": "box",
            "data": {
                "corners": [[100, 100], [200, 100], [200, 200], [100, 200]]
            },
            "confidence": 0.85,
            "source": "yolo",
            "class_label": "particle"
        }
    ]


@pytest.fixture
def mock_simpleblob_results():
    """Mock SimpleBlob detection results"""
    return [
        {
            "type": "circle",
            "data": {"x": 128, "y": 128, "size": 25},
            "confidence": 0.8,
            "source": "simpleblob"
        }
    ]
