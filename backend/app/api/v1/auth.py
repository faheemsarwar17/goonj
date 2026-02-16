"""Authentication endpoints"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.dependencies import get_current_user
from app.services.auth_service import AuthService
from app.schemas.user import UserCreate, UserLogin, UserResponse
from app.schemas.auth import LoginResponse
from app.schemas.common import MessageResponse
from app.models.user import User


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """
    Register a new user
    Account will be pending admin approval
    """
    auth_service = AuthService(db)
    return auth_service.signup(user_data)


@router.post("/login", response_model=LoginResponse)
async def login(
    credentials: UserLogin,
    db: Session = Depends(get_db)
):
    """
    Login with email and password
    Returns JWT access token
    """
    auth_service = AuthService(db)
    return auth_service.login(credentials.email, credentials.password)


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    Get current authenticated user information
    """
    return UserResponse.model_validate(current_user)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    current_user: User = Depends(get_current_user)
):
    """
    Logout endpoint (client should discard token)
    """
    return MessageResponse(message="Successfully logged out")
