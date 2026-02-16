"""Recording session service"""

from datetime import datetime
from typing import List, Optional
from pathlib import Path
from sqlalchemy.orm import Session
from fastapi import UploadFile
from app.core.exceptions import NotFoundError, AuthorizationError, ValidationError
from app.core.config import settings
from app.models.enums import SessionStatus, UserRole
from app.repositories.session_repository import SessionRepository
from app.repositories.transcript_repository import TranscriptRepository
from app.repositories.speaker_repository import SpeakerRepository
from app.services.storage_service import StorageService
from app.services.transcription_service import TranscriptionService
from app.schemas.session import SessionCreate, SessionResponse, SessionUpdate, SessionEnd
from app.schemas.common import PaginatedResponse


class SessionService:
    """
    Recording session service
    Handles session lifecycle and file management
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.session_repo = SessionRepository(db)
        self.transcript_repo = TranscriptRepository(db)
        self.speaker_repo = SpeakerRepository(db)
        self.storage_service = StorageService()
        
        # Initialize transcription service if API key is available
        self.transcription_service = None
        if settings.OPENAI_API_KEY:
            try:
                self.transcription_service = TranscriptionService()
                print(f"[SESSION_SERVICE] Transcription service initialized with model: {settings.OPENAI_MODEL}")
                print(f"[SESSION_SERVICE] API key present: {settings.OPENAI_API_KEY[:10]}...{settings.OPENAI_API_KEY[-4:]}")
            except Exception as e:
                print(f"[SESSION_SERVICE WARNING] Failed to initialize transcription service: {e}")
                import traceback
                traceback.print_exc()
                self.transcription_service = None
        else:
            print("[SESSION_SERVICE] OpenAI API key not configured, using demo transcripts")
    
    def create_session(
        self,
        session_data: SessionCreate,
        user_id: int,
        tenant_id: int
    ) -> SessionResponse:
        """
        Create a new recording session
        
        Args:
            session_data: Session creation data
            user_id: User creating the session
            tenant_id: Tenant ID
            
        Returns:
            Created session
        """
        session_dict = {
            "title": session_data.title,
            "audio_source": session_data.audio_source,
            "user_id": user_id,
            "tenant_id": tenant_id,
            "status": SessionStatus.RECORDING,
            "started_at": datetime.utcnow()
        }
        
        session = self.session_repo.create(session_dict)
        return SessionResponse.model_validate(session)
    
    def end_session(
        self,
        session_id: int,
        end_data: SessionEnd,
        audio_file: Optional[UploadFile],
        user_id: int,
        tenant_id: int
    ) -> SessionResponse:
        """
        End a recording session and upload audio file
        
        Args:
            session_id: Session ID
            end_data: Session end data
            audio_file: Uploaded audio file
            user_id: User ending the session
            tenant_id: Tenant ID
            
        Returns:
            Updated session
            
        Raises:
            NotFoundError: If session not found
            AuthorizationError: If user doesn't own session
            ValidationError: If session already ended
        """
        session = self.session_repo.get_with_tenant_check(session_id, tenant_id)
        
        if not session:
            raise NotFoundError("Session not found")
        
        if session.user_id != user_id:
            raise AuthorizationError("You can only end your own sessions")
        
        if session.status != SessionStatus.RECORDING:
            raise ValidationError("Session is not in recording state")
        
        update_dict = {
            "status": SessionStatus.COMPLETED,
            "ended_at": datetime.utcnow()
        }
        
        if end_data.duration_seconds:
            update_dict["duration_seconds"] = end_data.duration_seconds
        
        # Handle audio file upload
        audio_file_saved = False
        if audio_file:
            print(f"[SERVICE] Processing audio file upload for session {session_id}")
            try:
                # Ensure the file pointer is at the beginning
                audio_file.file.seek(0)
                
                print(f"[SERVICE] Calling storage_service.save_audio_file")
                file_path = self.storage_service.save_audio_file(
                    audio_file,
                    tenant_id,
                    session_id
                )
                print(f"[SERVICE] File saved successfully at: {file_path}")
                update_dict["audio_file_path"] = file_path
                audio_file_saved = True
                
                # Get file size
                file_size = self.storage_service.get_file_size(file_path)
                if file_size:
                    update_dict["file_size_bytes"] = file_size
                    print(f"[SERVICE] File size: {file_size} bytes")
                    
            except Exception as e:
                # Log error but don't fail the session end
                print(f"[SERVICE ERROR] Error saving audio file: {str(e)}")
                import traceback
                traceback.print_exc()
        else:
            print(f"[SERVICE] No audio file provided for session {session_id}")
        
        updated_session = self.session_repo.update(session_id, update_dict)
        
        # Auto-generate transcript for the completed session
        print(f"[SESSION_SERVICE] Checking if transcript exists for session {session_id}")
        transcript_exists = self.transcript_repo.exists_for_session(session_id)
        print(f"[SESSION_SERVICE] Transcript exists: {transcript_exists}")
        
        if not transcript_exists:
            if audio_file_saved and updated_session.audio_file_path:
                # Try to transcribe with AI if service is available
                print(f"[SESSION_SERVICE] Transcription service available: {self.transcription_service is not None}")
                if self.transcription_service:
                    print(f"[SESSION_SERVICE] Starting AI transcription for session {session_id}")
                    self._generate_ai_transcript(
                        session_id,
                        tenant_id,
                        updated_session.audio_file_path,
                        updated_session
                    )
                else:
                    # Fallback to demo transcript
                    print(f"[SESSION_SERVICE] Transcription service not available, generating demo transcript")
                    self._generate_demo_transcript(
                        session_id,
                        tenant_id,
                        updated_session,
                        end_data,
                        audio_file_saved=True
                    )
            else:
                # No audio file - generate demo transcript
                print(f"[SESSION_SERVICE] No audio file saved, generating demo transcript")
                self._generate_demo_transcript(
                    session_id,
                    tenant_id,
                    updated_session,
                    end_data,
                    audio_file_saved=False
                )
        else:
            print(f"[SESSION_SERVICE] Transcript already exists for session {session_id}, skipping generation")
        
        return SessionResponse.model_validate(updated_session)
    
    def get_session(
        self,
        session_id: int,
        user_id: int,
        user_role: UserRole,
        tenant_id: int
    ) -> SessionResponse:
        """
        Get session by ID
        
        Args:
            session_id: Session ID
            user_id: Requesting user ID
            user_role: Requesting user role
            tenant_id: Tenant ID
            
        Returns:
            Session details
            
        Raises:
            NotFoundError: If session not found
            AuthorizationError: If access denied
        """
        session = self.session_repo.get_with_tenant_check(session_id, tenant_id)
        
        if not session:
            raise NotFoundError("Session not found")
        
        # Regular users can only view their own sessions
        if user_role != UserRole.ADMIN and session.user_id != user_id:
            raise AuthorizationError("Access denied")
        
        return SessionResponse.model_validate(session)
    
    def list_sessions(
        self,
        page: int,
        page_size: int,
        user_id: int,
        user_role: UserRole,
        tenant_id: int,
        status: Optional[SessionStatus] = None
    ) -> PaginatedResponse[SessionResponse]:
        """
        List sessions with pagination
        
        Args:
            page: Page number
            page_size: Items per page
            user_id: Requesting user ID
            user_role: Requesting user role
            tenant_id: Tenant ID
            status: Optional status filter
            
        Returns:
            Paginated session list
        """
        skip = (page - 1) * page_size
        
        # Admins see all sessions, users see only their own
        if user_role == UserRole.ADMIN:
            sessions = self.session_repo.get_by_tenant(
                tenant_id,
                skip=skip,
                limit=page_size,
                status=status
            )
            total = self.session_repo.count_by_tenant(tenant_id, status=status)
        else:
            sessions = self.session_repo.get_by_user(
                user_id,
                tenant_id,
                skip=skip,
                limit=page_size
            )
            # Simple count for user's sessions
            total = self.session_repo.count(filters={
                "user_id": user_id,
                "tenant_id": tenant_id
            })
        
        session_responses = [SessionResponse.model_validate(s) for s in sessions]
        total_pages = (total + page_size - 1) // page_size
        
        return PaginatedResponse(
            items=session_responses,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
    
    def delete_session(
        self,
        session_id: int,
        user_id: int,
        user_role: UserRole,
        tenant_id: int
    ) -> None:
        """
        Delete a session
        
        Args:
            session_id: Session ID
            user_id: Requesting user ID
            user_role: Requesting user role
            tenant_id: Tenant ID
            
        Raises:
            NotFoundError: If session not found
            AuthorizationError: If access denied
        """
        session = self.session_repo.get_with_tenant_check(session_id, tenant_id)
        
        if not session:
            raise NotFoundError("Session not found")
        
        # Regular users can only delete their own sessions
        if user_role != UserRole.ADMIN and session.user_id != user_id:
            raise AuthorizationError("Access denied")
        
        # Delete audio file if exists
        if session.audio_file_path:
            self.storage_service.delete_file(session.audio_file_path)
        
        # Delete session from database (transcript will be cascade deleted)
        self.session_repo.delete(session_id)
    
    def update_session(
        self,
        session_id: int,
        update_data: SessionUpdate,
        user_id: int,
        user_role: UserRole,
        tenant_id: int
    ) -> SessionResponse:
        """
        Update session details
        
        Args:
            session_id: Session ID
            update_data: Update data
            user_id: Requesting user ID
            user_role: Requesting user role
            tenant_id: Tenant ID
            
        Returns:
            Updated session
            
        Raises:
            NotFoundError: If session not found
            AuthorizationError: If access denied
        """
        session = self.session_repo.get_with_tenant_check(session_id, tenant_id)
        
        if not session:
            raise NotFoundError("Session not found")
        
        # Regular users can only update their own sessions
        if user_role != UserRole.ADMIN and session.user_id != user_id:
            raise AuthorizationError("Access denied")
        
        update_dict = update_data.model_dump(exclude_unset=True)
        updated_session = self.session_repo.update(session_id, update_dict)
        
        return SessionResponse.model_validate(updated_session)
    
    def _generate_ai_transcript(
        self,
        session_id: int,
        tenant_id: int,
        audio_file_path: str,
        session
    ) -> None:
        """
        Generate transcript using AI transcription service
        
        Args:
            session_id: Session ID
            tenant_id: Tenant ID
            audio_file_path: Path to audio file (relative)
            session: Session model instance
        """
        try:
            print(f"[TRANSCRIPT_GEN] Starting AI transcription for session {session_id}")
            
            # Get absolute path to audio file
            absolute_path = self.storage_service.get_file_path(audio_file_path)
            
            if not absolute_path.exists():
                print(f"[TRANSCRIPT_GEN ERROR] Audio file not found: {absolute_path}")
                self._generate_demo_transcript(session_id, tenant_id, session, None, audio_file_saved=False)
                return
            
            # Get actual recording duration from session
            actual_duration = None
            if session.ended_at and session.started_at:
                time_diff = session.ended_at - session.started_at
                actual_duration = time_diff.total_seconds()
                print(f"[TRANSCRIPT_GEN] Actual recording duration: {actual_duration:.1f} seconds")
            
            # Perform transcription with speaker diarization
            result = self.transcription_service.transcribe_with_speakers(str(absolute_path), actual_duration)
            
            # Format transcript text with speaker labels
            transcript_content = self.transcription_service.format_transcript_text(result["segments"])
            
            # Create transcript record
            transcript_metadata = {
                "auto_generated": True,
                "demo_mode": False,
                "transcription_service": "openai_gpt4o_transcribe_diarize",
                "language": result.get("language"),
                "duration": result.get("duration"),
                "speaker_count": len(result.get("speakers", [])),
                "generated_at": datetime.utcnow().isoformat()
            }
            
            transcript_dict = {
                "session_id": session_id,
                "tenant_id": tenant_id,
                "content": transcript_content,
                "transcript_metadata": transcript_metadata
            }
            transcript = self.transcript_repo.create(transcript_dict)
            
            print(f"[TRANSCRIPT_GEN] Transcript created successfully (ID: {transcript.id})")
            
            # Create speaker records
            if result.get("speakers"):
                self._create_speaker_records(
                    session_id,
                    tenant_id,
                    transcript.id,
                    result["speakers"],
                    result["segments"]
                )
            
            print(f"[TRANSCRIPT_GEN] AI transcription completed for session {session_id}")
            
        except Exception as e:
            print(f"[TRANSCRIPT_GEN ERROR] Failed to generate AI transcript: {str(e)}")
            import traceback
            traceback.print_exc()
            
            # Fallback to demo transcript
            print(f"[TRANSCRIPT_GEN] Falling back to demo transcript")
            self._generate_demo_transcript(session_id, tenant_id, session, None, audio_file_saved=True)
    
    def _create_speaker_records(
        self,
        session_id: int,
        tenant_id: int,
        transcript_id: int,
        speaker_labels: List[str],
        segments: List[dict]
    ) -> None:
        """
        Create speaker records from diarization results
        
        Args:
            session_id: Session ID
            tenant_id: Tenant ID
            transcript_id: Transcript ID
            speaker_labels: List of unique speaker labels
            segments: List of transcript segments with speaker labels
        """
        try:
            print(f"[SPEAKER_GEN] Creating speaker records for {len(speaker_labels)} speakers")
            
            # Calculate speaking duration for each speaker
            speaker_durations = {}
            for segment in segments:
                speaker = segment.get("speaker")
                if speaker:
                    duration = segment.get("end", 0) - segment.get("start", 0)
                    speaker_durations[speaker] = speaker_durations.get(speaker, 0) + duration
            
            # Create speaker records
            for speaker_label in speaker_labels:
                speaker_dict = {
                    "transcript_id": transcript_id,
                    "tenant_id": tenant_id,
                    "speaker_label": speaker_label,
                    "total_speaking_time": speaker_durations.get(speaker_label, 0),
                    "confidence": 1.0  # Full confidence from gpt-4o-transcribe-diarize
                }
                
                self.speaker_repo.create(speaker_dict)
            
            print(f"[SPEAKER_GEN] Created {len(speaker_labels)} speaker records")
            
        except Exception as e:
            print(f"[SPEAKER_GEN ERROR] Failed to create speaker records: {str(e)}")
            import traceback
            traceback.print_exc()
    
    def _generate_demo_transcript(
        self,
        session_id: int,
        tenant_id: int,
        session,
        end_data: Optional[SessionEnd],
        audio_file_saved: bool
    ) -> None:
        """
        Generate demo transcript when AI transcription is not available
        
        Args:
            session_id: Session ID
            tenant_id: Tenant ID
            session: Session model instance
            end_data: Session end data
            audio_file_saved: Whether audio file was saved
        """
        if audio_file_saved:
            transcript_content = (
                f"[DEMO MODE - Audio file saved successfully]\n\n"
                f"Audio file location: {session.audio_file_path}\n"
                f"File size: {session.file_size_bytes or 0} bytes\n"
                f"Duration: {end_data.duration_seconds if end_data else 0} seconds\n"
                f"Audio source: {session.audio_source.value}\n\n"
                "TO ENABLE REAL TRANSCRIPTION:\n"
                "1. Verify OPENAI_API_KEY is set correctly in your .env file\n"
                "2. Restart the server to reload configuration\n"
                "3. Check terminal logs for any transcription errors\n\n"
                "Sample transcription format:\n\n"
                "[00:00:00] SPEAKER_00: Welcome everyone to today's meeting.\n\n"
                "[00:00:15] SPEAKER_01: Thank you for having me. Let's discuss the project updates.\n\n"
                "[00:00:35] SPEAKER_00: That sounds great. Please go ahead.\n\n"
                "[00:00:45] SPEAKER_01: We've made significant progress on the key features...\n"
            )
            metadata = {
                "auto_generated": True,
                "demo_mode": True,
                "audio_file_saved": True,
                "audio_file_path": session.audio_file_path,
                "file_size_bytes": session.file_size_bytes,
                "duration_seconds": end_data.duration_seconds if end_data else None,
                "generated_at": datetime.utcnow().isoformat()
            }
        else:
            transcript_content = (
                "[DEMO MODE - No audio file uploaded]\n\n"
                f"Session ID: {session_id}\n"
                f"Audio source: {session.audio_source.value}\n"
                f"Duration: {end_data.duration_seconds if end_data else 'N/A'} seconds\n\n"
                "This is a demo transcript. No audio file was uploaded with this session.\n\n"
                "Sample conversation:\n\n"
                "Speaker 1: Welcome everyone to today's meeting. Let's begin with the project status updates.\n\n"
                "Speaker 2: Thank you. Our team has made significant progress on the development phase.\n\n"
                "Speaker 1: That's excellent progress. What about testing?\n\n"
                "Speaker 3: We're on track for the release timeline.\n"
            )
            metadata = {
                "auto_generated": True,
                "demo_mode": True,
                "audio_file_saved": False,
                "generated_at": datetime.utcnow().isoformat()
            }
        
        transcript_dict = {
            "session_id": session_id,
            "tenant_id": tenant_id,
            "content": transcript_content,
            "transcript_metadata": metadata
        }
        self.transcript_repo.create(transcript_dict)
