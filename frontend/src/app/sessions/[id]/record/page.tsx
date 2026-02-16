'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter, useParams } from 'next/navigation'
import { sessionApi } from '@/lib/api/sessions'
import { Session } from '@/types/session'
import { useAudioRecorder } from '@/lib/hooks/useAudioRecorder'
import { useRecordingContext } from '@/lib/contexts/RecordingContext'

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

  const recorder = useAudioRecorder()

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
    }
  }, [])

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
      const audioSourceMap: Record<string, 'microphone' | 'device' | 'both'> = {
        'microphone': 'microphone',
        'device': 'device',
        'both': 'both'
      }
      
      const source = audioSourceMap[session.audio_source] || 'microphone'
      
      // Use existing streams from context if available
      await recorder.startRecording(
        source,
        recordingContext.micStream,
        recordingContext.screenStream
      )
      
      setRecordingStarted(true)
      console.log('[RECORD] Recording started with existing streams from setup')
    } catch (err: any) {
      setError(err.message || 'Failed to start recording')
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
      
      // Stop recording and get audio blob
      let audioBlob: Blob | null = null
      if (recorder.state.isRecording) {
        audioBlob = await recorder.stopRecording()
        console.log('[RECORD] Recording stopped, blob received:', audioBlob ? `${audioBlob.size} bytes` : 'null')
      }
      
      // Validate audio blob
      if (!audioBlob || audioBlob.size === 0) {
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
      
      // Clear context streams
      recordingContext.clearStreams()
      
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex items-center">
                <span className="flex h-3 w-3 relative mr-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <h1 className="text-xl font-bold text-gray-900">
                  {recorder.state.isPaused ? 'Recording Paused' : 'Recording in Progress'}
                </h1>
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-gray-700 mr-4">{user.full_name}</span>
              <button
                onClick={() => useAuth.getState().logout()}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">Loading session...</p>
          </div>
        ) : !session ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">Session not found</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Recording Status Card */}
            <div className="bg-white rounded-lg shadow p-8">
              <div className="text-center space-y-6">
                {/* Session Title */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{session.title}</h2>
                  <p className="text-gray-600 capitalize">Recording: {session.audio_source}</p>
                </div>

                {/* Duration Display */}
                <div className="py-8">
                  <div className="text-6xl font-mono font-bold text-gray-900">
                    {formatDuration(recorder.state.duration)}
                  </div>
                  <p className="text-gray-600 mt-2">Recording Duration</p>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center justify-center gap-4 py-4">
                  {recorder.state.isPaused ? (
                    <span className="inline-flex items-center px-6 py-3 rounded-full text-lg font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                      <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Paused
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-6 py-3 rounded-full text-lg font-medium bg-red-100 text-red-800 border border-red-200">
                      <span className="flex h-3 w-3 relative mr-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </span>
                      Recording
                    </span>
                  )}
                </div>

                {/* Control Buttons */}
                <div className="flex justify-center gap-4 pt-4">
                  {recorder.state.isPaused ? (
                    <button
                      onClick={recorder.resumeRecording}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-semibold text-lg shadow-md transform transition hover:scale-105 flex items-center gap-3"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                      Resume
                    </button>
                  ) : (
                    <button
                      onClick={recorder.pauseRecording}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white px-8 py-4 rounded-lg font-semibold text-lg shadow-md transform transition hover:scale-105 flex items-center gap-3"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Pause
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* End Session Card */}
            <div className="bg-white rounded-lg shadow p-8">
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Finish Recording</h3>
                <p className="text-gray-600 mb-6">
                  Click below to stop recording and save your session. The audio will be uploaded and transcribed.
                </p>
                <button
                  onClick={handleEndSession}
                  disabled={isEnding}
                  className="bg-red-600 hover:bg-red-700 text-white px-12 py-4 rounded-lg font-bold text-lg shadow-md transform transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 mx-auto"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                  </svg>
                  {isEnding ? 'Ending Session...' : 'End Session & Upload'}
                </button>
              </div>
            </div>

            {/* Info Card */}
            {recorder.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="h-6 w-6 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="ml-3">
                    <p className="text-sm text-red-800">{recorder.error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
