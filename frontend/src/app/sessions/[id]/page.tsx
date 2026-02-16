'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter, useParams } from 'next/navigation'
import { sessionApi } from '@/lib/api/sessions'
import { transcriptsApi } from '@/lib/api/transcripts'
import { Session } from '@/types/session'
import { Transcript } from '@/types/transcript'

export default function SessionDetailPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const sessionId = params?.id as string
  
  const [session, setSession] = useState<Session | null>(null)
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user && sessionId) {
      loadSessionDetails()
    }
  }, [user, sessionId])

  const loadSessionDetails = async () => {
    if (!sessionId) {
      setError('No session ID provided')
      setIsLoading(false)
      return
    }
    
    const parsedId = parseInt(sessionId)
    if (isNaN(parsedId) || parsedId <= 0) {
      setError('Invalid session ID')
      setIsLoading(false)
      return
    }
    
    try {
      setIsLoading(true)
      const sessionData = await sessionApi.getSession(parsedId)
      setSession(sessionData)
      
      // Redirect to setup if session is in recording state
      if (sessionData.status === 'recording') {
        router.push(`/sessions/${sessionId}/setup`)
        return
      }
      
      // Only try to load transcript if session is completed
      if (sessionData.status === 'completed') {
        try {
          const transcriptData = await transcriptsApi.getTranscriptBySession(parsedId)
          setTranscript(transcriptData)
        } catch (transcriptErr) {
          // No transcript yet, that's okay
          setTranscript(null)
        }
      }
      
      setError('')
    } catch (err: any) {
      console.error('Session load error:', err)
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
    } finally {
      setIsLoading(false)
    }
  }

  const getAudioUrl = (sessionId: number): string => {
    const token = localStorage.getItem('access_token')
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    return `${apiUrl}/api/v1/sessions/${sessionId}/audio?token=${encodeURIComponent(token || '')}`
  }

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
      case 'recording': return 'bg-red-100 text-red-800 border-red-300'
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'completed': return 'bg-green-100 text-green-800 border-green-300'
      case 'failed': return 'bg-gray-100 text-gray-800 border-gray-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
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
              <button
                onClick={() => router.push('/sessions')}
                className="text-gray-600 hover:text-gray-900 mr-4"
              >
                ← Sessions
              </button>
              <h1 className="text-xl font-bold text-gray-900">Session Details</h1>
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
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Loading session details...</p>
            </div>
          ) : !session ? (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Session not found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Session Info Card */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{session.title}</h2>
                    <p className="text-sm text-gray-600 mt-1">Session ID: {session.id}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(session.status)}`}>
                    {session.status.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="border-l-4 border-blue-500 pl-4">
                    <p className="text-sm text-gray-600">Audio Source</p>
                    <p className="text-lg font-semibold text-gray-900">{session.audio_source}</p>
                  </div>

                  <div className="border-l-4 border-green-500 pl-4">
                    <p className="text-sm text-gray-600">Duration</p>
                    <p className="text-lg font-semibold text-gray-900">{formatDuration(session.duration_seconds)}</p>
                  </div>

                  <div className="border-l-4 border-purple-500 pl-4">
                    <p className="text-sm text-gray-600">Created At</p>
                    <p className="text-lg font-semibold text-gray-900">{formatDate(session.created_at)}</p>
                  </div>

                  {session.ended_at && (
                    <div className="border-l-4 border-orange-500 pl-4">
                      <p className="text-sm text-gray-600">Ended At</p>
                      <p className="text-lg font-semibold text-gray-900">{formatDate(session.ended_at)}</p>
                    </div>
                  )}
                </div>


              </div>

              {/* Audio Player */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Audio Playback</h3>
                {session.audio_file_path ? (
                  <div className="space-y-3">
                    <audio
                      controls
                      preload="metadata"
                      className="w-full"
                      src={getAudioUrl(session.id)}
                    />
                    <p className="text-xs text-gray-500">
                      Audio file: {session.audio_file_path}
                    </p>
                  </div>
                ) : (
                  <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-600">
                      {session.status === 'recording' 
                        ? 'Audio will be available after recording'
                        : 'No audio file available for this session'
                      }
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Source: {session.audio_source}
                    </p>
                  </div>
                )}
              </div>

              {/* Transcript Section */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Transcript</h3>
                {transcript ? (
                  <div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {transcript.content.substring(0, 500)}
                        {transcript.content.length > 500 && '...'}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => router.push(`/transcripts`)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                      >
                        View Full Transcript
                      </button>
                      <button
                        onClick={() => router.push(`/speakers?transcriptId=${transcript.id}`)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                      >
                        Speaker Diarization
                      </button>
                    </div>
                  </div>
                ) : session.status === 'completed' ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex">
                        <svg className="h-5 w-5 text-yellow-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="ml-3">
                          <p className="text-sm text-yellow-800">
                            Transcript is being generated. This may take a few moments.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => loadSessionDetails()}
                        className="text-yellow-600 hover:text-yellow-800 text-sm font-medium"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Transcript will be available once the session is completed.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
