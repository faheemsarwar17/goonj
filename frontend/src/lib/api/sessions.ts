/**
 * Session API calls
 */

import { apiClient } from './client'
import { Session, CreateSessionData, PaginatedResponse } from '@/types/session'

export const sessionApi = {
  /**
   * Create a new recording session
   */
  createSession: async (data: CreateSessionData): Promise<Session> => {
    const response = await apiClient.post<Session>('/sessions', data)
    return response.data
  },

  /**
   * End a recording session
   */
  endSession: async (sessionId: number, audioFile?: File, duration?: number): Promise<Session> => {
    console.log('[API] endSession called with:', {
      sessionId,
      audioFile: audioFile ? `${audioFile.name} (${audioFile.size} bytes, type: ${audioFile.type})` : 'undefined',
      duration
    })
    
    const formData = new FormData()
    
    // Only append if values are provided
    if (audioFile) {
      console.log('[API] Appending audio file to FormData')
      formData.append('audio_file', audioFile)
    } else {
      console.warn('[API] No audio file provided to endSession')
    }
    
    if (duration !== undefined && duration !== null) {
      console.log('[API] Appending duration to FormData:', duration)
      formData.append('duration_seconds', duration.toString())
    } else {
      console.warn('[API] No duration provided to endSession')
    }
    
    // Log FormData contents
    console.log('[API] FormData entries:')
    for (let pair of formData.entries()) {
      console.log('[API]  -', pair[0], ':', pair[1] instanceof File ? `File(${pair[1].name}, ${pair[1].size} bytes)` : pair[1])
    }

    console.log('[API] Sending POST request to /sessions/' + sessionId + '/end')
    const response = await apiClient.post<Session>(
      `/sessions/${sessionId}/end`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    console.log('[API] Response received:', response.status, response.statusText)
    return response.data
  },

  /**
   * List sessions with pagination
   */
  listSessions: async (page: number = 1, pageSize: number = 20): Promise<PaginatedResponse<Session>> => {
    const response = await apiClient.get<PaginatedResponse<Session>>('/sessions', {
      params: { page, page_size: pageSize },
    })
    return response.data
  },

  /**
   * Get session by ID
   */
  getSession: async (sessionId: number): Promise<Session> => {
    const response = await apiClient.get<Session>(`/sessions/${sessionId}`)
    return response.data
  },

  /**
   * Delete session
   */
  deleteSession: async (sessionId: number): Promise<void> => {
    await apiClient.delete(`/sessions/${sessionId}`)
  },
}
