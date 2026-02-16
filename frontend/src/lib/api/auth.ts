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
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials)
    return response.data
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
