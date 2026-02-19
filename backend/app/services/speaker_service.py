"""Speaker diarization service"""

import time
from typing import List, Dict, Any
from pathlib import Path
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
from app.services.transcription_service import TranscriptionService
from app.services.storage_service import StorageService


class SpeakerService:
    """Service for speaker diarization operations"""
    
    def __init__(self, db: Session):
        self.db = db
        self.speaker_repo = SpeakerRepository(db)
        self.segment_repo = SpeakerSegmentRepository(db)
        self.transcript_repo = TranscriptRepository(db)
        self.session_repo = SessionRepository(db)
        self.storage_service = StorageService()
        try:
            self.transcription_service = TranscriptionService()
        except ValueError:
            # OpenAI API key not configured
            self.transcription_service = None
    
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
        
        This re-runs AI-powered speaker diarization on the audio file:
        1. Gets the audio file from the recording session
        2. Uses OpenAI gpt-4o-transcribe-diarize to identify speakers
        3. Deletes old speaker records
        4. Creates new Speaker and SpeakerSegment records from the results
        
        Args:
            request: Diarization request with optional min/max speaker constraints
            user_id: Requesting user ID
            user_role: User role
            tenant_id: Tenant ID
            
        Returns:
            Diarization results with speakers and their segments
            
        Raises:
            NotFoundError: If transcript or audio file not found
            AuthorizationError: If access denied
            ValidationError: If transcription service is not configured
        """
        start_time = time.time()
        
        print(f"[DIARIZATION] Starting re-diarization for transcript {request.transcript_id}")
        
        # Validate transcript exists and user has access
        transcript = self.transcript_repo.get_with_tenant_check(request.transcript_id, tenant_id)
        
        if not transcript:
            raise NotFoundError("Transcript not found")
        
        # Check session access
        session = self.session_repo.get_by_id(transcript.session_id)
        if not session:
            raise NotFoundError("Recording session not found")
            
        if user_role != UserRole.ADMIN and session.user_id != user_id:
            raise AuthorizationError("Access denied")
        
        # Check if transcription service is available
        if not self.transcription_service:
            raise ValidationError(
                "Diarization service not configured. Please set OPENAI_API_KEY in environment."
            )
        
        # Get audio file path
        if not session.audio_file_path:
            raise NotFoundError("No audio file associated with this session")
        
        audio_file_path = self.storage_service.get_file_path(session.audio_file_path)
        
        if not audio_file_path.exists():
            raise NotFoundError(f"Audio file not found: {session.audio_file_path}")
        
        print(f"[DIARIZATION] Audio file: {audio_file_path}")
        
        # Calculate actual duration from session timestamps
        actual_duration = None
        if session.ended_at and session.started_at:
            time_diff = session.ended_at - session.started_at
            actual_duration = time_diff.total_seconds()
            print(f"[DIARIZATION] Session duration: {actual_duration:.1f} seconds")
        
        # Run diarization
        try:
            result = self.transcription_service.transcribe_with_speakers(
                str(audio_file_path),
                actual_duration=actual_duration
            )
            
            print(f"[DIARIZATION] Detected {len(result.get('speakers', []))} speakers")
            
        except Exception as e:
            print(f"[DIARIZATION ERROR] Failed to diarize: {str(e)}")
            raise ValidationError(f"Diarization failed: {str(e)}")
        
        # Delete existing speakers for this transcript
        existing_speakers = self.speaker_repo.get_by_transcript(request.transcript_id, tenant_id)
        for speaker in existing_speakers:
            self.speaker_repo.delete(speaker.id)
        
        print(f"[DIARIZATION] Deleted {len(existing_speakers)} old speaker records")
        
        # Create new speaker records
        created_speakers = self._create_speakers_from_diarization(
            transcript_id=request.transcript_id,
            tenant_id=tenant_id,
            speaker_labels=result.get("speakers", []),
            segments=result.get("segments", [])
        )
        
        processing_time = time.time() - start_time
        
        print(f"[DIARIZATION] Completed in {processing_time:.2f} seconds")
        
        return DiarizationResponse(
            transcript_id=request.transcript_id,
            speakers=created_speakers,
            total_speakers=len(created_speakers),
            processing_time=processing_time
        )
    
    def _create_speakers_from_diarization(
        self,
        transcript_id: int,
        tenant_id: int,
        speaker_labels: List[str],
        segments: List[Dict[str, Any]]
    ) -> List[SpeakerResponse]:
        """
        Create speaker and segment records from diarization results
        
        Args:
            transcript_id: Transcript ID
            tenant_id: Tenant ID
            speaker_labels: List of unique speaker labels
            segments: List of segments with speaker labels and timestamps
            
        Returns:
            List of created speakers with their segments
        """
        print(f"[DIARIZATION] Creating {len(speaker_labels)} speaker records")
        
        # Calculate speaking duration for each speaker
        speaker_durations = {}
        speaker_segments = {label: [] for label in speaker_labels}
        
        for segment in segments:
            speaker = segment.get("speaker")
            if speaker:
                duration = segment.get("end", 0) - segment.get("start", 0)
                speaker_durations[speaker] = speaker_durations.get(speaker, 0) + duration
                speaker_segments[speaker].append(segment)
        
        # Create speaker records with segments
        created_speakers = []
        
        for speaker_label in speaker_labels:
            # Create speaker
            speaker_dict = {
                "transcript_id": transcript_id,
                "tenant_id": tenant_id,
                "speaker_label": speaker_label,
                "total_speaking_time": speaker_durations.get(speaker_label, 0),
                "confidence": 1.0  # OpenAI provides high-confidence diarization
            }
            
            speaker = self.speaker_repo.create(speaker_dict)
            
            # Create segments for this speaker
            segments_data = [
                {
                    "speaker_id": speaker.id,
                    "transcript_id": transcript_id,
                    "start_time": seg.get("start", 0),
                    "end_time": seg.get("end", 0),
                    "text": seg.get("text", "").strip(),
                    "confidence": 1.0
                }
                for seg in speaker_segments.get(speaker_label, [])
                if seg.get("text", "").strip()  # Only create segments with text
            ]
            
            created_segments = []
            if segments_data:
                created_segments = self.segment_repo.create_segments(segments_data)
            
            # Build response
            speaker_response = SpeakerResponse.model_validate(speaker)
            speaker_response.segments = [
                SpeakerSegmentResponse.model_validate(seg) for seg in created_segments
            ]
            created_speakers.append(speaker_response)
            
            print(f"[DIARIZATION] Created speaker {speaker_label}: "
                  f"{len(created_segments)} segments, "
                  f"{speaker_durations.get(speaker_label, 0):.1f}s total time")
        
        return created_speakers
