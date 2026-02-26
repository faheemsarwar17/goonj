"""AI-powered transcription service"""

import os
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from openai import OpenAI
from pydub import AudioSegment
from app.core.config import settings
from app.core.exceptions import TranscriptionError


class TranscriptionService:
    """
    Service for AI-powered audio transcription with speaker diarization
    
    This service provides:
    - Speaker diarization and identification
    - Accurate speaker labels with timestamps
    - Automatic audio chunking for long recordings
    - Multiple speaker detection
    - Audio format conversion for compatibility
    """
    
    def __init__(self):
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not configured")
        
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_MODEL
    
    def _convert_to_mp3(self, audio_file_path: str) -> str:
        """
        Convert audio file to MP3 format for better OpenAI compatibility
        
        Args:
            audio_file_path: Path to the audio file
            
        Returns:
            Path to the converted MP3 file
        """
        print(f"[TRANSCRIPTION] Converting audio to MP3: {audio_file_path}")
        
        try:
            file_path = Path(audio_file_path)
            file_ext = file_path.suffix.lower()
            
            # If already MP3, return as-is
            if file_ext == '.mp3':
                return audio_file_path
            
            # Load the audio file
            audio = AudioSegment.from_file(audio_file_path)
            
            # Create temporary MP3 file
            temp_mp3 = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
            temp_mp3_path = temp_mp3.name
            temp_mp3.close()
            
            # Export as MP3
            audio.export(temp_mp3_path, format='mp3', bitrate='128k')
            
            print(f"[TRANSCRIPTION] Converted to MP3: {temp_mp3_path}")
            return temp_mp3_path
            
        except Exception as e:
            print(f"[TRANSCRIPTION ERROR] Failed to convert audio: {str(e)}")
            # If conversion fails, return original file
            return audio_file_path
    
    def transcribe_audio(
        self, 
        audio_file_path: str,
        enable_diarization: bool = True,
        actual_duration: Optional[float] = None
    ) -> Dict:
        """
        Transcribe audio file with speaker diarization
        
        Args:
            audio_file_path: Path to the audio file
            enable_diarization: Whether to use speaker diarization
            actual_duration: Actual recording duration in seconds
            
        Returns:
            Dict containing transcription with speaker segments
            
        Raises:
            TranscriptionError: If transcription fails
        """
        converted_file = None
        try:
            # Verify file exists
            file_path = Path(audio_file_path)
            if not file_path.exists():
                raise TranscriptionError(f"Audio file not found: {audio_file_path}")
            
            # Check file size
            file_size = file_path.stat().st_size
            if file_size == 0:
                raise TranscriptionError("Audio file is empty")
            
            # Convert to MP3 for better OpenAI compatibility
            converted_file = self._convert_to_mp3(audio_file_path)
            
            with open(converted_file, "rb") as audio_file:
                response = self.client.audio.transcriptions.create(
                    model=self.model,
                    file=audio_file,
                    response_format="diarized_json",
                    extra_body={
                        "chunking_strategy": "auto"
                    }
                )
            
            # Format results from diarization response
            result = self._format_diarization_response(response, actual_duration)
            return result
            
        except Exception as e:
            raise TranscriptionError(f"Failed to transcribe audio: {str(e)}")
        finally:
            # Clean up temporary MP3 file if it was created
            if converted_file and converted_file != audio_file_path:
                try:
                    os.remove(converted_file)
                    print(f"[TRANSCRIPTION] Cleaned up temp file: {converted_file}")
                except Exception as e:
                    print(f"[TRANSCRIPTION] Failed to clean up temp file: {e}")
    
    def _format_diarization_response(
        self,
        transcription,
        actual_duration: Optional[float]
    ) -> Dict:
        """
        Format transcription results from API response
        
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
            segments = [{
                "speaker": "SPEAKER_00",
                "start": 0,
                "end": duration or 0,
                "text": text
            }]
        
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
        Complete transcription pipeline with speaker diarization
        
        Args:
            audio_file_path: Path to the audio file
            actual_duration: Actual recording duration in seconds
            
        Returns:
            Dict containing full transcript with speaker segments
            
        Raises:
            TranscriptionError: If transcription fails
        """
        # Get transcription with speaker diarization
        transcript_result = self.transcribe_audio(audio_file_path, actual_duration=actual_duration)
        
        # Format final output
        result = {
            "text": transcript_result["text"],
            "language": transcript_result["language"],
            "duration": transcript_result["duration"],
            "segments": transcript_result["segments"],
            "speakers": self._extract_unique_speakers(transcript_result["segments"])
        }
        
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
