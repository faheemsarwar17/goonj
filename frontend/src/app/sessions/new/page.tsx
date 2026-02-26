'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { sessionApi } from '@/lib/api/sessions'
import { AudioSource } from '@/types/session'
import DashboardLayout from '@/components/DashboardLayout'

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
        <DashboardLayout>
             <div className="flex h-full items-center justify-center">
                <p className="text-slate-500">Loading...</p>
            </div>
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
            <h1 className="text-2xl font-bold text-slate-900">New Recording Session</h1>
        </div>
        <p className="mt-2 text-sm text-slate-500 ml-1">Configure your new audio recording session.</p>
      </div>

       <div className="mx-auto max-w-2xl">
          <div className="bg-white rounded-lg shadow-sm ring-1 ring-slate-900/5 p-8">
            <h2 className="text-lg font-semibold leading-7 text-slate-900">Session Details</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Provide the basic information to start recording.</p>
            
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-6">
              {/* Session Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium leading-6 text-slate-900">
                  Session Title <span className="text-red-500">*</span>
                </label>
                <div className="mt-2">
                    <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Team Meeting - Feb 2026"
                    className="block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    required
                    />
                </div>
              </div>

              {/* Audio Source */}
              <div>
                <label className="block text-sm font-medium leading-6 text-slate-900 mb-2">
                  Audio Source <span className="text-red-500">*</span>
                </label>
                <div className="space-y-3">
                  <label className={`flex items-start p-4 border rounded-lg cursor-pointer transition-all ${audioSource === AudioSource.MICROPHONE ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                    <div className="flex h-6 items-center">
                        <input
                        type="radio"
                        name="audioSource"
                        value={AudioSource.MICROPHONE}
                        checked={audioSource === AudioSource.MICROPHONE}
                        onChange={(e) => setAudioSource(e.target.value as AudioSource)}
                        className="h-4 w-4 border-slate-300 text-primary-600 focus:ring-primary-600"
                        />
                    </div>
                    <div className="ml-3">
                      <span className={`block text-sm font-medium ${audioSource === AudioSource.MICROPHONE ? 'text-primary-900' : 'text-slate-900'}`}>Microphone</span>
                      <p className={`block text-sm ${audioSource === AudioSource.MICROPHONE ? 'text-primary-700' : 'text-slate-500'}`}>Record from your computer's built-in or external microphone.</p>
                    </div>
                  </label>

                  <label className={`flex items-start p-4 border rounded-lg cursor-pointer transition-all ${audioSource === AudioSource.DEVICE ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                    <div className="flex h-6 items-center">
                        <input
                            type="radio"
                            name="audioSource"
                            value={AudioSource.DEVICE}
                            checked={audioSource === AudioSource.DEVICE}
                            onChange={(e) => setAudioSource(e.target.value as AudioSource)}
                            className="h-4 w-4 border-slate-300 text-primary-600 focus:ring-primary-600"
                        />
                    </div>
                    <div className="ml-3">
                      <span className={`block text-sm font-medium ${audioSource === AudioSource.DEVICE ? 'text-primary-900' : 'text-slate-900'}`}>System Audio</span>
                      <p className={`block text-sm ${audioSource === AudioSource.DEVICE ? 'text-primary-700' : 'text-slate-500'}`}>Capture audio playing on your system (meetings, videos, etc).</p>
                    </div>
                  </label>

                  <label className={`flex items-start p-4 border rounded-lg cursor-pointer transition-all ${audioSource === AudioSource.BOTH ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                    <div className="flex h-6 items-center">
                        <input
                        type="radio"
                        name="audioSource"
                        value={AudioSource.BOTH}
                        checked={audioSource === AudioSource.BOTH}
                        onChange={(e) => setAudioSource(e.target.value as AudioSource)}
                        className="h-4 w-4 border-slate-300 text-primary-600 focus:ring-primary-600"
                        />
                    </div>
                    <div className="ml-3">
                      <span className={`block text-sm font-medium ${audioSource === AudioSource.BOTH ? 'text-primary-900' : 'text-slate-900'}`}>Both</span>
                      <p className={`block text-sm ${audioSource === AudioSource.BOTH ? 'text-primary-700' : 'text-slate-500'}`}>Record microphone and system audio together on separate tracks.</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Info Box */}
              <div className="rounded-md bg-blue-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3 flex-1 md:flex md:justify-between">
                    <p className="text-sm text-blue-700">Next, you'll be redirected to the recording interface where you can test your audio levels.</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-x-6 border-t border-slate-900/10 pt-6">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="text-sm font-semibold leading-6 text-slate-900 hover:text-slate-700"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isCreating}
                >
                  {isCreating ? 'Creating...' : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
    </DashboardLayout>
  )
}

