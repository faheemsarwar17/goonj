"""User model for authentication and authorization"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.database.session import Base
from app.models.enums import UserRole


class User(Base):
    """
    User model for authentication and RBAC
    
    Attributes:
        id: Primary key
        tenant_id: Foreign key to tenant
        email: User email (unique)
        hashed_password: Bcrypt hashed password
        full_name: User's full name
        role: User role (admin/user)
        is_approved: Whether user signup has been approved by admin
        is_active: Whether the user account is active
        created_at: Timestamp of creation
        updated_at: Timestamp of last update
    """
    
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False)
    is_approved = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    sessions = relationship("RecordingSession", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', role={self.role})>"
