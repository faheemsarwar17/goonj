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
import DashboardLayout from '@/components/DashboardLayout'

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
            }
            
            if (audioBlob && sessionRef.current) {
              // Convert blob to file
              const audioFile = new File([audioBlob], `recording-${sessionRef.current.id}.webm`, {
                type: 'audio/webm'
              })
              
              // End session with audio file and duration
              await sessionApi.endSession(
                sessionRef.current.id,
                audioFile,
                recorderRef.current.state.duration >= 0 ? recorderRef.current.state.duration : undefined
              )
              
              router.push('/dashboard')
            } else {
              router.push('/dashboard')
            }
          } catch (err) {
            console.error('[RECORD] Error ending session from back button:', err)
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
      pauseRealtime()
    } else if (!recorder.state.isPaused && realtimePaused) {
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
      
      const audioStream = await recorder.startRecording(
        source,
        recordingContext.micStream,
        recordingContext.screenStream
      )
      
      if (!audioStream) {
        setError('Unable to initialize audio stream. Please try again or check your audio source permissions.')
        setIsInitializingStream(false)
        if (recorder.state.isRecording) {
          recorder.cancelRecording()
        }
        return
      }
      
      const streamTracks = audioStream.getAudioTracks()
      
      if (streamTracks.length === 0) {
        setError('No audio tracks found in stream. Please check your audio source.')
        setIsInitializingStream(false)
        recorder.cancelRecording()
        return
      }
      
      const realtimeSession = await realtimeApi.createSession(session.id)
      await connectRealtime(realtimeSession, audioStream)
      
      setRecordingStarted(true)
      setIsInitializingStream(false)
    } catch (err: any) {
      setError(err.message || 'Failed to start recording')
      setIsInitializingStream(false)
    }
  }

  const handleEndSession = async () => {
    if (!session || !sessionId) return
    
    if (!confirm('Are you sure you want to end this recording session?')) return
    
    try {
      setIsEnding(true)
      setError('')
      
      disconnectRealtime()
      
      let audioBlob: Blob | null = null
      if (recorder.state.isRecording) {
        audioBlob = await recorder.stopRecording()
      }
      
      if (!audioBlob) {
        setError('No audio was recorded. Please make sure audio is being captured.')
        setIsEnding(false)
        return
      }
      
      const audioFile = new File([audioBlob], `recording-${session.id}.webm`, {
        type: 'audio/webm'
      })
      
      await sessionApi.endSession(
        session.id,
        audioFile,
        recorder.state.duration >= 0 ? recorder.state.duration : undefined
      )
      
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

  if (!user || !session) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
             {isLoading ? <p className="text-slate-500">Loading...</p> : <p className="text-red-500">Session not found</p>}
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Status */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                 <div className={`relative flex items-center justify-center w-12 h-12 rounded-full ${recorder.state.isPaused ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                    {recorder.state.isPaused ? (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    ) : (
                        <>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                        </>
                    )}
                 </div>
                 <div>
                    <h1 className="text-lg font-bold text-slate-900 leading-none">
                        {recorder.state.isPaused ? 'Recording Paused' : 'Recording in Progress'}
                    </h1>
                     <p className="text-sm text-slate-500 mt-1">
                        {session.title} • {session.audio_source === 'both' ? 'Mic + Screen' : session.audio_source}
                     </p>
                 </div>
            </div>

            <div className="flex items-center gap-6">
                 <div className="text-center">
                    <div className="text-3xl font-mono font-bold text-slate-900 tracking-tight">
                      {formatDuration(recorder.state.duration)}
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-2">
                     {recorder.state.isPaused ? (
                      <button
                        onClick={recorder.resumeRecording}
                        className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                        title="Resume"
                      >
                         <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        onClick={recorder.pauseRecording}
                        className="p-2 rounded-full bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors"
                        title="Pause"
                      >
                         <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                             <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                     <button
                      onClick={handleEndSession}
                      disabled={isEnding}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isEnding ? 'Ending...' : 'End Session'}
                    </button>
                 </div>
            </div>
        </div>

        {/* Error Banner */}
        {error && !isInitializingStream && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <svg className="h-5 w-5 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Initialization State */}
        {isInitializingStream && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status"></div>
                <h2 className="mt-4 text-lg font-semibold text-slate-900">Initializing Recording</h2>
                <p className="mt-2 text-sm text-slate-500">Setting up audio stream and transcription connection...</p>
            </div>
        )}
        
        {/* Live Transcript Area */}
        {!isInitializingStream && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col min-h-[500px] h-[calc(100vh-280px)]">
                 <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div>
                      <h3 className="font-semibold text-slate-900">Live Transcription</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Real-time preview • Speaker diarization available post-session</p>
                    </div>
                     <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        isConnected 
                            ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' 
                            : 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/10'
                     }`}>
                        {isConnected ? 'Live' : 'Connecting...'}
                     </span>
                 </div>

                 <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
                    {liveTranscripts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                         <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-slate-400">
                             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                         </div>
                        <p className="text-slate-900 font-medium">Listening for speech...</p>
                        <p className="text-sm text-slate-500 mt-1">Start speaking to see real-time transcription</p>
                      </div>
                    ) : (
                        // Grouping logic inside the render
                        (() => {
                           // ... same grouping logic as before ...
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
                          
                          const interimTranscript = liveTranscripts.find(t => !t.isFinal)
                          
                          return (
                            <>
                              {grouped.map((group, groupIndex) => {
                                const firstTimestamp = group.transcripts[0]?.timestamp || 0
                                const minutes = Math.floor(firstTimestamp / 60)
                                const seconds = Math.floor(firstTimestamp % 60)
                                const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`
                                
                                return (
                                  <div key={groupIndex} className="relative pl-8">
                                    <span className="absolute left-0 top-1 text-xs font-mono text-slate-400">{timeLabel}</span>
                                    <div className="space-y-2">
                                      {group.transcripts.map((transcript, index) => (
                                        <p key={index} className="text-slate-700 leading-relaxed">
                                            {transcript.text}
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                              
                              {interimTranscript && (
                                <div className="relative pl-8 animate-pulse">
                                   <span className="absolute left-0 top-1 text-xs font-mono text-slate-400">
                                        {Math.floor(interimTranscript.timestamp / 60)}:{Math.floor(interimTranscript.timestamp % 60).toString().padStart(2, '0')}
                                   </span>
                                  <p className="text-slate-500 italic">
                                    {interimTranscript.text}...
                                  </p>
                                </div>
                              )}
                              
                              <div ref={transcriptEndRef} />
                            </>
                          )
                        })()
                    )}
                 </div>
            </div>
        )}
      </div>
    </DashboardLayout>
  )
}
