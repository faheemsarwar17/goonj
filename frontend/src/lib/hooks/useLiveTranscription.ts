import { useState, useEffect, useRef, useCallback } from 'react'

export interface TranscriptSegment {
  speaker: string
  start: number
  end: number
  text: string
}

export interface LiveTranscriptionState {
  segments: TranscriptSegment[]
  isConnected: boolean
  error: string | null
}

export interface UseLiveTranscriptionReturn {
  segments: TranscriptSegment[]
  isConnected: boolean
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
  sendAudioChunk: (chunk: Blob) => void
}

export const useLiveTranscription = (sessionId: number): UseLiveTranscriptionReturn => {
  const [state, setState] = useState<LiveTranscriptionState>({
    segments: [],
    isConnected: false,
    error: null
  })
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5

  const connect = useCallback(async () => {
    // Get token from localStorage
    const token = localStorage.getItem('access_token')
    if (!token) {
      setState(prev => ({ ...prev, error: 'No authentication token' }))
      return
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected')
      return
    }

    try {
      // Determine WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.hostname
      const port = process.env.NEXT_PUBLIC_API_PORT || '8000'
      const wsUrl = `${protocol}//${host}:${port}/api/v1/ws/transcribe/${sessionId}?token=${token}`
      
      console.log('[WS] Connecting to:', wsUrl.replace(token, 'TOKEN'))
      
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WS] Connected to live transcription')
        setState(prev => ({ ...prev, isConnected: true, error: null }))
        reconnectAttemptsRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          
          if (message.type === 'transcription') {
            const { data } = message
            if (data.segments && data.segments.length > 0) {
              setState(prev => ({
                ...prev,
                segments: [...prev.segments, ...data.segments]
              }))
            }
          } else if (message.type === 'error') {
            console.error('[WS] Server error:', message.message)
            setState(prev => ({ ...prev, error: message.message }))
          } else if (message.type === 'status') {
            console.log('[WS] Status:', message.message)
          }
        } catch (err) {
          console.error('[WS] Failed to parse message:', err)
        }
      }

      ws.onerror = (error) => {
        console.error('[WS] WebSocket error:', error)
        setState(prev => ({ ...prev, error: 'WebSocket connection error' }))
      }

      ws.onclose = (event) => {
        console.log('[WS] WebSocket closed:', event.code, event.reason)
        setState(prev => ({ ...prev, isConnected: false }))
        wsRef.current = null

        // Attempt to reconnect unless manually disconnected
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000)
          console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setState(prev => ({ 
            ...prev, 
            error: 'Failed to connect after multiple attempts' 
          }))
        }
      }
    } catch (err: any) {
      console.error('[WS] Connection failed:', err)
      setState(prev => ({ ...prev, error: err.message || 'Failed to connect' }))
    }
  }, [sessionId])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect')
      wsRef.current = null
    }
    
    setState(prev => ({ ...prev, isConnected: false }))
  }, [])

  const sendAudioChunk = useCallback((chunk: Blob) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      chunk.arrayBuffer().then(buffer => {
        wsRef.current?.send(buffer)
      })
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    segments: state.segments,
    isConnected: state.isConnected,
    error: state.error,
    connect,
    disconnect,
    sendAudioChunk
  }
}
