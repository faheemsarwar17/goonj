"""Dependency injection for FastAPI"""

from typing import Generator, Optional
from fastapi import Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.security import security
from app.core.exceptions import AuthenticationError, AuthorizationError
from app.models.user import User
from app.models.enums import UserRole
from app.repositories.user_repository import UserRepository


# Security scheme
security_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to get current authenticated user from JWT token
    
    Args:
        credentials: HTTP bearer credentials
        db: Database session
        
    Returns:
        Current user
        
    Raises:
        HTTPException: If authentication fails
    """
    try:
        # Decode token
        payload = security.decode_token(credentials.credentials)
        
        if not payload:
            raise AuthenticationError("Invalid authentication credentials")
        
        user_id = payload.get("user_id")
        if not user_id:
            raise AuthenticationError("Invalid token payload")
        
        # Get user from database
        user_repo = UserRepository(db)
        user = user_repo.get_by_id(user_id)
        
        if not user:
            raise AuthenticationError("User not found")
        
        if not user.is_active:
            raise AuthenticationError("User account is inactive")
        
        if not user.is_approved:
            raise AuthenticationError("User account not approved")
        
        return user
        
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"}
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"}
        )


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency to ensure user is active
    
    Args:
        current_user: Current user from get_current_user
        
    Returns:
        Active user
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


def require_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency to require admin role
    
    Args:
        current_user: Current user from get_current_user
        
    Returns:
        Admin user
        
    Raises:
        HTTPException: If user is not admin
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Dependency to optionally get current user (for public/private endpoints)
    
    Args:
        credentials: Optional HTTP bearer credentials
        db: Database session
        
    Returns:
        Current user or None
    """
    if not credentials:
        return None
    
    try:
        return get_current_user(credentials, db)
    except HTTPException:
        return None


def get_current_user_with_query_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to get current user from JWT token (header or query parameter)
    Useful for HTML media elements that can't send custom headers
    
    Args:
        credentials: HTTP bearer credentials from header
        token: JWT token from query parameter
        db: Database session
        
    Returns:
        Current user
        
    Raises:
        HTTPException: If authentication fails
    """
    # Try header first, then query parameter
    token_string = None
    if credentials:
        token_string = credentials.credentials
    elif token:
        token_string = token
    
    if not token_string:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    try:
        # Decode token
        payload = security.decode_token(token_string)
        
        if not payload:
            raise AuthenticationError("Invalid authentication credentials")
        
        user_id = payload.get("user_id")
        if not user_id:
            raise AuthenticationError("Invalid token payload")
        
        # Get user from database
        user_repo = UserRepository(db)
        user = user_repo.get_by_id(user_id)
        
        if not user:
            raise AuthenticationError("User not found")
        
        if not user.is_active:
            raise AuthenticationError("User account is inactive")
        
        if not user.is_approved:
            raise AuthenticationError("User account not approved")
        
        return user
        
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"}
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"}
        )


async def get_current_user_from_token(
    token: str,
    db: Session
) -> User:
    """
    Get current user from JWT token string (for WebSocket authentication)
    
    Args:
        token: JWT token string
        db: Database session
        
    Returns:
        Current user
        
    Raises:
        Exception: If authentication fails
    """
    try:
        # Decode token
        payload = security.decode_token(token)
        
        if not payload:
            raise AuthenticationError("Invalid authentication credentials")
        
        user_id = payload.get("user_id")
        if not user_id:
            raise AuthenticationError("Invalid token payload")
        
        # Get user from database
        user_repo = UserRepository(db)
        user = user_repo.get_by_id(user_id)
        
        if not user:
            raise AuthenticationError("User not found")
        
        if not user.is_active:
            raise AuthenticationError("User account is inactive")
        
        if not user.is_approved:
            raise AuthenticationError("User account not approved")
        
        return user
        
    except Exception as e:
        raise Exception(f"Authentication failed: {str(e)}")

