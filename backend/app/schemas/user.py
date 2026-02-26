"""User schemas"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from app.models.enums import UserRole


class UserBase(BaseModel):
    """Base user schema"""
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)


class UserCreate(UserBase):
    """Schema for user signup/registration (public endpoint)"""
    password: str = Field(..., min_length=8, max_length=100)
    tenant_id: Optional[int] = None  # Will be auto-assigned if not provided


class AdminUserCreate(UserCreate):
    """Schema for admin creating a user (includes role)"""
    role: Optional[UserRole] = UserRole.USER


class UserLogin(BaseModel):
    """Schema for user login"""
    email: EmailStr
    password: str


class UserSelfUpdate(BaseModel):
    """Schema for users updating their own profile (no privilege fields)"""
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8, max_length=100)


class UserUpdate(BaseModel):
    """Schema for admin updating any user (includes privilege fields)"""
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8, max_length=100)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    is_approved: Optional[bool] = None


class UserResponse(UserBase):
    """Schema for user response"""
    id: int
    tenant_id: int
    role: UserRole
    is_approved: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class UserApproval(BaseModel):
    """Schema for approving/rejecting user"""
    is_approved: bool
    role: Optional[UserRole] = UserRole.USER
