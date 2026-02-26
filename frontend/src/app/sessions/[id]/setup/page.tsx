'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter, useParams } from 'next/navigation'
import { sessionApi } from '@/lib/api/sessions'
import { Session } from '@/types/session'
import { AudioLevelMeter } from '@/components/AudioLevelMeter'
import { useRecordingContext } from '@/lib/contexts/RecordingContext'
import DashboardLayout from '@/components/DashboardLayout'

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
        <DashboardLayout>
             <div className="flex h-full items-center justify-center">
                <p className="text-slate-500">Loading...</p>
            </div>
        </DashboardLayout>
    )
  }

  const requiresMic = session?.audio_source === 'microphone' || session?.audio_source === 'both'
  const requiresScreen = session?.audio_source === 'device' || session?.audio_source === 'both'

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">Setup Recording</h1>
             <button
                onClick={handleCancel}
                className="text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
                Cancel
            </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {isLoading ? (
             <div className="text-center py-12 bg-white rounded-lg shadow-sm ring-1 ring-slate-900/5">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                    <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
                </div>
                <p className="mt-4 text-sm text-slate-500">Loading session details...</p>
            </div>
        ) : !session ? (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm ring-1 ring-slate-900/5">
                 <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="mt-2 text-sm font-semibold text-slate-900">Session not found</h3>
                 <p className="mt-1 text-sm text-slate-500">The requested session could not be found.</p>
            </div>
        ) : (
          <div className="space-y-6">
            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <svg className="h-5 w-5 text-blue-600 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-sm font-semibold text-blue-900">Configure Your Recording Setup</h3>
                  <p className="mt-1 text-sm text-blue-800">
                    Test your microphone and screen recording to ensure everything works properly before starting.
                    You must grant the required permissions to continue.
                  </p>
                </div>
              </div>
            </div>

            {/* Session Info */}
            <div className="bg-white rounded-lg shadow-sm ring-1 ring-slate-900/5 p-6">
              <h2 className="text-base font-semibold leading-6 text-slate-900 mb-4">Session Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Title</p>
                  <p className="text-sm font-medium text-slate-900">{session.title}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Audio Source</p>
                  <p className="text-sm font-medium text-slate-900 capitalize">{session.audio_source}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Microphone Permission */}
              {requiresMic && (
                <div className={`rounded-lg p-6 border ${micPermissionGranted ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`font-semibold ${micPermissionGranted ? 'text-emerald-900' : 'text-slate-900'}`}>
                      Microphone
                    </h3>
                    {micPermissionGranted ? (
                      <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                        Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        Required
                      </span>
                    )}
                  </div>
                  
                  <p className={`text-sm mb-6 ${micPermissionGranted ? 'text-emerald-800' : 'text-slate-500'}`}>
                    {micPermissionGranted 
                      ? "Microphone is connected and working."
                      : "We need access to your microphone to record speech."
                    }
                  </p>

                  <div className="flex items-center gap-3">
                    {!micPermissionGranted ? (
                      <button
                        onClick={shareMicrophone}
                        className="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500"
                      >
                        Grant Permission
                      </button>
                    ) : (
                      <div className="w-full">
                        <div className="flex items-center gap-2 mb-2">
                          <button
                            onClick={testMicrophone}
                            disabled={isTestingMic}
                            className="text-xs font-medium text-primary-600 hover:text-primary-500 disabled:opacity-50"
                          >
                            {isTestingMic ? 'Testing...' : 'Test Microphone'}
                          </button>
                          {isTestingMic && (
                            <button 
                                onClick={stopMicTest}
                                className="text-xs font-medium text-red-600 hover:text-red-500"
                            >
                                Stop Test
                            </button>
                          )}
                        </div>
                        <AudioLevelMeter
                            stream={localMicStream || recordingContext.micStream}
                            label="Mic Level"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Screen/System Audio Permission */}
              {requiresScreen && (
                <div className={`rounded-lg p-6 border ${screenPermissionGranted ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`font-semibold ${screenPermissionGranted ? 'text-emerald-900' : 'text-slate-900'}`}>
                      System Audio
                    </h3>
                    {screenPermissionGranted ? (
                      <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                        Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        Required
                      </span>
                    )}
                  </div>
                  
                  <p className={`text-sm mb-6 ${screenPermissionGranted ? 'text-emerald-800' : 'text-slate-500'}`}>
                    {screenPermissionGranted 
                      ? "System audio sharing is active."
                      : "Share your screen (tab or window) and make sure to check 'Share system audio'."
                    }
                  </p>

                  <div className="flex items-center gap-3">
                    {!screenPermissionGranted ? (
                      <button
                        onClick={shareScreenAudio}
                        className="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500"
                      >
                        Share Screen Audio
                      </button>
                    ) : (
                      <div className="w-full">
                         <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-emerald-700">Screen sharing active</span>
                            <button 
                                onClick={stopScreenTest}
                                className="text-xs font-medium text-red-600 hover:text-red-500"
                            >
                                Stop Sharing
                            </button>
                        </div>
                        {/* Video Preview */}
                        <div className="relative aspect-video bg-black rounded overflow-hidden">
                           <video 
                              ref={videoPreviewRef}
                              autoPlay 
                              muted 
                              playsInline
                              className="w-full h-full object-contain"
                           />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Start Button */}
            <div className="flex justify-end pt-4">
              <button
                onClick={handleStartRecording}
                disabled={!canStart}
                className={`
                  rounded-md px-6 py-3 text-base font-semibold text-white shadow-sm
                  ${canStart 
                    ? 'bg-primary-600 hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600' 
                    : 'bg-slate-300 cursor-not-allowed'}
                `}
              >
                Start Recording
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
