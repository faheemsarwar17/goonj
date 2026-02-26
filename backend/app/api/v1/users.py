"""User management endpoints"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.dependencies import get_current_user
from app.services.user_service import UserService
from app.schemas.user import UserResponse, UserSelfUpdate
from app.models.user import User


router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user)
):
    """
    Get current user's profile
    """
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
async def update_my_profile(
    user_data: UserSelfUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update current user's profile (name, email, password only)
    """
    user_service = UserService(db)
    return user_service.update_user(
        current_user.id,
        user_data,
        current_user.tenant_id
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user by ID
    """
    user_service = UserService(db)
    return user_service.get_user(user_id, current_user.tenant_id)
