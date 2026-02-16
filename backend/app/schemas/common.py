"""Common schemas used across the application"""

from typing import Optional, Generic, TypeVar, List
from pydantic import BaseModel, Field


T = TypeVar('T')


class PaginationParams(BaseModel):
    """Pagination query parameters"""
    page: int = Field(default=1, ge=1, description="Page number")
    page_size: int = Field(default=20, ge=1, le=100, description="Items per page")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response"""
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class MessageResponse(BaseModel):
    """Simple message response"""
    message: str


class ErrorResponse(BaseModel):
    """Error response schema"""
    detail: str
    status_code: int
    details: Optional[dict] = None
