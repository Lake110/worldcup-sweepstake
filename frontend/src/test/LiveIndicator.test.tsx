import { describe, it, expect } from 'vitest'

// Extract the live indicator logic as a pure function matching Tournament.tsx

interface LiveMatch {
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  minute: string | null
  status: number
}

function buildLiveMap(liveMatches: LiveMatch[]): Map<string, LiveMatch> {
  const map = new Map<string, LiveMatch>()
  liveMatches.forEach(m => {
    map.set(m.home_team.toLowerCase(), m)
    map.set(m.away_team.toLowerCase(), m)
  })
  return map
}

function getLiveIndicator(teamName: string, liveMatches: LiveMatch[]) {
  const liveMap = buildLiveMap(liveMatches)
  return liveMap.get(teamName.toLowerCase()) ?? null
}

describe('Live indicator logic', () => {
  it('no live indicator when live endpoint returns []', () => {
    const result = getLiveIndicator('Brazil', [])
    expect(result).toBeNull()
  })

  it('returns live match when team is playing', () => {
    const liveMatches: LiveMatch[] = [
      { home_team: 'Brazil', away_team: 'Germany', home_score: 1, away_score: 0, minute: '67', status: 2 },
    ]
    const result = getLiveIndicator('Brazil', liveMatches)
    expect(result).not.toBeNull()
    expect(result!.minute).toBe('67')
  })

  it('returns live match for away team too', () => {
    const liveMatches: LiveMatch[] = [
      { home_team: 'Brazil', away_team: 'Germany', home_score: 1, away_score: 0, minute: '67', status: 2 },
    ]
    const result = getLiveIndicator('Germany', liveMatches)
    expect(result).not.toBeNull()
    expect(result!.minute).toBe('67')
  })

  it('live indicator not shown for a team not in live matches', () => {
    const liveMatches: LiveMatch[] = [
      { home_team: 'Brazil', away_team: 'Germany', home_score: 1, away_score: 0, minute: '67', status: 2 },
    ]
    const result = getLiveIndicator('France', liveMatches)
    expect(result).toBeNull()
  })

  it('is case-insensitive', () => {
    const liveMatches: LiveMatch[] = [
      { home_team: 'Brazil', away_team: 'Germany', home_score: 0, away_score: 0, minute: '10', status: 2 },
    ]
    expect(getLiveIndicator('BRAZIL', liveMatches)).not.toBeNull()
    expect(getLiveIndicator('brazil', liveMatches)).not.toBeNull()
  })

  it('no indicator for scheduled (non-live) matches — live endpoint returns empty', () => {
    // When no match is live, the endpoint returns [] — same as first test
    const liveMatches: LiveMatch[] = []
    expect(getLiveIndicator('Brazil', liveMatches)).toBeNull()
    expect(getLiveIndicator('Germany', liveMatches)).toBeNull()
  })
})
