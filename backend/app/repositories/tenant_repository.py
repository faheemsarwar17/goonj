"""Tenant repository"""

from typing import Optional
from sqlalchemy.orm import Session
from app.models.tenant import Tenant
from app.repositories.base import BaseRepository


class TenantRepository(BaseRepository[Tenant]):
    """Repository for tenant operations"""
    
    def __init__(self, db: Session):
        super().__init__(Tenant, db)
    
    def get_by_name(self, name: str) -> Optional[Tenant]:
        """
        Get tenant by name
        
        Args:
            name: Tenant name
            
        Returns:
            Tenant instance or None
        """
        return self.db.query(Tenant).filter(Tenant.name == name).first()
    
    def get_default_tenant(self) -> Optional[Tenant]:
        """
        Get the first active tenant (default for non-multi-tenant setup)
        
        Returns:
            Tenant instance or None
        """
        return self.db.query(Tenant).filter(Tenant.is_active == True).first()
