'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'

export default function SignupPage() {
  const router = useRouter()
  const { signup } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password length
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setIsLoading(true)

    try {
      await signup({
        email: formData.email,
        full_name: formData.full_name,
        password: formData.password,
      })
      setSuccess(true)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Signup failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen bg-white">
        <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
            <div className="mx-auto w-full max-w-sm lg:w-96">
                <div className="text-center">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                        <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                        Registration Successful!
                    </h2>
                    <p className="mt-4 text-base text-slate-600">
                        Your account has been created effectively. It is currently pending admin approval.
                        You will be able to log in once your account is activated.
                    </p>
                    <div className="mt-8">
                        <Link
                            href="/login"
                            className="inline-flex items-center justify-center w-full px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                        >
                            Go to Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
        
        {/* Right side background (reused) */}
        <div className="relative hidden w-0 flex-1 lg:block">
            <div className="absolute inset-0 h-full w-full bg-slate-900 object-cover">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 to-slate-900 opacity-90" />
                <div className="absolute inset-0 flex items-center justify-center p-12">
                     <div className="max-w-xl text-center">
                        <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Account Created</h2>
                        <p className="mt-6 text-lg leading-8 text-slate-300">
                            You're one step closer to seamless audio transcription. Wait for your approval and get started soon.
                        </p>
                     </div>
                </div>
                 {/* Abstract Shapes for visual interest */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 h-96 w-96 rounded-full bg-emerald-500 blur-3xl opacity-20"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-96 w-96 rounded-full bg-teal-500 blur-3xl opacity-20"></div>
            </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left side: Form */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div>
            <div className="h-10 w-10 text-primary-600 flex items-center justify-center rounded-lg bg-primary-100">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            </div>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
              Create your account
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-primary-600 hover:text-primary-500">
                Sign in
              </Link>
            </p>
          </div>

          <div className="mt-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Error</h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>{error}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div>
                <label htmlFor="full_name" className="block text-sm font-medium leading-6 text-slate-900">
                  Full Name
                </label>
                <div className="mt-2">
                  <input
                    id="full_name"
                    name="full_name"
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="block w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium leading-6 text-slate-900">
                  Email address
                </label>
                <div className="mt-2">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="block w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium leading-6 text-slate-900">
                  Password
                </label>
                <div className="mt-2">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="block w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    placeholder="Minimum 8 characters"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium leading-6 text-slate-900">
                  Confirm Password
                </label>
                <div className="mt-2">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="block w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    placeholder="Repeat password"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full justify-center rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating account...' : 'Sign up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      
      {/* Right side: Gradient/Content */}
      <div className="relative hidden w-0 flex-1 lg:block">
        <div className="absolute inset-0 h-full w-full bg-slate-900 object-cover">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-800 to-slate-900 opacity-90" />
            <div className="absolute inset-0 flex items-center justify-center p-12">
                 <div className="max-w-xl text-center">
                    <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Join Audio Transcript</h2>
                    <p className="mt-6 text-lg leading-8 text-slate-300">
                        Experience the power of precise speech-to-text technology. 
                        Sign up today to start transcribing your audio files and meetings effortlessly.
                    </p>
                 </div>
            </div>
             {/* Abstract Shapes for visual interest */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 h-96 w-96 rounded-full bg-indigo-500 blur-3xl opacity-20"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-96 w-96 rounded-full bg-violet-500 blur-3xl opacity-20"></div>
        </div>
      </div>
    </div>
  )
}
