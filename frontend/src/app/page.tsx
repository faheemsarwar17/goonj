'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    console.log('HomePage: Checking auth...')
    const token = localStorage.getItem('access_token')
    console.log('HomePage: Has token:', !!token)
    
    if (token) {
      console.log('HomePage: Redirecting to dashboard')
      router.replace('/dashboard')
    } else {
      console.log('HomePage: Redirecting to login')
      router.replace('/login')
    }
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Audio Transcript Application</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}
