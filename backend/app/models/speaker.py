"""Speaker model for diarization"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from app.database.session import Base


class Speaker(Base):
    """
    Speaker model for storing identified speakers in recordings
    
    Attributes:
        id: Primary key
        transcript_id: Foreign key to transcript
        tenant_id: Foreign key to tenant
        speaker_label: Unique identifier for the speaker (e.g., "SPEAKER_00", "SPEAKER_01")
        speaker_name: Optional human-readable name assigned to speaker
        confidence: Confidence score for speaker identification (0-1)
        total_speaking_time: Total time in seconds this speaker spoke
        created_at: Timestamp of creation
        updated_at: Timestamp of last update
    """
    
    __tablename__ = "speakers"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    transcript_id = Column(Integer, ForeignKey("transcripts.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    speaker_label = Column(String(50), nullable=False)  # SPEAKER_00, SPEAKER_01, etc.
    speaker_name = Column(String(100), nullable=True)  # User-assigned name
    confidence = Column(Float, nullable=False, default=0.0)
    total_speaking_time = Column(Float, nullable=False, default=0.0)  # in seconds
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    transcript = relationship("Transcript", back_populates="speakers")
    tenant = relationship("Tenant", back_populates="speakers")
    segments = relationship("SpeakerSegment", back_populates="speaker", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<Speaker(id={self.id}, label={self.speaker_label}, name={self.speaker_name})>"
