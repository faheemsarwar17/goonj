/**
 * Admin API calls
 */

import { apiClient } from './client'
import { User } from '@/types/auth'

export interface UserApproval {
  is_approved: boolean
  role?: 'admin' | 'user'
}

export interface CreateUserData {
  email: string
  full_name: string
  password: string
  role?: 'admin' | 'user'
}

export interface UpdateUserData {
  full_name?: string
  email?: string
  password?: string
  role?: 'admin' | 'user'
  is_active?: boolean
  is_approved?: boolean
}

export const adminApi = {
  /**
   * Get all users in tenant
   */
  getAllUsers: async (): Promise<User[]> => {
    const response = await apiClient.get<User[]>('/admin/users')
    return response.data
  },

  /**
   * Get list of pending users
   */
  getPendingUsers: async (): Promise<User[]> => {
    const response = await apiClient.get<User[]>('/admin/pending-users')
    return response.data
  },

  /**
   * Create a new user
   */
  createUser: async (userData: CreateUserData): Promise<User> => {
    const response = await apiClient.post<User>('/admin/users', userData)
    return response.data
  },

  /**
   * Update a user
   */
  updateUser: async (userId: number, userData: UpdateUserData): Promise<User> => {
    const response = await apiClient.put<User>(`/admin/users/${userId}`, userData)
    return response.data
  },

  /**
   * Approve or reject a user
   */
  approveUser: async (userId: number, approval: UserApproval): Promise<User> => {
    const response = await apiClient.post<User>(`/admin/users/${userId}/approve`, approval)
    return response.data
  },

  /**
   * Delete a user
   */
  deleteUser: async (userId: number): Promise<void> => {
    await apiClient.delete(`/admin/users/${userId}`)
  },
}
