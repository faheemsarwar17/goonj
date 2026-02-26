'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter, useParams } from 'next/navigation'
import { sessionApi } from '@/lib/api/sessions'
import { realtimeApi } from '@/lib/api/realtime'
import { Session } from '@/types/session'
import { useAudioRecorder } from '@/lib/hooks/useAudioRecorder'
import { useRecordingContext } from '@/lib/contexts/RecordingContext'
import { useOpenAIRealtime } from '@/lib/hooks/useOpenAIRealtime'

export default function SessionRecordPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const sessionId = params?.id as string
  const recordingContext = useRecordingContext()
  
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEnding, setIsEnding] = useState(false)
  const [error, setError] = useState('')
  const [recordingStarted, setRecordingStarted] = useState(false)
  const [isInitializingStream, setIsInitializingStream] = useState(false)

  const recorder = useAudioRecorder()
  
  // OpenAI Realtime API for live transcription
  const {
    transcripts: liveTranscripts,
    isConnected,
    isTranscribing,
    isPaused: realtimePaused,
    error: realtimeError,
    connect: connectRealtime,
    disconnect: disconnectRealtime,
    pause: pauseRealtime,
    resume: resumeRealtime
  } = useOpenAIRealtime()
  
  const transcriptEndRef = useRef<HTMLDivElement | null>(null)
  
  // Refs for navigation blocking to avoid stale closures
  const sessionRef = useRef(session)
  const recorderRef = useRef(recorder)
  const isConnectedRef = useRef(isConnected)
  const disconnectRealtimeRef = useRef(disconnectRealtime)
  
  // Update refs on every render
  useEffect(() => {
    sessionRef.current = session
    recorderRef.current = recorder
    isConnectedRef.current = isConnected
    disconnectRealtimeRef.current = disconnectRealtime
  })

  useEffect(() => {
    if (user && sessionId) {
      loadSession()
    }
  }, [user, sessionId])

  // Auto-start recording when component mounts
  useEffect(() => {
    if (session && !recordingStarted) {
      handleStartRecording()
    }
  }, [session, recordingStarted])

  // Cleanup: stop recording when component unmounts
  useEffect(() => {
    return () => {
      if (recorder.state.isRecording) {
        recorder.cancelRecording()
      }
      if (isConnected) {
        disconnectRealtime()
      }
    }
  }, [])
  
  // Prevent navigation away from page during recording
  useEffect(() => {
    if (!recordingStarted) return
    
    // Prevent browser back button
    const handlePopState = async (e: PopStateEvent) => {
      if (recorderRef.current.state.isRecording) {
        e.preventDefault()
        
        const shouldEndSession = window.confirm(
          'Do you want to end the recording session and return to the dashboard?\n\n' +
          'Click OK to save and end the session.\n' +
          'Click Cancel to continue recording.'
        )
        
        if (!shouldEndSession) {
          // Push the current state back to prevent navigation
          window.history.pushState(null, '', window.location.href)
        } else {
          // User confirmed, end the session properly
          try {
            console.log('[RECORD] Ending session from back button...')
            
            // Stop OpenAI Realtime transcription
            disconnectRealtimeRef.current()
            
            // Stop recording and get audio blob
            let audioBlob: Blob | null = null
            if (recorderRef.current.state.isRecording) {
              audioBlob = await recorderRef.current.stopRecording()
              console.log('[RECORD] Recording stopped, blob received:', audioBlob ? `${audioBlob.size} bytes` : 'null')
            }
            
            if (audioBlob && sessionRef.current) {
              // Convert blob to file
              const audioFile = new File([audioBlob], `recording-${sessionRef.current.id}.webm`, {
                type: 'audio/webm'
              })
              console.log('[RECORD] Audio file created:', audioFile.name, audioFile.size, 'bytes')
              
              // End session with audio file and duration
              console.log('[RECORD] Uploading audio and ending session...')
              await sessionApi.endSession(
                sessionRef.current.id,
                audioFile,
                recorderRef.current.state.duration >= 0 ? recorderRef.current.state.duration : undefined
              )
              
              console.log('[RECORD] Session ended successfully, navigating to dashboard')
              router.push('/dashboard')
            } else {
              // No audio blob, just cancel and go to dashboard
              console.log('[RECORD] No audio to save, navigating to dashboard')
              router.push('/dashboard')
            }
          } catch (err) {
            console.error('[RECORD] Error ending session from back button:', err)
            // Even if there's an error, allow navigation to dashboard
            router.push('/dashboard')
          }
        }
      }
    }

    // Prevent page refresh/close
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (recorderRef.current.state.isRecording) {
        e.preventDefault()
        e.returnValue = 'Recording is in progress. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    // Push initial state to enable back button interception
    window.history.pushState(null, '', window.location.href)
    
    window.addEventListener('popstate', handlePopState)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [recordingStarted, router])
  
  // Auto-scroll transcript to bottom
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [liveTranscripts])
  
  // Handle pause/resume for live transcription
  useEffect(() => {
    if (!recordingStarted || !isConnected) return
    
    if (recorder.state.isPaused && !realtimePaused) {
      console.log('[RECORD] Recording paused, pausing live transcription')
      pauseRealtime()
    } else if (!recorder.state.isPaused && realtimePaused) {
      console.log('[RECORD] Recording resumed, resuming live transcription')
      resumeRealtime()
    }
  }, [recorder.state.isPaused, recordingStarted, isConnected, realtimePaused, pauseRealtime, resumeRealtime])

  const loadSession = async () => {
    if (!sessionId) return
    
    const parsedId = parseInt(sessionId)
    if (isNaN(parsedId) || parsedId <= 0) {
      setError('Invalid session ID')
      setIsLoading(false)
      return
    }
    
    try {
      setIsLoading(true)
      const sessionData = await sessionApi.getSession(parsedId)
      
      if (sessionData.status !== 'recording') {
        setError('Session is not in recording state')
        router.push(`/sessions/${sessionId}`)
        return
      }
      
      setSession(sessionData)
      setError('')
    } catch (err: any) {
      console.error('Session load error:', err)
      setError('Failed to load session')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${hours > 0 ? hours + 'h ' : ''}${minutes}m ${secs}s`
  }

  const handleStartRecording = async () => {
    if (!session || recordingStarted) return
    
    try {
      setError('')
      setIsInitializingStream(true)
      
      const audioSourceMap: Record<string, 'microphone' | 'device' | 'both'> = {
        'microphone': 'microphone',
        'device': 'device',
        'both': 'both'
      }
      
      const source = audioSourceMap[session.audio_source] || 'microphone'
      
      // Start audio recording for file storage - returns the stream directly
      console.log('[RECORD] Starting recording with source:', source)
      const audioStream = await recorder.startRecording(
        source,
        recordingContext.micStream,
        recordingContext.screenStream
      )
      
      console.log('[RECORD] Recording started, stream received:', !!audioStream)
      
      if (!audioStream) {
        console.error('[RECORD] No audio stream returned from recorder')
        setError('Unable to initialize audio stream. Please try again or check your audio source permissions.')
        setIsInitializingStream(false)
        // Stop the recording attempt
        if (recorder.state.isRecording) {
          recorder.cancelRecording()
        }
        return
      }
      
      // Verify stream has audio tracks
      const streamTracks = audioStream.getAudioTracks()
      console.log('[RECORD] Audio stream has', streamTracks.length, 'audio tracks')
      streamTracks.forEach((track, i) => {
        console.log(`[RECORD] Track ${i}:`, track.label, 'enabled:', track.enabled, 'readyState:', track.readyState)
      })
      
      if (streamTracks.length === 0) {
        console.error('[RECORD] Audio stream has no audio tracks')
        setError('No audio tracks found in stream. Please check your audio source.')
        setIsInitializingStream(false)
        recorder.cancelRecording()
        return
      }
      
      // Start OpenAI Realtime API for live transcription using the same audio stream
      console.log('[RECORD] Creating Realtime session...')
      const realtimeSession = await realtimeApi.createSession(session.id)
      console.log('[RECORD] Realtime session created, connecting with audio stream...')
      
      console.log('[RECORD] Connecting Realtime with recorder audio stream for', source, 'audio')
      await connectRealtime(realtimeSession, audioStream)
      
      setRecordingStarted(true)
      setIsInitializingStream(false)
      console.log('[RECORD] Recording started with OpenAI Realtime transcription')
    } catch (err: any) {
      setError(err.message || 'Failed to start recording')
      setIsInitializingStream(false)
      console.error('[RECORD ERROR]', err)
    }
  }

  const handleEndSession = async () => {
    if (!session || !sessionId) return
    
    if (!confirm('Are you sure you want to end this recording session?')) return
    
    try {
      setIsEnding(true)
      setError('')
      
      console.log('[RECORD] Ending session...')
      
      // Stop OpenAI Realtime transcription
      disconnectRealtime()
      
      // Stop recording and get audio blob
      let audioBlob: Blob | null = null
      if (recorder.state.isRecording) {
        audioBlob = await recorder.stopRecording()
        console.log('[RECORD] Recording stopped, blob received:', audioBlob ? `${audioBlob.size} bytes` : 'null')
      }
      
      if (!audioBlob) {
        setError('No audio was recorded. Please make sure audio is being captured.')
        setIsEnding(false)
        return
      }
      
      // Convert blob to file
      const audioFile = new File([audioBlob], `recording-${session.id}.webm`, {
        type: 'audio/webm'
      })
      console.log('[RECORD] Audio file created:', audioFile.name, audioFile.size, 'bytes')
      
      // End session with audio file and duration
      console.log('[RECORD] Uploading audio and ending session...')
      await sessionApi.endSession(
        session.id,
        audioFile,
        recorder.state.duration >= 0 ? recorder.state.duration : undefined
      )
      
      console.log('[RECORD] Session ended successfully')
      
      // Redirect to session detail page
      router.push(`/sessions/${sessionId}`)
    } catch (err: any) {
      console.error('[RECORD] End session error:', err)
      let errorMessage = 'Failed to end session'
      try {
        const detail = err.response?.data?.detail
        if (typeof detail === 'string') {
          errorMessage = detail
        } else if (detail && typeof detail === 'object') {
          errorMessage = JSON.stringify(detail)
        } else if (err.message) {
          errorMessage = err.message
        }
      } catch (stringifyError) {
        errorMessage = 'Failed to end session'
      }
      setError(errorMessage)
    } finally {
      setIsEnding(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Compact Header */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center space-x-4">
              <span className="flex h-2.5 w-2.5 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${recorder.state.isPaused ? 'bg-yellow-400' : 'bg-red-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${recorder.state.isPaused ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
              </span>
              <h1 className="text-lg font-semibold text-gray-900">
                {recorder.state.isPaused ? 'Paused' : 'Recording'}
              </h1>
              <span className="hidden sm:inline text-sm text-gray-500">•</span>
              <span className="hidden sm:inline text-sm font-medium text-gray-700">{formatDuration(recorder.state.duration)}</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-700 hidden md:inline">{user.full_name}</span>
              <button
                onClick={() => useAuth.getState().logout()}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
        {/* Error Banner */}
        {error && !isInitializingStream && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg p-4 shadow-sm">
            <div className="flex items-start">
              <svg className="h-5 w-5 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="ml-3 text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Loading States */}
        {isLoading ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading session...</p>
          </div>
        ) : !session ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-600 font-medium">Session not found</p>
          </div>
        ) : isInitializingStream ? (
            <div className="bg-white rounded-lg shadow p-8">
              <div className="text-center space-y-6">
                {error ? (
                  // Error state - show error and retry button
                  <>
                    <div className="flex justify-center">
                      <div className="rounded-full h-16 w-16 bg-red-100 flex items-center justify-center">
                        <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">Initialization Failed</h2>
                      <p className="text-red-600">{error}</p>
                      <p className="text-sm text-gray-500 mt-2">Audio Source: {session.audio_source}</p>
                    </div>
                    <div className="flex justify-center space-x-4">
                      <button
                        onClick={() => {
                          setError('')
                          setIsInitializingStream(false)
                          handleStartRecording()
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium"
                      >
                        Retry
                      </button>
                      <button
                        onClick={() => {
                          setError('')
                          setIsInitializingStream(false)
                          router.push(`/sessions/${sessionId}`)
                        }}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-md font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  // Loading state
                  <>
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">Initializing Recording Session</h2>
                      <p className="text-gray-600">Setting up audio stream and live transcription...</p>
                      <p className="text-sm text-gray-500 mt-2">Audio Source: {session.audio_source}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                        <span className="text-sm text-gray-600">Starting audio capture</span>
                      </div>
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                        <span className="text-sm text-gray-600">Connecting to live transcription</span>
                      </div>
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                        <span className="text-sm text-gray-600">Preparing recording interface</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            // Main Recording Interface
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
              {/* Left Column: Session Info & Controls - Takes 1 column on xl screens */}
              <div className="xl:col-span-1 space-y-4">
                {/* Session Info Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-gray-900 leading-tight mb-1">{session.title}</h2>
                      <p className="text-sm text-gray-500 capitalize flex items-center">
                        <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        {session.audio_source === 'both' ? 'Mic + Screen' : session.audio_source}
                      </p>
                    </div>
                  </div>
                  
                  {/* Duration Display */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 text-center mb-3">
                    <div className="text-5xl font-mono font-bold text-gray-900 tracking-tight">
                      {formatDuration(recorder.state.duration)}
                    </div>
                    <p className="text-xs text-gray-600 mt-2 font-medium uppercase tracking-wide">Duration</p>
                  </div>

                  {/* Status Badge */}
                  <div className="flex justify-center">
                    {recorder.state.isPaused ? (
                      <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300">
                        <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Paused
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-red-100 text-red-800 border border-red-300">
                        <span className="flex h-2 w-2 relative mr-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                        </span>
                        Recording
                      </span>
                    )}
                  </div>
                </div>

                {/* Control Buttons Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Controls</h3>
                  <div className="space-y-3">
                    {recorder.state.isPaused ? (
                      <button
                        onClick={recorder.resumeRecording}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3.5 rounded-lg font-semibold shadow-md transform transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        Resume Recording
                      </button>
                    ) : (
                      <button
                        onClick={recorder.pauseRecording}
                        className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white px-6 py-3.5 rounded-lg font-semibold shadow-md transform transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Pause Recording
                      </button>
                    )}
                    
                    <button
                      onClick={handleEndSession}
                      disabled={isEnding}
                      className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-6 py-3.5 rounded-lg font-semibold shadow-md transform transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                      </svg>
                      {isEnding ? 'Ending...' : 'End & Upload'}
                    </button>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500 text-center">
                      Recording will be processed and transcribed with speaker diarization after upload
                    </p>
                  </div>
                </div>

                {/* Error Display */}
                {recorder.error && (
                  <div className="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-4 shadow-sm">
                    <div className="flex items-start">
                      <svg className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="ml-3 text-sm text-red-800">{recorder.error}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Live Transcript - Takes 2 columns on xl screens */}
              <div className="xl:col-span-2">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
                  {/* Transcript Header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Live Transcription</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Real-time preview • Speaker diarization available post-session</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        recorder.state.isPaused 
                          ? 'bg-yellow-500'
                          : isTranscribing 
                          ? 'bg-green-500 animate-pulse' 
                          : 'bg-gray-300'
                      }`}></div>
                      <span className="text-xs font-medium text-gray-600">
                        {recorder.state.isPaused 
                          ? 'Paused' 
                          : isTranscribing 
                          ? 'Active' 
                          : isConnected 
                          ? 'Connected' 
                          : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Realtime Error */}
                  {realtimeError && (
                    <div className="mx-5 mt-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-r p-3">
                      <p className="text-xs text-yellow-800">{realtimeError}</p>
                    </div>
                  )}
                  
                  {/* Transcript Content */}
                  <div className="flex-1 overflow-y-auto p-5 bg-gray-50 min-h-[500px] max-h-[calc(100vh-280px)]">
                    {liveTranscripts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center py-12">
                        <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                        <p className="text-gray-500 font-medium">
                          {recorder.state.isPaused
                            ? 'Transcription paused'
                            : recordingStarted 
                            ? 'Listening for speech...' 
                            : 'Transcription will appear here'}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">Start speaking to see real-time transcription</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(() => {
                          // Group transcripts by minute for better readability
                          const grouped: { minute: number; transcripts: typeof liveTranscripts }[] = []
                          let currentMinute = -1
                          let currentGroup: typeof liveTranscripts = []
                          
                          liveTranscripts.filter(t => t.isFinal).forEach((transcript) => {
                            const minute = Math.floor(transcript.timestamp / 60)
                            if (minute !== currentMinute) {
                              if (currentGroup.length > 0) {
                                grouped.push({ minute: currentMinute, transcripts: currentGroup })
                              }
                              currentMinute = minute
                              currentGroup = [transcript]
                            } else {
                              currentGroup.push(transcript)
                            }
                          })
                          
                          if (currentGroup.length > 0) {
                            grouped.push({ minute: currentMinute, transcripts: currentGroup })
                          }
                          
                          // Add any interim transcript at the end
                          const interimTranscript = liveTranscripts.find(t => !t.isFinal)
                          
                          return (
                            <>
                              {grouped.map((group, groupIndex) => {
                                // Get timestamp from first transcript in group
                                const firstTimestamp = group.transcripts[0]?.timestamp || 0
                                const minutes = Math.floor(firstTimestamp / 60)
                                const seconds = Math.floor(firstTimestamp % 60)
                                const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`
                                
                                return (
                                  <div key={groupIndex} className="border-l-2 border-blue-200 pl-3">
                                    <div className="text-xs font-semibold text-blue-600 mb-1">
                                      {timeLabel}
                                    </div>
                                    <div className="space-y-1">
                                      {group.transcripts.map((transcript, index) => (
                                        <div key={index}>
                                          <p className="text-sm text-gray-900">{transcript.text}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                              
                              {interimTranscript && (
                                <div className="pl-3">
                                  <div className="text-xs font-semibold text-gray-400 mb-1">
                                    {Math.floor(interimTranscript.timestamp / 60)}:{Math.floor(interimTranscript.timestamp % 60).toString().padStart(2, '0')}
                                  </div>
                                  <p className="text-sm text-gray-600 opacity-60 italic">{interimTranscript.text}...</p>
                                </div>
                              )}
                              
                              <div ref={transcriptEndRef} />
                            </>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{liveTranscripts.filter(t => t.isFinal).length} transcript{liveTranscripts.filter(t => t.isFinal).length !== 1 ? 's' : ''}</span>
                      <span className="text-gray-500">
                        Live preview only
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Real-time transcription • Speaker diarization after session ends
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
      </main>
    </div>
  )
}
