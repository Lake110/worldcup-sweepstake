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

const CONFEDERATION_COLOURS: Record<string, string> = {
  UEFA:     'bg-blue-900/40 text-blue-300 border border-blue-700',
  CONMEBOL: 'bg-green-900/40 text-green-300 border border-green-700',
  CONCACAF: 'bg-red-900/40 text-red-300 border border-red-700',
  CAF:      'bg-yellow-900/40 text-yellow-300 border border-yellow-700',
  AFC:      'bg-purple-900/40 text-purple-300 border border-purple-700',
  OFC:      'bg-gray-700/40 text-gray-300 border border-gray-600',
}

const CONFEDERATION_ORDER = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC']

export default function Tournament() {
  const [teams, setTeams]       = useState<Team[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<string>('ALL')
  const [search, setSearch]     = useState('')

  useEffect(() => {
    api.get('/teams/')
      .then(res => setTeams(res.data))
      .finally(() => setLoading(false))
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
        <div className="text-gray-400 text-sm">Loading teams...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-1">
          ⚽ 2026 World Cup Teams
        </h2>
        <p className="text-gray-400 text-sm">
          {teams.length} teams · Ranked by FIFA ranking
        </p>
      </div>

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
      <div className="grid grid-cols-6 gap-3 mb-8">
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
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-12">
                Rank
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                Team
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                Confederation
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                Code
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((team, index) => (
              <tr
                key={team.id}
                className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors"
              >
                <td className="px-4 py-3">
                  <span className={`text-sm font-bold ${
                    team.fifa_ranking <= 10
                      ? 'text-orange-400'
                      : team.fifa_ranking <= 20
                      ? 'text-yellow-400'
                      : 'text-gray-500'
                  }`}>
                    {team.fifa_ranking}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{team.flag_emoji}</span>
                    <span className="text-sm font-medium text-white">
                      {team.name}
                    </span>
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
                  <span className="text-xs font-mono text-gray-400">
                    {team.code}
                  </span>
                </td>
              </tr>
            ))}
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
    </div>
  )
}