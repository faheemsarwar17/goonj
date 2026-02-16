'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { transcriptsApi } from '@/lib/api/transcripts'
import { Transcript } from '@/types/transcript'

export default function TranscriptsPage() {
  const { user } = useAuth()
  const router = useRouter()
  
  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      loadTranscripts()
    }
  }, [user])

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
    return new Date(dateString).toLocaleString()
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
                onClick={() => router.push('/dashboard')}
                className="text-gray-600 hover:text-gray-900 mr-4"
              >
                ← Dashboard
              </button>
              <h1 className="text-xl font-bold text-gray-900">Transcripts</h1>
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

          {/* Transcripts List */}
          {isLoading ? (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Loading transcripts...</p>
            </div>
          ) : transcripts.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">No transcripts available. Complete a recording session to generate transcripts.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transcripts.map((transcript) => (
                <div key={transcript.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Transcript #{transcript.id}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Session ID: {transcript.session_id}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Created: {formatDate(transcript.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/speakers?transcriptId=${transcript.id}`)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                      >
                        Speaker Diarization
                      </button>
                    </div>
                  </div>

                  {/* Transcript Content Preview */}
                  <div className="mt-4 p-4 bg-gray-50 rounded-md border border-gray-200">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap line-clamp-4">
                      {transcript.content}
                    </p>
                    {transcript.content.length > 200 && (
                      <button
                        onClick={() => {
                          // Toggle expand functionality here
                        }}
                        className="text-sm text-blue-600 hover:text-blue-800 mt-2"
                      >
                        Read more...
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
