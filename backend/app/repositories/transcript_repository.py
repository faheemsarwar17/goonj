"""Transcript repository"""

from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models.transcript import Transcript
from app.repositories.base import BaseRepository


class TranscriptRepository(BaseRepository[Transcript]):
    """Repository for transcript operations"""
    
    def __init__(self, db: Session):
        super().__init__(Transcript, db)
    
    def get_by_tenant(self, tenant_id: int) -> List[Transcript]:
        """
        Get all transcripts for a tenant
        
        Args:
            tenant_id: Tenant ID for isolation
            
        Returns:
            List of transcripts
        """
        return (
            self.db.query(Transcript)
            .filter(Transcript.tenant_id == tenant_id)
            .order_by(Transcript.created_at.desc())
            .all()
        )
    
    def get_by_session(
        self,
        session_id: int,
        tenant_id: int
    ) -> Optional[Transcript]:
        """
        Get transcript by session ID with tenant isolation
        
        Args:
            session_id: Session ID
            tenant_id: Tenant ID for isolation
            
        Returns:
            Transcript or None
        """
        return (
            self.db.query(Transcript)
            .filter(
                and_(
                    Transcript.session_id == session_id,
                    Transcript.tenant_id == tenant_id
                )
            )
            .first()
        )
    
    def get_with_tenant_check(
        self,
        transcript_id: int,
        tenant_id: int
    ) -> Optional[Transcript]:
        """
        Get transcript by ID with tenant isolation check
        
        Args:
            transcript_id: Transcript ID
            tenant_id: Tenant ID for isolation
            
        Returns:
            Transcript or None
        """
        return (
            self.db.query(Transcript)
            .filter(
                and_(
                    Transcript.id == transcript_id,
                    Transcript.tenant_id == tenant_id
                )
            )
            .first()
        )
    
    def exists_for_session(self, session_id: int) -> bool:
        """
        Check if transcript exists for a session
        
        Args:
            session_id: Session ID
            
        Returns:
            True if exists
        """
        return (
            self.db.query(Transcript)
            .filter(Transcript.session_id == session_id)
            .first()
        ) is not None
