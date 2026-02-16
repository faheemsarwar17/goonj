/**
 * Session type definitions
 */

export enum SessionStatus {
  RECORDING = 'recording',
  COMPLETED = 'completed',
  PROCESSING = 'processing',
  FAILED = 'failed',
}

export enum AudioSource {
  DEVICE = 'device',
  MICROPHONE = 'microphone',
  BOTH = 'both',
}

export interface Session {
  id: number
  tenant_id: number
  user_id: number
  title: string
  audio_file_path: string | null
  audio_source: AudioSource
  duration_seconds: number | null
  file_size_bytes: number | null
  status: SessionStatus
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateSessionData {
  title: string
  audio_source: AudioSource
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}
