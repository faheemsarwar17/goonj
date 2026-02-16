'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { sessionApi } from '@/lib/api/sessions'
import { AudioSource } from '@/types/session'

export default function NewSessionPage() {
  const { user } = useAuth()
  const router = useRouter()
  
  const [title, setTitle] = useState('')
  const [audioSource, setAudioSource] = useState<AudioSource>(AudioSource.MICROPHONE)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      setError('Please enter a session title')
      return
    }
    
    try {
      setIsCreating(true)
      setError('')
      
      const session = await sessionApi.createSession({
        title: title.trim(),
        audio_source: audioSource
      })
      
      // Redirect to the setup page instead of detail page
      router.push(`/sessions/${session.id}/setup`)
    } catch (err: any) {
      console.error('Create session error:', err)
      let errorMessage = 'Failed to create session'
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
        errorMessage = 'Failed to create session'
      }
      setError(errorMessage)
    } finally {
      setIsCreating(false)
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
                ← Back to Sessions
              </button>
              <h1 className="text-xl font-bold text-gray-900">New Recording Session</h1>
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
      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Recording Session</h2>
            
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Session Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Session Title *
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Team Meeting - Feb 2026"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              {/* Audio Source */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Audio Source *
                </label>
                <div className="space-y-3">
                  <label className="flex items-center p-3 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="audioSource"
                      value={AudioSource.MICROPHONE}
                      checked={audioSource === AudioSource.MICROPHONE}
                      onChange={(e) => setAudioSource(e.target.value as AudioSource)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <span className="font-medium text-gray-900">Microphone</span>
                      <p className="text-sm text-gray-600">Record from your computer's microphone</p>
                    </div>
                  </label>

                  <label className="flex items-center p-3 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="audioSource"
                      value={AudioSource.DEVICE}
                      checked={audioSource === AudioSource.DEVICE}
                      onChange={(e) => setAudioSource(e.target.value as AudioSource)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <span className="font-medium text-gray-900">System Audio</span>
                      <p className="text-sm text-gray-600">Capture system audio output</p>
                    </div>
                  </label>

                  <label className="flex items-center p-3 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="audioSource"
                      value={AudioSource.BOTH}
                      checked={audioSource === AudioSource.BOTH}
                      onChange={(e) => setAudioSource(e.target.value as AudioSource)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <span className="font-medium text-gray-900">Both</span>
                      <p className="text-sm text-gray-600">Record microphone and system audio together</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex">
                  <svg className="h-5 w-5 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="ml-3">
                    <p className="text-sm text-blue-800">
                      After creating the session, you'll be redirected to the session page where you can manage your recording.
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-md font-medium"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isCreating}
                >
                  {isCreating ? 'Creating...' : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
