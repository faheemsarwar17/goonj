"""Authentication service"""

from datetime import timedelta
from typing import Optional
from sqlalchemy.orm import Session
from app.core.security import security
from app.core.config import settings
from app.core.exceptions import AuthenticationError, ConflictError
from app.models.user import User
from app.models.enums import UserRole
from app.repositories.user_repository import UserRepository
from app.repositories.tenant_repository import TenantRepository
from app.schemas.auth import Token, LoginResponse
from app.schemas.user import UserCreate, UserResponse


class AuthService:
    """
    Authentication service handling login, signup, and token generation
    Follows Single Responsibility Principle
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.tenant_repo = TenantRepository(db)
    
    def signup(self, user_data: UserCreate) -> UserResponse:
        """
        Register a new user (requires admin approval)
        
        Args:
            user_data: User signup data
            
        Returns:
            Created user
            
        Raises:
            ConflictError: If email already exists
        """
        # Check if email already exists
        if self.user_repo.exists_by_email(user_data.email):
            raise ConflictError("Email already registered")
        
        # Get tenant (default or specified)
        if user_data.tenant_id:
            tenant = self.tenant_repo.get_by_id(user_data.tenant_id)
            if not tenant:
                raise ConflictError("Invalid tenant ID")
        else:
            # Get default tenant
            tenant = self.tenant_repo.get_default_tenant()
            if not tenant:
                raise ConflictError("No tenant available. Please contact administrator.")
        
        # Hash password
        hashed_password = security.get_password_hash(user_data.password)
        
        # Create user (not approved by default)
        user_dict = {
            "email": user_data.email,
            "full_name": user_data.full_name,
            "hashed_password": hashed_password,
            "tenant_id": tenant.id,
            "role": UserRole.USER,
            "is_approved": False,  # Requires admin approval
            "is_active": True
        }
        
        user = self.user_repo.create(user_dict)
        return UserResponse.model_validate(user)
    
    def login(self, email: str, password: str) -> LoginResponse:
        """
        Authenticate user and generate JWT token
        
        Args:
            email: User email
            password: User password
            
        Returns:
            Login response with user and token
            
        Raises:
            AuthenticationError: If credentials are invalid or user not approved
        """
        # Get user by email
        user = self.user_repo.get_by_email(email)
        
        if not user:
            raise AuthenticationError("Invalid email or password")
        
        # Verify password
        if not security.verify_password(password, user.hashed_password):
            raise AuthenticationError("Invalid email or password")
        
        # Check if user is approved
        if not user.is_approved:
            raise AuthenticationError("Account pending admin approval")
        
        # Check if user is active
        if not user.is_active:
            raise AuthenticationError("Account is inactive")
        
        # Generate JWT token
        token_data = {
            "user_id": user.id,
            "tenant_id": user.tenant_id,
            "email": user.email,
            "role": user.role.value
        }
        
        access_token = security.create_access_token(token_data)
        
        token = Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
        
        user_response = UserResponse.model_validate(user)
        
        return LoginResponse(user=user_response, token=token)
    
    def verify_token(self, token: str) -> Optional[User]:
        """
        Verify JWT token and return user
        
        Args:
            token: JWT token
            
        Returns:
            User if valid, None otherwise
        """
        payload = security.decode_token(token)
        
        if not payload:
            return None
        
        user_id = payload.get("user_id")
        if not user_id:
            return None
        
        user = self.user_repo.get_by_id(user_id)
        
        if not user or not user.is_active or not user.is_approved:
            return None
        
        return user
