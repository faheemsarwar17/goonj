/**
 * Authentication API calls
 */

import { apiClient } from './client'
import { LoginCredentials, LoginResponse, SignupData, User } from '@/types/auth'

export const authApi = {
  /**
   * Login user
   */
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    console.log('[AUTH_API] login: Starting request with credentials:', { email: credentials.email, passwordLength: credentials.password?.length })
    console.log('[AUTH_API] login: API URL:', apiClient.defaults.baseURL)
    try {
      const response = await apiClient.post<LoginResponse>('/auth/login', credentials)
      console.log('[AUTH_API] login: Response received:', response.status, response.statusText)
      console.log('[AUTH_API] login: Response data:', response.data)
      return response.data
    } catch (error: any) {
      console.error('[AUTH_API] login: Error occurred:', error)
      console.error('[AUTH_API] login: Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL
        }
      })
      throw error
    }
  },

  /**
   * Signup new user
   */
  signup: async (data: SignupData): Promise<User> => {
    const response = await apiClient.post<User>('/auth/signup', data)
    return response.data
  },

  /**
   * Get current user info
   */
  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/me')
    return response.data
  },

  /**
   * Logout user
   */
  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout')
  },
}
