"""Transcript schemas"""

from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class TranscriptBase(BaseModel):
    """Base transcript schema"""
    content: str = Field(default="")
    transcript_metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class TranscriptCreate(TranscriptBase):
    """Schema for creating a transcript"""
    session_id: int


class TranscriptUpdate(BaseModel):
    """Schema for updating a transcript"""
    content: Optional[str] = Field(None)
    transcript_metadata: Optional[Dict[str, Any]] = None


class TranscriptResponse(TranscriptBase):
    """Schema for transcript response"""
    id: int
    session_id: int
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
