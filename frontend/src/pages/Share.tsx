import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../services/api'

interface Team {
  id: string
  name: string
  code: string
  flag_emoji: string
  confederation: string
  fifa_ranking: number
}

interface Assignment {
  team: Team
}

interface Participant {
  id: string
  user_name: string
  assignments: Assignment[]
}

interface ShareData {
  id: string
  name: string
  teams_per_person: number
  invite_code: string
  participants: Participant[]
}

interface GroupMember {
  team: Team
}

interface Group {
  id: string
  name: string
  members: GroupMember[]
}

interface TeamScore {
  team: Team
  match_points: number
  bonus_points: number
  total: number
}

interface LeaderboardEntry {
  participant_id: string
  user_id: string
  user_name: string
  teams: TeamScore[]
  total_points: number
  position: number
}

const PARTICIPANT_COLOURS = [
  { bg: 'bg-orange-900/40',  border: 'border-orange-600',  text: 'text-orange-300'  },
  { bg: 'bg-blue-900/40',    border: 'border-blue-600',    text: 'text-blue-300'    },
  { bg: 'bg-green-900/40',   border: 'border-green-600',   text: 'text-green-300'   },
  { bg: 'bg-purple-900/40',  border: 'border-purple-600',  text: 'text-purple-300'  },
  { bg: 'bg-pink-900/40',    border: 'border-pink-600',    text: 'text-pink-300'    },
  { bg: 'bg-yellow-900/40',  border: 'border-yellow-600',  text: 'text-yellow-300'  },
  { bg: 'bg-cyan-900/40',    border: 'border-cyan-600',    text: 'text-cyan-300'    },
  { bg: 'bg-red-900/40',     border: 'border-red-600',     text: 'text-red-300'     },
]

