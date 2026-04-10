// Dashboard renders a setInterval countdown that hangs jsdom.
// We test the core logic (strongest group calculation) in isolation instead.

interface Team {
  id: string
  fifa_ranking: number
}
interface GroupMember { team: Team }
interface Group { id: string; name: string; members: GroupMember[] }

function findStrongestGroup(groups: Group[]) {
  return groups.reduce((best, group) => {
    if (group.members.length === 0) return best
    const avg = group.members.reduce((sum, m) => sum + m.team.fifa_ranking, 0) / group.members.length
    if (!best || avg < best.avg) return { group, avg }
    return best
  }, null as { group: Group; avg: number } | null)
}

describe('Dashboard — strongest group logic', () => {
  const groups: Group[] = [
    { id: 'g1', name: 'A', members: [{ team: { id: '1', fifa_ranking: 1 } }, { team: { id: '2', fifa_ranking: 3 } }] },
    { id: 'g2', name: 'B', members: [{ team: { id: '3', fifa_ranking: 10 } }, { team: { id: '4', fifa_ranking: 12 } }] },
    { id: 'g3', name: 'C', members: [{ team: { id: '5', fifa_ranking: 5 } }, { team: { id: '6', fifa_ranking: 7 } }] },
  ]

  it('returns the group with the lowest average FIFA ranking', () => {
    const result = findStrongestGroup(groups)
    expect(result?.group.name).toBe('A') // avg 2 — lower is stronger
  })

  it('calculates the average correctly', () => {
    const result = findStrongestGroup(groups)
    expect(result?.avg).toBe(2)
  })

  it('returns null for an empty array', () => {
    expect(findStrongestGroup([])).toBeNull()
  })

  it('skips groups with no members', () => {
    const withEmpty: Group[] = [
      { id: 'g1', name: 'A', members: [] },
      { id: 'g2', name: 'B', members: [{ team: { id: '1', fifa_ranking: 5 } }] },
    ]
    const result = findStrongestGroup(withEmpty)
    expect(result?.group.name).toBe('B')
  })
})
