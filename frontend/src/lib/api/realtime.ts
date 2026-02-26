import { apiClient } from './client'

export interface RealtimeSessionAPI {
  websocket_url: string
}

export interface RealtimeSession {
  websocketUrl: string
}

export const realtimeApi = {
  async createSession(sessionId: number): Promise<RealtimeSession> {
    const response = await apiClient.post<RealtimeSessionAPI>(`/sessions/${sessionId}/realtime`)
    
    // Transform snake_case to camelCase
    return {
      websocketUrl: response.data.websocket_url
    }
  }
}
