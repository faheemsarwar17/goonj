'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { adminApi } from '@/lib/api/admin'
import { User } from '@/types/auth'

export default function AdminPanelPage() {
  const { user } = useAuth()
  const router = useRouter()
  
  const [pendingUsers, setPendingUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingUserId, setProcessingUserId] = useState<number | null>(null)

  useEffect(() => {
    if (user) {
      if (user.role !== 'admin') {
        router.push('/dashboard')
        return
      }
      loadPendingUsers()
    }
  }, [user])

  const loadPendingUsers = async () => {
    try {
      setIsLoading(true)
      const users = await adminApi.getPendingUsers()
      setPendingUsers(users)
      setError('')
    } catch (err: any) {
      console.error('Failed to load pending users:', err)
      setError(err.response?.data?.detail || 'Failed to load pending users')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async (userId: number, fullName: string) => {
    if (!confirm(`Are you sure you want to approve ${fullName}?`)) {
      return
    }

    try {
      setProcessingUserId(userId)
      await adminApi.approveUser(userId, { is_approved: true })
      setPendingUsers(pendingUsers.filter(u => u.id !== userId))
      alert(`${fullName} has been approved successfully!`)
    } catch (err: any) {
      console.error('Approval error:', err)
      alert('Failed to approve user: ' + (err.response?.data?.detail || err.message))
    } finally {
      setProcessingUserId(null)
    }
  }

  const handleReject = async (userId: number, fullName: string) => {
    const reason = prompt(`Enter rejection reason for ${fullName}:`)
    if (!reason) {
      return
    }

    try {
      setProcessingUserId(userId)
      await adminApi.approveUser(userId, { is_approved: false })
      setPendingUsers(pendingUsers.filter(u => u.id !== userId))
      alert(`${fullName} has been rejected.`)
    } catch (err: any) {
      console.error('Rejection error:', err)
      alert('Failed to reject user: ' + (err.response?.data?.detail || err.message))
    } finally {
      setProcessingUserId(null)
    }
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString()
  }

  const getApprovalBadge = (isApproved: boolean) => {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isApproved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
        {isApproved ? 'APPROVED' : 'PENDING'}
      </span>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
          <p className="mt-2 text-gray-600">You must be an admin to access this page.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Go to Dashboard
          </button>
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
                onClick={() => router.push('/dashboard')}
                className="text-gray-600 hover:text-gray-900 mr-4"
              >
                ← Dashboard
              </button>
              <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
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
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Pending User Approvals</h2>
            <p className="mt-1 text-sm text-gray-600">
              Review and approve or reject user registration requests.
            </p>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Loading pending users...</p>
            </div>
          ) : pendingUsers.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center py-8">
                <svg 
                  className="mx-auto h-12 w-12 text-gray-400" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No pending users</h3>
                <p className="mt-1 text-sm text-gray-500">
                  All user registrations have been processed.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registered
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pendingUsers.map((pendingUser) => (
                    <tr key={pendingUser.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-blue-600 font-semibold text-sm">
                                {pendingUser.full_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {pendingUser.full_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {pendingUser.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{pendingUser.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getApprovalBadge(pendingUser.is_approved)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(pendingUser.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleApprove(pendingUser.id, pendingUser.full_name)}
                          disabled={processingUserId === pendingUser.id}
                          className="text-green-600 hover:text-green-900 mr-4 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processingUserId === pendingUser.id ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReject(pendingUser.id, pendingUser.full_name)}
                          disabled={processingUserId === pendingUser.id}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processingUserId === pendingUser.id ? 'Processing...' : 'Reject'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
