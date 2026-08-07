import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import uuid

from main import app
from database import get_db
from models import Base, User, KBCard
from auth import hash_password
# Test database URL (force defaults; allow override via TEST_* or TEST_DATABASE_URL)
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
if not TEST_DATABASE_URL:
    test_host = os.environ.get("TEST_POSTGRES_HOST", "localhost")
    test_port = os.environ.get("TEST_POSTGRES_PORT", "5434")
    test_user = os.environ.get("TEST_POSTGRES_USER", "watanbot")
    test_password = os.environ.get("TEST_POSTGRES_PASSWORD", "changeme")
    test_db = os.environ.get("TEST_POSTGRES_DB", "watanbot_test")
    TEST_DATABASE_URL = f"postgresql://{test_user}:{test_password}@{test_host}:{test_port}/{test_db}"

engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    """Create a fresh database for each test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    """Create a test client with database dependency override."""
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def superadmin_user(db):
    """Create a superadmin user for testing."""
    user = User(
        id=uuid.uuid4(),
        email="superadmin@test.local",
        password_hash=hash_password("testpassword"),
        role="superadmin",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin_user(db):
    """Create an admin user for testing."""
    user = User(
        id=uuid.uuid4(),
        email="admin@test.local",
        password_hash=hash_password("testpassword"),
        role="admin",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def superadmin_token(client, superadmin_user):
    """Get JWT token for superadmin user."""
    response = client.post("/auth/login", json={
        "email": "superadmin@test.local",
        "password": "testpassword"
    })
    return response.json()["access_token"]


@pytest.fixture
def admin_token(client, admin_user):
    """Get JWT token for admin user."""
    response = client.post("/auth/login", json={
        "email": "admin@test.local",
        "password": "testpassword"
    })
    return response.json()["access_token"]


@pytest.fixture
def sample_kb_card(db):
    """Create a sample published KB card."""
    card = KBCard(
        id=uuid.uuid4(),
        slug="test-card",
        status="published",
        locales={
            "en": {
                "title": "Test Card",
                "summary": "This is a test card summary",
                "body": "This is the detailed body of the test card",
                "tags": ["test", "sample"]
            },
            "ar": {
                "title": "بطاقة اختبار",
                "summary": "هذا ملخص بطاقة الاختبار",
                "body": "هذا هو النص التفصيلي لبطاقة الاختبار",
                "tags": ["اختبار", "عينة"]
            }
        },
        sources={"url": "https://example.com"},
        version=1
    )
    db.add(card)
    db.commit()
    db.refresh(card)

    db.execute(
        text("UPDATE kb_cards SET fts = to_tsvector('simple', :content) WHERE id = :id"),
        {
            "content": "test card summary بطاقة اختبار ملخص بطاقة الاختبار",
            "id": card.id,
        },
    )
    db.commit()
    return card
