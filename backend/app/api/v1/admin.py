"""Admin endpoints"""

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.dependencies import require_admin
from app.services.user_service import UserService
from app.schemas.user import UserResponse, UserApproval, UserCreate, UserUpdate
from app.schemas.common import MessageResponse
from app.models.user import User


router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin)])


@router.get("/users", response_model=List[UserResponse])
async def get_all_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Get all users in tenant (Admin only)
    """
    user_service = UserService(db)
    users = user_service.user_repo.get_by_tenant(current_user.tenant_id)
    return [UserResponse.model_validate(user) for user in users]


@router.get("/pending-users", response_model=List[UserResponse])
async def get_pending_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Get list of users pending approval (Admin only)
    """
    user_service = UserService(db)
    return user_service.get_pending_users(
        current_user.role,
        current_user.tenant_id
    )


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new user (Admin only)
    Users created by admin are auto-approved
    """
    from app.services.auth_service import AuthService
    from app.repositories.user_repository import UserRepository
    
    auth_service = AuthService(db)
    user_repo = UserRepository(db)
    
    # Override tenant_id with current user's tenant
    user_data.tenant_id = current_user.tenant_id
    
    # Create user via auth service
    new_user = auth_service.signup(user_data)
    
    # Auto-approve the user since admin created it
    approved_user = user_repo.approve_user(new_user.id, user_data.role)
    
    return UserResponse.model_validate(approved_user)


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Update any user (Admin only)
    """
    user_service = UserService(db)
    return user_service.update_user(
        user_id,
        user_data,
        current_user.tenant_id
    )


@router.get("/pending-users", response_model=List[UserResponse])
async def get_pending_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Get list of users pending approval (Admin only)
    """
    user_service = UserService(db)
    return user_service.get_pending_users(
        current_user.role,
        current_user.tenant_id
    )


@router.post("/users/{user_id}/approve", response_model=UserResponse)
async def approve_user(
    user_id: int,
    approval_data: UserApproval,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Approve or reject user signup (Admin only)
    """
    user_service = UserService(db)
    return user_service.approve_user(
        user_id,
        approval_data,
        current_user.role,
        current_user.tenant_id
    )


@router.delete("/users/{user_id}", response_model=MessageResponse)
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Delete a user (Admin only)
    """
    user_service = UserService(db)
    user_service.delete_user(
        user_id,
        current_user.role,
        current_user.tenant_id
    )
    return MessageResponse(message="User deleted successfully")
