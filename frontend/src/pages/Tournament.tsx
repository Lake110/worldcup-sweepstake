import { useEffect, useState } from 'react'
import api from '../services/api'

interface Team {
  id: string
  name: string
  code: string
  flag_emoji: string
  confederation: string
  fifa_ranking: number
  latitude: number | null
  longitude: number | null
}

interface GroupMember {
  team: Team
}

interface Group {
  id: string
  name: string
  members: GroupMember[]
}

const CONFEDERATION_COLOURS: Record<string, string> = {
  UEFA:     'bg-blue-900/40 text-blue-300 border border-blue-700',
  CONMEBOL: 'bg-green-900/40 text-green-300 border border-green-700',
  CONCACAF: 'bg-red-900/40 text-red-300 border border-red-700',
  CAF:      'bg-yellow-900/40 text-yellow-300 border border-yellow-700',
  AFC:      'bg-purple-900/40 text-purple-300 border border-purple-700',
  OFC:      'bg-gray-700/40 text-gray-300 border border-gray-600',
}

const RANKING_COLOUR: Record<string, string> = {
  top10: 'text-orange-400',
  top20: 'text-yellow-400',
  rest:  'text-gray-500',
}

const CONFEDERATION_ORDER = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC']

export default function Tournament() {
  const [teams, setTeams]     = useState<Team[]>([])
  const [groups, setGroups]   = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<'groups' | 'teams'>('groups')
  const [filter, setFilter]   = useState<string>('ALL')
  const [search, setSearch]   = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/teams/'),
      api.get('/groups/'),
    ]).then(([teamsRes, groupsRes]) => {
      setTeams(teamsRes.data)
      setGroups(groupsRes.data)
    }).finally(() => setLoading(false))
  }, [])

  const filtered = teams.filter(t => {
    const matchesConf   = filter === 'ALL' || t.confederation === filter
    const matchesSearch = search === '' ||
                          t.name.toLowerCase().startsWith(search.toLowerCase())
    return matchesConf && matchesSearch
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading tournament data...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-1">⚽ 2026 World Cup</h2>
        <p className="text-gray-400 text-sm">
          48 teams · 12 groups · June 11 – July 19, 2026
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-800">
        {(['groups', 'teams'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors capitalize border-b-2 -mb-px ${
              tab === t
                ? 'border-orange-500 text-orange-500'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {t === 'groups' ? '🗂 Groups' : '🌍 All Teams'}
          </button>
        ))}
      </div>

      {/* GROUPS TAB */}
      {tab === 'groups' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map(group => (
            <div key={group.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              {/* Group header */}
              <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800 flex items-center justify-between">
                <h3 className="font-bold text-white text-lg">
                  Group {group.name}
                </h3>
              </div>

              {/* Standings header */}
              <div className="grid grid-cols-12 px-4 py-2 text-xs text-gray-500 border-b border-gray-800/50">
                <div className="col-span-6">Team</div>
                <div className="col-span-1 text-center">P</div>
                <div className="col-span-1 text-center">W</div>
                <div className="col-span-1 text-center">D</div>
                <div className="col-span-1 text-center">L</div>
                <div className="col-span-1 text-center">GD</div>
                <div className="col-span-1 text-center font-bold text-gray-400">Pts</div>
              </div>

              {/* Teams */}
              {group.members.map((member, index) => (
                <div
                  key={member.team.id}
                  className={`grid grid-cols-12 px-4 py-2.5 items-center text-sm
                    ${index < group.members.length - 1 ? 'border-b border-gray-800/30' : ''}
                    hover:bg-gray-800/30 transition-colors`}
                >
                  <div className="col-span-6 flex items-center gap-2">
                    <span className="text-xl">{member.team.flag_emoji}</span>
                    <div>
                      <div className="text-white text-xs font-medium leading-tight">
                        {member.team.name}
                      </div>
                      <div className="text-gray-600 text-xs">
                        #{member.team.fifa_ranking}
                      </div>
                    </div>
                  </div>
                  {/* All zeros — tournament hasn't started */}
                  <div className="col-span-1 text-center text-gray-500 text-xs">0</div>
                  <div className="col-span-1 text-center text-gray-500 text-xs">0</div>
                  <div className="col-span-1 text-center text-gray-500 text-xs">0</div>
                  <div className="col-span-1 text-center text-gray-500 text-xs">0</div>
                  <div className="col-span-1 text-center text-gray-500 text-xs">0</div>
                  <div className="col-span-1 text-center text-white text-xs font-bold">0</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* TEAMS TAB */}
      {tab === 'teams' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <input
              type="text"
              placeholder="Search teams..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 w-48"
            />
            <div className="flex flex-wrap gap-2">
              {['ALL', ...CONFEDERATION_ORDER].map(conf => (
                <button
                  key={conf}
                  onClick={() => setFilter(conf)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filter === conf
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {conf}
                </button>
              ))}
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-6 gap-3 mb-6">
            {CONFEDERATION_ORDER.map(conf => {
              const count = teams.filter(t => t.confederation === conf).length
              return (
                <div key={conf} className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                  <div className="text-xs text-gray-500 mb-1">{conf}</div>
                  <div className="text-xl font-bold text-white">{count}</div>
                  <div className="text-xs text-gray-500">teams</div>
                </div>
              )
            })}
          </div>

          {/* Teams table */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-12">Rank</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Team</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Confederation</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Group</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(team => {
                  const group = groups.find(g =>
                    g.members.some(m => m.team.id === team.id)
                  )
                  return (
                    <tr key={team.id} className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`text-sm font-bold ${
                          team.fifa_ranking <= 10 ? RANKING_COLOUR.top10
                          : team.fifa_ranking <= 20 ? RANKING_COLOUR.top20
                          : RANKING_COLOUR.rest
                        }`}>
                          {team.fifa_ranking}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{team.flag_emoji}</span>
                          <span className="text-sm font-medium text-white">{team.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          CONFEDERATION_COLOURS[team.confederation]
                        }`}>
                          {team.confederation}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-orange-400">
                          {group ? `Group ${group.name}` : '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-500 text-sm">
                No teams match your search
              </div>
            )}
          </div>
          <div className="mt-4 text-xs text-gray-600 text-right">
            Showing {filtered.length} of {teams.length} teams
          </div>
        </>
      )}
    </div>
  )
}