"""
Realtime transcription API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.session import RecordingSession
from app.services.realtime_service import realtime_service
from pydantic import BaseModel


router = APIRouter()


class RealtimeSessionResponse(BaseModel):
    websocket_url: str


@router.post("/sessions/{session_id}/realtime", response_model=RealtimeSessionResponse)
async def create_realtime_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create an ephemeral OpenAI Realtime API session for live transcription
    
    Returns session token and WebSocket URL for the frontend to connect directly to OpenAI
    """
    # Verify session exists and belongs to user
    session = db.query(RecordingSession).filter(
        RecordingSession.id == session_id,
        RecordingSession.tenant_id == current_user.tenant_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.status != "recording":
        raise HTTPException(status_code=400, detail="Session is not in recording state")
    
    # Create OpenAI Realtime session
    try:
        realtime_session = await realtime_service.create_session(session_id)
        return realtime_session
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create Realtime session: {str(e)}")
