"""Tenant schemas"""

from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class TenantBase(BaseModel):
    """Base tenant schema"""
    name: str = Field(..., min_length=1, max_length=255)
    configuration: Optional[Dict[str, Any]] = Field(default_factory=dict)


class TenantCreate(TenantBase):
    """Schema for creating a tenant"""
    is_active: bool = True


class TenantUpdate(BaseModel):
    """Schema for updating a tenant"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    configuration: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class TenantResponse(TenantBase):
    """Schema for tenant response"""
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
