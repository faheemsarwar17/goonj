"""File storage service for audio files"""

import os
import shutil
from pathlib import Path
from typing import Optional
from fastapi import UploadFile
from app.core.config import settings
from app.core.exceptions import StorageError


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
            print(f"[STORAGE] Starting to save audio file for session {session_id}, tenant {tenant_id}")
            print(f"[STORAGE] Uploaded file name: {file.filename}")
            print(f"[STORAGE] Base storage path: {self.base_path}")
            
            # Validate file extension
            file_ext = os.path.splitext(file.filename)[1].lower()
            print(f"[STORAGE] File extension: {file_ext}")
            
            if file_ext not in settings.ALLOWED_AUDIO_FORMATS:
                raise StorageError(f"Invalid file format. Allowed formats: {', '.join(settings.ALLOWED_AUDIO_FORMATS)}")
            
            # Get session directory
            session_dir = self._get_session_directory(tenant_id, session_id)
            print(f"[STORAGE] Session directory will be: {session_dir}")
            
            self._ensure_directory(session_dir)
            print(f"[STORAGE] Directory created/verified: {session_dir.exists()}")
            
            # Create file path
            filename = f"audio{file_ext}"
            file_path = session_dir / filename
            print(f"[STORAGE] Full file path: {file_path}")
            
            # Check if file has content
            file.file.seek(0, 2)  # Seek to end
            file_size = file.file.tell()
            file.file.seek(0)  # Reset to beginning
            print(f"[STORAGE] File size in upload: {file_size} bytes")
            
            if file_size == 0:
                raise StorageError("Uploaded file is empty (0 bytes)")
            
            # Save file
            with open(file_path, "wb") as buffer:
                bytes_written = shutil.copyfileobj(file.file, buffer)
                print(f"[STORAGE] Bytes written: {bytes_written}")
            
            # Verify file was saved
            if file_path.exists():
                saved_size = file_path.stat().st_size
                print(f"[STORAGE] File saved successfully! Size on disk: {saved_size} bytes")
            else:
                raise StorageError("File path does not exist after save operation")
            
            # Return relative path
            relative_path = f"audio/{tenant_id}/{session_id}/{filename}"
            print(f"[STORAGE] Returning relative path: {relative_path}")
            return relative_path
            
        except Exception as e:
            print(f"[STORAGE ERROR] Failed to save file: {str(e)}")
            import traceback
            traceback.print_exc()
            raise StorageError(f"Failed to save file: {str(e)}")
    
    def get_file_path(self, relative_path: str) -> Path:
        """
        Get absolute file path from relative path
        
        Args:
            relative_path: Relative file path
            
        Returns:
            Absolute file path
        """
        return self.base_path / relative_path
    
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
