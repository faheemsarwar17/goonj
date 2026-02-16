"""Transcript service"""

from typing import Optional, List
from sqlalchemy.orm import Session
from app.core.exceptions import NotFoundError, AuthorizationError, ConflictError
from app.models.enums import UserRole
from app.repositories.transcript_repository import TranscriptRepository
from app.repositories.session_repository import SessionRepository
from app.schemas.transcript import TranscriptCreate, TranscriptResponse, TranscriptUpdate


class TranscriptService:
    """
    Transcript service
    Handles transcript CRUD operations
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.transcript_repo = TranscriptRepository(db)
        self.session_repo = SessionRepository(db)
    
    def get_all_transcripts(
        self,
        user_id: int,
        user_role: UserRole,
        tenant_id: int
    ) -> List[TranscriptResponse]:
        """
        Get all transcripts for current tenant
        
        Args:
            user_id: Requesting user ID
            user_role: User role
            tenant_id: Tenant ID
            
        Returns:
            List of transcripts (admins see all, regular users see only their own)
        """
        transcripts = self.transcript_repo.get_by_tenant(tenant_id)
        
        # Regular users only see their own transcripts
        if user_role != UserRole.ADMIN:
            # Filter by checking session ownership
            user_transcripts = []
            for transcript in transcripts:
                session = self.session_repo.get_by_id(transcript.session_id)
                if session and session.user_id == user_id:
                    user_transcripts.append(transcript)
            transcripts = user_transcripts
        
        return [TranscriptResponse.model_validate(t) for t in transcripts]
    
    def create_transcript(
        self,
        transcript_data: TranscriptCreate,
        user_id: int,
        user_role: UserRole,
        tenant_id: int
    ) -> TranscriptResponse:
        """
        Create a transcript for a session
        
        Args:
            transcript_data: Transcript creation data
            user_id: User creating the transcript
            user_role: User role
            tenant_id: Tenant ID
            
        Returns:
            Created transcript
            
        Raises:
            NotFoundError: If session not found
            AuthorizationError: If access denied
            ConflictError: If transcript already exists for session
        """
        # Verify session exists and user has access
        session = self.session_repo.get_with_tenant_check(
            transcript_data.session_id,
            tenant_id
        )
        
        if not session:
            raise NotFoundError("Session not found")
        
        # Regular users can only create transcripts for their own sessions
        if user_role != UserRole.ADMIN and session.user_id != user_id:
            raise AuthorizationError("Access denied")
        
        # Check if transcript already exists
        if self.transcript_repo.exists_for_session(transcript_data.session_id):
            raise ConflictError("Transcript already exists for this session")
        
        transcript_dict = {
            "session_id": transcript_data.session_id,
            "tenant_id": tenant_id,
            "content": transcript_data.content,
            "transcript_metadata": transcript_data.transcript_metadata or {}
        }
        
        transcript = self.transcript_repo.create(transcript_dict)
        return TranscriptResponse.model_validate(transcript)
    
    def get_transcript_by_session(
        self,
        session_id: int,
        user_id: int,
        user_role: UserRole,
        tenant_id: int
    ) -> TranscriptResponse:
        """
        Get transcript for a session
        
        Args:
            session_id: Session ID
            user_id: Requesting user ID
            user_role: User role
            tenant_id: Tenant ID
            
        Returns:
            Transcript details
            
        Raises:
            NotFoundError: If session or transcript not found
            AuthorizationError: If access denied
        """
        # Verify session access
        session = self.session_repo.get_with_tenant_check(session_id, tenant_id)
        
        if not session:
            raise NotFoundError("Session not found")
        
        # Regular users can only view transcripts for their own sessions
        if user_role != UserRole.ADMIN and session.user_id != user_id:
            raise AuthorizationError("Access denied")
        
        transcript = self.transcript_repo.get_by_session(session_id, tenant_id)
        
        if not transcript:
            raise NotFoundError("Transcript not found for this session")
        
        return TranscriptResponse.model_validate(transcript)
    
    def get_transcript(
        self,
        transcript_id: int,
        user_id: int,
        user_role: UserRole,
        tenant_id: int
    ) -> TranscriptResponse:
        """
        Get transcript by ID
        
        Args:
            transcript_id: Transcript ID
            user_id: Requesting user ID
            user_role: User role
            tenant_id: Tenant ID
            
        Returns:
            Transcript details
            
        Raises:
            NotFoundError: If transcript not found
            AuthorizationError: If access denied
        """
        transcript = self.transcript_repo.get_with_tenant_check(transcript_id, tenant_id)
        
        if not transcript:
            raise NotFoundError("Transcript not found")
        
        # Verify session access
        session = self.session_repo.get_by_id(transcript.session_id)
        
        # Regular users can only view their own transcripts
        if user_role != UserRole.ADMIN and session.user_id != user_id:
            raise AuthorizationError("Access denied")
        
        return TranscriptResponse.model_validate(transcript)
    
    def update_transcript(
        self,
        transcript_id: int,
        update_data: TranscriptUpdate,
        user_id: int,
        user_role: UserRole,
        tenant_id: int
    ) -> TranscriptResponse:
        """
        Update transcript
        
        Args:
            transcript_id: Transcript ID
            update_data: Update data
            user_id: Requesting user ID
            user_role: User role
            tenant_id: Tenant ID
            
        Returns:
            Updated transcript
            
        Raises:
            NotFoundError: If transcript not found
            AuthorizationError: If access denied
        """
        transcript = self.transcript_repo.get_with_tenant_check(transcript_id, tenant_id)
        
        if not transcript:
            raise NotFoundError("Transcript not found")
        
        # Verify session access
        session = self.session_repo.get_by_id(transcript.session_id)
        
        # Regular users can only update their own transcripts
        if user_role != UserRole.ADMIN and session.user_id != user_id:
            raise AuthorizationError("Access denied")
        
        update_dict = update_data.model_dump(exclude_unset=True)
        updated_transcript = self.transcript_repo.update(transcript_id, update_dict)
        
        return TranscriptResponse.model_validate(updated_transcript)
    
    def delete_transcript(
        self,
        transcript_id: int,
        user_id: int,
        user_role: UserRole,
        tenant_id: int
    ) -> None:
        """
        Delete transcript
        
        Args:
            transcript_id: Transcript ID
            user_id: Requesting user ID
            user_role: User role
            tenant_id: Tenant ID
            
        Raises:
            NotFoundError: If transcript not found
            AuthorizationError: If access denied
        """
        transcript = self.transcript_repo.get_with_tenant_check(transcript_id, tenant_id)
        
        if not transcript:
            raise NotFoundError("Transcript not found")
        
        # Verify session access
        session = self.session_repo.get_by_id(transcript.session_id)
        
        # Regular users can only delete their own transcripts
        if user_role != UserRole.ADMIN and session.user_id != user_id:
            raise AuthorizationError("Access denied")
        
        self.transcript_repo.delete(transcript_id)
