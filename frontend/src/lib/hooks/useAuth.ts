/**
 * Authentication hook
 */

import { create } from 'zustand'
import { User, LoginCredentials, SignupData } from '@/types/auth'
import { authApi } from '@/lib/api/auth'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  signup: (data: SignupData) => Promise<void>
  logout: () => Promise<void>
  loadUser: () => Promise<void>
  setUser: (user: User | null) => void
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,

  setUser: (user: User | null) => {
    set({ user, isAuthenticated: !!user })
  },

  login: async (credentials: LoginCredentials) => {
    try {
      console.log('useAuth.login: Starting login...')
      set({ isLoading: true })
      const response = await authApi.login(credentials)
      console.log('useAuth.login: API response received:', response)
      
      // Ensure localStorage is set synchronously
      const token = response.token.access_token
      const user = response.user
      console.log('useAuth.login: Setting localStorage and cookie...')
      localStorage.setItem('access_token', token)
      localStorage.setItem('user', JSON.stringify(user))
      
      // Also set cookie for middleware
      document.cookie = `access_token=${token}; path=/; max-age=${response.token.expires_in}; samesite=strict`
      console.log('useAuth.login: localStorage and cookie set successfully')
      
      // Update state
      set({ user, isAuthenticated: true, isLoading: false })
      console.log('useAuth.login: State updated')
      
      // Return success to caller
      return Promise.resolve()
    } catch (error) {
      console.error('useAuth.login: Error:', error)
      set({ isLoading: false })
      throw error
    }
  },

  signup: async (data: SignupData) => {
    try {
      await authApi.signup(data)
      // Don't auto-login, user needs approval
    } catch (error) {
      throw error
    }
  },

  logout: async () => {
    try {
      await authApi.logout()
    } catch (error) {
      // Continue with logout even if API call fails
    } finally {
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
      // Clear cookie
      document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
      set({ user: null, isAuthenticated: false })
      window.location.href = '/login'
    }
  },

  loadUser: async () => {
    const token = localStorage.getItem('access_token')
    const userStr = localStorage.getItem('user')
    
    if (!token) {
      set({ isLoading: false, isAuthenticated: false, user: null })
      return
    }

    if (userStr) {
      try {
        const cachedUser = JSON.parse(userStr)
        set({ user: cachedUser, isAuthenticated: true, isLoading: false })
      } catch (e) {
        // Invalid cached data
      }
    }

    try {
      const user = await authApi.getCurrentUser()
      localStorage.setItem('user', JSON.stringify(user))
      set({ user, isAuthenticated: true, isLoading: false })
    } catch (error) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },
}))
