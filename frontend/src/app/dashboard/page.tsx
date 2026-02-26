'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'

export default function DashboardPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  // Wait for auth to be checked
  if (!user && isLoading) {
    return <DashboardLayout><div className="flex justify-center p-8 text-slate-500">Loading user data...</div></DashboardLayout>
  }

  // If check complete but no user, layout will handle redirect, we just return empty
  if (!user) {
    return <DashboardLayout><div></div></DashboardLayout> 
  }

  return (
    <DashboardLayout>
      <div className="bg-white shadow rounded-lg mb-6 border border-slate-200">
        <div className="px-4 py-5 sm:p-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome back, {user.full_name}!</h2>
          <p className="text-slate-600 mb-4">
            Manage your audio recordings, transcripts, and speakers from one place.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Recording Sessions Card */}
        <div 
            onClick={() => router.push('/sessions')}
            className="group relative bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg shadow-sm ring-1 ring-slate-900/5 hover:bg-slate-50 transition cursor-pointer"
        >
          <div>
            <span className="inline-flex rounded-lg p-3 bg-primary-50 text-primary-700 ring-4 ring-white">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-base font-semibold leading-6 text-slate-900">
              <span className="absolute inset-0" aria-hidden="true" />
              Recording Sessions
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              View, upload, and manage your audio recording sessions.
            </p>
          </div>
          <span className="pointer-events-none absolute right-6 top-6 text-slate-300 group-hover:text-slate-400" aria-hidden="true">
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
            </svg>
          </span>
        </div>

        {/* Transcripts Card */}
        <div 
            onClick={() => router.push('/transcripts')}
            className="group relative bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg shadow-sm ring-1 ring-slate-900/5 hover:bg-slate-50 transition cursor-pointer"
        >
          <div>
            <span className="inline-flex rounded-lg p-3 bg-emerald-50 text-emerald-700 ring-4 ring-white">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-base font-semibold leading-6 text-slate-900">
              <span className="absolute inset-0" aria-hidden="true" />
              Transcripts
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Access and export generated transcripts from your sessions.
            </p>
          </div>
        </div>

        {/* Speakers Card */}
        <div 
             onClick={() => router.push('/speakers')}
             className="group relative bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg shadow-sm ring-1 ring-slate-900/5 hover:bg-slate-50 transition cursor-pointer"
        >
          <div>
            <span className="inline-flex rounded-lg p-3 bg-violet-50 text-violet-700 ring-4 ring-white">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 01-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 5.472m0 0a9.094 9.094 0 00-4.962.875 3 3 0 004.682 2.72 6.09 6.09 0 01-3.74-3.198" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-base font-semibold leading-6 text-slate-900">
              <span className="absolute inset-0" aria-hidden="true" />
              Speakers
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Identify and manage speakers detected in your audio.
            </p>
          </div>
        </div>

        {/* Admin Card (conditional) */}
        {user.role === 'admin' && (
          <div 
               onClick={() => router.push('/admin')}
               className="group relative bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg shadow-sm ring-1 ring-slate-900/5 hover:bg-slate-50 transition cursor-pointer"
          >
            <div>
              <span className="inline-flex rounded-lg p-3 bg-orange-50 text-orange-700 ring-4 ring-white">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-base font-semibold leading-6 text-slate-900">
                <span className="absolute inset-0" aria-hidden="true" />
                Admin Panel
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Manage users and system settings.
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

