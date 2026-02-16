"""Admin endpoints"""

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.dependencies import require_admin
from app.services.user_service import UserService
from app.schemas.user import UserResponse, UserApproval
from app.schemas.common import MessageResponse
from app.models.user import User


router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin)])


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
