"""Speaker segment model for storing time-stamped speech segments"""

from datetime import datetime
from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from app.database.session import Base


class SpeakerSegment(Base):
    """
    Speaker segment model for storing individual speech segments with timestamps
    
    Attributes:
        id: Primary key
        speaker_id: Foreign key to speaker
        transcript_id: Foreign key to transcript
        start_time: Start time of segment in seconds
        end_time: End time of segment in seconds
        text: Transcribed text for this segment
        confidence: Confidence score for this segment
        created_at: Timestamp of creation
    """
    
    __tablename__ = "speaker_segments"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    speaker_id = Column(Integer, ForeignKey("speakers.id", ondelete="CASCADE"), nullable=False, index=True)
    transcript_id = Column(Integer, ForeignKey("transcripts.id", ondelete="CASCADE"), nullable=False, index=True)
    start_time = Column(Float, nullable=False)  # in seconds
    end_time = Column(Float, nullable=False)  # in seconds
    text = Column(Text, nullable=False)
    confidence = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    speaker = relationship("Speaker", back_populates="segments")
    transcript = relationship("Transcript", back_populates="segments")
    
    def __repr__(self) -> str:
        return f"<SpeakerSegment(id={self.id}, speaker={self.speaker_id}, time={self.start_time}-{self.end_time})>"
    
    @property
    def duration(self) -> float:
        """Calculate segment duration in seconds"""
        return self.end_time - self.start_time
