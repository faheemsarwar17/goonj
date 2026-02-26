'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { transcriptsApi } from '@/lib/api/transcripts'
import { Transcript } from '@/types/transcript'
import DashboardLayout from '@/components/DashboardLayout'
import Link from 'next/link'

export default function TranscriptsPage() {
  const { user } = useAuth()
  const router = useRouter()
  
  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedTranscripts, setExpandedTranscripts] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (user) {
      loadTranscripts()
    }
  }, [user])

  const toggleExpand = (transcriptId: number) => {
    setExpandedTranscripts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(transcriptId)) {
        newSet.delete(transcriptId)
      } else {
        newSet.add(transcriptId)
      }
      return newSet
    })
  }

  const loadTranscripts = async () => {
    try {
      setIsLoading(true)
      const data = await transcriptsApi.getMyTranscripts()
      setTranscripts(data)
      setError('')
    } catch (err: any) {
      console.error('Transcripts load error:', err)
      let errorMessage = 'Failed to load transcripts'
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
        errorMessage = 'Failed to load transcripts'
      }
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Transcripts</h1>
        <p className="mt-1 text-sm text-slate-500">Access and manage all your generated transcripts.</p>
      </div>

      <div className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Transcripts List */}
          {isLoading ? (
             <div className="text-center py-12 bg-white rounded-lg shadow-sm ring-1 ring-slate-900/5">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                    <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
                </div>
                <p className="mt-4 text-sm text-slate-500">Loading transcripts...</p>
            </div>
          ) : transcripts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm ring-1 ring-slate-900/5">
                 <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-semibold text-slate-900">No transcripts found</h3>
                <p className="mt-1 text-sm text-slate-500">Complete a recording session to generate transcripts.</p>
                <div className="mt-6">
                    <Link
                        href="/sessions/new"
                        className="inline-flex items-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                    >
                        <svg className="-ml-0.5 mr-1.5 h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                        </svg>
                        New Session
                    </Link>
                </div>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
              {transcripts.map((transcript) => (
                <div key={transcript.id} className="bg-white rounded-lg shadow-sm ring-1 ring-slate-900/5 overflow-hidden hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                             <div className="flex items-center gap-2">
                                <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                                    ID: #{transcript.id}
                                </span>
                                <span className="text-xs text-slate-500">
                                    {formatDate(transcript.created_at)}
                                </span>
                             </div>
                             <h3 className="mt-2 text-lg font-semibold leading-6 text-slate-900 group-hover:text-primary-600">
                                <Link href={`/sessions/${transcript.session_id}`} className="hover:underline">
                                    Session #{transcript.session_id}
                                </Link>
                             </h3>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Link
                                href={`/speakers?transcriptId=${transcript.id}`}
                                className="inline-flex items-center justify-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
                            >
                                <svg className="-ml-0.5 mr-1.5 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                                </svg>
                                Speakers
                            </Link>
                        </div>
                    </div>
                    
                     {/* Transcript Content Preview */}
                    <div className="mt-4 relative group">
                        <div className={`text-sm text-slate-600 leading-relaxed ${!expandedTranscripts.has(transcript.id) ? 'line-clamp-4' : ''}`}>
                            {transcript.content || <em className="text-slate-400">No content generated yet.</em>}
                        </div>
                        {transcript.content && transcript.content.length > 200 && (
                            <button
                                onClick={() => toggleExpand(transcript.id)}
                                className="mt-2 text-xs font-medium text-primary-600 hover:text-primary-500 hover:underline focus:outline-none"
                            >
                                {expandedTranscripts.has(transcript.id) ? 'Show less' : 'Read more'}
                            </button>
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
