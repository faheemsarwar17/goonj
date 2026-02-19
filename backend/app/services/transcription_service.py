"""AI-powered transcription service using OpenAI gpt-4o-transcribe-diarize"""

import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from openai import OpenAI
from app.core.config import settings
from app.core.exceptions import TranscriptionError


class TranscriptionService:
    """
    Service for AI-powered audio transcription with speaker diarization
    Uses OpenAI gpt-4o-transcribe-diarize for accurate speaker identification
    
    This service provides:
    - Native speaker diarization from OpenAI
    - Accurate speaker labels with timestamps
    - Automatic audio chunking for long recordings
    - Multiple speaker detection
    """
    
    def __init__(self):
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not configured")
        
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = "gpt-4o-transcribe-diarize"  # Native diarization support
        print(f"[TRANSCRIPTION] Initialized with {self.model}")
    
    def transcribe_audio(
        self, 
        audio_file_path: str,
        enable_diarization: bool = True,
        actual_duration: Optional[float] = None
    ) -> Dict:
        """
        Transcribe audio file with native speaker diarization
        
        Args:
            audio_file_path: Path to the audio file
            enable_diarization: Whether to use speaker diarization
            actual_duration: Actual recording duration in seconds
            
        Returns:
            Dict containing transcription with speaker segments
            
        Raises:
            TranscriptionError: If transcription fails
        """
        try:
            print(f"[TRANSCRIPTION] Starting transcription for: {audio_file_path}")
            
            # Verify file exists
            file_path = Path(audio_file_path)
            if not file_path.exists():
                raise TranscriptionError(f"Audio file not found: {audio_file_path}")
            
            # Check file size
            file_size = file_path.stat().st_size
            print(f"[TRANSCRIPTION] File size: {file_size} bytes")
            
            if file_size == 0:
                raise TranscriptionError("Audio file is empty")
            
            # Transcribe with OpenAI gpt-4o-transcribe-diarize
            print(f"[TRANSCRIPTION] Calling OpenAI {self.model} API...")
            
            with open(audio_file_path, "rb") as audio_file:
                # Call diarization model with correct parameters
                response = self.client.audio.transcriptions.create(
                    model=self.model,
                    file=audio_file,
                    response_format="diarized_json",
                    extra_body={
                        "chunking_strategy": "auto"  # Required for audio > 30 seconds
                    }
                )
            
            print(f"[TRANSCRIPTION] Received response")
            
            # Log segments count
            segments_count = len(response.segments) if hasattr(response, 'segments') else 0
            print(f"[TRANSCRIPTION] Got {segments_count} diarized segments")
            
            # Format results from diarization response
            result = self._format_diarization_response(response, actual_duration)
            
            print(f"[TRANSCRIPTION] Transcription completed successfully")
            return result
            
        except Exception as e:
            print(f"[TRANSCRIPTION ERROR] {str(e)}")
            import traceback
            traceback.print_exc()
            raise TranscriptionError(f"Failed to transcribe audio: {str(e)}")
    
    def _format_diarization_response(
        self,
        transcription,
        actual_duration: Optional[float]
    ) -> Dict:
        """
        Format transcription results from gpt-4o-transcribe-diarize
        
        Args:
            transcription: API response with diarized segments
            actual_duration: Actual recording duration
            
        Returns:
            Formatted results with speaker segments
        """
        # Get basic info
        text = transcription.text if hasattr(transcription, 'text') else ""
        language = transcription.language if hasattr(transcription, 'language') else None
        duration = transcription.duration if hasattr(transcription, 'duration') else actual_duration
        
        # Get diarized segments
        segments_raw = transcription.segments if hasattr(transcription, 'segments') else []
        
        print(f"[TRANSCRIPTION] Processing {len(segments_raw)} diarized segments")
        
        # Format segments
        segments = []
        for seg in segments_raw:
            # Handle both dict and object responses
            if isinstance(seg, dict):
                segment = {
                    "speaker": seg.get('speaker', 'SPEAKER_00'),
                    "start": seg.get('start', 0),
                    "end": seg.get('end', 0),
                    "text": seg.get('text', '')
                }
            else:
                segment = {
                    "speaker": seg.speaker if hasattr(seg, 'speaker') else "SPEAKER_00",
                    "start": seg.start if hasattr(seg, 'start') else 0,
                    "end": seg.end if hasattr(seg, 'end') else 0,
                    "text": seg.text if hasattr(seg, 'text') else ""
                }
            segments.append(segment)
        
        # If no segments, create fallback
        if not segments:
            print("[TRANSCRIPTION WARNING] No diarized segments, using single speaker")
            segments = [{
                "speaker": "SPEAKER_00",
                "start": 0,
                "end": duration or 0,
                "text": text
            }]
        
        # Log speaker summary
        unique_speakers = len(set(seg["speaker"] for seg in segments))
        print(f"[TRANSCRIPTION] Detected {unique_speakers} unique speakers")
        
        for speaker in sorted(set(seg["speaker"] for seg in segments)):
            speaker_segments = [s for s in segments if s["speaker"] == speaker]
            total_time = sum(s["end"] - s["start"] for s in speaker_segments)
            print(f"[TRANSCRIPTION] {speaker}: {len(speaker_segments)} segments, {total_time:.1f}s speaking time")
        
        result = {
            "text": text,
            "language": language,
            "duration": duration,
            "segments": segments
        }
        
        return result
    
    def _extract_unique_speakers(self, segments: List[Dict]) -> List[str]:
        """Extract unique speaker labels from segments"""
        speakers = set()
        for segment in segments:
            if "speaker" in segment:
                speakers.add(segment["speaker"])
        return sorted(list(speakers))
    
    def transcribe_with_speakers(
        self,
        audio_file_path: str,
        actual_duration: Optional[float] = None
    ) -> Dict:
        """
        Complete transcription pipeline with native speaker diarization
        Uses OpenAI gpt-4o-transcribe-diarize
        
        Args:
            audio_file_path: Path to the audio file
            actual_duration: Actual recording duration in seconds
            
        Returns:
            Dict containing full transcript with speaker segments
            
        Raises:
            TranscriptionError: If transcription fails
        """
        print(f"[TRANSCRIPTION_PIPELINE] Starting diarization with {self.model}")
        
        # Get transcription with speaker estimation
        transcript_result = self.transcribe_audio(audio_file_path, actual_duration=actual_duration)
        
        # Format final output
        result = {
            "text": transcript_result["text"],
            "language": transcript_result["language"],
            "duration": transcript_result["duration"],
            "segments": transcript_result["segments"],
            "speakers": self._extract_unique_speakers(transcript_result["segments"])
        }
        
        print(f"[TRANSCRIPTION_PIPELINE] Pipeline completed successfully")
        print(f"[TRANSCRIPTION_PIPELINE] Total segments: {len(result['segments'])}")
        print(f"[TRANSCRIPTION_PIPELINE] Total speakers: {len(result['speakers'])}")
        
        return result
    
    def format_transcript_text(self, segments: List[Dict]) -> str:
        """
        Format transcript segments into readable text with speaker labels
        
        Args:
            segments: List of segments with text, timestamps, and speaker labels
            
        Returns:
            Formatted transcript text
        """
        formatted_lines = []
        current_speaker = None
        current_text = []
        
        for segment in segments:
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
        """Convert seconds to HH:MM:SS format"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
