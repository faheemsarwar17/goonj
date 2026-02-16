"""Speaker schemas for API requests and responses"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class SpeakerSegmentBase(BaseModel):
    """Base speaker segment schema"""
    start_time: float = Field(..., ge=0)
    end_time: float = Field(..., gt=0)
    text: str = Field(..., min_length=1)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class SpeakerSegmentCreate(SpeakerSegmentBase):
    """Schema for creating a speaker segment"""
    pass


class SpeakerSegmentResponse(SpeakerSegmentBase):
    """Schema for speaker segment response"""
    id: int
    speaker_id: int
    transcript_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class SpeakerBase(BaseModel):
    """Base speaker schema"""
    speaker_label: str = Field(..., max_length=50)
    speaker_name: Optional[str] = Field(None, max_length=100)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class SpeakerCreate(SpeakerBase):
    """Schema for creating a speaker"""
    transcript_id: int
    segments: List[SpeakerSegmentCreate] = Field(default_factory=list)


class SpeakerUpdate(BaseModel):
    """Schema for updating a speaker"""
    speaker_name: Optional[str] = Field(None, max_length=100)


class SpeakerResponse(SpeakerBase):
    """Schema for speaker response"""
    id: int
    transcript_id: int
    tenant_id: int
    total_speaking_time: float
    created_at: datetime
    updated_at: datetime
    segments: List[SpeakerSegmentResponse] = Field(default_factory=list)
    
    class Config:
        from_attributes = True


class DiarizationRequest(BaseModel):
    """Schema for requesting diarization of a transcript"""
    transcript_id: int
    min_speakers: Optional[int] = Field(default=1, ge=1, le=10)
    max_speakers: Optional[int] = Field(default=10, ge=1, le=20)


class DiarizationResponse(BaseModel):
    """Schema for diarization response"""
    transcript_id: int
    speakers: List[SpeakerResponse]
    total_speakers: int
    processing_time: float  # in seconds
