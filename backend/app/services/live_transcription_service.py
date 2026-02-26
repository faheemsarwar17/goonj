"""Live transcription service for real-time audio processing"""

import os
import io
import time
import asyncio
from pathlib import Path
from typing import Dict, List, Optional, Any
from openai import OpenAI
from app.core.config import settings
from app.core.exceptions import TranscriptionError


class LiveTranscriptionService:
    """
    Service for real-time audio transcription with speaker diarization
    
    This service provides:
    - Real-time audio chunk processing
    - Speaker diarization on live audio
    - Buffered transcription for near real-time results
    - Automatic speaker detection and labeling
    """
    
    def __init__(self):
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not configured")
        
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_MODEL
        
        # Buffer settings - transcribe frequently for near real-time results
        self.buffer_duration = 1.5  # seconds - reduced for faster response
        self.min_buffer_size = 20000  # ~20KB minimum - smaller for quicker processing
        
    async def transcribe_audio_chunk(
        self,
        audio_chunk: bytes,
        session_context: Optional[Dict] = None
    ) -> Dict:
        """
        Transcribe an audio chunk with speaker diarization
        
        Args:
            audio_chunk: Audio data in WebM/Opus format
            session_context: Optional context including previous speakers
            
        Returns:
            Dict containing transcription segment with speaker info
            
        Raises:
            TranscriptionError: If transcription fails
        """
        try:
            if len(audio_chunk) < 500:  # Skip very small chunks (reduced threshold)
                return {
                    "text": "",
                    "segments": [],
                    "is_partial": True
                }
            
            # Create a file-like object from the audio chunk
            audio_file = io.BytesIO(audio_chunk)
            audio_file.name = "chunk.webm"
            
            # Transcribe with diarization
            response = await asyncio.to_thread(
                self.client.audio.transcriptions.create,
                model=self.model,
                file=audio_file,
                response_format="diarized_json",
                extra_body={
                    "chunking_strategy": "auto"
                }
            )
            
            # Format the response
            result = self._format_chunk_response(response, session_context)
            return result
            
        except Exception as e:
            # Don't fail completely on chunk errors, just log and return empty
            print(f"[LIVE_TRANSCRIPTION] Error transcribing chunk: {str(e)}")
            return {
                "text": "",
                "segments": [],
                "error": str(e),
                "is_partial": True
            }
    
    def _format_chunk_response(
        self,
        transcription,
        session_context: Optional[Dict]
    ) -> Dict:
        """
        Format transcription chunk results from API response
        
        Args:
            transcription: API response with diarized segments
            session_context: Session context with previous speakers
            
        Returns:
            Formatted results with speaker segments
        """
        # Get basic info
        text = transcription.text if hasattr(transcription, 'text') else ""
        language = transcription.language if hasattr(transcription, 'language') else None
        
        # Get diarized segments
        segments_raw = transcription.segments if hasattr(transcription, 'segments') else []
        
        # Format segments
        segments = []
        for seg in segments_raw:
            # Handle both dict and object responses
            if isinstance(seg, dict):
                segment = {
                    "speaker": seg.get('speaker', 'SPEAKER_00'),
                    "start": seg.get('start', 0),
                    "end": seg.get('end', 0),
                    "text": seg.get('text', '').strip()
                }
            else:
                segment = {
                    "speaker": seg.speaker if hasattr(seg, 'speaker') else "SPEAKER_00",
                    "start": seg.start if hasattr(seg, 'start') else 0,
                    "end": seg.end if hasattr(seg, 'end') else 0,
                    "text": seg.text if hasattr(seg, 'text') else ""
                }
            
            if segment["text"]:  # Only add non-empty segments
                segments.append(segment)
        
        # Map speakers to consistent IDs within session
        if session_context and "speaker_map" in session_context:
            segments = self._map_speakers_to_session(segments, session_context["speaker_map"])
        
        result = {
            "text": text,
            "language": language,
            "segments": segments,
            "is_partial": False,
            "timestamp": time.time()
        }
        
        return result
    
    def _map_speakers_to_session(
        self,
        segments: List[Dict],
        speaker_map: Dict[str, str]
    ) -> List[Dict]:
        """
        Map chunk-level speakers to session-level consistent speaker IDs
        
        Args:
            segments: Segments from current chunk
            speaker_map: Mapping of speakers across the session
            
        Returns:
            Segments with consistent speaker IDs
        """
        mapped_segments = []
        for segment in segments:
            chunk_speaker = segment["speaker"]
            
            # If we've seen this speaker pattern before, use the mapped ID
            if chunk_speaker in speaker_map:
                segment["speaker"] = speaker_map[chunk_speaker]
            else:
                # New speaker - assign next available ID
                next_id = f"SPEAKER_{len(speaker_map):02d}"
                speaker_map[chunk_speaker] = next_id
                segment["speaker"] = next_id
            
            mapped_segments.append(segment)
        
        return mapped_segments
    
    def create_session_context(self) -> Dict:
        """
        Create a new session context for tracking speakers
        
        Returns:
            Session context dictionary
        """
        return {
            "speaker_map": {},
            "segments": [],
            "start_time": time.time(),
            "total_duration": 0.0
        }
    
    def update_session_context(
        self,
        context: Dict,
        new_segments: List[Dict]
    ) -> Dict:
        """
        Update session context with new segments
        
        Args:
            context: Current session context
            new_segments: New segments to add
            
        Returns:
            Updated context
        """
        if new_segments:
            context["segments"].extend(new_segments)
            
            # Update total duration based on last segment
            if new_segments:
                last_segment = new_segments[-1]
                if "end" in last_segment:
                    context["total_duration"] = last_segment["end"]
        
        return context
    
    def get_formatted_transcript(self, context: Dict) -> str:
        """
        Format all segments into a readable transcript
        
        Args:
            context: Session context with all segments
            
        Returns:
            Formatted transcript text
        """
        formatted_lines = []
        current_speaker = None
        current_text = []
        
        for segment in context["segments"]:
            speaker = segment.get("speaker", "UNKNOWN")
            text = segment.get("text", "").strip()
            start = segment.get("start", 0)
            
            if not text:
                continue
            
            # Format timestamp
            timestamp = self._format_timestamp(start)
            
            # If speaker changed, start new paragraph
            if speaker != current_speaker:
                # Add previous speaker's text
                if current_text:
                    formatted_lines.append(" ".join(current_text))
                    formatted_lines.append("")  # Empty line between speakers
                
                # Start new speaker section
                formatted_lines.append(f"[{timestamp}] {speaker}:")
                current_speaker = speaker
                current_text = [text]
            else:
                # Continue with same speaker
                current_text.append(text)
        
        # Add final speaker's text
        if current_text:
            formatted_lines.append(" ".join(current_text))
        
        return "\n".join(formatted_lines)
    
    def _format_timestamp(self, seconds: float) -> str:
        """Convert seconds to MM:SS format for live display"""
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes:02d}:{secs:02d}"
