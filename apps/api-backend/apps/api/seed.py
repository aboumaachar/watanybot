"""
Seed script to create initial superadmin user.
Run with: python -m apps.api.seed
"""
import uuid
from database import get_db_context
from models import User
from auth import hash_password
from config import settings
import structlog

logger = structlog.get_logger()


def seed_superadmin():
    """Create superadmin user if it doesn't exist."""
    if not settings.superadmin_email or not settings.superadmin_password:
        raise ValueError("SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set before seeding")
    with get_db_context() as db:
        # Check if superadmin exists
        existing = db.query(User).filter(User.email == settings.superadmin_email).first()
        
        if existing:
            logger.info("superadmin_exists", email=settings.superadmin_email)
            print(f"Superadmin already exists: {settings.superadmin_email}")
            return
        
        # Create superadmin
        superadmin = User(
            id=uuid.uuid4(),
            email=settings.superadmin_email,
            password_hash=hash_password(settings.superadmin_password),
            role="superadmin",
            is_active=True
        )
        db.add(superadmin)
        db.commit()
        
        logger.info("superadmin_created", email=settings.superadmin_email)
        print(f"✓ Superadmin created: {settings.superadmin_email}")


if __name__ == "__main__":
    seed_superadmin()
