export type AuthUser = {
  id: string
  email: string
  full_name: string
  is_active: boolean
  is_admin: boolean
}

export type LoginResponse = {
  access_token: string
  token_type: 'bearer'
  user: AuthUser
}
