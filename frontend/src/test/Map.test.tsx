import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MapPage from '../pages/Map'
import api from '../services/api'

vi.mock('../services/api')
const mockedApi = vi.mocked(api)

// Leaflet uses browser APIs that jsdom doesn't have — mock them out
vi.mock('react-leaflet', () => ({
  MapContainer:   ({ children }: any) => <div data-testid="map">{children}</div>,
  TileLayer:      () => null,
  CircleMarker:   ({ children }: any) => <div data-testid="marker">{children}</div>,
  Popup:          ({ children }: any) => <div>{children}</div>,
}))

const mockTeams = [
  { id: '1', name: 'France',    flag_emoji: '🇫🇷', fifa_ranking: 2,  latitude: 48.8,  longitude: 2.3  },
  { id: '2', name: 'Brazil',    flag_emoji: '🇧🇷', fifa_ranking: 5,  latitude: -14.2, longitude: -51.9 },
  { id: '3', name: 'Argentina', flag_emoji: '🇦🇷', fifa_ranking: 1,  latitude: -38.4, longitude: -63.6 },
  { id: '4', name: 'England',   flag_emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', fifa_ranking: 4,  latitude: 52.3,  longitude: -1.1  },
]

const mockGroups = [
  { id: 'g1', name: 'A', members: [{ team: mockTeams[0] }, { team: mockTeams[1] }] },
  { id: 'g2', name: 'B', members: [{ team: mockTeams[2] }, { team: mockTeams[3] }] },
]

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  mockedApi.get = vi.fn().mockImplementation((url: string) => {
    if (url === '/teams/')  return Promise.resolve({ data: mockTeams })
    if (url === '/groups/') return Promise.resolve({ data: mockGroups })
    return Promise.reject(new Error(`Unexpected URL: ${url}`))
  })
})

describe('MapPage', () => {
  it('renders the page heading', async () => {
    renderWithQuery(<MapPage />)
    expect(await screen.findByText('🌍 World Map')).toBeInTheDocument()
  })

  it('renders a badge for each group', async () => {
    renderWithQuery(<MapPage />)
    expect(await screen.findByText('Group A')).toBeInTheDocument()
    expect(screen.getByText('Group B')).toBeInTheDocument()
  })

  it('renders a marker for each team', async () => {
    renderWithQuery(<MapPage />)
    await screen.findByText('🌍 World Map')
    const markers = screen.getAllByTestId('marker')
    expect(markers).toHaveLength(mockTeams.length)
  })

  it('shows only filtered teams when a group badge is clicked', async () => {
    renderWithQuery(<MapPage />)
    await screen.findByText('Group A')

    await userEvent.click(screen.getByText('Group A'))

    // Group A has 2 teams — only 2 markers should be visible
    const markers = screen.getAllByTestId('marker')
    expect(markers).toHaveLength(2)
  })

  it('shows a clear filter button when a group is selected', async () => {
    renderWithQuery(<MapPage />)
    await screen.findByText('Group A')

    await userEvent.click(screen.getByText('Group A'))

    expect(screen.getByText('✕ Clear filter')).toBeInTheDocument()
  })

  it('resets to all teams when clear filter is clicked', async () => {
    renderWithQuery(<MapPage />)
    await screen.findByText('Group A')

    await userEvent.click(screen.getByText('Group A'))
    await userEvent.click(screen.getByText('✕ Clear filter'))

    const markers = screen.getAllByTestId('marker')
    expect(markers).toHaveLength(mockTeams.length)
  })
})
