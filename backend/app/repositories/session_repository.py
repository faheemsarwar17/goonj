"""Recording session repository"""

from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models.session import RecordingSession
from app.models.enums import SessionStatus
from app.repositories.base import BaseRepository


class SessionRepository(BaseRepository[RecordingSession]):
    """Repository for recording session operations"""
    
    def __init__(self, db: Session):
        super().__init__(RecordingSession, db)
    
    def get_by_tenant(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[SessionStatus] = None
    ) -> List[RecordingSession]:
        """
        Get sessions for a tenant with optional status filter
        
        Args:
            tenant_id: Tenant ID
            skip: Number of records to skip
            limit: Maximum number of records
            status: Optional status filter
            
        Returns:
            List of sessions
        """
        query = self.db.query(RecordingSession).filter(
            RecordingSession.tenant_id == tenant_id
        )
        
        if status:
            query = query.filter(RecordingSession.status == status)
        
        return query.offset(skip).limit(limit).all()
    
    def get_by_user(
        self,
        user_id: int,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> List[RecordingSession]:
        """
        Get sessions created by a user (with tenant isolation)
        
        Args:
            user_id: User ID
            tenant_id: Tenant ID for isolation
            skip: Number of records to skip
            limit: Maximum number of records
            
        Returns:
            List of sessions
        """
        return (
            self.db.query(RecordingSession)
            .filter(
                and_(
                    RecordingSession.user_id == user_id,
                    RecordingSession.tenant_id == tenant_id
                )
            )
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    def get_with_tenant_check(
        self,
        session_id: int,
        tenant_id: int
    ) -> Optional[RecordingSession]:
        """
        Get session by ID with tenant isolation check
        
        Args:
            session_id: Session ID
            tenant_id: Tenant ID for isolation
            
        Returns:
            Session or None
        """
        return (
            self.db.query(RecordingSession)
            .filter(
                and_(
                    RecordingSession.id == session_id,
                    RecordingSession.tenant_id == tenant_id
                )
            )
            .first()
        )
    
    def count_by_tenant(
        self,
        tenant_id: int,
        status: Optional[SessionStatus] = None
    ) -> int:
        """
        Count sessions for a tenant
        
        Args:
            tenant_id: Tenant ID
            status: Optional status filter
            
        Returns:
            Count of sessions
        """
        query = self.db.query(RecordingSession).filter(
            RecordingSession.tenant_id == tenant_id
        )
        
        if status:
            query = query.filter(RecordingSession.status == status)
        
        return query.count()
