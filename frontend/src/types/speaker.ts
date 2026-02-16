/**
 * Speaker and diarization types
 */

export interface SpeakerSegment {
  id: number
  speaker_id: number
  transcript_id: number
  start_time: number
  end_time: number
  text: string
  confidence: number
  created_at: string
}

export interface Speaker {
  id: number
  transcript_id: number
  tenant_id: number
  speaker_label: string
  speaker_name: string | null
  confidence: number
  total_speaking_time: number
  created_at: string
  updated_at: string
  segments: SpeakerSegment[]
}

export interface SpeakerSegmentCreate {
  start_time: number
  end_time: number
  text: string
  confidence?: number
}

export interface SpeakerCreate {
  transcript_id: number
  speaker_label: string
  speaker_name?: string | null
  confidence?: number
  segments?: SpeakerSegmentCreate[]
}

export interface SpeakerUpdate {
  speaker_name?: string | null
}

export interface DiarizationRequest {
  transcript_id: number
  min_speakers?: number
  max_speakers?: number
}

export interface DiarizationResponse {
  transcript_id: number
  speakers: Speaker[]
  total_speakers: number
  processing_time: number
}
