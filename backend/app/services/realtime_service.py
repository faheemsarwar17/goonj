"""
OpenAI Realtime API service for live transcription sessions
"""
from typing import Dict, Any


class RealtimeService:
    """Service for managing OpenAI Realtime API sessions"""
    
    async def create_session(self, session_id: int) -> Dict[str, Any]:
        """
        Generate WebSocket URL for connecting to Realtime API via backend proxy
        
        Args:
            session_id: The recording session ID
            
        Returns:
            Dict with WebSocket URL to backend proxy
        """
        # Return the WebSocket URL to our backend proxy
        # The backend proxy will handle authentication with OpenAI
        return {
            "websocket_url": f"/api/v1/sessions/{session_id}/realtime/ws"
        }


realtime_service = RealtimeService()
