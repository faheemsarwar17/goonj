"""Recording session endpoints"""

from typing import Optional
from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File, Form, Query, status, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database.session import get_db, SessionLocal
from app.core.dependencies import get_current_user, get_current_user_with_query_token
from app.core.config import settings
from app.services.session_service import SessionService
from app.schemas.session import (
    SessionCreate,
    SessionResponse,
    SessionUpdate,
    SessionEnd
)
from app.schemas.common import MessageResponse, PaginationParams, PaginatedResponse
from app.models.user import User
from app.models.enums import SessionStatus, AudioSource


router = APIRouter(prefix="/sessions", tags=["Recording Sessions"])


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def start_session(
    session_data: SessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Start a new recording session
    """
    session_service = SessionService(db)
    return session_service.create_session(
        session_data,
        current_user.id,
        current_user.tenant_id
    )


def run_transcription_task(session_id: int, tenant_id: int):
    """
    Background task wrapper for transcription
    """
    # Create new session for background task
    db = SessionLocal()
    try:
        service = SessionService(db)
        if service.transcription_service:
            print(f"[BACKGROUND] Starting transcription for session {session_id}")
            service.trigger_transcription(session_id, tenant_id)
        else:
            print(f"[BACKGROUND] Transcription service not configured, skipping")
    except Exception as e:
        print(f"[BACKGROUND ERROR] Transcription task failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

@router.post("/{session_id}/end", response_model=SessionResponse)
async def end_session(
    session_id: int,
    background_tasks: BackgroundTasks,
    duration_seconds: Optional[int] = Form(None),
    audio_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    End a recording session and upload audio file
    """
    print(f"[ENDPOINT] /sessions/{session_id}/end called")
    
    # Process the session end (save file, update status)
    session_service = SessionService(db)
    end_data = SessionEnd(duration_seconds=duration_seconds)
    
    result = session_service.end_session(
        session_id,
        end_data,
        audio_file,
        current_user.id,
        current_user.tenant_id
    )
    
    # Schedule background transcription if service available and audio file was uploaded
    if session_service.transcription_service and audio_file:
         print(f"[ENDPOINT] Scheduling background transcription for session {session_id}")
         background_tasks.add_task(
             run_transcription_task, 
             session_id, 
             current_user.tenant_id
         )
    
    print(f"[ENDPOINT] Session ended successfully, returning result")
    return result


@router.get("", response_model=PaginatedResponse[SessionResponse])
async def list_sessions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[SessionStatus] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List recording sessions with pagination
    Admins see all sessions, users see only their own
    """
    session_service = SessionService(db)
    return session_service.list_sessions(
        page,
        page_size,
        current_user.id,
        current_user.role,
        current_user.tenant_id,
        status
    )


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get session details by ID
    """
    session_service = SessionService(db)
    return session_service.get_session(
        session_id,
        current_user.id,
        current_user.role,
        current_user.tenant_id
    )


@router.put("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: int,
    update_data: SessionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update session details
    """
    session_service = SessionService(db)
    return session_service.update_session(
        session_id,
        update_data,
        current_user.id,
        current_user.role,
        current_user.tenant_id
    )


@router.delete("/{session_id}", response_model=MessageResponse)
async def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a recording session and its audio file
    """
    session_service = SessionService(db)
    session_service.delete_session(
        session_id,
        current_user.id,
        current_user.role,
        current_user.tenant_id
    )
    return MessageResponse(message="Session deleted successfully")


@router.get("/{session_id}/audio", response_class=FileResponse)
async def get_session_audio(
    session_id: int,
    current_user: User = Depends(get_current_user_with_query_token),
    db: Session = Depends(get_db)
):
    """
    Get audio file for a recording session
    Supports authentication via header or query parameter for HTML audio element compatibility
    """
    session_service = SessionService(db)
    
    # Get session and verify access
    session = session_service.get_session(
        session_id,
        current_user.id,
        current_user.role,
        current_user.tenant_id
    )
    
    if not session.audio_file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No audio file available for this session"
        )
    
    # Construct full file path
    storage_base = Path(settings.STORAGE_PATH).resolve()
    audio_file_path = (storage_base / session.audio_file_path).resolve()
    
    # Guard against path traversal
    if not str(audio_file_path).startswith(str(storage_base)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid audio file path"
        )
    
    # Check if file exists
    if not audio_file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audio file not found on server"
        )
    
    # Determine media type based on file extension
    file_ext = audio_file_path.suffix.lower()
    media_type_map = {
        '.webm': 'audio/webm',
        '.wav': 'audio/wav',
        '.mp3': 'audio/mpeg',
        '.m4a': 'audio/mp4',
        '.ogg': 'audio/ogg'
    }
    media_type = media_type_map.get(file_ext, 'audio/webm')
    
    # Return file with appropriate media type and headers for seeking
    return FileResponse(
        path=str(audio_file_path),
        media_type=media_type,
        filename=audio_file_path.name,
        headers={
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600'
        }
    )
