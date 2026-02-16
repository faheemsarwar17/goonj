"""User management service"""

from typing import List
from sqlalchemy.orm import Session
from app.core.security import security
from app.core.exceptions import NotFoundError, AuthorizationError, ConflictError
from app.models.enums import UserRole
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserResponse, UserUpdate, UserApproval


class UserService:
    """
    User management service
    Handles user CRUD operations and approval workflow
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
    
    def get_user(self, user_id: int, tenant_id: int) -> UserResponse:
        """
        Get user by ID with tenant isolation
        
        Args:
            user_id: User ID
            tenant_id: Tenant ID for isolation
            
        Returns:
            User response
            
        Raises:
            NotFoundError: If user not found
            AuthorizationError: If user belongs to different tenant
        """
        user = self.user_repo.get_by_id(user_id)
        
        if not user:
            raise NotFoundError("User not found")
        
        if user.tenant_id != tenant_id:
            raise AuthorizationError("Access denied")
        
        return UserResponse.model_validate(user)
    
    def get_pending_users(self, requesting_user_role: UserRole, tenant_id: int) -> List[UserResponse]:
        """
        Get users pending approval (admin only)
        
        Args:
            requesting_user_role: Role of requesting user
            tenant_id: Tenant ID
            
        Returns:
            List of pending users
            
        Raises:
            AuthorizationError: If not admin
        """
        if requesting_user_role != UserRole.ADMIN:
            raise AuthorizationError("Admin access required")
        
        users = self.user_repo.get_pending_approvals(tenant_id)
        return [UserResponse.model_validate(user) for user in users]
    
    def approve_user(
        self,
        user_id: int,
        approval_data: UserApproval,
        requesting_user_role: UserRole,
        tenant_id: int
    ) -> UserResponse:
        """
        Approve or reject user signup (admin only)
        
        Args:
            user_id: User ID to approve/reject
            approval_data: Approval data
            requesting_user_role: Role of requesting user
            tenant_id: Tenant ID
            
        Returns:
            Updated user
            
        Raises:
            AuthorizationError: If not admin or tenant mismatch
            NotFoundError: If user not found
        """
        if requesting_user_role != UserRole.ADMIN:
            raise AuthorizationError("Admin access required")
        
        user = self.user_repo.get_by_id(user_id)
        
        if not user:
            raise NotFoundError("User not found")
        
        if user.tenant_id != tenant_id:
            raise AuthorizationError("Access denied")
        
        if approval_data.is_approved:
            user = self.user_repo.approve_user(user_id, approval_data.role)
        else:
            # Reject by deleting the user
            self.user_repo.delete(user_id)
            raise NotFoundError("User registration rejected")
        
        return UserResponse.model_validate(user)
    
    def update_user(
        self,
        user_id: int,
        user_data: UserUpdate,
        tenant_id: int
    ) -> UserResponse:
        """
        Update user information
        
        Args:
            user_id: User ID
            user_data: Updated user data
            tenant_id: Tenant ID for isolation
            
        Returns:
            Updated user
            
        Raises:
            NotFoundError: If user not found
            AuthorizationError: If tenant mismatch
        """
        user = self.user_repo.get_by_id(user_id)
        
        if not user:
            raise NotFoundError("User not found")
        
        if user.tenant_id != tenant_id:
            raise AuthorizationError("Access denied")
        
        update_dict = user_data.model_dump(exclude_unset=True)
        
        # Hash password if provided
        if "password" in update_dict:
            update_dict["hashed_password"] = security.get_password_hash(update_dict.pop("password"))
        
        # Check email uniqueness if changed
        if "email" in update_dict and update_dict["email"] != user.email:
            if self.user_repo.exists_by_email(update_dict["email"]):
                raise ConflictError("Email already in use")
        
        updated_user = self.user_repo.update(user_id, update_dict)
        return UserResponse.model_validate(updated_user)
    
    def delete_user(
        self,
        user_id: int,
        requesting_user_role: UserRole,
        tenant_id: int
    ) -> None:
        """
        Delete user (admin only)
        
        Args:
            user_id: User ID
            requesting_user_role: Role of requesting user
            tenant_id: Tenant ID
            
        Raises:
            AuthorizationError: If not admin or tenant mismatch
            NotFoundError: If user not found
        """
        if requesting_user_role != UserRole.ADMIN:
            raise AuthorizationError("Admin access required")
        
        user = self.user_repo.get_by_id(user_id)
        
        if not user:
            raise NotFoundError("User not found")
        
        if user.tenant_id != tenant_id:
            raise AuthorizationError("Access denied")
        
        self.user_repo.delete(user_id)
