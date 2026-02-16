"""Transcript endpoints"""

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.dependencies import get_current_user
from app.services.transcript_service import TranscriptService
from app.schemas.transcript import TranscriptCreate, TranscriptResponse, TranscriptUpdate
from app.schemas.common import MessageResponse
from app.models.user import User


router = APIRouter(prefix="/transcripts", tags=["Transcripts"])


@router.get("", response_model=List[TranscriptResponse])
async def get_all_transcripts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all transcripts for current user/tenant
    """
    transcript_service = TranscriptService(db)
    return transcript_service.get_all_transcripts(
        current_user.id,
        current_user.role,
        current_user.tenant_id
    )


@router.post("", response_model=TranscriptResponse, status_code=status.HTTP_201_CREATED)
async def create_transcript(
    transcript_data: TranscriptCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a transcript for a session
    """
    transcript_service = TranscriptService(db)
    return transcript_service.create_transcript(
        transcript_data,
        current_user.id,
        current_user.role,
        current_user.tenant_id
    )


@router.get("/session/{session_id}", response_model=TranscriptResponse)
async def get_transcript_by_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get transcript for a specific session
    """
    transcript_service = TranscriptService(db)
    return transcript_service.get_transcript_by_session(
        session_id,
        current_user.id,
        current_user.role,
        current_user.tenant_id
    )


@router.get("/{transcript_id}", response_model=TranscriptResponse)
async def get_transcript(
    transcript_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get transcript by ID
    """
    transcript_service = TranscriptService(db)
    return transcript_service.get_transcript(
        transcript_id,
        current_user.id,
        current_user.role,
        current_user.tenant_id
    )


@router.put("/{transcript_id}", response_model=TranscriptResponse)
async def update_transcript(
    transcript_id: int,
    update_data: TranscriptUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update transcript content or metadata
    """
    transcript_service = TranscriptService(db)
    return transcript_service.update_transcript(
        transcript_id,
        update_data,
        current_user.id,
        current_user.role,
        current_user.tenant_id
    )


@router.delete("/{transcript_id}", response_model=MessageResponse)
async def delete_transcript(
    transcript_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a transcript
    """
    transcript_service = TranscriptService(db)
    transcript_service.delete_transcript(
        transcript_id,
        current_user.id,
        current_user.role,
        current_user.tenant_id
    )
    return MessageResponse(message="Transcript deleted successfully")
