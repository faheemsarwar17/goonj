/**
 * Type definitions for the application
 */

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export interface User {
  id: number
  tenant_id: number
  email: string
  full_name: string
  role: UserRole
  is_approved: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Token {
  access_token: string
  token_type: string
  expires_in: number
}

export interface LoginResponse {
  user: User
  token: Token
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface SignupData {
  email: string
  full_name: string
  password: string
}
