"""Tenant/Client model for multi-tenancy"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from app.database.session import Base


class Tenant(Base):
    """
    Tenant model for multi-tenancy support
    
    Attributes:
        id: Primary key
        name: Tenant/client name
        configuration: JSON field for client-level settings
        is_active: Whether the tenant is active
        created_at: Timestamp of creation
        updated_at: Timestamp of last update
    """
    
    __tablename__ = "tenants"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    configuration = Column(JSON, nullable=True, default={})
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    sessions = relationship("RecordingSession", back_populates="tenant", cascade="all, delete-orphan")
    transcripts = relationship("Transcript", back_populates="tenant", cascade="all, delete-orphan")
    speakers = relationship("Speaker", back_populates="tenant", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<Tenant(id={self.id}, name='{self.name}', is_active={self.is_active})>"
