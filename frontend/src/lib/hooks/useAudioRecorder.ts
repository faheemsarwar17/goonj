import { useState, useRef, useCallback } from 'react'

export interface RecorderState {
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioBlob: Blob | null
  stream: MediaStream | null
}

export interface UseAudioRecorderReturn {
  state: RecorderState
  startRecording: (audioSource: 'microphone' | 'device' | 'both', existingMicStream?: MediaStream | null, existingScreenStream?: MediaStream | null, onChunk?: (chunk: Blob) => void) => Promise<MediaStream>
  stopRecording: () => Promise<Blob | null>
  pauseRecording: () => void
  resumeRecording: () => void
  cancelRecording: () => void
  error: string
}

export const useAudioRecorder = (): UseAudioRecorderReturn => {
  const [state, setState] = useState<RecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioBlob: null,
    stream: null,
  })
  const [error, setError] = useState<string>('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const pausedTimeRef = useRef<number>(0)
  const pauseStartRef = useRef<number>(0)

  const updateDuration = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current - pausedTimeRef.current
      setState(prev => ({ ...prev, duration: Math.floor(elapsed / 1000) }))
    }, 1000)
  }, [])

  const startRecording = useCallback(async (
    audioSource: 'microphone' | 'device' | 'both',
    existingMicStream?: MediaStream | null,
    existingScreenStream?: MediaStream | null,
    onChunk?: (chunk: Blob) => void
  ) => {
    try {
      setError('')
      chunksRef.current = []
      
      let micStream: MediaStream | null = null
      let systemStream: MediaStream | null = null
      let finalStream: MediaStream

      // Get microphone stream (use existing if provided)
      if (audioSource === 'microphone' || audioSource === 'both') {
        if (existingMicStream && existingMicStream.active) {
          console.log('[RECORDER] Using existing microphone stream')
          micStream = existingMicStream
        } else {
          try {
            micStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            })
          } catch (err) {
            throw new Error('Microphone access denied. Please allow microphone permissions.')
          }
        }
      }

      // Get system audio (use existing if provided)
      if (audioSource === 'device' || audioSource === 'both') {
        if (existingScreenStream && existingScreenStream.active) {
          console.log('[RECORDER] Using existing screen stream')
          systemStream = existingScreenStream
          
          // Verify it has audio
          const hasAudioTrack = systemStream.getAudioTracks().length > 0
          if (!hasAudioTrack) {
            systemStream.getTracks().forEach(track => track.stop())
            if (micStream && !existingMicStream) {
              micStream.getTracks().forEach(track => track.stop())
            }
            throw new Error(
              'No system audio was captured. Make sure to check "Share audio" when sharing your screen.'
            )
          }
        } else {
          try {
            systemStream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: {
                echoCancellation: false, // Turn off echo cancellation for system audio to get raw sound
                noiseSuppression: false, // Turn off noise suppression for system audio
                autoGainControl: false,  // Turn off auto gain for system audio
              },
            })
            
            // Check if audio track was actually included
            const hasAudioTrack = systemStream.getAudioTracks().length > 0
            
            if (!hasAudioTrack) {
              // Don't stop tracks immediately if no audio found, to allow graceful exit or retry
              try {
                systemStream.getTracks().forEach(track => track.stop())
              } catch (e) {
                console.warn('Error stopping tracks', e)
              }

              if (micStream && !existingMicStream) {
                micStream.getTracks().forEach(track => track.stop())
              }
              throw new Error(
                'No system audio was captured. Make sure to check "Share audio" when sharing your screen.'
              )
            }
          } catch (err: any) {
            // Also stop mic stream if system stream failed
            if (micStream && !existingMicStream) {
              micStream.getTracks().forEach(track => track.stop())
            }
            if (err.message && err.message.includes('Share audio')) {
              throw err
            }
            throw new Error(
              'System audio capture was cancelled or denied. To record system audio, you must share your screen and check the "Share audio" option.'
            )
          }
        }
      }

      // Mix streams if both are selected
      if (audioSource === 'both' && micStream && systemStream) {
        // Close any existing context to prevent leaks (max 6 per browser)
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          await audioContextRef.current.close()
        }

        const audioContext = new AudioContext()
        audioContextRef.current = audioContext
        const destination = audioContext.createMediaStreamDestination()

        const micSource = audioContext.createMediaStreamSource(micStream)
        const systemSource = audioContext.createMediaStreamSource(systemStream)

        micSource.connect(destination)
        systemSource.connect(destination)

        finalStream = destination.stream
        
        // Keep references to stop later
        streamRef.current = new MediaStream([
          ...micStream.getTracks(),
          ...systemStream.getTracks(),
        ])
      } else if (micStream) {
        finalStream = micStream
        streamRef.current = micStream
      } else if (systemStream) {
        // Create audio-only stream to prevent MediaRecorder mimeType mismatch
        // since getDisplayMedia always returns a video track
        finalStream = new MediaStream(systemStream.getAudioTracks())
        streamRef.current = systemStream // Keep original to stop all tracks later
      } else {
        throw new Error('No audio stream available')
      }

      // Create MediaRecorder
      const options: MediaRecorderOptions = {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      }
      
      // Ensure finalStream has only audio tracks for audio mimeType
      // This is critical if we passed a full stream with video (e.g. mic + system without mixing, or raw mic stream with video)
      if (finalStream.getVideoTracks().length > 0) {
        console.log('[RECORDER] Filtering out video tracks for audio-only recorder')
        finalStream = new MediaStream(finalStream.getAudioTracks())
      }

      console.log(`[RECORDER] Creating MediaRecorder with mimeType: ${options.mimeType}`)
      const mediaRecorder = new MediaRecorder(finalStream, options)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`[RECORDER] Received chunk: ${event.data.size} bytes`)
          chunksRef.current.push(event.data)
          // Call chunk callback if provided (for live streaming)
          if (onChunk) {
            onChunk(event.data)
          }
        }
      }

      mediaRecorder.onstop = () => {
        // Request any remaining data before creating final blob
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.requestData()
        }
        
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        console.log(`[RECORDER] Recording stopped. Total chunks: ${chunksRef.current.length}, Blob size: ${blob.size} bytes`)
        setState(prev => ({ ...prev, audioBlob: blob, isRecording: false, isPaused: false }))
        
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }

      // Use 1000ms (1 second) timeslice for proper WebM chunks
      // Smaller timeslices create corrupted files when reassembled
      mediaRecorder.start(1000)
      startTimeRef.current = Date.now()
      pausedTimeRef.current = 0
      
      setState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        audioBlob: null,
        stream: finalStream,
      })
      
      updateDuration()
      
      console.log('[RECORDER] Recording started successfully with stream:', !!finalStream)
      return finalStream
    } catch (err: any) {
      setError(err.message || 'Failed to start recording')
      throw err
    }
  }, [updateDuration])

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (mediaRecorderRef.current && state.isRecording) {
        mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          console.log(`[RECORDER] Stopping recording. Total chunks: ${chunksRef.current.length}, Blob size: ${blob.size} bytes`)
          setState(prev => ({ ...prev, audioBlob: blob, isRecording: false, isPaused: false }))
          
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }

          // Stop all tracks
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
          }

          // Close AudioContext to prevent resource leaks/crashes
          if (audioContextRef.current) {
            audioContextRef.current.close()
            audioContextRef.current = null
          }

          resolve(blob)
        }

        // Request final data before stopping to ensure nothing is lost
        if (mediaRecorderRef.current.state === 'recording') {
          console.log('[RECORDER] Requesting final data before stop')
          mediaRecorderRef.current.requestData()
        }
        
        mediaRecorderRef.current.stop()
      } else {
        resolve(null)
      }
    })
  }, [state.isRecording])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording && !state.isPaused) {
      mediaRecorderRef.current.pause()
      pauseStartRef.current = Date.now()
      setState(prev => ({ ...prev, isPaused: true }))
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [state.isRecording, state.isPaused])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording && state.isPaused) {
      mediaRecorderRef.current.resume()
      pausedTimeRef.current += Date.now() - pauseStartRef.current
      setState(prev => ({ ...prev, isPaused: false }))
      updateDuration()
    }
  }, [state.isRecording, state.isPaused, updateDuration])

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    chunksRef.current = []
    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioBlob: null,
      stream: null,
    })
  }, [])

  return {
    state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    error,
  }
}
