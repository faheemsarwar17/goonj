"""WebSocket endpoints for live transcription"""

import json
import asyncio
from typing import Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.config import settings
from app.services.live_transcription_service import LiveTranscriptionService
from app.repositories.session_repository import SessionRepository
from app.core.dependencies import get_current_user_from_token


router = APIRouter(tags=["Live Transcription"])


class ConnectionManager:
    """Manages WebSocket connections for live transcription sessions"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.session_contexts: Dict[str, Dict] = {}
    
    async def connect(self, session_id: int, websocket: WebSocket):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        key = f"session_{session_id}"
        self.active_connections[key] = websocket
        
        # Initialize session context for speaker tracking
        live_service = LiveTranscriptionService()
        self.session_contexts[key] = live_service.create_session_context()
        
        print(f"[WEBSOCKET] Client connected for session {session_id}")
    
    def disconnect(self, session_id: int):
        """Remove a WebSocket connection"""
        key = f"session_{session_id}"
        if key in self.active_connections:
            del self.active_connections[key]
        if key in self.session_contexts:
            del self.session_contexts[key]
        print(f"[WEBSOCKET] Client disconnected from session {session_id}")
    
    async def send_transcription(self, session_id: int, data: dict):
        """Send transcription data to a specific session"""
        key = f"session_{session_id}"
        if key in self.active_connections:
            try:
                await self.active_connections[key].send_json(data)
            except Exception as e:
                print(f"[WEBSOCKET] Error sending to session {session_id}: {e}")
    
    def get_session_context(self, session_id: int) -> Optional[Dict]:
        """Get the session context for speaker tracking"""
        key = f"session_{session_id}"
        return self.session_contexts.get(key)
    
    def update_session_context(self, session_id: int, context: Dict):
        """Update the session context"""
        key = f"session_{session_id}"
        self.session_contexts[key] = context


# Global connection manager
manager = ConnectionManager()


@router.websocket("/ws/transcribe/{session_id}")
async def websocket_transcribe(
    websocket: WebSocket,
    session_id: int,
    token: str = Query(..., description="JWT authentication token"),
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for live transcription
    
    Client sends audio chunks as binary data
    Server responds with JSON transcription results
    
    Message format from client:
    - Binary: Audio chunk data (WebM/Opus)
    
    Message format from server:
    - JSON: {"type": "transcription", "data": {...}}
    - JSON: {"type": "error", "message": "..."}
    - JSON: {"type": "status", "message": "..."}
    """
    try:
        # Authenticate the connection
        try:
            user = await get_current_user_from_token(token, db)
        except Exception as e:
            await websocket.close(code=1008, reason=f"Authentication failed: {str(e)}")
            return
        
        # Verify session exists and user has access
        session_repo = SessionRepository(db)
        session = session_repo.get_with_tenant_check(session_id, user.tenant_id)
        
        if not session:
            await websocket.close(code=1008, reason="Session not found")
            return
        
        if session.user_id != user.id:
            await websocket.close(code=1008, reason="Unauthorized access to session")
            return
        
        # Accept the connection
        await manager.connect(session_id, websocket)
        
        # Send initial status
        await websocket.send_json({
            "type": "status",
            "message": "Connected to live transcription service",
            "session_id": session_id
        })
        
        # Initialize transcription service
        live_service = LiveTranscriptionService()
        
        # Buffer for accumulating audio chunks
        audio_buffer = bytearray()
        buffer_start_time = asyncio.get_event_loop().time()
        
        try:
            while True:
                # Receive audio chunk
                data = await websocket.receive()
                
                if "bytes" in data:
                    # Audio chunk received
                    audio_chunk = data["bytes"]
                    audio_buffer.extend(audio_chunk)
                    
                    print(f"[WEBSOCKET] Received audio chunk: {len(audio_chunk)} bytes, buffer total: {len(audio_buffer)} bytes")
                    
                    current_time = asyncio.get_event_loop().time()
                    buffer_duration = current_time - buffer_start_time
                    
                    # Process buffer when it reaches minimum size or duration
                    if (len(audio_buffer) >= live_service.min_buffer_size or 
                        buffer_duration >= live_service.buffer_duration):
                        
                        print(f"[WEBSOCKET] Processing buffer: {len(audio_buffer)} bytes after {buffer_duration:.1f}s")
                        
                        # Get session context for speaker tracking
                        session_context = manager.get_session_context(session_id)
                        
                        # Transcribe the buffered audio
                        result = await live_service.transcribe_audio_chunk(
                            bytes(audio_buffer),
                            session_context
                        )
                        
                        print(f"[WEBSOCKET] Transcription result: {len(result.get('segments', []))} segments")
                        
                        # Update session context with new segments
                        if result.get("segments"):
                            updated_context = live_service.update_session_context(
                                session_context,
                                result["segments"]
                            )
                            manager.update_session_context(session_id, updated_context)
                        
                        # Send transcription result to client
                        if result.get("text") or result.get("segments"):
                            await manager.send_transcription(session_id, {
                                "type": "transcription",
                                "data": result
                            })
                            print(f"[WEBSOCKET] Sent transcription to client")
                        
                        # Clear buffer and reset timer
                        audio_buffer.clear()
                        buffer_start_time = current_time
                
                elif "text" in data:
                    # Handle control messages
                    try:
                        message = json.loads(data["text"])
                        
                        if message.get("type") == "ping":
                            await websocket.send_json({"type": "pong"})
                        
                        elif message.get("type") == "get_transcript":
                            # Return full formatted transcript
                            session_context = manager.get_session_context(session_id)
                            if session_context:
                                formatted = live_service.get_formatted_transcript(session_context)
                                await websocket.send_json({
                                    "type": "full_transcript",
                                    "data": {
                                        "text": formatted,
                                        "segments": session_context["segments"],
                                        "speakers": list(session_context["speaker_map"].values())
                                    }
                                })
                    
                    except json.JSONDecodeError:
                        pass  # Ignore invalid JSON
                
        except WebSocketDisconnect:
            print(f"[WEBSOCKET] Client disconnected from session {session_id}")
        except Exception as e:
            print(f"[WEBSOCKET] Error in session {session_id}: {str(e)}")
            import traceback
            traceback.print_exc()
            
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Transcription error: {str(e)}"
                })
            except:
                pass
        finally:
            manager.disconnect(session_id)
    
    except Exception as e:
        print(f"[WEBSOCKET] Connection error for session {session_id}: {str(e)}")
        try:
            await websocket.close(code=1011, reason=str(e))
        except:
            pass
