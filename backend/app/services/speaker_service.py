"""Speaker diarization service"""

import time
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.repositories.speaker_repository import SpeakerRepository, SpeakerSegmentRepository
from app.repositories.transcript_repository import TranscriptRepository
from app.repositories.session_repository import SessionRepository
from app.schemas.speaker import (
    SpeakerCreate, SpeakerUpdate, SpeakerResponse,
    DiarizationRequest, DiarizationResponse,
    SpeakerSegmentResponse
)
from app.core.exceptions import NotFoundError, ValidationError, AuthorizationError
from app.models.enums import UserRole


class SpeakerService:
    """Service for speaker diarization operations"""
    
    def __init__(self, db: Session):
        self.db = db
        self.speaker_repo = SpeakerRepository(db)
        self.segment_repo = SpeakerSegmentRepository(db)
        self.transcript_repo = TranscriptRepository(db)
        self.session_repo = SessionRepository(db)
    
    def get_speakers_by_transcript(
        self,
        transcript_id: int,
        user_id: int,
        user_role: UserRole,
        tenant_id: int
    ) -> List[SpeakerResponse]:
        """
        Get all speakers for a transcript
        
        Args:
            transcript_id: Transcript ID
            user_id: Requesting user ID
            user_role: User role
            tenant_id: Tenant ID
            
        Returns:
            List of speakers with their segments
            
        Raises:
            NotFoundError: If transcript not found
            AuthorizationError: If access denied
        """
        transcript = self.transcript_repo.get_with_tenant_check(transcript_id, tenant_id)
        
        if not transcript:
            raise NotFoundError("Transcript not found")
        
        # Check session access
        session = self.session_repo.get_by_id(transcript.session_id)
        if user_role != UserRole.ADMIN and session.user_id != user_id:
            raise AuthorizationError("Access denied")
        
        speakers = self.speaker_repo.get_by_transcript(transcript_id, tenant_id)
        
        # Load segments for each speaker
        result = []
        for speaker in speakers:
            segments = self.segment_repo.get_by_speaker(speaker.id)
            speaker_dict = SpeakerResponse.model_validate(speaker).model_dump()
            speaker_dict['segments'] = [SpeakerSegmentResponse.model_validate(seg) for seg in segments]
            result.append(SpeakerResponse(**speaker_dict))
        
        return result
    
    def create_speaker(
        self,
        speaker_data: SpeakerCreate,
        user_id: int,
        user_role: UserRole,
        tenant_id: int
    ) -> SpeakerResponse:
        """
        Create a new speaker with segments
        
        Args:
            speaker_data: Speaker creation data
            user_id: Requesting user ID
            user_role: User role
            tenant_id: Tenant ID
            
        Returns:
            Created speaker
            
        Raises:
            NotFoundError: If transcript not found
            AuthorizationError: If access denied
            ValidationError: If speaker already exists
        """
        transcript = self.transcript_repo.get_with_tenant_check(speaker_data.transcript_id, tenant_id)
        
        if not transcript:
            raise NotFoundError("Transcript not found")
        
        # Check session access
        session = self.session_repo.get_by_id(transcript.session_id)
        if user_role != UserRole.ADMIN and session.user_id != user_id:
            raise AuthorizationError("Access denied")
        
        # Check if speaker already exists
        existing = self.speaker_repo.get_by_label(
            speaker_data.transcript_id,
            speaker_data.speaker_label,
            tenant_id
        )
        if existing:
            raise ValidationError(f"Speaker {speaker_data.speaker_label} already exists")
        
        # Calculate total speaking time from segments
        total_time = sum(seg.end_time - seg.start_time for seg in speaker_data.segments)
        
        # Create speaker
        speaker_dict = speaker_data.model_dump(exclude={'segments'})
        speaker_dict['tenant_id'] = tenant_id
        speaker_dict['total_speaking_time'] = total_time
        
        speaker = self.speaker_repo.create(speaker_dict)
        
        # Create segments
        if speaker_data.segments:
            segments_data = [
                {
                    'speaker_id': speaker.id,
                    'transcript_id': speaker_data.transcript_id,
                    'start_time': seg.start_time,
                    'end_time': seg.end_time,
                    'text': seg.text,
                    'confidence': seg.confidence
                }
                for seg in speaker_data.segments
            ]
            segments = self.segment_repo.create_segments(segments_data)
        else:
            segments = []
        
        # Return response with segments
        speaker_response = SpeakerResponse.model_validate(speaker)
        speaker_response.segments = [SpeakerSegmentResponse.model_validate(seg) for seg in segments]
        
        return speaker_response
    
    def update_speaker_name(
        self,
        speaker_id: int,
        update_data: SpeakerUpdate,
        user_id: int,
        user_role: UserRole,
        tenant_id: int
    ) -> SpeakerResponse:
        """
        Update speaker name
        
        Args:
            speaker_id: Speaker ID
            update_data: Update data
            user_id: Requesting user ID
            user_role: User role
            tenant_id: Tenant ID
            
        Returns:
            Updated speaker
            
        Raises:
            NotFoundError: If speaker not found
            AuthorizationError: If access denied
        """
        speaker = self.speaker_repo.get_with_tenant_check(speaker_id, tenant_id)
        
        if not speaker:
            raise NotFoundError("Speaker not found")
        
        # Check session access
        transcript = self.transcript_repo.get_by_id(speaker.transcript_id)
        session = self.session_repo.get_by_id(transcript.session_id)
        
        if user_role != UserRole.ADMIN and session.user_id != user_id:
            raise AuthorizationError("Access denied")
        
        if update_data.speaker_name:
            speaker = self.speaker_repo.update_name(speaker_id, update_data.speaker_name, tenant_id)
        
        # Load segments
        segments = self.segment_repo.get_by_speaker(speaker.id)
        speaker_response = SpeakerResponse.model_validate(speaker)
        speaker_response.segments = [SpeakerSegmentResponse.model_validate(seg) for seg in segments]
        
        return speaker_response
    
    def delete_speaker(
        self,
        speaker_id: int,
        user_id: int,
        user_role: UserRole,
        tenant_id: int
    ) -> None:
        """
        Delete a speaker and all its segments
        
        Args:
            speaker_id: Speaker ID
            user_id: Requesting user ID
            user_role: User role
            tenant_id: Tenant ID
            
        Raises:
            NotFoundError: If speaker not found
            AuthorizationError: If access denied
        """
        speaker = self.speaker_repo.get_with_tenant_check(speaker_id, tenant_id)
        
        if not speaker:
            raise NotFoundError("Speaker not found")
        
        # Check session access
        transcript = self.transcript_repo.get_by_id(speaker.transcript_id)
        session = self.session_repo.get_by_id(transcript.session_id)
        
        if user_role != UserRole.ADMIN and session.user_id != user_id:
            raise AuthorizationError("Access denied")
        
        self.speaker_repo.delete(speaker_id)
    
    def perform_diarization(
        self,
        request: DiarizationRequest,
        user_id: int,
        user_role: UserRole,
        tenant_id: int
    ) -> DiarizationResponse:
        """
        Perform speaker diarization on a transcript
        
        NOTE: This is a placeholder implementation. In production, this would:
        1. Get the audio file from the recording session
        2. Use a diarization library (e.g., pyannote.audio) to identify speakers
        3. Create Speaker and SpeakerSegment records from the results
        
        For now, it creates mock diarization data for demonstration.
        
        Args:
            request: Diarization request
            user_id: Requesting user ID
            user_role: User role
            tenant_id: Tenant ID
            
        Returns:
            Diarization results
            
        Raises:
            NotFoundError: If transcript not found
            AuthorizationError: If access denied
        """
        start_time = time.time()
        
        transcript = self.transcript_repo.get_with_tenant_check(request.transcript_id, tenant_id)
        
        if not transcript:
            raise NotFoundError("Transcript not found")
        
        # Check session access
        session = self.session_repo.get_by_id(transcript.session_id)
        if user_role != UserRole.ADMIN and session.user_id != user_id:
            raise AuthorizationError("Access denied")
        
        # TODO: Implement actual diarization logic here
        # This would involve:
        # 1. Loading the audio file
        # 2. Running diarization model
        # 3. Parsing results and creating speakers/segments
        
        # For now, return mock data
        # In real implementation, you would create actual Speaker and SpeakerSegment records
        
        speakers = self.speaker_repo.get_by_transcript(request.transcript_id, tenant_id)
        
        processing_time = time.time() - start_time
        
        return DiarizationResponse(
            transcript_id=request.transcript_id,
            speakers=[],  # Would contain actual speakers from diarization
            total_speakers=len(speakers),
            processing_time=processing_time
        )
