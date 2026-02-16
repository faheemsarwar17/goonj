/**
 * Transcript API calls
 */

import { apiClient } from './client'
import { Transcript, CreateTranscriptData } from '@/types/transcript'

export const transcriptsApi = {
  /**
   * Get all my transcripts
   */
  getMyTranscripts: async (): Promise<Transcript[]> => {
    const response = await apiClient.get<Transcript[]>('/transcripts')
    return response.data
  },

  /**
   * Create transcript for a session
   */
  createTranscript: async (data: CreateTranscriptData): Promise<Transcript> => {
    const response = await apiClient.post<Transcript>('/transcripts', data)
    return response.data
  },

  /**
   * Get transcript by session ID
   */
  getTranscriptBySession: async (sessionId: number): Promise<Transcript> => {
    const response = await apiClient.get<Transcript>(`/transcripts/session/${sessionId}`)
    return response.data
  },

  /**
   * Update transcript
   */
  updateTranscript: async (transcriptId: number, content: string): Promise<Transcript> => {
    const response = await apiClient.put<Transcript>(`/transcripts/${transcriptId}`, { content })
    return response.data
  },

  /**
   * Delete transcript
   */
  deleteTranscript: async (transcriptId: number): Promise<void> => {
    await apiClient.delete(`/transcripts/${transcriptId}`)
  },
}