export default function Share() {
  const { invite_code } = useParams<{ invite_code: string }>()

  const [draw, setDraw]           = useState<ShareData | null>(null)
  const [groups, setGroups]       = useState<Group[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [tab, setTab]             = useState<'participants' | 'groups' | 'leaderboard'>('participants')

  useEffect(() => {
    if (!invite_code) return

    Promise.all([
      api.get(`/sweepstakes/share/${invite_code}`),
      api.get('/groups/'),
    ]).then(([shareRes, groupsRes]) => {
      setDraw(shareRes.data)
      setGroups(groupsRes.data)
      // Fetch leaderboard using the sweepstake id from share data
      return api.get(`/sweepstakes/${shareRes.data.id}/leaderboard/?scoring_method=total`)
    }).then(lbRes => {
      setLeaderboard(lbRes.data)
    }).catch(() => {
      setError('Draw not found — the link may be invalid or expired.')
    }).finally(() => setLoading(false))
  }, [invite_code])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading draw results...</div>
      </div>
    )
  }

  if (error || !draw) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">⚡</div>
          <div className="text-white font-medium mb-2">Draw not found</div>
          <div className="text-gray-500 text-sm">{error}</div>
        </div>
      </div>
    )
  }

  // Build a map of team id -> participant index for group colouring
  const teamOwnerMap: Record<string, number> = {}
  draw.participants.forEach((p, i) => {
    p.assignments.forEach(a => {
      teamOwnerMap[a.team.id] = i
    })
  })

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-orange-500 font-bold text-lg">⚽ WC 2026</span>
            <span className="text-gray-600 text-sm">·</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900/40 border border-orange-700 text-orange-300">
              ⚡ Quick draw
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{draw.name}</h1>
          <p className="text-gray-400 text-sm mt-1">
            {draw.participants.length} participants · {draw.teams_per_person} teams each
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">

        {/* Colour legend */}
        <div className="flex flex-wrap gap-2 mb-6">
          {draw.participants.map((p, i) => {
            const colours = PARTICIPANT_COLOURS[i % PARTICIPANT_COLOURS.length]
            return (
              <div key={p.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colours.bg} ${colours.border}`}>
                <div className={`w-2 h-2 rounded-full bg-current ${colours.text}`} />
                <span className={`text-xs font-medium ${colours.text}`}>{p.user_name}</span>
              </div>
            )
          })}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-800">
          {(['participants', 'groups', 'leaderboard'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors capitalize border-b-2 -mb-px ${
                tab === t
                  ? 'border-orange-500 text-orange-500'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {t === 'participants' ? '👥 Participants'
                : t === 'groups' ? '🗂 Groups'
                : '🏆 Leaderboard'}
            </button>
          ))}
        </div>

        {/* ── PARTICIPANTS TAB ── */}
        {tab === 'participants' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {draw.participants.map((p, i) => {
              const colours = PARTICIPANT_COLOURS[i % PARTICIPANT_COLOURS.length]
              return (
                <div key={p.id} className={`bg-gray-900 border rounded-xl p-5 ${colours.border}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold ${colours.bg} ${colours.border} ${colours.text}`}>
                      {p.user_name[0]?.toUpperCase() ?? (i + 1)}
                    </div>
                    <div className={`text-sm font-medium ${colours.text}`}>{p.user_name}</div>
                  </div>
                  <div className="space-y-2">
                    {p.assignments.map(a => (
                      <div key={a.team.id}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 border ${colours.bg} ${colours.border}`}>
                        <span className="text-2xl">{a.team.flag_emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${colours.text} truncate`}>{a.team.name}</div>
                          <div className="text-xs text-gray-500">#{a.team.fifa_ranking} · {a.team.confederation}</div>
                        </div>
                        <span className={`text-xs font-bold ${colours.text} flex-shrink-0`}>#{a.team.fifa_ranking}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── GROUPS TAB ── */}
        {tab === 'groups' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {groups.map(group => (
              <div key={group.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800">
                  <h3 className="font-bold text-white text-lg">Group {group.name}</h3>
                </div>
                <div className="grid grid-cols-12 px-4 py-2 text-xs text-gray-500 border-b border-gray-800/50">
                  <div className="col-span-7">Team</div>
                  <div className="col-span-1 text-center">P</div>
                  <div className="col-span-1 text-center">W</div>
                  <div className="col-span-1 text-center hidden sm:block">D</div>
                  <div className="col-span-1 text-center hidden sm:block">L</div>
                  <div className="col-span-1 text-center hidden sm:block">GD</div>
                  <div className="col-span-1 text-center font-bold text-gray-400">Pts</div>
                </div>
                {group.members.map((member, index) => {
                  const ownerIdx = teamOwnerMap[member.team.id]
                  const colours = ownerIdx !== undefined
                    ? PARTICIPANT_COLOURS[ownerIdx % PARTICIPANT_COLOURS.length]
                    : null
                  return (
                    <div key={member.team.id}
                      className={`grid grid-cols-12 px-4 py-2.5 items-center text-sm transition-colors
                        ${index < group.members.length - 1 ? 'border-b border-gray-800/30' : ''}
                        ${colours ? `${colours.bg} border-l-2 ${colours.border}` : ''}`}>
                      <div className="col-span-7 flex items-center gap-2 min-w-0">
                        <span className="text-xl flex-shrink-0">{member.team.flag_emoji}</span>
                        <div className="min-w-0">
                          <div className={`text-xs font-medium leading-tight truncate ${colours ? colours.text : 'text-white'}`}>
                            {member.team.name}
                          </div>
                          <div className="text-gray-600 text-xs">#{member.team.fifa_ranking}</div>
                        </div>
                      </div>
                      <div className="col-span-1 text-center text-gray-500 text-xs">0</div>
                      <div className="col-span-1 text-center text-gray-500 text-xs">0</div>
                      <div className="col-span-1 text-center text-gray-500 text-xs hidden sm:block">0</div>
                      <div className="col-span-1 text-center text-gray-500 text-xs hidden sm:block">0</div>
                      <div className="col-span-1 text-center text-gray-500 text-xs hidden sm:block">0</div>
                      <div className={`col-span-1 text-center text-xs font-bold ${colours ? colours.text : 'text-white'}`}>0</div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* ── LEADERBOARD TAB ── */}
        {tab === 'leaderboard' && (
          <div>
            {leaderboard.length === 0 ? (
              <div className="text-center py-12 text-gray-600">
                <div className="text-4xl mb-4">🏆</div>
                <div className="text-sm">No points yet — leaderboard updates as match results come in</div>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {/* Mobile — stacked cards */}
                <div className="sm:hidden divide-y divide-gray-800">
                  {leaderboard.map((entry) => {
                    const colours = PARTICIPANT_COLOURS[
                      draw.participants.findIndex(p => p.id === entry.participant_id) % PARTICIPANT_COLOURS.length
                    ]
                    const positionIcon = entry.position === 1 ? '🥇'
                      : entry.position === 2 ? '🥈'
                      : entry.position === 3 ? '🥉'
                      : `${entry.position}`
                    return (
                      <div key={entry.participant_id} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{positionIcon}</span>
                            <div className={`w-2 h-2 rounded-full bg-current ${colours.text}`} />
                            <span className={`text-sm font-medium ${colours.text}`}>{entry.user_name}</span>
                          </div>
                          <div>
                            <span className={`text-lg font-bold ${entry.position === 1 ? 'text-yellow-400' : 'text-white'}`}>
                              {entry.total_points}
                            </span>
                            <span className="text-xs text-gray-500 ml-1">pts</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {entry.teams.map(ts => (
                            <div key={ts.team.id}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs ${colours.bg} ${colours.border}`}>
                              <span>{ts.team.flag_emoji}</span>
                              <span className={`font-medium ${colours.text}`}>{ts.team.code}</span>
                              <span className={`font-bold ${colours.text}`}>· {ts.total}pts</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop — grid */}
                <div className="hidden sm:block">
                  <div className="grid grid-cols-12 px-4 py-3 text-xs font-medium text-gray-500 border-b border-gray-800 uppercase tracking-wider">
                    <div className="col-span-1">#</div>
                    <div className="col-span-3">Participant</div>
                    <div className="col-span-6">Teams</div>
                    <div className="col-span-2 text-right">Points</div>
                  </div>
                  {leaderboard.map((entry) => {
                    const colours = PARTICIPANT_COLOURS[
                      draw.participants.findIndex(p => p.id === entry.participant_id) % PARTICIPANT_COLOURS.length
                    ]
                    const positionIcon = entry.position === 1 ? '🥇'
                      : entry.position === 2 ? '🥈'
                      : entry.position === 3 ? '🥉'
                      : `${entry.position}`
                    return (
                      <div key={entry.participant_id}
                        className="grid grid-cols-12 px-4 py-3 items-center border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30">
                        <div className="col-span-1 text-lg">{positionIcon}</div>
                        <div className="col-span-3 flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full bg-current ${colours.text}`} />
                          <span className={`text-sm font-medium ${colours.text}`}>{entry.user_name}</span>
                        </div>
                        <div className="col-span-6 flex items-center gap-2 flex-wrap">
                          {entry.teams.map(ts => (
                            <div key={ts.team.id}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs ${colours.bg} ${colours.border}`}>
                              <span className="text-base">{ts.team.flag_emoji}</span>
                              <span className={`font-medium ${colours.text}`}>{ts.team.name}</span>
                              <span className={`font-bold ${colours.text}`}>· {ts.total}pts</span>
                            </div>
                          ))}
                        </div>
                        <div className="col-span-2 text-right">
                          <span className={`text-lg font-bold ${entry.position === 1 ? 'text-yellow-400' : 'text-white'}`}>
                            {entry.total_points}
                          </span>
                          <span className="text-xs text-gray-500 ml-1">pts</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-800 text-center text-xs text-gray-600">
          ⚽ World Cup 2026 Sweepstake · Read-only view
        </div>
      </div>
    </div>
  )
}