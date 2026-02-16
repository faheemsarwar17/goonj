"""Speaker repository for database operations"""

from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.speaker import Speaker
from app.models.speaker_segment import SpeakerSegment
from app.repositories.base import BaseRepository


class SpeakerRepository(BaseRepository[Speaker]):
    """Repository for speaker database operations"""
    
    def __init__(self, db: Session):
        super().__init__(Speaker, db)
    
    def get_by_transcript(self, transcript_id: int, tenant_id: int) -> List[Speaker]:
        """Get all speakers for a transcript"""
        return (
            self.db.query(Speaker)
            .filter(Speaker.transcript_id == transcript_id, Speaker.tenant_id == tenant_id)
            .all()
        )
    
    def get_by_label(self, transcript_id: int, speaker_label: str, tenant_id: int) -> Optional[Speaker]:
        """Get speaker by label for a transcript"""
        return (
            self.db.query(Speaker)
            .filter(
                Speaker.transcript_id == transcript_id,
                Speaker.speaker_label == speaker_label,
                Speaker.tenant_id == tenant_id
            )
            .first()
        )
    
    def update_name(self, speaker_id: int, name: str, tenant_id: int) -> Optional[Speaker]:
        """Update speaker name"""
        speaker = self.get_with_tenant_check(speaker_id, tenant_id)
        if speaker:
            speaker.speaker_name = name
            self.db.commit()
            self.db.refresh(speaker)
        return speaker
    
    def calculate_speaking_time(self, speaker_id: int) -> float:
        """Calculate total speaking time from segments"""
        segments = (
            self.db.query(SpeakerSegment)
            .filter(SpeakerSegment.speaker_id == speaker_id)
            .all()
        )
        return sum((seg.end_time - seg.start_time) for seg in segments)


class SpeakerSegmentRepository(BaseRepository[SpeakerSegment]):
    """Repository for speaker segment database operations"""
    
    def __init__(self, db: Session):
        super().__init__(SpeakerSegment, db)
    
    def get_by_speaker(self, speaker_id: int) -> List[SpeakerSegment]:
        """Get all segments for a speaker"""
        return (
            self.db.query(SpeakerSegment)
            .filter(SpeakerSegment.speaker_id == speaker_id)
            .order_by(SpeakerSegment.start_time)
            .all()
        )
    
    def get_by_transcript(self, transcript_id: int) -> List[SpeakerSegment]:
        """Get all segments for a transcript"""
        return (
            self.db.query(SpeakerSegment)
            .filter(SpeakerSegment.transcript_id == transcript_id)
            .order_by(SpeakerSegment.start_time)
            .all()
        )
    
    def create_segments(self, segments_data: List[dict]) -> List[SpeakerSegment]:
        """Create multiple segments at once"""
        segments = [SpeakerSegment(**data) for data in segments_data]
        self.db.add_all(segments)
        self.db.commit()
        for segment in segments:
            self.db.refresh(segment)
        return segments
