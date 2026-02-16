'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter, useSearchParams } from 'next/navigation'
import { speakerApi } from '@/lib/api/speakers'
import { Speaker, DiarizationRequest } from '@/types/speaker'

export default function SpeakersPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const transcriptId = searchParams.get('transcriptId')
  
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [editingSpeaker, setEditingSpeaker] = useState<number | null>(null)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    if (!transcriptId) {
      setError('No transcript ID provided')
      setIsLoading(false)
      return
    }
    
    if (user) {
      loadSpeakers()
    }
  }, [user, transcriptId])

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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  if (!transcriptId) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">No transcript ID provided</p>
          </div>
        </div>
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
                onClick={() => router.back()}
                className="text-gray-600 hover:text-gray-900 mr-4"
              >
                ← Back
              </button>
              <h1 className="text-xl font-bold text-gray-900">Speaker Diarization</h1>
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

          {/* Diarization Controls */}
          <div className="bg-white rounded-lg shadow mb-6 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Automatic Speaker Detection</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Automatically identify and separate different speakers in the transcript
                </p>
              </div>
              <button
                onClick={handlePerformDiarization}
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Processing...' : 'Run Diarization'}
              </button>
            </div>
          </div>

          {/* Speakers List */}
          {isLoading ? (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Loading speakers...</p>
            </div>
          ) : speakers.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">No speakers identified yet. Run diarization to detect speakers.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {speakers.map((speaker) => (
                <div key={speaker.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          {speaker.speaker_label}
                        </span>
                        {editingSpeaker === speaker.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              placeholder="Enter speaker name"
                              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                            />
                            <button
                              onClick={() => handleUpdateName(speaker.id)}
                              className="text-sm text-blue-600 hover:text-blue-800"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingSpeaker(null)
                                setNewName('')
                              }}
                              className="text-sm text-gray-600 hover:text-gray-800"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-lg font-semibold text-gray-900">
                              {speaker.speaker_name || 'Unnamed Speaker'}
                            </span>
                            <button
                              onClick={() => {
                                setEditingSpeaker(speaker.id)
                                setNewName(speaker.speaker_name || '')
                              }}
                              className="text-sm text-blue-600 hover:text-blue-800"
                            >
                              Edit
                            </button>
                          </>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                        <span>Speaking time: {formatTime(speaker.total_speaking_time)}</span>
                        <span>Confidence: {(speaker.confidence * 100).toFixed(1)}%</span>
                        <span>{speaker.segments.length} segments</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(speaker.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>

                  {/* Segments */}
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {speaker.segments.map((segment) => (
                      <div
                        key={segment.id}
                        className="bg-gray-50 rounded-md p-3 border border-gray-200"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-600">
                            {formatTime(segment.start_time)} - {formatTime(segment.end_time)}
                          </span>
                          <span className="text-xs text-gray-500">
                            Confidence: {(segment.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-sm text-gray-800">{segment.text}</p>
                      </div>
                    ))}
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
