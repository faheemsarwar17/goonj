/**
 * Speaker API calls
 */

import { apiClient } from './client'
import {
  Speaker,
  SpeakerCreate,
  SpeakerUpdate,
  DiarizationRequest,
  DiarizationResponse
} from '@/types/speaker'

export const speakerApi = {
  /**
   * Get all speakers for a transcript
   */
  getSpeakersByTranscript: async (transcriptId: number): Promise<Speaker[]> => {
    const response = await apiClient.get<Speaker[]>(`/speakers/transcript/${transcriptId}`)
    return response.data
  },

  /**
   * Create a new speaker
   */
  createSpeaker: async (data: SpeakerCreate): Promise<Speaker> => {
    const response = await apiClient.post<Speaker>('/speakers/', data)
    return response.data
  },

  /**
   * Update speaker name
   */
  updateSpeakerName: async (speakerId: number, data: SpeakerUpdate): Promise<Speaker> => {
    const response = await apiClient.patch<Speaker>(`/speakers/${speakerId}`, data)
    return response.data
  },

  /**
   * Delete a speaker
   */
  deleteSpeaker: async (speakerId: number): Promise<void> => {
    await apiClient.delete(`/speakers/${speakerId}`)
  },

  /**
   * Perform speaker diarization on a transcript
   */
  performDiarization: async (request: DiarizationRequest): Promise<DiarizationResponse> => {
    const response = await apiClient.post<DiarizationResponse>('/speakers/diarize', request)
    return response.data
  },
}
