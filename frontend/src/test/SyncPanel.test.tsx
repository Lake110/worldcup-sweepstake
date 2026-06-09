import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import SyncPanel from '../components/SyncPanel'

// Mock the api module
vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import api from '../services/api'
const mockApi = api as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> }

const emptyStatus = {}
const syncResult = {
  synced_at: '2026-06-11T20:00:00Z',
  updated: ['Mexico 2-1 South Africa'],
  skipped: [],
  errors: [],
  total_finished: 1,
}
const standingsResult = {
  synced_at: '2026-06-11T20:00:00Z',
  groups_updated: 12,
  teams_updated: 48,
  errors: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockApi.get.mockResolvedValue({ data: emptyStatus })
  mockApi.post.mockResolvedValue({ data: syncResult })
})

describe('SyncPanel', () => {
  it('shows "Never synced" on initial load when status returns {}', async () => {
    render(<SyncPanel />)
    await waitFor(() => {
      expect(screen.getByText('Never synced')).toBeInTheDocument()
    })
  })

  it('shows grey dot when never synced', async () => {
    render(<SyncPanel />)
    await waitFor(() => {
      const dot = screen.getByTestId('sync-dot')
      expect(dot.className).toContain('bg-gray-500')
    })
  })

  it('sync results button triggers POST /api/sync/run and updates status', async () => {
    const user = userEvent.setup()
    render(<SyncPanel />)
    await waitFor(() => screen.getByText('Never synced'))

    mockApi.post.mockResolvedValueOnce({ data: syncResult })
    await user.click(screen.getByRole('button', { name: /Sync Results/i }))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/sync/run')
      expect(screen.getByText(/Last synced/)).toBeInTheDocument()
    })
  })

  it('shows updated count in status subtext after sync', async () => {
    const user = userEvent.setup()
    render(<SyncPanel />)
    await waitFor(() => screen.getByText('Never synced'))

    await user.click(screen.getByRole('button', { name: /Sync Results/i }))

    await waitFor(() => {
      expect(screen.getByText(/1 updated/)).toBeInTheDocument()
    })
  })

  it('sync standings button triggers POST /api/sync/standings', async () => {
    const user = userEvent.setup()
    render(<SyncPanel />)
    await waitFor(() => screen.getByText('Never synced'))

    mockApi.post.mockResolvedValueOnce({ data: standingsResult })
    await user.click(screen.getByRole('button', { name: /Sync Standings/i }))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/sync/standings')
      expect(screen.getByText(/Last synced/)).toBeInTheDocument()
    })
  })

  it('both buttons disabled while request in flight', async () => {
    const user = userEvent.setup()

    let resolveFn!: (v: unknown) => void
    const pending = new Promise(r => { resolveFn = r })
    mockApi.post.mockReturnValueOnce(pending)

    render(<SyncPanel />)
    await waitFor(() => screen.getByText('Never synced'))

    await user.click(screen.getByRole('button', { name: /Sync Results/i }))

    const buttons = screen.getAllByRole('button')
    buttons.forEach(btn => expect(btn).toBeDisabled())

    await act(async () => {
      resolveFn({ data: syncResult })
    })
  })

  it('shows amber "Sync failed" on API error', async () => {
    const user = userEvent.setup()
    mockApi.post.mockRejectedValueOnce(new Error('500'))

    render(<SyncPanel />)
    await waitFor(() => screen.getByText('Never synced'))

    await user.click(screen.getByRole('button', { name: /Sync Results/i }))

    await waitFor(() => {
      expect(screen.getByText('Sync failed')).toBeInTheDocument()
    })
  })
})
