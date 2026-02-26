'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter, useParams } from 'next/navigation'
import { sessionApi } from '@/lib/api/sessions'
import { transcriptsApi } from '@/lib/api/transcripts'
import { Session } from '@/types/session'
import { Transcript } from '@/types/transcript'
import { AudioLevelMeter } from '@/components/AudioLevelMeter'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'

export default function SessionDetailPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const sessionId = params?.id as string
  
  const [session, setSession] = useState<Session | null>(null)
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  const loadSessionDetails = useCallback(async (silent = false) => {
    if (!sessionId) {
      if (!silent) {
        setError('No session ID provided')
        setIsLoading(false)
      }
      return
    }
    
    const parsedId = parseInt(sessionId)
    if (isNaN(parsedId) || parsedId <= 0) {
      if (!silent) {
        setError('Invalid session ID')
        setIsLoading(false)
      }
      return
    }
    
    try {
      if (!silent) setIsLoading(true)
      const sessionData = await sessionApi.getSession(parsedId)
      setSession(sessionData)
      
      // Redirect to setup if session is in recording state
      if (sessionData.status === 'recording' && !silent) {
        router.push(`/sessions/${sessionId}/setup`)
        return
      }
      
      // Only try to load transcript if session is completed
      if (sessionData.status === 'completed') {
        try {
          const transcriptData = await transcriptsApi.getTranscriptBySession(parsedId)
          setTranscript(transcriptData)
        } catch (transcriptErr) {
          // No transcript yet, that's okay. 
          // If we are polling (silent=true), we don't want to clear the transcript if we had one (unlikely case)
          // But here we set to null to indicate it's not ready. 
          // If we previously had a transcript, and now 404... that's weird but possible if deleted.
          setTranscript(null)
        }
      }
      
      if (!silent) setError('')
    } catch (err: any) {
      console.error('Session load error:', err)
      if (!silent) {
        let errorMessage = 'Failed to load session details'
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
          errorMessage = 'Failed to load session details'
        }
        setError(errorMessage)
      }
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [sessionId, router])

  useEffect(() => {
    if (user && sessionId) {
      loadSessionDetails()
    }
  }, [user, sessionId, loadSessionDetails])

  // Poll for transcript if session is completed/processing but transcript is missing
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    // Check if we need to poll
    const shouldPoll = session && (
      session.status === 'processing' || 
      (session.status === 'completed' && !transcript)
    );

    if (shouldPoll) {
      intervalId = setInterval(() => {
        loadSessionDetails(true); // silent update
      }, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [session?.status, transcript, loadSessionDetails]); 

  const handleDeleteSession = async () => {
    if (!session) return
    
    if (!confirm(`Are you sure you want to delete session "${session.title}"? This action cannot be undone.`)) {
      return
    }

    try {
      await sessionApi.deleteSession(session.id)
      router.push('/sessions')
    } catch (err: any) {
      console.error('Delete error:', err)
      alert('Failed to delete session: ' + (err.response?.data?.detail || err.message))
    }
  }

  // Securely load audio as blob (avoids leaking JWT in URL)
  useEffect(() => {
    let revoke: string | null = null
    if (session && (session.audio_file_path || session.status === 'completed')) {
      const token = localStorage.getItem('access_token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      fetch(`${apiUrl}/api/v1/sessions/${session.id}/audio`, {
        headers: { Authorization: `Bearer ${token || ''}` }
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to load audio')
          return res.blob()
        })
        .then(blob => {
          const url = URL.createObjectURL(blob)
          revoke = url
          setAudioUrl(url)
        })
        .catch(err => console.error('Audio load error:', err))
    }
    return () => {
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [session?.id, session?.status, session?.audio_file_path])

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString()
  }

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return 'N/A'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${hours > 0 ? hours + 'h ' : ''}${minutes}m ${secs}s`
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'recording': return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
      case 'processing': return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10'
      case 'completed': return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
      case 'failed': return 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-500/10'
      default: return 'bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-500/10'
    }
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
                >
                    <svg className="-ml-0.5 mr-1.5 h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
                    </svg>
                    Back
                </button>
                <h1 className="text-2xl font-bold text-slate-900">Session Details</h1>
            </div>
            
             {session && (
                 <button
                    onClick={handleDeleteSession}
                    className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                >
                    Delete Session
                </button>
             )}
        </div>

       <div className="">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
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
                <p className="mt-1 text-sm text-slate-500">The requested session could not be found or you do not have permission to view it.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Session Info Card */}
              <div className="bg-white rounded-lg shadow-sm ring-1 ring-slate-900/5 px-4 py-5 sm:px-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold leading-7 text-slate-900 sm:truncate sm:text-2xl sm:tracking-tight">{session.title}</h2>
                    <p className="text-sm text-slate-500 mt-1">ID: #{session.id}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${getStatusColor(session.status)}`}>
                    {session.status.toUpperCase()}
                  </span>
                </div>

                <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-slate-500">Audio Source</dt>
                    <dd className="mt-1 text-sm text-slate-900">{session.audio_source}</dd>
                  </div>
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-slate-500">Duration</dt>
                    <dd className="mt-1 text-sm text-slate-900">{formatDuration(session.duration_seconds)}</dd>
                  </div>
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-slate-500">Created At</dt>
                    <dd className="mt-1 text-sm text-slate-900">{formatDate(session.created_at)}</dd>
                  </div>
                  <div className="sm:col-span-1">
                     {/* Placeholder for future metadata */}
                  </div>
                </dl>
              </div>

               {/* Audio Player */}
               <div className="bg-white rounded-lg shadow-sm ring-1 ring-slate-900/5 px-4 py-5 sm:px-6">
                <h3 className="text-base font-semibold leading-6 text-slate-900 mb-4">Audio Playback</h3>
                {session.audio_file_path || session.status === 'completed' ? (
                  <div className="space-y-3">
                    {audioUrl ? (
                      <audio 
                          controls 
                          className="w-full h-10 outline-none"
                          src={audioUrl}
                      >
                          Your browser does not support the audio element.
                      </audio>
                    ) : (
                      <p className="text-sm text-slate-500">Loading audio...</p>
                    )}
                  </div>
                ) : (
                   <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                    <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    <p className="mt-2 text-sm text-slate-600">
                      {session.status === 'recording' 
                        ? 'Audio will be available after recording is stopped'
                        : 'No audio file available for this session'
                      }
                    </p>
                  </div>
                )}
               </div>

               {/* Transcript Section */}
               <div className="bg-white rounded-lg shadow-sm ring-1 ring-slate-900/5 px-4 py-5 sm:px-6">
                  <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-semibold leading-6 text-slate-900">Transcript</h3>
                       {transcript && (
                            <div className="flex gap-2">
                                <Link
                                    href={`/speakers?transcriptId=${transcript.id}`}
                                     className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
                                >
                                    View Speakers
                                </Link>
                                <button className="rounded-md bg-primary-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600">
                                    Export
                                </button>
                            </div>
                       )}
                  </div>
                  
                  {transcript ? (
                        <div className="space-y-4">
                            <div className="bg-slate-50 rounded-lg p-6 border border-slate-200 shadow-sm max-h-[600px] overflow-y-auto">
                                <p className="whitespace-pre-wrap text-slate-700 leading-relaxed font-mono text-sm">
                                    {isTranscriptExpanded 
                                      ? transcript.content 
                                      : transcript.content.length > 500 
                                        ? transcript.content.substring(0, 500) + '...' 
                                        : transcript.content
                                    }
                                </p>
                            </div>
                             {transcript.content.length > 500 && (
                                <button
                                  onClick={() => setIsTranscriptExpanded(!isTranscriptExpanded)}
                                  className="text-sm font-medium text-primary-600 hover:text-primary-500"
                                >
                                  {isTranscriptExpanded ? 'Show Less' : 'View Full Transcript'}
                                </button>
                              )}
                        </div>
                   ) : session.status === 'processing' || session.status === 'completed' ? (
                       <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <div className="flex items-start">
                                <svg className="h-5 w-5 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-amber-800">Transcript Processing</h3>
                                    <p className="mt-1 text-sm text-amber-700">
                                        The transcript is currently being generated. This process may take a few moments depending on the audio length.
                                    </p>
                                </div>
                            </div>
                       </div>
                   ) : (
                       <div className="text-center py-8">
                           <p className="text-sm text-slate-500">Transcript not available</p>
                       </div>
                   )}
               </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
