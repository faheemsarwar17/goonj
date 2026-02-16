"""User repository"""

from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.enums import UserRole
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """Repository for user operations"""
    
    def __init__(self, db: Session):
        super().__init__(User, db)
    
    def get_by_email(self, email: str) -> Optional[User]:
        """
        Get user by email
        
        Args:
            email: User email
            
        Returns:
            User instance or None
        """
        return self.db.query(User).filter(User.email == email).first()
    
    def get_by_tenant(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> List[User]:
        """
        Get all users for a tenant
        
        Args:
            tenant_id: Tenant ID
            skip: Number of records to skip
            limit: Maximum number of records
            
        Returns:
            List of users
        """
        return (
            self.db.query(User)
            .filter(User.tenant_id == tenant_id)
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    def get_pending_approvals(self, tenant_id: Optional[int] = None) -> List[User]:
        """
        Get users pending approval
        
        Args:
            tenant_id: Optional tenant ID to filter by
            
        Returns:
            List of users pending approval
        """
        query = self.db.query(User).filter(User.is_approved == False)
        
        if tenant_id:
            query = query.filter(User.tenant_id == tenant_id)
        
        return query.all()
    
    def approve_user(self, user_id: int, role: UserRole = UserRole.USER) -> Optional[User]:
        """
        Approve a user and set their role
        
        Args:
            user_id: User ID
            role: Role to assign
            
        Returns:
            Updated user or None
        """
        user = self.get_by_id(user_id)
        if not user:
            return None
        
        user.is_approved = True
        user.role = role
        self.db.commit()
        self.db.refresh(user)
        return user
    
    def exists_by_email(self, email: str) -> bool:
        """
        Check if user exists by email
        
        Args:
            email: User email
            
        Returns:
            True if exists
        """
        return self.db.query(User).filter(User.email == email).first() is not None
