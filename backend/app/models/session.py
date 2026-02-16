"""Recording session model"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, BigInteger, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.database.session import Base
from app.models.enums import SessionStatus, AudioSource


class RecordingSession(Base):
    """
    Recording session model
    
    Attributes:
        id: Primary key
        tenant_id: Foreign key to tenant
        user_id: Foreign key to user (creator)
        title: Session title
        audio_file_path: Relative path to the audio file on server
        audio_source: Type of audio source (device/microphone/both)
        duration_seconds: Duration of recording in seconds
        file_size_bytes: Size of audio file in bytes
        status: Current status of the session
        started_at: Timestamp when recording started
        ended_at: Timestamp when recording ended
        created_at: Timestamp of creation
        updated_at: Timestamp of last update
    """
    
    __tablename__ = "recording_sessions"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    audio_file_path = Column(String(500), nullable=True)
    audio_source = Column(Enum(AudioSource), default=AudioSource.MICROPHONE, nullable=False)
    duration_seconds = Column(Integer, nullable=True)
    file_size_bytes = Column(BigInteger, nullable=True)
    status = Column(Enum(SessionStatus), default=SessionStatus.RECORDING, nullable=False, index=True)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="sessions")
    user = relationship("User", back_populates="sessions")
    transcript = relationship("Transcript", back_populates="session", uselist=False, cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<RecordingSession(id={self.id}, title='{self.title}', status={self.status})>"
