'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter, useSearchParams } from 'next/navigation'
import { speakerApi } from '@/lib/api/speakers'
import { sessionApi } from '@/lib/api/sessions'
import { transcriptsApi } from '@/lib/api/transcripts'
import { Speaker, DiarizationRequest } from '@/types/speaker'
import { Session } from '@/types/session'
import DashboardLayout from '@/components/DashboardLayout'

export default function SpeakersPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const transcriptId = searchParams.get('transcriptId')
  
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSessionsLoading, setIsSessionsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [editingSpeaker, setEditingSpeaker] = useState<number | null>(null)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    if (!transcriptId) {
      loadSessionList()
      return
    }
    
    if (user) {
      loadSpeakers()
    }
  }, [user, transcriptId])

  const loadSessionList = async () => {
    try {
      setIsSessionsLoading(true)
      const data = await sessionApi.listSessions(1, 100)
      setSessions(data.items.filter(s => s.status === 'completed'))
      setIsLoading(false)
    } catch (err) {
      console.error('Failed to load sessions', err)
      setError('Failed to load sessions. Please try again.')
      setIsLoading(false)
    } finally {
      setIsSessionsLoading(false)
    }
  }

  const handleSelectSession = async (sessionId: number) => {
    try {
      setIsLoading(true)
      const transcript = await transcriptsApi.getTranscriptBySession(sessionId)
      if (transcript && transcript.id) {
        router.push(`/speakers?transcriptId=${transcript.id}`)
      } else {
        alert('No transcript found for this session.')
        setIsLoading(false)
      }
    } catch (err) {
      console.error('Error fetching transcript:', err)
      alert('Failed to find transcript for this session.')
      setIsLoading(false)
    }
  }

  const loadSpeakers = async () => {
    if (!transcriptId) return
    
    const parsedId = parseInt(transcriptId)
    if (isNaN(parsedId) || parsedId <= 0) {
      setError('Invalid transcript ID')
      setIsLoading(false)
      return
    }
    
    try {
      setIsLoading(true)
      const data = await speakerApi.getSpeakersByTranscript(parsedId)
      setSpeakers(data)
      setError('')
    } catch (err: any) {
      console.error('Speakers load error:', err)
      let errorMessage = 'Failed to load speakers'
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
        errorMessage = 'Failed to load speakers'
      }
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePerformDiarization = async () => {
    if (!transcriptId) return
    
    const parsedId = parseInt(transcriptId)
    if (isNaN(parsedId) || parsedId <= 0) {
      setError('Invalid transcript ID')
      return
    }
    
    try {
      setIsProcessing(true)
      setError('')
      
      const request: DiarizationRequest = {
        transcript_id: parsedId,
        min_speakers: 1,
        max_speakers: 10
      }
      
      const result = await speakerApi.performDiarization(request)
      await loadSpeakers()
      alert(`Diarization complete! Found ${result.total_speakers} speakers (${result.processing_time.toFixed(2)}s)`)
    } catch (err: any) {
      console.error('Diarization error:', err)
      let errorMessage = 'Diarization failed'
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
        errorMessage = 'Diarization failed'
      }
      setError(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUpdateName = async (speakerId: number) => {
    try {
      await speakerApi.updateSpeakerName(speakerId, { speaker_name: newName })
      await loadSpeakers()
      setEditingSpeaker(null)
      setNewName('')
    } catch (err: any) {
      console.error('Update speaker name error:', err)
      let errorMessage = 'Failed to update speaker name'
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
        errorMessage = 'Failed to update speaker name'
      }
      setError(errorMessage)
    }
  }

  const handleDelete = async (speakerId: number) => {
    if (!confirm('Are you sure you want to delete this speaker?')) return
    
    try {
      await speakerApi.deleteSpeaker(speakerId)
      await loadSpeakers()
    } catch (err: any) {
      console.error('Delete speaker error:', err)
      let errorMessage = 'Failed to delete speaker'
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
        errorMessage = 'Failed to delete speaker'
      }
      setError(errorMessage)
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
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

  if (!transcriptId) {
    return (
      <DashboardLayout>
          {isSessionsLoading ? (
             <div className="flex h-full items-center justify-center">
                <p className="text-slate-500">Loading sessions...</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
               <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Select a Session</h1>
                <p className="mt-2 text-sm text-slate-500">Choose a completed session to manage speakers.</p>
              </div>

               {sessions.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-sm p-8 text-center border border-slate-200">
                      <p className="text-slate-500">No completed sessions found.</p>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sessions.map((session) => (
                        <button
                          key={session.id}
                          onClick={() => handleSelectSession(session.id)}
                          className="text-left bg-white p-6 rounded-lg shadow-sm border border-slate-200 hover:border-primary-500 hover:ring-1 hover:ring-primary-500 transition-all group"
                        >
                          <h3 className="font-semibold text-slate-900 group-hover:text-primary-600 mb-1">{session.title}</h3>
                          <div className="text-sm text-slate-500 flex justify-between">
                            <span>{new Date(session.created_at).toLocaleDateString()}</span>
                            <span>{session.duration_seconds ? `${Math.round(session.duration_seconds / 60)} min` : ''}</span>
                          </div>
                        </button>
                      ))}
                  </div>
               )}
            </div>
          )}
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
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
            <h1 className="text-2xl font-bold text-slate-900">Speaker Diarization</h1>
        </div>
        <p className="mt-2 text-sm text-slate-500 ml-1">Manage identified speakers for transcript #{transcriptId}.</p>
      </div>

        <div className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Diarization Controls */}
          <div className="bg-white rounded-lg shadow-sm ring-1 ring-slate-900/5 p-6">
            <div className="sm:flex sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold leading-6 text-slate-900">Automatic Speaker Detection</h3>
                <div className="mt-2 max-w-xl text-sm text-slate-500">
                  <p>Automatically identify and separate different speakers in the transcript using AI.</p>
                </div>
              </div>
              <div className="mt-5 sm:ml-6 sm:mt-0 sm:flex sm:flex-shrink-0 sm:items-center">
                <button
                    onClick={handlePerformDiarization}
                    disabled={isProcessing}
                    className="inline-flex items-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isProcessing ? 'Processing...' : 'Run Diarization'}
                </button>
              </div>
            </div>
          </div>

          {/* Speakers List */}
          {isLoading ? (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm ring-1 ring-slate-900/5">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                    <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
                </div>
                <p className="mt-4 text-sm text-slate-500">Loading speakers...</p>
            </div>
          ) : speakers.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm ring-1 ring-slate-900/5">
                <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-semibold text-slate-900">No speakers found</h3>
                <p className="mt-1 text-sm text-slate-500">Run diarization to detect speakers in your audio.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {speakers.map((speaker, index) => (
                <div key={speaker.id} className="bg-white rounded-lg shadow-sm ring-1 ring-slate-900/5 overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className={`inline-flex items-center justify-center h-10 w-10 rounded-full text-sm font-medium ${
                                ['bg-blue-100 text-blue-700', 'bg-green-100 text-green-700', 'bg-yellow-100 text-yellow-700', 'bg-purple-100 text-purple-700'][index % 4]
                            }`}>
                                {speaker.speaker_label.substring(0, 2).toUpperCase()}
                            </span>
                            
                            {editingSpeaker === speaker.id ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        placeholder="Enter speaker name"
                                        className="block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                                        autoFocus
                                    />
                                    <button
                                        onClick={() => handleUpdateName(speaker.id)}
                                        className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-primary-600 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingSpeaker(null)
                                            setNewName('')
                                        }}
                                        className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 group">
                                    <h3 className="text-base font-semibold leading-7 text-slate-900">
                                        {speaker.speaker_name || (
                                            speaker.speaker_label === 'SPEAKER_00' && speakers.length === 1 
                                            ? 'Default Speaker' 
                                            : `Speaker ${index + 1} (${speaker.speaker_label})`
                                        )}
                                    </h3>
                                    <button
                                        onClick={() => {
                                            setEditingSpeaker(speaker.id)
                                            setNewName(speaker.speaker_name || '')
                                        }}
                                        className="opacity-0 group-hover:opacity-100 rounded bg-white px-2 py-1 text-xs font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 transition-opacity"
                                    >
                                        Edit
                                    </button>
                                </div>
                            )}
                        </div>
                        <button
                             onClick={() => handleDelete(speaker.id)}
                            className="text-sm font-medium text-red-600 hover:text-red-500"
                        >
                            Delete
                        </button>
                    </div>
                    
                    <div className="mt-2 flex items-center gap-6 text-sm text-slate-500">
                       <div className="flex items-center gap-1">
                            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatTime(speaker.total_speaking_time)}
                       </div>
                       <div className="flex items-center gap-1">
                            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                            </svg>
                            {speakers.length} segments
                       </div>
                       <div>
                           Confidence: {(speaker.confidence * 100).toFixed(0)}%
                       </div>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 max-h-60 overflow-y-auto">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Sample Segments</h4>
                    <div className="space-y-3">
                         {speaker.segments.slice(0, 5).map((segment, i) => (
                            <div key={segment.id || i} className="text-sm text-slate-700 ml-4 border-l-2 border-slate-200 pl-3">
                                <span className="text-xs font-mono text-slate-400 block mb-1">
                                    {formatTime(segment.start_time)} - {formatTime(segment.end_time)}
                                </span>
                                {segment.text}
                            </div>
                         ))}
                         {speaker.segments.length > 5 && (
                             <p className="text-xs text-slate-400 italic text-center pt-2">
                                 ...and {speaker.segments.length - 5} more segments
                             </p>
                         )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
    </DashboardLayout>
  )
}
