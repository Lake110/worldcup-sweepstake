import { act } from '@testing-library/react'
import { useAuthStore } from '../store/authStore'

const mockUser = { id: '1', email: 'test@test.com', full_name: 'Test User', is_admin: false }

describe('authStore', () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.setState({ token: null, user: null })
    })
  })

  it('starts with no token and no user', () => {
    const { token, user } = useAuthStore.getState()
    expect(token).toBeNull()
    expect(user).toBeNull()
  })

  it('setAuth stores a token and user', () => {
    act(() => {
      useAuthStore.getState().setAuth('abc123', mockUser)
    })
    expect(useAuthStore.getState().token).toBe('abc123')
    expect(useAuthStore.getState().user?.email).toBe('test@test.com')
  })

  it('logout clears token and user', () => {
    act(() => {
      useAuthStore.getState().setAuth('abc123', mockUser)
      useAuthStore.getState().logout()
    })
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('setAuth stores is_admin flag', () => {
    act(() => {
      useAuthStore.getState().setAuth('abc123', { ...mockUser, is_admin: true })
    })
    expect(useAuthStore.getState().user?.is_admin).toBe(true)
  })
})
