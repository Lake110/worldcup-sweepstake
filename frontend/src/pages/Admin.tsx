import { useEffect, useState } from 'react'
import api from '../services/api'

interface Team {
  id: string
  name: string
  flag_emoji: string
  fifa_ranking: number
}

interface Group {
  id: string
  name: string
  members: { team: Team }[]
}

interface Match {
  id: string
  group_id: string | null
  home_team_id: string | null
  away_team_id: string | null
  home_team: Team | null
  away_team: Team | null
  home_score: number | null
  away_score: number | null
  stage: string
  match_date: string | null
  is_completed: boolean
}

const KNOCKOUT_STAGES = [
  { key: 'round_of_32',   label: 'R32',   emoji: '🔵' },
  { key: 'round_of_16',   label: 'R16',   emoji: '🟡' },
  { key: 'quarter_final', label: 'QF',    emoji: '🟠' },
  { key: 'semi_final',    label: 'SF',    emoji: '🔴' },
  { key: 'final',         label: 'Final', emoji: '🏆' },
]

export default function Admin() {
  const [groups, setGroups]               = useState<Group[]>([])
  const [matches, setMatches]             = useState<Match[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [adminTab, setAdminTab]           = useState<'groups' | 'knockout'>('groups')
  const [knockoutStage, setKnockoutStage] = useState('round_of_32')
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState<string | null>(null)
  const [saved, setSaved]                 = useState<string | null>(null)
  const [scores, setScores]               = useState<Record<string, { home: string; away: string }>>({})
  const [teams, setTeams]                 = useState<Team[]>([])
  const [editingSlot, setEditingSlot]     = useState<{ matchId: string; slot: 'home' | 'away' } | null>(null)
  const [populating, setPopulating]       = useState(false)
  const [populateResult, setPopulateResult] = useState<{ filled: string[]; needs_manual: string[]; message: string } | null>(null)

  // Load all teams for manual override dropdown
  useEffect(() => {
    api.get('/teams/').then(res => setTeams(res.data))
  }, [])

  // Load groups once
  useEffect(() => {
    api.get('/groups/').then(res => {
      const sorted = [...res.data].sort((a: Group, b: Group) => a.name.localeCompare(b.name))
      setGroups(sorted)
      setSelectedGroup(sorted[0] ?? null)
    }).finally(() => setLoading(false))
  }, [])

  // Load group matches when selected group changes
  useEffect(() => {
    if (adminTab !== 'groups' || !selectedGroup) return
    setMatches([])
    api.get(`/matches/?group_id=${selectedGroup.id}`).then(res => {
      const m: Match[] = res.data
      setMatches(m)
      prefillScores(m)
    })
  }, [selectedGroup, adminTab])

  // Load knockout matches when stage changes
  useEffect(() => {
    if (adminTab !== 'knockout') return
    setMatches([])
    api.get(`/matches/?stage=${knockoutStage}`).then(res => {
      const m: Match[] = res.data
      setMatches(m)
      prefillScores(m)
    })
  }, [knockoutStage, adminTab])

  function prefillScores(matchList: Match[]) {
    const initial: Record<string, { home: string; away: string }> = {}
    matchList.forEach(match => {
      initial[match.id] = {
        home: match.home_score != null ? String(match.home_score) : '',
        away: match.away_score != null ? String(match.away_score) : '',
      }
    })
    setScores(initial)
  }

  function refreshMatches() {
    if (adminTab === 'groups' && selectedGroup) {
      api.get(`/matches/?group_id=${selectedGroup.id}`).then(res => setMatches(res.data))
    } else {
      api.get(`/matches/?stage=${knockoutStage}`).then(res => setMatches(res.data))
    }
  }

  async function populateR32() {
    setPopulating(true)
    setPopulateResult(null)
    try {
      const res = await api.post('/matches/knockout/populate-r32')
      setPopulateResult(res.data)
      // Refresh current view
      api.get(`/matches/?stage=${knockoutStage}`).then(res => {
        setMatches(res.data)
        prefillScores(res.data)
      })
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to populate R32')
    } finally {
      setPopulating(false)
    }
  }

  async function assignTeam(matchId: string, slot: 'home' | 'away', teamId: string) {
    try {
      await api.patch(`/matches/${matchId}/teams`, {
        [`${slot}_team_id`]: teamId || null
      })
      setEditingSlot(null)
      api.get(`/matches/?stage=${knockoutStage}`).then(res => {
        setMatches(res.data)
        prefillScores(res.data)
      })
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to assign team')
    }
  }

  async function saveResult(match: Match) {
    const s = scores[match.id]
    if (s.home === '' || s.away === '') return
    const home_score = parseInt(s.home)
    const away_score = parseInt(s.away)
    if (isNaN(home_score) || isNaN(away_score)) return
    setSaving(match.id)
    try {
      await api.patch(`/matches/${match.id}/result`, { home_score, away_score, is_completed: true })
      setSaved(match.id)
      setTimeout(() => setSaved(null), 2000)
      refreshMatches()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save result')
    } finally {
      setSaving(null)
    }
  }

  async function clearResult(match: Match) {
    setSaving(match.id)
    try {
      await api.patch(`/matches/${match.id}/result`, { home_score: null, away_score: null, is_completed: false })
      setScores(prev => ({ ...prev, [match.id]: { home: '', away: '' } }))
      refreshMatches()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to clear result')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
    </div>
  )

  const completedCount = matches.filter(m => m.is_completed).length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">🔧 Match Results</h2>
        <p className="text-gray-400 text-sm">Admin only — enter scores to update standings and leaderboards</p>
      </div>

      {/* Top tabs: Groups vs Knockout */}
      <div className="flex gap-2 p-1 bg-gray-900 border border-gray-800 rounded-xl w-fit">
        <button
          onClick={() => setAdminTab('groups')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            adminTab === 'groups' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
          }`}>
          🗂 Group Stage
        </button>
        <button
          onClick={() => setAdminTab('knockout')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            adminTab === 'knockout' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
          }`}>
          🏆 Knockout
        </button>
      </div>

      {/* ── GROUP STAGE ── */}
      {adminTab === 'groups' && (
        <>
          <div className="flex gap-1 flex-wrap">
            {groups.map(group => (
              <button
                key={group.id}
                onClick={() => setSelectedGroup(group)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  selectedGroup?.id === group.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}>
                {group.name}
              </button>
            ))}
          </div>

          {selectedGroup && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white">Group {selectedGroup.name}</h3>
                  <p className="text-sm text-gray-400">{completedCount} / {matches.length} matches completed</p>
                </div>
                <div className="w-full sm:w-48">
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full transition-all"
                      style={{ width: matches.length > 0 ? `${(completedCount / matches.length) * 100}%` : '0%' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── KNOCKOUT ── */}
      {adminTab === 'knockout' && (
        <>
          <div className="flex gap-1 flex-wrap">
            {KNOCKOUT_STAGES.map(s => (
              <button
                key={s.key}
                onClick={() => setKnockoutStage(s.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  knockoutStage === s.key
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}>
                {s.emoji} {s.label}
              </button>
            ))}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {KNOCKOUT_STAGES.find(s => s.key === knockoutStage)?.emoji}{' '}
                  {KNOCKOUT_STAGES.find(s => s.key === knockoutStage)?.label}
                </h3>
                <p className="text-sm text-gray-400">{completedCount} / {matches.length} matches completed</p>
              </div>
              <div className="flex items-center gap-3">
                {knockoutStage === 'round_of_32' && (
                  <button onClick={populateR32} disabled={populating}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors">
                    {populating ? '⏳ Populating...' : '⚡ Auto-populate from standings'}
                  </button>
                )}
                <div className="w-48">
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full transition-all"
                      style={{ width: matches.length > 0 ? `${(completedCount / matches.length) * 100}%` : '0%' }} />
                  </div>
                </div>
              </div>
            </div>
            {populateResult && (
              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 text-xs space-y-1">
                <div className="text-blue-300 font-medium">{populateResult.message}</div>
                {populateResult.needs_manual.length > 0 && (
                  <div className="text-gray-400">Manual slots: {populateResult.needs_manual.length} (use the ✏️ button on each TBD slot below)</div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── MATCH LIST (shared) ── */}
      {matches.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <div className="text-4xl mb-4">⚽</div>
          <div className="text-sm">
            {adminTab === 'knockout'
              ? 'No matches yet — teams advance here after group stage results are entered'
              : 'No matches found for this group'}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map(match => {
            const s       = scores[match.id] ?? { home: '', away: '' }
            const isSaving = saving === match.id
            const isSaved  = saved  === match.id
            const isDirty  =
              s.home !== (match.home_score != null ? String(match.home_score) : '') ||
              s.away !== (match.away_score != null ? String(match.away_score) : '')
            const isTbd = !match.home_team_id && !match.away_team_id

            return (
              <div key={match.id}
                className={`bg-gray-900 border rounded-xl p-4 transition-colors ${
                  match.is_completed ? 'border-green-800/50' : isTbd ? 'border-gray-800/40 opacity-50' : 'border-gray-800'
                }`}>
                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">

                  {/* Home team */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-2xl flex-shrink-0">{match.home_team?.flag_emoji ?? '🏳️'}</span>
                    <div className="min-w-0 flex-1">
                      {editingSlot?.matchId === match.id && editingSlot?.slot === 'home' ? (
                        <select autoFocus
                          className="w-full bg-gray-800 border border-orange-500 rounded px-2 py-1 text-xs text-white"
                          defaultValue=""
                          onChange={e => assignTeam(match.id, 'home', e.target.value)}
                          onBlur={() => setEditingSlot(null)}>
                          <option value="">— Select team —</option>
                          {teams.map(t => <option key={t.id} value={t.id}>{t.flag_emoji} {t.name}</option>)}
                        </select>
                      ) : (
                        <div className="flex items-center gap-1">
                          <div className="text-sm font-medium text-white truncate">{match.home_team?.name ?? 'TBD'}</div>
                          {adminTab === 'knockout' && (
                            <button onClick={() => setEditingSlot({ matchId: match.id, slot: 'home' })}
                              className="text-gray-600 hover:text-orange-400 text-xs flex-shrink-0" title="Manually assign team">✏️</button>
                          )}
                        </div>
                      )}
                      {match.home_team && <div className="text-xs text-gray-500">#{match.home_team.fifa_ranking}</div>}
                    </div>
                  </div>

                  {/* Score inputs */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input type="number" min={0} max={99} value={s.home}
                      disabled={isTbd}
                      onChange={e => setScores(prev => ({ ...prev, [match.id]: { ...prev[match.id], home: e.target.value } }))}
                      placeholder="—"
                      className="w-12 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-center text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-30" />
                    <span className="text-gray-600 font-bold">:</span>
                    <input type="number" min={0} max={99} value={s.away}
                      disabled={isTbd}
                      onChange={e => setScores(prev => ({ ...prev, [match.id]: { ...prev[match.id], away: e.target.value } }))}
                      placeholder="—"
                      className="w-12 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-center text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-30" />
                  </div>

                  {/* Away team */}
                  <div className="flex items-center gap-2 flex-1 min-w-0 justify-end sm:justify-start">
                    <div className="min-w-0 text-right sm:text-left flex-1">
                      {editingSlot?.matchId === match.id && editingSlot?.slot === 'away' ? (
                        <select autoFocus
                          className="w-full bg-gray-800 border border-orange-500 rounded px-2 py-1 text-xs text-white"
                          defaultValue=""
                          onChange={e => assignTeam(match.id, 'away', e.target.value)}
                          onBlur={() => setEditingSlot(null)}>
                          <option value="">— Select team —</option>
                          {teams.map(t => <option key={t.id} value={t.id}>{t.flag_emoji} {t.name}</option>)}
                        </select>
                      ) : (
                        <div className="flex items-center gap-1 justify-end sm:justify-start">
                          {adminTab === 'knockout' && (
                            <button onClick={() => setEditingSlot({ matchId: match.id, slot: 'away' })}
                              className="text-gray-600 hover:text-orange-400 text-xs flex-shrink-0" title="Manually assign team">✏️</button>
                          )}
                          <div className="text-sm font-medium text-white truncate">{match.away_team?.name ?? 'TBD'}</div>
                        </div>
                      )}
                      {match.away_team && <div className="text-xs text-gray-500">#{match.away_team.fifa_ranking}</div>}
                    </div>
                    <span className="text-2xl flex-shrink-0">{match.away_team?.flag_emoji ?? '🏳️'}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                    <button
                      onClick={() => saveResult(match)}
                      disabled={isSaving || isTbd || s.home === '' || s.away === ''}
                      className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        isSaved ? 'bg-green-600 text-white'
                        : isDirty ? 'bg-orange-500 text-white hover:bg-orange-600'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}>
                      {isSaving ? '...' : isSaved ? '✓ Saved' : 'Save'}
                    </button>
                    {match.is_completed && (
                      <button onClick={() => clearResult(match)} disabled={isSaving}
                        className="px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors disabled:opacity-40"
                        title="Clear result">
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Date + status */}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-800/50">
                  <span className="text-xs text-gray-600">
                    {match.match_date
                      ? new Date(match.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                      : 'Date TBC'}
                  </span>
                  {isTbd && <span className="text-xs text-gray-600">Waiting for teams to qualify</span>}
                  {match.is_completed && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-800">
                      ✓ Final
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
