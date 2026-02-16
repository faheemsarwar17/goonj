/**
 * Transcript type definitions
 */

export interface Transcript {
  id: number
  session_id: number
  tenant_id: number
  content: string
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface CreateTranscriptData {
  session_id: number
  content: string
  metadata?: Record<string, any>
}
