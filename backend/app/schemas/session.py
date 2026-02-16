"""Recording session schemas"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.enums import SessionStatus, AudioSource


class SessionBase(BaseModel):
    """Base session schema"""
    title: str = Field(..., min_length=1, max_length=255)
    audio_source: AudioSource = AudioSource.MICROPHONE


class SessionCreate(SessionBase):
    """Schema for starting a recording session"""
    pass


class SessionEnd(BaseModel):
    """Schema for ending a recording session"""
    duration_seconds: Optional[int] = Field(None, ge=0)


class SessionUpdate(BaseModel):
    """Schema for updating a session"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[SessionStatus] = None


class SessionResponse(SessionBase):
    """Schema for session response"""
    id: int
    tenant_id: int
    user_id: int
    audio_file_path: Optional[str]
    duration_seconds: Optional[int]
    file_size_bytes: Optional[int]
    status: SessionStatus
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class SessionWithTranscript(SessionResponse):
    """Session response with transcript included"""
    transcript: Optional[str] = None
