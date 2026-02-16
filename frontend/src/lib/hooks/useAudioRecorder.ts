import { useState, useRef, useCallback } from 'react'

export interface RecorderState {
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioBlob: Blob | null
}

export interface UseAudioRecorderReturn {
  state: RecorderState
  startRecording: (audioSource: 'microphone' | 'device' | 'both', existingMicStream?: MediaStream | null, existingScreenStream?: MediaStream | null) => Promise<void>
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
  })
  const [error, setError] = useState<string>('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
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
    existingScreenStream?: MediaStream | null
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
          
          // Stop video tracks since we only need audio
          systemStream.getVideoTracks().forEach(track => track.stop())
        } else {
          try {
            systemStream = await navigator.mediaDevices.getDisplayMedia({
              video: true, // Required for getDisplayMedia, even if we only want audio
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
              },
            })
            
            // Check if audio track was actually included
            const hasAudioTrack = systemStream.getAudioTracks().length > 0
            
            // Stop video tracks since we only need audio
            systemStream.getVideoTracks().forEach(track => track.stop())
            
            if (!hasAudioTrack) {
              systemStream.getTracks().forEach(track => track.stop())
              if (micStream && !existingMicStream) {
                micStream.getTracks().forEach(track => track.stop())
              }
              throw new Error(
                'No system audio was captured. Make sure to check "Share audio" when sharing your screen.'
              )
            }
          } catch (err: any) {
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
        const audioContext = new AudioContext()
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
        finalStream = systemStream
        streamRef.current = systemStream
      } else {
        throw new Error('No audio stream available')
      }

      // Create MediaRecorder
      const options: MediaRecorderOptions = {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      }

      const mediaRecorder = new MediaRecorder(finalStream, options)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        console.log(`[RECORDER] Recording stopped. Blob size: ${blob.size} bytes`)
        setState(prev => ({ ...prev, audioBlob: blob, isRecording: false, isPaused: false }))
        
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }

      mediaRecorder.start(100) // Collect data every 100ms
      startTimeRef.current = Date.now()
      pausedTimeRef.current = 0
      
      setState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        audioBlob: null,
      })
      
      updateDuration()
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

          resolve(blob)
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
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      
      setState(prev => ({ ...prev, isPaused: true }))
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
