"""Custom application exceptions"""

from typing import Any, Optional


class AppException(Exception):
    """Base application exception"""
    
    def __init__(
        self,
        message: str,
        status_code: int = 500,
        details: Optional[Any] = None
    ):
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(self.message)


class AuthenticationError(AppException):
    """Authentication failed exception"""
    
    def __init__(self, message: str = "Authentication failed", details: Optional[Any] = None):
        super().__init__(message, status_code=401, details=details)


class AuthorizationError(AppException):
    """Authorization/Permission denied exception"""
    
    def __init__(self, message: str = "Permission denied", details: Optional[Any] = None):
        super().__init__(message, status_code=403, details=details)


class NotFoundError(AppException):
    """Resource not found exception"""
    
    def __init__(self, message: str = "Resource not found", details: Optional[Any] = None):
        super().__init__(message, status_code=404, details=details)


class ValidationError(AppException):
    """Validation error exception"""
    
    def __init__(self, message: str = "Validation error", details: Optional[Any] = None):
        super().__init__(message, status_code=422, details=details)


class ConflictError(AppException):
    """Conflict error (e.g., duplicate resource)"""
    
    def __init__(self, message: str = "Resource conflict", details: Optional[Any] = None):
        super().__init__(message, status_code=409, details=details)


class TenantIsolationError(AppException):
    """Tenant isolation violation exception"""
    
    def __init__(self, message: str = "Tenant isolation violation", details: Optional[Any] = None):
        super().__init__(message, status_code=403, details=details)


class StorageError(AppException):
    """File storage operation exception"""
    
    def __init__(self, message: str = "Storage operation failed", details: Optional[Any] = None):
        super().__init__(message, status_code=500, details=details)


class TranscriptionError(AppException):
    """Audio transcription operation exception"""
    
    def __init__(self, message: str = "Transcription failed", details: Optional[Any] = None):
        super().__init__(message, status_code=500, details=details)
