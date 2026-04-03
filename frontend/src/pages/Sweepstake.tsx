import { useEffect, useState } from 'react'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'

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
  assignments: Assignment[]
}

interface Sweepstake {
  id: string
  name: string
  max_participants: number
  teams_per_person: number
  scoring_method: string
  is_locked: boolean
  invite_code: string
  pts_round_of_32: number
  pts_round_of_16: number
  pts_quarter_final: number
  pts_semi_final: number
  pts_final: number
  pts_winner: number
  created_at: string
}

const SCORING_METHODS = [
  { value: 'total',   label: 'Total — add up all team scores' },
  { value: 'average', label: 'Average — average across your teams' },
  { value: 'best',    label: 'Best — only your best team counts' },
]

export default function SweepstakePage() {
  const user = useAuthStore(s => s.user)

  const [sweepstakes, setSweepstakes]       = useState<Sweepstake[]>([])
  const [selected, setSelected]             = useState<Sweepstake | null>(null)
  const [participants, setParticipants]     = useState<Participant[]>([])
  const [loading, setLoading]               = useState(true)
  const [drawLoading, setDrawLoading]       = useState(false)
  const [view, setView]                     = useState<'list' | 'create' | 'room'>('list')
  const [joinCode, setJoinCode]             = useState('')
  const [joinError, setJoinError]           = useState('')
  const [copied, setCopied]                 = useState(false)

  // Create form state
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
    fetchSweepstakes()
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
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Draw failed')
    } finally {
      setDrawLoading(false)
    }
  }

  function openRoom(s: Sweepstake) {
    setSelected(s)
    setView('room')
    fetchParticipants(s.id)
  }

  function copyInviteCode() {
    if (!selected) return
    navigator.clipboard.writeText(selected.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

    return (
      <div>
        {/* Back button */}
        <button onClick={() => setView('list')}
          className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-2 transition-colors">
          ← Back to sweepstakes
        </button>

        {/* Room header */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{selected.name}</h2>
              <p className="text-gray-400 text-sm">
                {selected.teams_per_person} teams per person · {selected.scoring_method} scoring
              </p>
            </div>

            {/* Invite code */}
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">
                Invite code
              </div>
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
          </div>

          {/* Status */}
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

        {/* Points config */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">
            🏆 Bonus points per round
          </h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: 'R32',    value: selected.pts_round_of_32 },
              { label: 'R16',    value: selected.pts_round_of_16 },
              { label: 'QF',     value: selected.pts_quarter_final },
              { label: 'SF',     value: selected.pts_semi_final },
              { label: 'Final',  value: selected.pts_final },
              { label: 'Winner', value: selected.pts_winner },
            ].map(p => (
              <div key={p.label} className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">{p.label}</div>
                <div className="text-lg font-bold text-orange-400">+{p.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Draw button — only show if not locked and user is owner */}
        {!selected.is_locked && (
          <div className="bg-gray-900 border border-orange-800/40 rounded-xl p-5 mb-6">
            <h3 className="text-white font-medium mb-2">Ready to run the draw?</h3>
            <p className="text-gray-400 text-sm mb-4">
              Teams will be assigned randomly, weighted by FIFA ranking. Better teams are more likely to be picked first.
            </p>
            <button
              onClick={handleDraw}
              disabled={drawLoading}
              className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {drawLoading ? '🎲 Running draw...' : '🎲 Run the draw'}
            </button>
          </div>
        )}

        {/* Participants and their teams */}
        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
            Participants
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {participants.map(p => (
              <div key={p.id}
                className={`bg-gray-900 border rounded-xl p-5 ${
                  p.user_id === user?.id
                    ? 'border-orange-700'
                    : 'border-gray-800'
                }`}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-orange-900/40 border border-orange-700 flex items-center justify-center text-xs font-bold text-orange-400">
                    {p.user_id === user?.id ? user?.full_name?.[0] ?? 'M' : '?'}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">
                      {p.user_id === user?.id ? (user?.full_name ?? 'You') : 'Participant'}
                    </div>
                    {p.user_id === user?.id && (
                      <div className="text-xs text-orange-400">You</div>
                    )}
                  </div>
                </div>

                {p.assignments.length > 0 ? (
                  <div className="space-y-2">
                    {p.assignments.map(a => (
                      <div key={a.team.id}
                        className="flex items-center gap-3 bg-gray-800/50 rounded-lg px-3 py-2">
                        <span className="text-2xl">{a.team.flag_emoji}</span>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">
                            {a.team.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            #{a.team.fifa_ranking} · {a.team.confederation}
                          </div>
                        </div>
                        <span className={`text-xs font-bold ${
                          a.team.fifa_ranking <= 10
                            ? 'text-orange-400'
                            : a.team.fifa_ranking <= 20
                            ? 'text-yellow-400'
                            : 'text-gray-500'
                        }`}>
                          #{a.team.fifa_ranking}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-600 italic">
                    Waiting for draw...
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
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
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Max participants
              </label>
              <input type="number" min={2} max={48}
                value={form.max_participants}
                onChange={e => setForm(f => ({ ...f, max_participants: +e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Teams per person
              </label>
              <input type="number" min={1} max={10}
                value={form.teams_per_person}
                onChange={e => setForm(f => ({ ...f, teams_per_person: +e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Scoring method
            </label>
            <select value={form.scoring_method}
              onChange={e => setForm(f => ({ ...f, scoring_method: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
              {SCORING_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Bonus points per round
            </label>
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
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">🎯 Sweepstakes</h2>
          <p className="text-gray-400 text-sm">Create a room, invite friends, run the draw</p>
        </div>
        <button onClick={() => setView('create')}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
          + Create
        </button>
      </div>

      {/* Join by code */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Join with invite code</h3>
        <form onSubmit={handleJoin} className="flex gap-3">
          <input
            type="text"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Enter code e.g. XK7P2Q"
            maxLength={6}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white font-mono uppercase tracking-widest placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button type="submit"
            className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors">
            Join
          </button>
        </form>
        {joinError && (
          <p className="text-red-400 text-xs mt-2">{joinError}</p>
        )}
      </div>

      {/* Sweepstake list */}
      {sweepstakes.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <div className="text-4xl mb-4">🎯</div>
          <div className="text-sm">No sweepstakes yet — create one or join with a code</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sweepstakes.map(s => (
            <div key={s.id}
              onClick={() => openRoom(s)}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-gray-600 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-white">{s.name}</h3>
                <span className={`text-xs px-2 py-1 rounded-full border ${
                  s.is_locked
                    ? 'bg-green-900/30 text-green-300 border-green-700'
                    : 'bg-yellow-900/30 text-yellow-300 border-yellow-700'
                }`}>
                  {s.is_locked ? '🔒 Drawn' : '⏳ Open'}
                </span>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <div>{s.teams_per_person} teams per person · {s.max_participants} max participants</div>
                <div className="font-mono text-orange-400/70 tracking-wider">
                  Code: {s.invite_code}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}