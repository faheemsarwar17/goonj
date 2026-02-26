"""
WebSocket proxy for OpenAI Realtime API
"""
import asyncio
import websockets
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.dependencies import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.session import RecordingSession


router = APIRouter()


@router.websocket("/sessions/{session_id}/realtime/ws")
async def realtime_websocket_proxy(
    websocket: WebSocket,
    session_id: int,
    db: Session = Depends(get_db)
):
    """
    WebSocket proxy to OpenAI Realtime API
    
    This proxy handles authentication with OpenAI so the frontend doesn't need the API key
    """
    print(f"[REALTIME_WS] Client connecting for session {session_id}")
    
    # Accept the client connection
    await websocket.accept()
    print(f"[REALTIME_WS] Client connection accepted")
    
    try:
        # Get API key from settings
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            print("[REALTIME_WS ERROR] OPENAI_API_KEY not configured")
            await websocket.send_json({"error": "OPENAI_API_KEY not configured"})
            await websocket.close()
            return
        
        print(f"[REALTIME_WS] API key found, connecting to OpenAI...")
        
        # Connect to OpenAI Realtime API
        openai_ws_url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17"
        
        async with websockets.connect(
            openai_ws_url,
            additional_headers={
                "Authorization": f"Bearer {api_key}",
                "OpenAI-Beta": "realtime=v1"
            }
        ) as openai_ws:
            print(f"[REALTIME_WS] Connected to OpenAI successfully")
            
            # Create tasks for bidirectional proxy
            async def client_to_openai():
                """Forward messages from client to OpenAI"""
                try:
                    while True:
                        data = await websocket.receive_text()
                        print(f"[REALTIME_WS] Client -> OpenAI: {data[:100]}...")
                        await openai_ws.send(data)
                except WebSocketDisconnect:
                    print("[REALTIME_WS] Client disconnected")
                except Exception as e:
                    print(f"[REALTIME_WS ERROR] client_to_openai: {e}")
            
            async def openai_to_client():
                """Forward messages from OpenAI to client"""
                try:
                    async for message in openai_ws:
                        print(f"[REALTIME_WS] OpenAI -> Client: {str(message)[:100]}...")
                        await websocket.send_text(message)
                except Exception as e:
                    print(f"[REALTIME_WS ERROR] openai_to_client: {e}")
            
            # Run both proxy directions concurrently
            await asyncio.gather(
                client_to_openai(),
                openai_to_client(),
                return_exceptions=True
            )
    
    except Exception as e:
        print(f"[REALTIME_WS ERROR] WebSocket proxy error: {e}")
        try:
            await websocket.send_json({"error": str(e)})
        except:
            pass
    finally:
        try:
            await websocket.close()
        except:
            pass
