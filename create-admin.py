#!/usr/bin/env python3
"""
Create admin user for LabelFlow
Run this script after database migrations
"""

import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash


def create_admin_user(username="admin", password="admin", email="admin@labelflow.com"):
    """Create admin user"""
    db = SessionLocal()

    try:
        # Check if user already exists
        existing = db.query(User).filter(User.username == username).first()

        if existing:
            print(f"❌ User '{username}' already exists")
            print(f"   Email: {existing.email}")
            print(f"   Is Admin: {existing.is_admin}")
            return False

        # Create new admin user
        admin = User(
            username=username,
            email=email,
            hashed_password=get_password_hash(password),
            is_admin=True,
            is_active=True
        )

        db.add(admin)
        db.commit()

        print("✅ Admin user created successfully!")
        print(f"   Username: {username}")
        print(f"   Password: {password}")
        print(f"   Email: {email}")
        print("")
        print("⚠️  IMPORTANT: Change the password after first login!")

        return True

    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        db.rollback()
        return False

    finally:
        db.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Create LabelFlow admin user")
    parser.add_argument("--username", default="admin", help="Admin username (default: admin)")
    parser.add_argument("--password", default="admin", help="Admin password (default: admin)")
    parser.add_argument("--email", default="admin@labelflow.com", help="Admin email")

    args = parser.parse_args()

    print("======================================")
    print("LabelFlow - Create Admin User")
    print("======================================")
    print("")

    success = create_admin_user(args.username, args.password, args.email)

    sys.exit(0 if success else 1)
