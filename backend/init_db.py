"""
Database initialization script
Creates tables, default tenant, and first admin user
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.orm import Session
from app.database.session import engine, Base, SessionLocal
from app.models import Tenant, User
from app.models.enums import UserRole
from app.core.security import security
from app.core.config import settings


def create_tables():
    """Create all database tables"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✓ Tables created successfully")


def create_default_tenant(db: Session) -> Tenant:
    """Create default tenant if it doesn't exist"""
    print("\nCreating default tenant...")
    
    # Check if tenant already exists
    existing_tenant = db.query(Tenant).filter(Tenant.name == "Default Organization").first()
    if existing_tenant:
        print(f"✓ Default tenant already exists (ID: {existing_tenant.id})")
        return existing_tenant
    
    # Create new tenant
    tenant = Tenant(
        name="Default Organization",
        configuration={
            "max_users": 100,
            "max_storage_gb": 50,
            "features": ["audio_recording", "transcription", "speaker_diarization"]
        },
        is_active=True
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    
    print(f"✓ Default tenant created (ID: {tenant.id})")
    return tenant


def create_admin_user(db: Session, tenant_id: int):
    """Create first admin user if it doesn't exist"""
    print("\nCreating admin user...")
    
    # Get admin credentials from environment
    admin_email = getattr(settings, 'FIRST_ADMIN_EMAIL', 'admin@example.com')
    admin_password = getattr(settings, 'FIRST_ADMIN_PASSWORD', 'changeme')
    admin_name = getattr(settings, 'FIRST_ADMIN_NAME', 'System Administrator')
    
    # Check if admin already exists
    existing_admin = db.query(User).filter(User.email == admin_email).first()
    if existing_admin:
        print(f"✓ Admin user already exists: {admin_email}")
        return existing_admin
    
    # Create admin user
    hashed_password = security.get_password_hash(admin_password)
    admin_user = User(
        email=admin_email,
        full_name=admin_name,
        hashed_password=hashed_password,
        tenant_id=tenant_id,
        role=UserRole.ADMIN,
        is_approved=True,  # Admin is pre-approved
        is_active=True
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)
    
    print(f"✓ Admin user created")
    print(f"  Email: {admin_email}")
    print(f"  ⚠️  IMPORTANT: Change the default password after first login!")
    
    return admin_user


def init_database():
    """Initialize the database with tables, tenant, and admin user"""
    print("=" * 60)
    print("Audio Transcript Application - Database Initialization")
    print("=" * 60)
    
    try:
        # Create tables
        create_tables()
        
        # Create database session
        db = SessionLocal()
        
        try:
            # Create default tenant
            tenant = create_default_tenant(db)
            
            # Create admin user
            admin_user = create_admin_user(db, tenant.id)
            
            print("\n" + "=" * 60)
            print("✓ Database initialization completed successfully!")
            print("=" * 60)
            print("\nYou can now:")
            print("1. Start the backend server: uvicorn app.main:app --reload")
            print("2. Login with the admin credentials shown above")
            print("3. Create additional users through the admin panel")
            print("\n" + "=" * 60)
            
        finally:
            db.close()
            
    except Exception as e:
        print(f"\n✗ Error during initialization: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    init_database()
