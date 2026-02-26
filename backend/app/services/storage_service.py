"""File storage service for audio files"""

import os
import logging
import shutil
from pathlib import Path
from typing import Optional
from fastapi import UploadFile
from app.core.config import settings
from app.core.exceptions import StorageError

logger = logging.getLogger(__name__)


class StorageService:
    """
    Service for managing file storage operations
    Follows Interface Segregation Principle - can be easily replaced with S3 service
    """
    
    def __init__(self):
        self.base_path = Path(settings.STORAGE_PATH)
        self._ensure_base_directory()
    
    def _ensure_base_directory(self) -> None:
        """Create base storage directory if it doesn't exist"""
        self.base_path.mkdir(parents=True, exist_ok=True)
    
    def _get_session_directory(self, tenant_id: int, session_id: int) -> Path:
        """
        Get directory path for a session
        
        Args:
            tenant_id: Tenant ID
            session_id: Session ID
            
        Returns:
            Path to session directory
        """
        return self.base_path / "audio" / str(tenant_id) / str(session_id)
    
    def _ensure_directory(self, directory: Path) -> None:
        """
        Ensure directory exists
        
        Args:
            directory: Directory path
        """
        directory.mkdir(parents=True, exist_ok=True)
    
    def save_audio_file(
        self,
        file: UploadFile,
        tenant_id: int,
        session_id: int
    ) -> str:
        """
        Save uploaded audio file
        
        Args:
            file: Uploaded file
            tenant_id: Tenant ID
            session_id: Session ID
            
        Returns:
            Relative file path
            
        Raises:
            StorageError: If save operation fails
        """
        try:
            logger.debug("Saving audio file for session %s, tenant %s", session_id, tenant_id)
            
            # Validate file extension
            file_ext = os.path.splitext(file.filename)[1].lower()
            
            if file_ext not in settings.ALLOWED_AUDIO_FORMATS:
                raise StorageError(f"Invalid file format. Allowed formats: {', '.join(settings.ALLOWED_AUDIO_FORMATS)}")
            
            # Sanitize filename to prevent path traversal / injection
            safe_basename = os.path.basename(file.filename)
            if safe_basename != file.filename or '..' in file.filename:
                raise StorageError("Invalid filename")
            
            # Get session directory
            session_dir = self._get_session_directory(tenant_id, session_id)
            
            self._ensure_directory(session_dir)
            
            # Create file path
            filename = f"audio{file_ext}"
            file_path = session_dir / filename
            
            # Check if file has content
            file.file.seek(0, 2)  # Seek to end
            file_size = file.file.tell()
            file.file.seek(0)  # Reset to beginning
            
            if file_size == 0:
                raise StorageError("Uploaded file is empty (0 bytes)")
            
            # Enforce file size limit
            max_size_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
            if file_size > max_size_bytes:
                raise StorageError(f"File too large ({file_size / (1024*1024):.1f} MB). Maximum allowed: {settings.MAX_FILE_SIZE_MB} MB")
            
            # Save file
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Return relative path
            relative_path = f"audio/{tenant_id}/{session_id}/{filename}"
            
            # Verify file was saved
            if file_path.exists():
                saved_size = file_path.stat().st_size
                logger.debug("File saved successfully: %s (%d bytes)", relative_path, saved_size)
            else:
                raise StorageError("File path does not exist after save operation")
            
            return relative_path
            
        except StorageError:
            raise
        except Exception as e:
            logger.exception("Failed to save audio file")
            raise StorageError(f"Failed to save file: {str(e)}")
    
    def get_file_path(self, relative_path: str) -> Path:
        """
        Get absolute file path from relative path (with traversal guard)
        
        Args:
            relative_path: Relative file path
            
        Returns:
            Absolute file path
            
        Raises:
            StorageError: If path escapes the storage directory
        """
        resolved = (self.base_path / relative_path).resolve()
        if not str(resolved).startswith(str(self.base_path.resolve())):
            raise StorageError("Invalid file path")
        return resolved
    
    def delete_file(self, relative_path: str) -> bool:
        """
        Delete a file
        
        Args:
            relative_path: Relative file path
            
        Returns:
            True if deleted, False if not found
        """
        try:
            file_path = self.get_file_path(relative_path)
            
            if file_path.exists():
                file_path.unlink()
                
                # Try to remove empty parent directories
                try:
                    file_path.parent.rmdir()
                    file_path.parent.parent.rmdir()
                except OSError:
                    pass  # Directory not empty
                
                return True
            
            return False
            
        except Exception as e:
            raise StorageError(f"Failed to delete file: {str(e)}")
    
    def get_file_size(self, relative_path: str) -> Optional[int]:
        """
        Get file size in bytes
        
        Args:
            relative_path: Relative file path
            
        Returns:
            File size in bytes or None if not found
        """
        file_path = self.get_file_path(relative_path)
        
        if file_path.exists():
            return file_path.stat().st_size
        
        return None
    
    def file_exists(self, relative_path: str) -> bool:
        """
        Check if file exists
        
        Args:
            relative_path: Relative file path
            
        Returns:
            True if exists
        """
        return self.get_file_path(relative_path).exists()
