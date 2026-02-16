"""Transcript model"""

from datetime import datetime
from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database.session import Base


class Transcript(Base):
    """
    Transcript model for storing transcription data
    
    Attributes:
        id: Primary key
        session_id: Foreign key to recording session (one-to-one)
        tenant_id: Foreign key to tenant
        content: Full transcript text
        transcript_metadata: JSON field for additional data (speaker diarization, timestamps, etc.)
        created_at: Timestamp of creation
        updated_at: Timestamp of last update
    """
    
    __tablename__ = "transcripts"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("recording_sessions.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    transcript_metadata = Column(JSON, nullable=True, default={})
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    session = relationship("RecordingSession", back_populates="transcript")
    tenant = relationship("Tenant", back_populates="transcripts")
    speakers = relationship("Speaker", back_populates="transcript", cascade="all, delete-orphan")
    segments = relationship("SpeakerSegment", back_populates="transcript", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<Transcript(id={self.id}, session_id={self.session_id})>"
