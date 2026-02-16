"""Base repository with common CRUD operations"""

from typing import TypeVar, Generic, Type, Optional, List, Any, Dict
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.database.session import Base


ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """
    Base repository class with generic CRUD operations
    Follows Single Responsibility Principle - handles only data access
    """
    
    def __init__(self, model: Type[ModelType], db: Session):
        """
        Initialize repository with model and database session
        
        Args:
            model: SQLAlchemy model class
            db: Database session
        """
        self.model = model
        self.db = db
    
    def create(self, obj_in: Dict[str, Any]) -> ModelType:
        """
        Create a new record
        
        Args:
            obj_in: Dictionary with object attributes
            
        Returns:
            Created model instance
        """
        db_obj = self.model(**obj_in)
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj
    
    def get_by_id(self, id: int) -> Optional[ModelType]:
        """
        Get record by ID
        
        Args:
            id: Record ID
            
        Returns:
            Model instance or None
        """
        return self.db.query(self.model).filter(self.model.id == id).first()
    
    def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[ModelType]:
        """
        Get all records with optional filtering and pagination
        
        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return
            filters: Dictionary of filter conditions
            
        Returns:
            List of model instances
        """
        query = self.db.query(self.model)
        
        if filters:
            for key, value in filters.items():
                if hasattr(self.model, key):
                    query = query.filter(getattr(self.model, key) == value)
        
        return query.order_by(desc(self.model.id)).offset(skip).limit(limit).all()
    
    def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """
        Count records with optional filtering
        
        Args:
            filters: Dictionary of filter conditions
            
        Returns:
            Count of records
        """
        query = self.db.query(self.model)
        
        if filters:
            for key, value in filters.items():
                if hasattr(self.model, key):
                    query = query.filter(getattr(self.model, key) == value)
        
        return query.count()
    
    def update(self, id: int, obj_in: Dict[str, Any]) -> Optional[ModelType]:
        """
        Update a record
        
        Args:
            id: Record ID
            obj_in: Dictionary with updated attributes
            
        Returns:
            Updated model instance or None
        """
        db_obj = self.get_by_id(id)
        if not db_obj:
            return None
        
        for key, value in obj_in.items():
            if hasattr(db_obj, key) and value is not None:
                setattr(db_obj, key, value)
        
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj
    
    def delete(self, id: int) -> bool:
        """
        Delete a record
        
        Args:
            id: Record ID
            
        Returns:
            True if deleted, False if not found
        """
        db_obj = self.get_by_id(id)
        if not db_obj:
            return False
        
        self.db.delete(db_obj)
        self.db.commit()
        return True
    
    def exists(self, id: int) -> bool:
        """
        Check if record exists
        
        Args:
            id: Record ID
            
        Returns:
            True if exists, False otherwise
        """
        return self.db.query(self.model).filter(self.model.id == id).first() is not None
