import { useState, useEffect, useRef, useCallback } from 'react'

export interface TranscriptSegment {
  start: number
  end: number
  text: string
  isFinal: boolean
}

export interface UseLiveSpeechRecognitionReturn {
  segments: TranscriptSegment[]
  isRecognizing: boolean
  error: string | null
  start: () => void
  stop: () => void
  clearSegments: () => void
}

// Extend Window interface for WebKit support
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

export const useLiveSpeechRecognition = (): UseLiveSpeechRecognitionReturn => {
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const recognitionRef = useRef<any>(null)
  const startTimeRef = useRef<number>(0)
  const shouldBeRecognizingRef = useRef<boolean>(false)
  const lastFinalTimeRef = useRef<number>(0)

  // Initialize speech recognition (only once)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser. Use Chrome or Edge.')
      return
    }

    const recognition = new SpeechRecognition()
    
    // Configuration for live transcription
    recognition.continuous = true // Keep listening
    recognition.interimResults = true // Get partial results
    recognition.maxAlternatives = 1
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      console.log('[SPEECH] Recognition started')
      setIsRecognizing(true)
      setError(null)
      if (startTimeRef.current === 0) {
        startTimeRef.current = Date.now()
      }
    }

    recognition.onresult = (event: any) => {
      const results = event.results
      const lastResult = results[results.length - 1]
      const transcript = lastResult[0].transcript
      const isFinal = lastResult.isFinal
      const confidence = lastResult[0].confidence

      const currentTime = (Date.now() - startTimeRef.current) / 1000

      if (isFinal) {
        console.log(`[SPEECH] Final: "${transcript}" (confidence: ${confidence})`)
        lastFinalTimeRef.current = currentTime
        
        // Add final segment
        setSegments(prev => {
          // Remove any interim segment and add final
          const withoutInterim = prev.filter(s => s.isFinal)
          return [...withoutInterim, {
            start: lastFinalTimeRef.current,
            end: currentTime,
            text: transcript.trim(),
            isFinal: true
          }]
        })
      } else {
        // Interim result - show as temporary
        console.log(`[SPEECH] Interim: "${transcript}"`)
        
        setSegments(prev => {
          // Replace last interim result or add new
          const finalSegments = prev.filter(s => s.isFinal)
          return [...finalSegments, {
            start: currentTime - 1,
            end: currentTime,
            text: transcript.trim(),
            isFinal: false
          }]
        })
      }
    }

    recognition.onerror = (event: any) => {
      console.error('[SPEECH] Error:', event.error)
      
      if (event.error === 'no-speech') {
        // Ignore no-speech errors, just continue
        console.log('[SPEECH] No speech detected, continuing...')
        return
      } else if (event.error === 'network') {
        setError('Network error. Please check your connection.')
        shouldBeRecognizingRef.current = false
      } else if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone permissions.')
        shouldBeRecognizingRef.current = false
      } else if (event.error === 'aborted') {
        // Ignore aborted errors (happens on manual stop)
        console.log('[SPEECH] Recognition aborted')
        return
      } else {
        setError(`Speech recognition error: ${event.error}`)
        shouldBeRecognizingRef.current = false
      }
    }

    recognition.onend = () => {
      console.log('[SPEECH] Recognition ended, shouldBeRecognizing:', shouldBeRecognizingRef.current)
      
      // Auto-restart immediately if still supposed to be recognizing
      if (shouldBeRecognizingRef.current) {
        console.log('[SPEECH] Auto-restarting recognition...')
        try {
          recognition.start()
        } catch (err: any) {
          // If it fails because already started, ignore
          if (!err.message?.includes('already started')) {
            console.error('[SPEECH] Failed to restart:', err)
            setIsRecognizing(false)
          }
        }
      } else {
        setIsRecognizing(false)
      }
    }

    recognitionRef.current = recognition

    return () => {
      shouldBeRecognizingRef.current = false
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (err) {
          // Ignore errors on cleanup
        }
      }
    }
  }, []) // Empty dependency array - only initialize once

  const start = useCallback(() => {
    if (!recognitionRef.current) {
      setError('Speech recognition not initialized. Use Chrome or Edge browser.')
      return
    }

    try {
      console.log('[SPEECH] Starting recognition...')
      setError(null)
      shouldBeRecognizingRef.current = true
      startTimeRef.current = Date.now()
      lastFinalTimeRef.current = 0
      recognitionRef.current.start()
    } catch (err: any) {
      console.error('[SPEECH] Start error:', err)
      if (err.message?.includes('already started')) {
        // Already running, that's fine
        console.log('[SPEECH] Already started, continuing...')
        setIsRecognizing(true)
        shouldBeRecognizingRef.current = true
      } else {
        setError(err.message || 'Failed to start speech recognition')
        shouldBeRecognizingRef.current = false
      }
    }
  }, [])

  const stop = useCallback(() => {
    console.log('[SPEECH] Stopping recognition...')
    shouldBeRecognizingRef.current = false
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (err) {
        console.error('[SPEECH] Stop error:', err)
      }
    }
    setIsRecognizing(false)
  }, [])

  const clearSegments = useCallback(() => {
    setSegments([])
    lastFinalTimeRef.current = 0
  }, [])

  return {
    segments,
    isRecognizing,
    error,
    start,
    stop,
    clearSegments
  }
}
