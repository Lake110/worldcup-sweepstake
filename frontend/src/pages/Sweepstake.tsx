import { useEffect, useState } from 'react'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'
import BracketView from '../components/tournament/BracketView'

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
  user_id: string
  sweepstake_id: string
  user_name?: string
  assignments: Assignment[]
}

interface Sweepstake {
  id: string
  name: string
  max_participants: number
  teams_per_person: number
  scoring_method: string
  is_locked: boolean
  is_quick_draw: boolean
  invite_code: string
  pts_round_of_32: number
  pts_round_of_16: number
  pts_quarter_final: number
  pts_semi_final: number
  pts_final: number
  pts_winner: number
  created_at: string
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

const SCORING_METHODS = [
  { value: 'total',   label: 'Total — add up all team scores' },
  { value: 'average', label: 'Average — average across your teams' },
  { value: 'best',    label: 'Best — only your best team counts' },
]

export default function SweepstakePage() {
  const user = useAuthStore(s => s.user)

  const [sweepstakes, setSweepstakes]               = useState<Sweepstake[]>([])
  const [selected, setSelected]                     = useState<Sweepstake | null>(null)
  const [participants, setParticipants]             = useState<Participant[]>([])
  const [loading, setLoading]                       = useState(true)
  const [drawLoading, setDrawLoading]               = useState(false)
  const [view, setView]                             = useState<'list' | 'create' | 'room'>('list')
  const [joinCode, setJoinCode]                     = useState('')
  const [joinError, setJoinError]                   = useState('')
  const [copied, setCopied]                         = useState(false)
  const [groups, setGroups]                         = useState<Group[]>([])
  const [roomTab, setRoomTab]                       = useState<'leaderboard' | 'participants' | 'groups' | 'bracket'>('leaderboard')
  const [leaderboard, setLeaderboard]               = useState<LeaderboardEntry[]>([])
  const [mode, setMode]                             = useState<'account' | 'quickdraw'>('account')
  const [quickDrawView, setQuickDrawView]           = useState<'list' | 'setup'>('list')
  const [quickNames, setQuickNames]                 = useState<string[]>([])
  const [quickNameInput, setQuickNameInput]         = useState('')
  const [quickDrawName, setQuickDrawName]           = useState('')
  const [quickTeamsPerPerson, setQuickTeamsPerPerson] = useState(3)
  const [leaderboardScoring, setLeaderboardScoring] = useState<'total' | 'average' | 'best'>('total')

  const PARTICIPANT_COLOURS = [
    { bg: 'bg-orange-900/40',  border: 'border-orange-600',  text: 'text-orange-300',  highlight: 'bg-orange-900/60 border-orange-500' },
    { bg: 'bg-blue-900/40',    border: 'border-blue-600',    text: 'text-blue-300',    highlight: 'bg-blue-900/60 border-blue-500' },
    { bg: 'bg-green-900/40',   border: 'border-green-600',   text: 'text-green-300',   highlight: 'bg-green-900/60 border-green-500' },
    { bg: 'bg-purple-900/40',  border: 'border-purple-600',  text: 'text-purple-300',  highlight: 'bg-purple-900/60 border-purple-500' },
    { bg: 'bg-pink-900/40',    border: 'border-pink-600',    text: 'text-pink-300',    highlight: 'bg-pink-900/60 border-pink-500' },
    { bg: 'bg-yellow-900/40',  border: 'border-yellow-600',  text: 'text-yellow-300',  highlight: 'bg-yellow-900/60 border-yellow-500' },
    { bg: 'bg-cyan-900/40',    border: 'border-cyan-600',    text: 'text-cyan-300',    highlight: 'bg-cyan-900/60 border-cyan-500' },
    { bg: 'bg-red-900/40',     border: 'border-red-600',     text: 'text-red-300',     highlight: 'bg-red-900/60 border-red-500' },
  ]

  const [form, setForm] = useState({
    name: '',
    max_participants: 8,
    teams_per_person: 2,
    scoring_method: 'total',
    pts_round_of_32: 1,
    pts_round_of_16: 2,
    pts_quarter_final: 4,
    pts_semi_final: 8,
    pts_final: 12,
    pts_winner: 20,
  })

  useEffect(() => {
    Promise.all([
      api.get('/sweepstakes/'),
      api.get('/groups/'),
    ]).then(([sweepRes, groupsRes]) => {
      setSweepstakes(sweepRes.data)
      setGroups(groupsRes.data)
    }).finally(() => setLoading(false))
  }, [])

  function fetchSweepstakes() {
    setLoading(true)
    api.get('/sweepstakes/')
      .then(res => setSweepstakes(res.data))
      .finally(() => setLoading(false))
  }

  function fetchParticipants(sweepstakeId: string) {
    api.get(`/sweepstakes/${sweepstakeId}/participants/`)
      .then(res => setParticipants(res.data))
      .catch(() => setParticipants([]))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await api.post('/sweepstakes/', form)
      setSweepstakes(prev => [...prev, res.data])
      openRoom(res.data)
    } catch {
      alert('Failed to create sweepstake')
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setJoinError('')
    try {
      await api.post(`/sweepstakes/join/${joinCode.toUpperCase()}`)
      setJoinCode('')
      fetchSweepstakes()
    } catch (err: any) {
      setJoinError(err.response?.data?.detail || 'Invalid invite code')
    }
  }

  async function handleDraw() {
    if (!selected) return
    setDrawLoading(true)
    try {
      const res = await api.post(`/sweepstakes/${selected.id}/draw`)
      setParticipants(res.data)
      setSelected(prev => prev ? { ...prev, is_locked: true } : prev)
      setRoomTab('leaderboard')
      fetchLeaderboard(selected.id, 'total')
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Draw failed')
    } finally {
      setDrawLoading(false)
    }
  }

  function openRoom(s: Sweepstake) {
    setSelected(s)
    setParticipants([])
    setLeaderboard([])
    setView('room')
    setLeaderboardScoring('total')
    setRoomTab(s.is_locked ? 'leaderboard' : 'participants')
    fetchParticipants(s.id)
    if (s.is_locked) fetchLeaderboard(s.id, 'total')
  }

  function copyInviteCode() {
    if (!selected) return
    navigator.clipboard.writeText(selected.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function fetchLeaderboard(sweepstakeId: string, scoring: string) {
    api.get(`/sweepstakes/${sweepstakeId}/leaderboard/?scoring_method=${scoring}`)
      .then(res => setLeaderboard(res.data))
      .catch(() => setLeaderboard([]))
  }

  async function handleQuickDraw() {
    if (quickNames.length < 2 || !quickDrawName.trim()) return
    setDrawLoading(true)
    try {
      const createRes = await api.post('/sweepstakes/', {
        name: quickDrawName.trim(),
        is_quick_draw: true,
        quick_draw_names: quickNames,
        teams_per_person: quickTeamsPerPerson,
        max_participants: quickNames.length,
      })
      const drawRes = await api.post(`/sweepstakes/${createRes.data.id}/draw`)
      const fullSweepstake: Sweepstake = {
        ...createRes.data,
        is_locked: true,
      }
      setSweepstakes(prev => [...prev, fullSweepstake])
      setQuickDrawView('list')
      setQuickNames([])
      setQuickNameInput('')
      setQuickDrawName('')
      setQuickTeamsPerPerson(3)
      // Set participants directly from draw response — skip the fetch in openRoom
      setParticipants(drawRes.data)
      setSelected(fullSweepstake)
      setView('room')
      setLeaderboardScoring('total')
      setRoomTab('leaderboard')
      fetchLeaderboard(fullSweepstake.id, 'total')
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Quick draw failed')
    } finally {
      setDrawLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  // ── ROOM VIEW ──────────────────────────────────────────────────────────────
  if (view === 'room' && selected) {
    const myParticipant = participants.find(p => p.user_id === user?.id)

    const participantColourMap: Record<string, number> = {}
    participants.forEach((p, i) => {
      participantColourMap[p.id] = i % PARTICIPANT_COLOURS.length
    })

    const teamOwnerMap: Record<string, Participant> = {}
    participants.forEach(p => {
      p.assignments.forEach(a => {
        teamOwnerMap[a.team.id] = p
      })
    })

    return (
      <div className="relative">
        {/* Back button */}
        <button
          onClick={() => { setView('list'); setRoomTab('participants') }}
          className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-2 transition-colors">
          ← Back to sweepstakes
        </button>

        {/* Room header */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl font-bold text-white">{selected.name}</h2>
                {selected.is_quick_draw && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900/40 border border-orange-700 text-orange-300">
                    ⚡ Quick draw
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-sm">
                {selected.teams_per_person} teams per person
              </p>
            </div>
            {/* Only show invite code for account mode sweepstakes */}
            {!selected.is_quick_draw && (
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Invite code</div>
                <div className="flex items-center gap-2">
                  <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 font-mono text-xl font-bold text-orange-400 tracking-widest">
                    {selected.invite_code}
                  </div>
                  <button onClick={copyInviteCode}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <span className={`text-xs px-3 py-1 rounded-full border font-medium ${
              selected.is_locked
                ? 'bg-green-900/30 text-green-300 border-green-700'
                : 'bg-yellow-900/30 text-yellow-300 border-yellow-700'
            }`}>
              {selected.is_locked ? '🔒 Draw completed' : '⏳ Waiting for draw'}
            </span>
            <span className="text-xs text-gray-500">
              {participants.length} / {selected.max_participants} participants
            </span>
          </div>
        </div>

        {/* Draw button — account mode only */}
        {!selected.is_locked && !selected.is_quick_draw && (
          <div className="bg-gray-900 border border-orange-800/40 rounded-xl p-5 mb-6">
            <h3 className="text-white font-medium mb-2">Ready to run the draw?</h3>
            <p className="text-gray-400 text-sm mb-4">
              Teams are assigned by tier — everyone gets one top 10 team, one top 20 team, and so on.
            </p>
            <div className="mb-4">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                {participants.length} / {selected.max_participants} joined
              </div>
              <div className="flex flex-wrap gap-2">
                {participants.map((p, i) => {
                  const colours = PARTICIPANT_COLOURS[i % PARTICIPANT_COLOURS.length]
                  return (
                    <div key={p.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colours.bg} ${colours.border}`}>
                      <div className={`w-2 h-2 rounded-full ${colours.text.replace('text-', 'bg-')}`} />
                      <span className={`text-xs font-medium ${colours.text}`}>
                        {p.user_id === user?.id ? (user?.full_name ?? 'You') : (p.user_name ?? `Participant ${i + 1}`)}
                      </span>
                      {p.user_id === user?.id && (
                        <span className="text-xs text-gray-500">(you)</span>
                      )}
                    </div>
                  )
                })}
                {Array.from({ length: selected.max_participants - participants.length }).map((_, i) => (
                  <div key={`empty-${i}`} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800/30">
                    <div className="w-2 h-2 rounded-full bg-gray-600" />
                    <span className="text-xs text-gray-600">Waiting...</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={handleDraw} disabled={drawLoading}
              className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors">
              {drawLoading ? '🎲 Running draw...' : '🎲 Run the draw'}
            </button>
          </div>
        )}

        {/* Room tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-800 sticky top-0 bg-[#0a0a0a] z-10 pt-2 -mx-4 px-4">
          {(selected.is_locked
            ? ['leaderboard', 'participants', 'groups', 'bracket'] as const
            : ['participants'] as const
          ).map(t => (
            <button key={t} onClick={() => setRoomTab(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors capitalize border-b-2 -mb-px ${
                roomTab === t
                  ? 'border-orange-500 text-orange-500'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}>
              {t === 'leaderboard' ? '🏆 Leaderboard'
                : t === 'participants' ? '👥 Participants'
                : t === 'groups' ? '🗂 Groups'
                : '🏆 Bracket'}
            </button>
          ))}
        </div>

        {/* LEADERBOARD TAB */}
        {roomTab === 'leaderboard' && (
          <div>
            {/* Scoring toggle */}
            <div className="flex gap-1 p-1 bg-gray-900 border border-gray-800 rounded-xl mb-5 w-fit">
              {(['total', 'average', 'best'] as const).map(method => (
                <button
                  key={method}
                  onClick={() => {
                    setLeaderboardScoring(method)
                    fetchLeaderboard(selected.id, method)
                  }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                    leaderboardScoring === method
                      ? 'bg-orange-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}>
                  {method === 'total' ? '∑ Total' : method === 'average' ? '⌀ Average' : '★ Best'}
                </button>
              ))}
            </div>

            {leaderboard.length === 0 ? (
              <div className="text-center py-12 text-gray-600">
                <div className="text-4xl mb-4">🏆</div>
                <div className="text-sm">No leaderboard data yet</div>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-3 text-xs font-medium text-gray-500 border-b border-gray-800 uppercase tracking-wider">
                  <div className="col-span-1">#</div>
                  <div className="col-span-3">Participant</div>
                  <div className="col-span-6">Teams</div>
                  <div className="col-span-2 text-right">Points</div>
                </div>
                {leaderboard.map((entry) => {
                  const colours = PARTICIPANT_COLOURS[
                    participants.findIndex(p => p.id === entry.participant_id) % PARTICIPANT_COLOURS.length
                  ]
                  const isMe = entry.user_id === user?.id
                  const positionIcon = entry.position === 1 ? '🥇'
                    : entry.position === 2 ? '🥈'
                    : entry.position === 3 ? '🥉'
                    : `${entry.position}`
                  return (
                    <div key={entry.participant_id}
                      className={`grid grid-cols-12 px-4 py-3 items-center border-b border-gray-800/50 last:border-0
                        ${isMe ? `${colours.bg} border-l-2 ${colours.border}` : 'hover:bg-gray-800/30'}`}>
                      <div className="col-span-1 text-lg">{positionIcon}</div>
                      <div className="col-span-3 flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full bg-current ${colours.text}`} />
                        <span className={`text-sm font-medium ${isMe ? colours.text : 'text-white'}`}>
                          {entry.user_name}
                        </span>
                        {isMe && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${colours.bg} ${colours.text} border ${colours.border}`}>
                            You
                          </span>
                        )}
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
            )}
          </div>
        )}

        {/* PARTICIPANTS TAB */}
        {roomTab === 'participants' && (
          <div>
            {participants.length > 0 && selected.is_locked && (
              <div className="flex flex-wrap gap-2 mb-4">
                {participants.map((p, i) => {
                  const colours = PARTICIPANT_COLOURS[i % PARTICIPANT_COLOURS.length]
                  return (
                    <div key={p.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colours.bg} ${colours.border}`}>
                      <div className={`w-2 h-2 rounded-full ${colours.text.replace('text', 'bg')}`} />
                      <span className={`text-xs font-medium ${colours.text}`}>
                        {p.user_id === user?.id ? (user?.full_name ?? 'You') : (p.user_name ?? `Participant ${i + 1}`)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {participants.map((p, i) => {
                const colours = PARTICIPANT_COLOURS[i % PARTICIPANT_COLOURS.length]
                return (
                  <div key={p.id} className={`bg-gray-900 border rounded-xl p-5 ${
                    p.user_id === user?.id ? `${colours.border} border-2` : 'border-gray-800'
                  }`}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold ${colours.bg} ${colours.border} ${colours.text}`}>
                        {p.user_id === user?.id ? (user?.full_name?.[0] ?? 'M') : (i + 1)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">
                          {p.user_id === user?.id ? (user?.full_name ?? 'You') : (p.user_name ?? `Participant ${i + 1}`)}
                        </div>
                        {p.user_id === user?.id && (
                          <div className={`text-xs ${colours.text}`}>You</div>
                        )}
                      </div>
                    </div>
                    {p.assignments.length > 0 ? (
                      <div className="space-y-2">
                        {p.assignments.map(a => (
                          <div key={a.team.id}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 border ${colours.bg} ${colours.border}`}>
                            <span className="text-2xl">{a.team.flag_emoji}</span>
                            <div className="flex-1">
                              <div className={`text-sm font-medium ${colours.text}`}>{a.team.name}</div>
                              <div className="text-xs text-gray-500">#{a.team.fifa_ranking} · {a.team.confederation}</div>
                            </div>
                            <span className={`text-xs font-bold ${colours.text}`}>#{a.team.fifa_ranking}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-600 italic">Waiting for draw...</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* GROUPS TAB */}
        {roomTab === 'groups' && (
          <div>
            {participants.length > 0 && selected.is_locked && (
              <div className="flex flex-wrap gap-2 mb-6">
                {participants.map((p, i) => {
                  const colours = PARTICIPANT_COLOURS[i % PARTICIPANT_COLOURS.length]
                  return (
                    <div key={p.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colours.bg} ${colours.border}`}>
                      <div className={`w-2 h-2 rounded-full ${colours.text.replace('text', 'bg')}`} />
                      <span className={`text-xs font-medium ${colours.text}`}>
                        {p.user_id === user?.id ? (user?.full_name ?? 'You') : (p.user_name ?? `Participant ${i + 1}`)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {groups.map(group => (
                <div key={group.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800">
                    <h3 className="font-bold text-white text-lg">Group {group.name}</h3>
                  </div>
                  <div className="grid grid-cols-12 px-4 py-2 text-xs text-gray-500 border-b border-gray-800/50">
                    <div className="col-span-6">Team</div>
                    <div className="col-span-1 text-center">P</div>
                    <div className="col-span-1 text-center">W</div>
                    <div className="col-span-1 text-center">D</div>
                    <div className="col-span-1 text-center">L</div>
                    <div className="col-span-1 text-center">GD</div>
                    <div className="col-span-1 text-center font-bold text-gray-400">Pts</div>
                  </div>
                  {group.members.map((member, index) => {
                    const owner = teamOwnerMap[member.team.id]
                    const ownerIndex = owner ? participants.findIndex(p => p.id === owner.id) : -1
                    const colours = owner ? PARTICIPANT_COLOURS[ownerIndex % PARTICIPANT_COLOURS.length] : null
                    return (
                      <div key={member.team.id}
                        className={`grid grid-cols-12 px-4 py-2.5 items-center text-sm transition-colors
                          ${index < group.members.length - 1 ? 'border-b border-gray-800/30' : ''}
                          ${colours ? `${colours.bg} border-l-2 ${colours.border}` : 'hover:bg-gray-800/30'}`}>
                        <div className="col-span-6 flex items-center gap-2">
                          <span className="text-xl">{member.team.flag_emoji}</span>
                          <div>
                            <div className={`text-xs font-medium leading-tight ${colours ? colours.text : 'text-white'}`}>
                              {member.team.name}
                            </div>
                            <div className="text-gray-600 text-xs">#{member.team.fifa_ranking}</div>
                          </div>
                        </div>
                        <div className="col-span-1 text-center text-gray-500 text-xs">0</div>
                        <div className="col-span-1 text-center text-gray-500 text-xs">0</div>
                        <div className="col-span-1 text-center text-gray-500 text-xs">0</div>
                        <div className="col-span-1 text-center text-gray-500 text-xs">0</div>
                        <div className="col-span-1 text-center text-gray-500 text-xs">0</div>
                        <div className={`col-span-1 text-center text-xs font-bold ${colours ? colours.text : 'text-white'}`}>0</div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BRACKET TAB */}
        {roomTab === 'bracket' && (
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-bold text-white mb-1">🏆 Knockout Bracket</h3>
              <p className="text-gray-400 text-sm mb-3">Your teams are highlighted in your colour.</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {participants.map((p, i) => {
                  const colours = PARTICIPANT_COLOURS[i % PARTICIPANT_COLOURS.length]
                  return (
                    <div key={p.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colours.bg} ${colours.border}`}>
                      <div className={`w-2 h-2 rounded-full ${colours.text.replace('text', 'bg')}`} />
                      <span className={`text-xs font-medium ${colours.text}`}>
                        {p.user_id === user?.id ? (user?.full_name ?? 'You') : (p.user_name ?? `Participant ${i + 1}`)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
           <BracketView />
          </div>
        )}
      </div>
    )
  }

  // ── CREATE VIEW ────────────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <div className="max-w-lg">
        <button onClick={() => setView('list')}
          className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-2 transition-colors">
          ← Back
        </button>
        <h2 className="text-2xl font-bold text-white mb-6">Create sweepstake</h2>
        <form onSubmit={handleCreate} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
            <input type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Office Sweepstake" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Max participants</label>
              <input type="number" min={2} max={48} value={form.max_participants}
                onChange={e => setForm(f => ({ ...f, max_participants: +e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Teams per person</label>
              <input type="number" min={1} max={10} value={form.teams_per_person}
                onChange={e => setForm(f => ({ ...f, teams_per_person: +e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Bonus points per round</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'pts_round_of_32',   label: 'Round of 32' },
                { key: 'pts_round_of_16',   label: 'Round of 16' },
                { key: 'pts_quarter_final', label: 'Quarter final' },
                { key: 'pts_semi_final',    label: 'Semi final' },
                { key: 'pts_final',         label: 'Final' },
                { key: 'pts_winner',        label: 'Winner' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1">{label}</label>
                  <input type="number" min={0}
                    value={form[key as keyof typeof form] as number}
                    onChange={e => setForm(f => ({ ...f, [key]: +e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              ))}
            </div>
          </div>
          <button type="submit"
            className="w-full bg-orange-500 text-white py-2.5 rounded-lg font-medium hover:bg-orange-600 transition-colors">
            Create sweepstake
          </button>
        </form>
      </div>
    )
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  const accountSweepstakes = sweepstakes.filter(s => !s.is_quick_draw)
  const quickDrawSweepstakes = sweepstakes.filter(s => s.is_quick_draw)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">🎯 Sweepstakes</h2>
          <p className="text-gray-400 text-sm">Create a room, invite friends, run the draw</p>
        </div>
        {mode === 'account' && (
          <button onClick={() => setView('create')}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
            + Create
          </button>
        )}
        {mode === 'quickdraw' && quickDrawView === 'list' && (
          <button onClick={() => setQuickDrawView('setup')}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
            + New Quick Draw
          </button>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-gray-900 border border-gray-800 rounded-xl mb-6 w-fit">
        <button
          onClick={() => { setMode('account'); setQuickDrawView('list') }}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'account' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
          }`}>
          👤 Account mode
        </button>
        <button
          onClick={() => { setMode('quickdraw'); setQuickDrawView('list') }}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'quickdraw' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
          }`}>
          ⚡ Quick draw
        </button>
      </div>

      {/* ── ACCOUNT MODE ── */}
      {mode === 'account' && (
        <div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Join with invite code</h3>
            <form onSubmit={handleJoin} className="flex gap-3">
              <input type="text" value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter code e.g. XK7P2Q" maxLength={6}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white font-mono uppercase tracking-widest placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              <button type="submit"
                className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors">
                Join
              </button>
            </form>
            {joinError && <p className="text-red-400 text-xs mt-2">{joinError}</p>}
          </div>
          {accountSweepstakes.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <div className="text-4xl mb-4">🎯</div>
              <div className="text-sm">No sweepstakes yet — create one or join with a code</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accountSweepstakes.map(s => (
                <div key={s.id} onClick={() => openRoom(s)}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-gray-600 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-white">{s.name}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full border ${
                      s.is_locked ? 'bg-green-900/30 text-green-300 border-green-700' : 'bg-yellow-900/30 text-yellow-300 border-yellow-700'
                    }`}>
                      {s.is_locked ? '🔒 Drawn' : '⏳ Open'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>{s.teams_per_person} teams per person · {s.max_participants} max participants</div>
                    <div className="font-mono text-orange-400/70 tracking-wider">Code: {s.invite_code}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── QUICK DRAW MODE ── */}
      {mode === 'quickdraw' && (
        <div>
          {/* Quick draw list */}
          {quickDrawView === 'list' && (
            <div>
              {quickDrawSweepstakes.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                  <div className="text-4xl mb-4">⚡</div>
                  <div className="text-sm">No quick draws yet — hit + New Quick Draw to start</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {quickDrawSweepstakes.map(s => (
                    <div key={s.id} onClick={() => openRoom(s)}
                      className="bg-gray-900 border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-gray-600 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold text-white">{s.name}</h3>
                        <span className="text-xs px-2 py-1 rounded-full border bg-green-900/30 text-green-300 border-green-700">
                          🔒 Drawn
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>{s.teams_per_person} teams per person · {s.max_participants} participants</div>
                        <div className="text-orange-400/70">⚡ Quick draw</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick draw setup */}
          {quickDrawView === 'setup' && (
            <div className="max-w-3xl w-full">
              <button onClick={() => setQuickDrawView('list')}
                className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-2 transition-colors">
                ← Back
              </button>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-white font-semibold text-lg mb-1">New quick draw</h3>
                <p className="text-gray-500 text-sm mb-6">
                  Name your draw, choose teams per person, add everyone taking part.
                </p>

                <div className="flex flex-col md:flex-row gap-6">

                  {/* Left col — all form fields */}
                  <div className="flex-1 min-w-0">

                    {/* Draw name */}
                    <div className="mb-5">
                      <label className="block text-sm font-medium text-gray-300 mb-1">Draw name</label>
                      <input type="text" value={quickDrawName}
                        onChange={e => setQuickDrawName(e.target.value)}
                        placeholder="e.g. Office World Cup 2026"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    </div>

                    {/* Teams per person */}
                    <div className="mb-5">
                      <label className="block text-sm font-medium text-gray-300 mb-1">Teams per person</label>
                      <input type="number" min={1} max={20} value={quickTeamsPerPerson}
                        onChange={e => setQuickTeamsPerPerson(+e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                      {quickNames.length >= 2 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {quickNames.length} people × {quickTeamsPerPerson} teams = {quickNames.length * quickTeamsPerPerson} teams needed
                          {quickNames.length * quickTeamsPerPerson > 48 && (
                            <span className="text-red-400 ml-1">— exceeds 48 available teams</span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Name input */}
                    <div className="mb-5">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Add participants
                      </label>
                      <div className="flex gap-2">
                        <input type="text" value={quickNameInput}
                          onChange={e => setQuickNameInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && quickNameInput.trim()) {
                              e.preventDefault()
                              setQuickNames(prev => [...prev, quickNameInput.trim()])
                              setQuickNameInput('')
                            }
                          }}
                          placeholder="Enter a name..."
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                        <button
                          onClick={() => {
                            if (quickNameInput.trim()) {
                              setQuickNames(prev => [...prev, quickNameInput.trim()])
                              setQuickNameInput('')
                            }
                          }}
                          className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors">
                          + Add
                        </button>
                      </div>
                    </div>

                    {/* Run draw button */}
                    <button
                      onClick={handleQuickDraw}
                      disabled={
                        quickNames.length < 2 ||
                        !quickDrawName.trim() ||
                        quickNames.length * quickTeamsPerPerson > 48 ||
                        drawLoading
                      }
                      className="w-full py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      {drawLoading ? '🎲 Running draw...' : `🎲 Run draw for ${quickNames.length || '—'} people`}
                    </button>
                    {quickNames.length < 2 && (
                      <p className="text-xs text-gray-600 text-center mt-2">Add at least 2 names to run the draw</p>
                    )}

                  </div>

                  {/* Right col — names list */}
                  <div className="w-56 flex-shrink-0">
                    <div className="text-sm font-medium text-gray-300 mb-2">
                      Participants
                      {quickNames.length > 0 && (
                        <span className="text-gray-500 font-normal ml-1">({quickNames.length})</span>
                      )}
                    </div>
                    {quickNames.length === 0 ? (
                      <div className="text-xs text-gray-600 italic pt-2">No names added yet</div>
                    ) : (
                      <div className="space-y-1.5">
                        {quickNames.map((name, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs text-gray-500 w-4 flex-shrink-0 text-right">{i + 1}</span>
                              <span className="text-sm text-white truncate">{name}</span>
                            </div>
                            <button
                              onClick={() => setQuickNames(prev => prev.filter((_, j) => j !== i))}
                              className="text-gray-600 hover:text-red-400 transition-colors text-sm ml-2 flex-shrink-0">
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
