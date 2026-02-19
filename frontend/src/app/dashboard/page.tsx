'use client'

import { useEffect, useState } from  'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const { user, loadUser } = useAuth()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token')
      const userStr = localStorage.getItem('user')
      
      console.log('Dashboard auth check:', { hasToken: !!token, hasUser: !!userStr })
      
      if (!token || !userStr) {
        console.log('No auth data, redirecting to login')
        router.replace('/login')
        return
      }
      
      try {
        // Set cached user immediately
        const cachedUser = JSON.parse(userStr)
        useAuth.setState({ user: cachedUser, isAuthenticated: true })
        setIsChecking(false)
        
        // Refresh user data in background
        await loadUser()
      } catch (e) {
        console.error('Auth check failed:', e)
        router.replace('/login')
      }
    }
    
    checkAuth()
  }, [])

  if (isChecking || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900">Audio Transcript</h1>
              </div>
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

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome, {user.full_name}!</h2>
              <p className="text-gray-600 mb-4">
                This is your dashboard. From here you can manage your recording sessions and transcripts.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <button
                  onClick={() => router.push('/sessions')}
                  className="bg-blue-50 overflow-hidden shadow rounded-lg hover:bg-blue-100 transition-colors cursor-pointer text-left"
                >
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Recording Sessions</dt>
                          <dd className="text-lg font-medium text-gray-900">View All Sessions</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => router.push('/transcripts')}
                  className="bg-green-50 overflow-hidden shadow rounded-lg hover:bg-green-100 transition-colors cursor-pointer text-left"
                >
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Transcripts</dt>
                          <dd className="text-lg font-medium text-gray-900">View All Transcripts</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => router.push('/speakers')}
                  className="bg-purple-50 overflow-hidden shadow rounded-lg hover:bg-purple-100 transition-colors cursor-pointer text-left"
                >
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Speaker Diarization</dt>
                          <dd className="text-lg font-medium text-gray-900">Identify Speakers</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </button>

                {user.role === 'admin' && (
                  <button
                    onClick={() => router.push('/admin')}
                    className="bg-orange-50 overflow-hidden shadow rounded-lg hover:bg-orange-100 transition-colors cursor-pointer text-left"
                  >
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">Admin Panel</dt>
                            <dd className="text-lg font-medium text-gray-900">Manage Users</dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
