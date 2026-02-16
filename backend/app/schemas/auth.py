"""Authentication schemas"""

from typing import Optional
from pydantic import BaseModel
from app.models.enums import UserRole
from app.schemas.user import UserResponse


class Token(BaseModel):
    """JWT token response"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenData(BaseModel):
    """Data stored in JWT token"""
    user_id: int
    tenant_id: int
    email: str
    role: UserRole


class LoginResponse(BaseModel):
    """Response after successful login"""
    user: UserResponse
    token: Token
