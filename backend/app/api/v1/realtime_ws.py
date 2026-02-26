"""WebSocket proxy for OpenAI Realtime API"""
import asyncio
import logging
import websockets
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.security import security
from app.core.config import settings
from app.repositories.user_repository import UserRepository
from app.repositories.session_repository import SessionRepository
from app.models.user import User
from app.models.session import RecordingSession

logger = logging.getLogger(__name__)


router = APIRouter()


@router.websocket("/sessions/{session_id}/realtime/ws")
async def realtime_websocket_proxy(
    websocket: WebSocket,
    session_id: int,
    db: Session = Depends(get_db)
):
    """
    WebSocket proxy to OpenAI Realtime API
    
    This proxy handles authentication with OpenAI so the frontend doesn't need the API key.
    Requires a valid JWT token as a query parameter 'token'.
    """
    logger.info("Client connecting for session %d", session_id)
    
    # --- Authentication: validate token before accepting ---
    token = websocket.query_params.get("token")
    if not token:
        logger.warning("No token provided for WebSocket connection")
        await websocket.close(code=4401, reason="Authentication required")
        return
    
    try:
        payload = security.decode_token(token)
        if not payload:
            raise ValueError("Invalid token")
        user_id = payload.get("user_id")
        if not user_id:
            raise ValueError("Invalid token payload")
        
        user_repo = UserRepository(db)
        user = user_repo.get_by_id(user_id)
        if not user or not user.is_active or not user.is_approved:
            raise ValueError("User not found or inactive")
        
        # Verify session belongs to user's tenant
        session_repo = SessionRepository(db)
        session_obj = session_repo.get_by_id(session_id)
        if not session_obj or session_obj.tenant_id != user.tenant_id:
            raise ValueError("Session not found or access denied")
        
        logger.info("Authenticated user %d for session %d", user.id, session_id)
    except Exception as e:
        logger.warning("Authentication failed: %s", e)
        await websocket.close(code=4403, reason="Authentication failed")
        return
    
    # Accept the client connection (only after auth)
    await websocket.accept()
    logger.debug("Client connection accepted for session %d", session_id)
    
    try:
        # Get API key from settings
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            logger.error("OPENAI_API_KEY not configured")
            await websocket.send_json({"error": "OPENAI_API_KEY not configured"})
            await websocket.close()
            return
        
        logger.debug("Connecting to OpenAI Realtime API...")
        
        # Connect to OpenAI Realtime API
        openai_ws_url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17"
        
        async with websockets.connect(
            openai_ws_url,
            additional_headers={
                "Authorization": f"Bearer {api_key}",
                "OpenAI-Beta": "realtime=v1"
            }
        ) as openai_ws:
            logger.info("Connected to OpenAI Realtime API for session %d", session_id)
            
            # Create tasks for bidirectional proxy
            async def client_to_openai():
                """Forward messages from client to OpenAI"""
                try:
                    while True:
                        data = await websocket.receive_text()
                        logger.debug("Client -> OpenAI: %s...", data[:100])
                        await openai_ws.send(data)
                except WebSocketDisconnect:
                    logger.info("Client disconnected from session %d", session_id)
                except Exception as e:
                    logger.error("client_to_openai error: %s", e)
            
            async def openai_to_client():
                """Forward messages from OpenAI to client"""
                try:
                    async for message in openai_ws:
                        logger.debug("OpenAI -> Client: %s...", str(message)[:100])
                        try:
                            await websocket.send_text(message)
                        except Exception:
                            # Client already disconnected, stop forwarding
                            break
                except Exception as e:
                    logger.error("openai_to_client error: %s", e)
            
            # Run both directions concurrently; cancel the other when one finishes
            task1 = asyncio.create_task(client_to_openai())
            task2 = asyncio.create_task(openai_to_client())
            
            done, pending = await asyncio.wait(
                [task1, task2],
                return_when=asyncio.FIRST_COMPLETED,
            )
            
            for task in pending:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
    
    except Exception as e:
        logger.error("WebSocket proxy error for session %d: %s", session_id, e)
        try:
            await websocket.send_json({"error": str(e)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
