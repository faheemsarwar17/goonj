/**
 * Axios client configuration for API calls
 */

import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    console.log('[API_CLIENT] Request interceptor:', config.method?.toUpperCase(), config.url)
    // Get token from localStorage
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      console.log('[API_CLIENT] Added Authorization header')
    }
    return config
  },
  (error) => {
    console.error('[API_CLIENT] Request interceptor error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => {
    console.log('[API_CLIENT] Response received:', response.status, response.config.url)
    return response
  },
  (error) => {
    console.error('[API_CLIENT] Response error:', error.message, error.response?.status, error.config?.url)
    if (error.response?.status === 401) {
      // Only redirect if not already on login/signup page
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
      const isAuthPage = currentPath === '/login' || currentPath === '/signup'
      
      if (!isAuthPage) {
        console.log('[API_CLIENT] 401 Unauthorized - redirecting to login')
        // Clear token and redirect to login
        localStorage.removeItem('access_token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
