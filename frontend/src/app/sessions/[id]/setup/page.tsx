'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter, useParams } from 'next/navigation'
import { sessionApi } from '@/lib/api/sessions'
import { Session } from '@/types/session'
import { AudioLevelMeter } from '@/components/AudioLevelMeter'
import { useRecordingContext } from '@/lib/contexts/RecordingContext'

export default function SessionSetupPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const sessionId = params?.id as string
  const recordingContext = useRecordingContext()
  
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Permission states
  const [micPermissionGranted, setMicPermissionGranted] = useState(false)
  const [screenPermissionGranted, setScreenPermissionGranted] = useState(false)
  const [isTestingMic, setIsTestingMic] = useState(false)
  const [isTestingScreen, setIsTestingScreen] = useState(false)
  
  // Local test streams (separate from context streams)
  const [localMicStream, setLocalMicStream] = useState<MediaStream | null>(null)
  const videoPreviewRef = useRef<HTMLVideoElement>(null)
  
  const [canStart, setCanStart] = useState(false)

  useEffect(() => {
    if (user && sessionId) {
      loadSession()
    }
  }, [user, sessionId])

  useEffect(() => {
    // Update video preview when screen stream changes
    if (videoPreviewRef.current && recordingContext.screenStream) {
      videoPreviewRef.current.srcObject = recordingContext.screenStream
    }
  }, [recordingContext.screenStream])

  useEffect(() => {
    // Check if user can start recording based on permissions
    const audioSource = session?.audio_source
    
    if (audioSource === 'microphone') {
      setCanStart(micPermissionGranted)
    } else if (audioSource === 'device') {
      setCanStart(screenPermissionGranted)
    } else if (audioSource === 'both') {
      setCanStart(micPermissionGranted && screenPermissionGranted)
    }
  }, [micPermissionGranted, screenPermissionGranted, session?.audio_source])

  useEffect(() => {
    // Cleanup streams on unmount
    return () => {
      if (localMicStream) {
        localMicStream.getTracks().forEach(track => track.stop())
      }
      // Don't stop context streams here - they're managed by context
    }
  }, [localMicStream])

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

  const testMicrophone = async () => {
    try {
      setIsTestingMic(true)
      setError('')
      
      // Use existing stream from context or create new one
      const stream = recordingContext.micStream || await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      
      setLocalMicStream(stream)
      setMicPermissionGranted(true)
      setIsTestingMic(false)
    } catch (err: any) {
      console.error('Microphone test error:', err)
      setError('Failed to access microphone. Please allow microphone permissions.')
      setMicPermissionGranted(false)
      setIsTestingMic(false)
    }
  }

  const shareMicrophone = async () => {
    try {
      setError('')
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      
      // Store in context for later use
      recordingContext.setMicStream(stream)
      setMicPermissionGranted(true)
    } catch (err: any) {
      console.error('Microphone permission error:', err)
      setError('Failed to access microphone. Please allow microphone permissions.')
      setMicPermissionGranted(false)
    }
  }

  const shareScreenAudio = async () => {
    try {
      setError('')
      
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      
      // Check if audio is included
      const hasAudio = stream.getAudioTracks().length > 0
      
      if (!hasAudio) {
        stream.getTracks().forEach(track => track.stop())
        setError('No system audio detected. Make sure to check "Share audio" when sharing your screen.')
        setScreenPermissionGranted(false)
        return
      }
      
      // Store in context for later use (keep video track for preview)
      recordingContext.setScreenStream(stream)
      setScreenPermissionGranted(true)
    } catch (err: any) {
      console.error('Screen permission error:', err)
      setError('Failed to access screen. Please allow screen sharing permissions.')
      setScreenPermissionGranted(false)
    }
  }

  const stopMicTest = () => {
    if (localMicStream) {
      localMicStream.getTracks().forEach(track => track.stop())
      setLocalMicStream(null)
    }
  }

  const stopScreenTest = () => {
    // Clear context stream and permission
    recordingContext.setScreenStream(null)
    setScreenPermissionGranted(false)
  }

  const handleStartRecording = () => {
    if (!canStart) return
    
    // Stop local test stream if active (context streams are kept)
    if (localMicStream) {
      localMicStream.getTracks().forEach(track => track.stop())
      setLocalMicStream(null)
    }
    
    // Navigate to recording page - context streams will be available there
    router.push(`/sessions/${sessionId}/record`)
  }

  const handleCancel = () => {
    // Stop local test stream
    if (localMicStream) {
      localMicStream.getTracks().forEach(track => track.stop())
    }
    
    // Clear context streams
    recordingContext.clearStreams()
    
    router.push('/sessions')
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  const requiresMic = session?.audio_source === 'microphone' || session?.audio_source === 'both'
  const requiresScreen = session?.audio_source === 'device' || session?.audio_source === 'both'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Setup Recording</h1>
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
      <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
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
          <div className="space-y-6">
            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex">
                <svg className="h-6 w-6 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">Configure Your Recording Setup</h3>
                  <p className="text-sm text-blue-800">
                    Test your microphone and screen recording to ensure everything works properly before starting.
                    You must grant the required permissions to continue.
                  </p>
                </div>
              </div>
            </div>

            {/* Session Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Session Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Title</p>
                  <p className="text-base font-medium text-gray-900">{session.title}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Audio Source</p>
                  <p className="text-base font-medium text-gray-900 capitalize">{session.audio_source}</p>
                </div>
              </div>
            </div>

            {/* Microphone Test */}
            {requiresMic && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Microphone</h3>
                    <p className="text-sm text-gray-600">Grant microphone permission to continue</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {micPermissionGranted && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Ready
                      </span>
                    )}
                  </div>
                </div>

                {!micPermissionGranted ? (
                  <button
                    onClick={shareMicrophone}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-md font-medium"
                  >
                    Share Microphone
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-md p-3">
                      <p className="text-sm text-green-800">
                        ✓ Microphone permission granted. You can now start recording or test your microphone first.
                      </p>
                    </div>
                    
                    {!localMicStream ? (
                      <button
                        onClick={testMicrophone}
                        disabled={isTestingMic}
                        className="w-full bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-md font-medium border border-blue-300 disabled:opacity-50"
                      >
                        {isTestingMic ? 'Starting Test...' : 'Test Microphone (Optional)'}
                      </button>
                    ) : (
                      <>
                        <AudioLevelMeter 
                          stream={localMicStream} 
                          label="Microphone Level" 
                          color="bg-blue-500"
                        />
                        <p className="text-sm text-gray-600">
                          Speak into your microphone to test the audio level.
                        </p>
                        <button
                          onClick={stopMicTest}
                          className="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md font-medium"
                        >
                          Stop Test
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Screen Recording Test */}
            {requiresScreen && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Screen Recording</h3>
                    <p className="text-sm text-gray-600">Grant screen sharing permission with audio to continue</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {screenPermissionGranted && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Ready
                      </span>
                    )}
                  </div>
                </div>

                {!screenPermissionGranted ? (
                  <div className="space-y-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                      <p className="text-sm text-yellow-800">
                        <strong>Important:</strong> Make sure to check the "Share audio" checkbox when selecting your screen, tab, or window.
                      </p>
                    </div>
                    <button
                      onClick={shareScreenAudio}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-md font-medium"
                    >
                      Share Screen Audio
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-md p-3">
                      <p className="text-sm text-green-800">
                        ✓ Screen sharing permission granted. You can now start recording or test your screen capture first.
                      </p>
                    </div>

                    {/* Video Preview - Always show if stream exists */}
                    {recordingContext.screenStream && (
                      <>
                        <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                          <video
                            ref={videoPreviewRef}
                            autoPlay
                            muted
                            className="absolute top-0 left-0 w-full h-full object-contain"
                          />
                        </div>
                        
                        <AudioLevelMeter 
                          stream={recordingContext.screenStream} 
                          label="System Audio Level" 
                          color="bg-purple-500"
                        />
                        <p className="text-sm text-gray-600">
                          Screen preview is active. Play some audio to test the system audio capture.
                        </p>
                        <button
                          onClick={stopScreenTest}
                          className="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md font-medium"
                        >
                          Stop Preview & Re-configure
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Start Recording Button */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Ready to Start?</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {canStart 
                      ? 'All required permissions have been granted. You can now start recording.' 
                      : 'Please test and grant all required permissions above to continue.'}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-md font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartRecording}
                    disabled={!canStart}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    Start Recording
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
