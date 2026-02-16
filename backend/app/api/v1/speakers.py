"""Speaker diarization API endpoints"""

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.dependencies import get_current_user
from app.services.speaker_service import SpeakerService
from app.schemas.speaker import (
    SpeakerCreate, SpeakerUpdate, SpeakerResponse,
    DiarizationRequest, DiarizationResponse
)
from app.schemas.common import MessageResponse
from app.models.user import User


router = APIRouter(prefix="/speakers", tags=["Speakers & Diarization"])


@router.get("/transcript/{transcript_id}", response_model=List[SpeakerResponse])
async def get_transcript_speakers(
    transcript_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all speakers for a transcript
    Returns speakers with their segments ordered by time
    """
    speaker_service = SpeakerService(db)
    return speaker_service.get_speakers_by_transcript(
        transcript_id,
        current_user.id,
        current_user.role,
        current_user.tenant_id
    )


@router.post("/", response_model=SpeakerResponse, status_code=status.HTTP_201_CREATED)
async def create_speaker(
    speaker_data: SpeakerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new speaker with segments
    Used for manually adding or correcting speaker identification
    """
    speaker_service = SpeakerService(db)
    return speaker_service.create_speaker(
        speaker_data,
        current_user.id,
        current_user.role,
        current_user.tenant_id
    )


@router.patch("/{speaker_id}", response_model=SpeakerResponse)
async def update_speaker_name(
    speaker_id: int,
    update_data: SpeakerUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update speaker name
    Allows users to assign human-readable names to identified speakers
    """
    speaker_service = SpeakerService(db)
    return speaker_service.update_speaker_name(
        speaker_id,
        update_data,
        current_user.id,
        current_user.role,
        current_user.tenant_id
    )


@router.delete("/{speaker_id}", response_model=MessageResponse)
async def delete_speaker(
    speaker_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a speaker and all its segments
    """
    speaker_service = SpeakerService(db)
    speaker_service.delete_speaker(
        speaker_id,
        current_user.id,
        current_user.role,
        current_user.tenant_id
    )
    return MessageResponse(message="Speaker deleted successfully")


@router.post("/diarize", response_model=DiarizationResponse)
async def perform_diarization(
    request: DiarizationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Perform speaker diarization on a transcript
    
    This endpoint analyzes the audio to identify and separate different speakers.
    The diarization process:
    1. Analyzes the audio waveform
    2. Identifies when different speakers are talking
    3. Creates speaker labels and time-stamped segments
    
    NOTE: This is a placeholder. In production, this would integrate with
    a real diarization service like pyannote.audio or AssemblyAI.
    """
    speaker_service = SpeakerService(db)
    return speaker_service.perform_diarization(
        request,
        current_user.id,
        current_user.role,
        current_user.tenant_id
    )
