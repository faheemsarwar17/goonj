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
    Uses OpenAI gpt-4o-transcribe-diarize model for unified transcription and speaker identification
    Follows Single Responsibility Principle - handles only transcription logic
    """
    
    def __init__(self):
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not configured")
        
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_MODEL
    
    def transcribe_audio(
        self, 
        audio_file_path: str,
        enable_diarization: bool = True,
        actual_duration: Optional[float] = None
    ) -> Dict:
        """
        Transcribe audio file with speaker diarization using gpt-4o-transcribe-diarize
        
        Args:
            audio_file_path: Path to the audio file
            enable_diarization: Whether to include speaker diarization
            actual_duration: Actual recording duration in seconds (for accurate time calculations)
            
        Returns:
            Dict containing transcription results with timestamps and speaker labels
            
        Raises:
            TranscriptionError: If transcription fails
        """
        try:
            print(f"[TRANSCRIPTION] Starting transcription with diarization for: {audio_file_path}")
            
            # Verify file exists
            file_path = Path(audio_file_path)
            if not file_path.exists():
                raise TranscriptionError(f"Audio file not found: {audio_file_path}")
            
            # Check file size
            file_size = file_path.stat().st_size
            print(f"[TRANSCRIPTION] File size: {file_size} bytes")
            
            if file_size == 0:
                raise TranscriptionError("Audio file is empty")
            
            # Open and transcribe audio file
            with open(audio_file_path, "rb") as audio_file:
                print(f"[TRANSCRIPTION] Calling OpenAI {self.model} API...")
                
                # Call gpt-4o-transcribe-diarize API with diarization
                # Pass chunking_strategy through extra_body for custom API parameters
                response = self.client.audio.transcriptions.create(
                    model=self.model,
                    file=audio_file,
                    response_format="json",
                    extra_body={"chunking_strategy": "auto"}  # Required for diarization models
                )
            
            print(f"[TRANSCRIPTION] Transcription completed successfully")
            print(f"[TRANSCRIPTION] Response type: {type(response)}")
            
            # Debug: Print full response structure
            print(f"[TRANSCRIPTION] Response fields:")
            if hasattr(response, 'model_dump'):
                response_dict = response.model_dump()
                for key, value in response_dict.items():
                    if key == 'text':
                        print(f"  - {key}: {len(str(value))} characters")
                    elif isinstance(value, list) and len(value) > 0:
                        print(f"  - {key}: {len(value)} items")
                    else:
                        print(f"  - {key}: {value}")
            
            # Try to get text from response
            response_text = ""
            if hasattr(response, 'text'):
                response_text = response.text
            elif isinstance(response, dict) and 'text' in response:
                response_text = response['text']
            
            print(f"[TRANSCRIPTION] Text length: {len(response_text)} characters")
            
            # Structure the response
            result = {
                "text": response_text,
                "language": getattr(response, 'language', None),
                "duration": getattr(response, 'duration', None),
                "segments": []
            }
            
            # Extract segments with timestamps and speaker labels
            segments = None
            if hasattr(response, 'segments'):
                segments = response.segments
            elif isinstance(response, dict) and 'segments' in response:
                segments = response['segments']
            elif hasattr(response, 'words'):
                # Some models return 'words' instead of 'segments'
                segments = response.words
            elif isinstance(response, dict) and 'words' in response:
                segments = response['words']
            
            if segments:
                print(f"[TRANSCRIPTION] Processing {len(segments)} segments")
                for segment in segments:
                    # Handle both dict and object formats
                    if isinstance(segment, dict):
                        segment_dict = {
                            "start": segment.get("start", 0),
                            "end": segment.get("end", 0),
                            "text": segment.get("text", "").strip(),
                            "speaker": segment.get("speaker", "SPEAKER_00")
                        }
                    else:
                        segment_dict = {
                            "start": getattr(segment, "start", 0),
                            "end": getattr(segment, "end", 0),
                            "text": getattr(segment, "text", "").strip(),
                            "speaker": getattr(segment, "speaker", "SPEAKER_00")
                        }
                    
                    result["segments"].append(segment_dict)
            else:
                print("[TRANSCRIPTION] No segments found in response, creating single segment")
                # If no segments, create a single segment with the full text
                # Use actual duration if provided, otherwise estimate from word count
                segment_duration = actual_duration or result.get("duration")
                
                if not segment_duration:
                    word_count = len(response_text.split())
                    segment_duration = max(1, word_count / 2.5)  # Rough estimate: ~150 words per minute
                    print(f"[TRANSCRIPTION] Estimated duration from word count: {segment_duration:.1f}s ({word_count} words)")
                else:
                    print(f"[TRANSCRIPTION] Using actual duration: {segment_duration:.1f}s")
                
                result["segments"].append({
                    "start": 0,
                    "end": segment_duration,
                    "text": response_text,
                    "speaker": "SPEAKER_00"
                })
                
                # Update result duration
                result["duration"] = segment_duration
            
            # Extract unique speakers
            unique_speakers = self._extract_unique_speakers(result["segments"])
            print(f"[TRANSCRIPTION] Found {len(unique_speakers)} unique speakers")
            
            return result
            
        except Exception as e:
            print(f"[TRANSCRIPTION ERROR] {str(e)}")
            import traceback
            traceback.print_exc()
            raise TranscriptionError(f"Failed to transcribe audio: {str(e)}")
    
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
        Uses gpt-4o-transcribe-diarize for unified transcription and speaker identification
        
        Args:
            audio_file_path: Path to the audio file
            actual_duration: Actual recording duration in seconds
            
        Returns:
            Dict containing full transcript with speaker labels and metadata
            
        Raises:
            TranscriptionError: If transcription fails
        """
        print(f"[TRANSCRIPTION_PIPELINE] Starting transcription pipeline with {self.model}")
        
        # Single API call for transcription + diarization
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
