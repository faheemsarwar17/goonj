'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { sessionApi } from '@/lib/api/sessions'
import { Session, SessionStatus } from '@/types/session'
import DashboardLayout from '@/components/DashboardLayout'

export default function SessionsPage() {
  const { user } = useAuth()
  const router = useRouter()
  
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      loadSessions()
    }
  }, [user])

  const loadSessions = async () => {
    try {
      setIsLoading(true)
      const response = await sessionApi.listSessions(1, 100)
      setSessions(response.items)
      setError('')
    } catch (err: any) {
      console.error('Sessions load error:', err)
      let errorMessage = 'Failed to load sessions'
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
        errorMessage = 'Failed to load sessions'
      }
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteSession = async (sessionId: number, title: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Are you sure you want to delete session "${title}"? This action cannot be undone.`)) {
      return
    }

    try {
      await sessionApi.deleteSession(sessionId)
      setSessions(sessions.filter(s => s.id !== sessionId))
    } catch (err: any) {
      console.error('Delete error:', err)
      alert('Failed to delete session: ' + (err.response?.data?.detail || err.message))
    }
  }

  const getStatusBadge = (status: SessionStatus) => {
    const styles: Record<SessionStatus, string> = {
      [SessionStatus.RECORDING]: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
      [SessionStatus.PROCESSING]: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10',
      [SessionStatus.COMPLETED]: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
      [SessionStatus.FAILED]: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-500/10'
    }
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${styles[status]}`}>
        {status}
      </span>
    )
  }

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
            <h1 className="text-2xl font-bold text-slate-900">Recording Sessions</h1>
            <p className="mt-1 text-sm text-slate-500">All your audio recordings and their transcription status.</p>
        </div>
        <button
          onClick={() => router.push('/sessions/new')}
          className="rounded-md bg-primary-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
        >
          New Session
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 flex justify-center">
            <div className="flex flex-col items-center gap-4">
                 <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600"></div>
            </div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center bg-white rounded-lg shadow-sm border border-slate-200 py-12">
            <svg
                className="mx-auto h-12 w-12 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
            >
                <path
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
            </svg>
            <h3 className="mt-2 text-sm font-semibold text-slate-900">No sessions</h3>
            <p className="mt-1 text-sm text-slate-500">Get started by creating a new recording session.</p>
            <div className="mt-6">
                <button
                onClick={() => router.push('/sessions/new')}
                className="inline-flex items-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                >
                <svg className="-ml-0.5 mr-1.5 h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
                New Session
                </button>
            </div>
        </div>
      ) : (
        <div className="overflow-hidden bg-white shadow-sm ring-1 ring-slate-900/5 sm:rounded-lg">
          <table className="min-w-full divide-y divide-slate-300">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 sm:pl-6">
                  Title
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Duration
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Created
                </th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {sessions.map((session) => (
                <tr 
                    key={session.id} 
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/sessions/${session.id}`)}
                >
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">
                    {session.title}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                    {getStatusBadge(session.status)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 font-mono">
                    {formatDuration(session.duration_seconds)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                    {formatDate(session.created_at)}
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <button
                        onClick={(e) => handleDeleteSession(session.id, session.title, e)}
                        className="text-red-600 hover:text-red-900 transition-colors"
                    >
                        Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  )
}

