import { useEffect, useRef, useState } from 'react'
import api from '../services/api'
import SyncPanel from '../components/SyncPanel'

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
  winner_team_id: string | null
}

interface ThirdPlaceTeam {
  id: string
  name: string
  flag_emoji: string
  group: string
  points: number
  goal_difference: number
  goals_for: number
}

interface PopulateResult {
  filled: string[]
  needs_manual: string[]
  pending_groups: string[]
  third_place_ranking: ThirdPlaceTeam[]
  message: string
}

const KNOCKOUT_STAGES = [
  { key: 'round_of_32',   label: 'R32',   emoji: '🔵' },
  { key: 'round_of_16',   label: 'R16',   emoji: '🟡' },
  { key: 'quarter_final', label: 'QF',    emoji: '🟠' },
  { key: 'semi_final',    label: 'SF',    emoji: '🔴' },
  { key: 'final',         label: 'Final', emoji: '🏆' },
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

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
  const [populateResult, setPopulateResult] = useState<PopulateResult | null>(null)
  const [recalcing, setRecalcing]         = useState(false)

  // AI Score Fetch state
  type AiResult = { updated: string[]; skipped: string[]; not_found: string[]; total_extracted: number; message?: string }
  const [aiFetching, setAiFetching]       = useState<'web' | 'image' | null>(null)
  const [aiResult, setAiResult]           = useState<AiResult | null>(null)
  const [aiError, setAiError]             = useState<string | null>(null)
  const fileInputRef                      = useRef<HTMLInputElement>(null)
  const aiDismissTimer                    = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.get('/teams/').then(res => setTeams(res.data))
  }, [])

  useEffect(() => {
    api.get('/groups/').then(res => {
      const sorted = [...res.data].sort((a: Group, b: Group) => a.name.localeCompare(b.name))
      setGroups(sorted)
      setSelectedGroup(sorted[0] ?? null)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (adminTab !== 'groups' || !selectedGroup) return
    setMatches([])
    api.get(`/matches/?group_id=${selectedGroup.id}`).then(res => {
      const m: Match[] = res.data
      setMatches(m)
      prefillScores(m)
    })
  }, [selectedGroup, adminTab])

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
      api.get(`/matches/?group_id=${selectedGroup.id}`).then(res => {
        const m: Match[] = res.data
        setMatches(m)
        prefillScores(m)
      })
    } else {
      api.get(`/matches/?stage=${knockoutStage}`).then(res => {
        const m: Match[] = res.data
        setMatches(m)
        prefillScores(m)
      })
    }
  }

  async function recalcAll() {
    setRecalcing(true)
    try {
      const res = await api.post('/matches/recalc-all')
      alert(`Standings recalculated for ${res.data.groups_recalculated} groups`)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Recalculate failed')
    } finally {
      setRecalcing(false)
    }
  }

  function showAiResult(result: AiResult) {
    setAiResult(result)
    setAiError(null)
    if (aiDismissTimer.current) clearTimeout(aiDismissTimer.current)
    aiDismissTimer.current = setTimeout(() => setAiResult(null), 60_000)
    // Refresh match list so scores show immediately
    refreshMatches()
  }

  async function fetchWebScores() {
    setAiFetching('web')
    setAiResult(null)
    setAiError(null)
    try {
      const res = await api.post('/ai-scores/fetch-web')
      showAiResult(res.data)
    } catch (err: any) {
      setAiError(err.response?.data?.detail || 'Web fetch failed')
    } finally {
      setAiFetching(null)
    }
  }

  async function uploadImage(file: File) {
    setAiFetching('image')
    setAiResult(null)
    setAiError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post('/ai-scores/fetch-image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      showAiResult(res.data)
    } catch (err: any) {
      setAiError(err.response?.data?.detail || 'Image upload failed')
    } finally {
      setAiFetching(null)
    }
  }

  async function populateR32() {
    setPopulating(true)
    setPopulateResult(null)
    try {
      const res = await api.post('/knockout/populate')
      setPopulateResult(res.data)
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

  async function setKnockoutWinner(match: Match, teamId: string | null) {
    if (!teamId) return
    setSaving(match.id)
    try {
      await api.patch(`/matches/${match.id}/result`, { winner_team_id: teamId })
      setSaved(match.id)
      setTimeout(() => setSaved(null), 2000)
      refreshMatches()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to set penalty winner')
    } finally {
      setSaving(null)
    }
  }

  async function assignTeam(matchId: string, slot: 'home' | 'away', teamId: string) {
    try {
      await api.patch(`/matches/${matchId}/teams`, { [`${slot}_team_id`]: teamId || null })
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

  // ── Shared score-input class ──────────────────────────────────────────────
  const scoreInputCls = (disabled: boolean) =>
    `w-14 min-h-[44px] bg-gray-800 border rounded-lg text-center text-lg font-bold text-white
     focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors
     ${disabled ? 'opacity-30 cursor-not-allowed border-gray-700'
                : 'border-gray-700 hover:border-gray-600'}`

  return (
    <div className="space-y-5">

      <SyncPanel />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">🔧 Match Results</h2>
          <p className="text-gray-400 text-sm">Admin only — enter scores to update standings and leaderboards</p>
        </div>
        <button
          onClick={recalcAll}
          disabled={recalcing}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2">
          {recalcing ? <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> : '🔄'}
          Recalculate All Standings
        </button>
      </div>

      {/* ── AI Score Fetch panel ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <div>
          <h3 className="text-base font-bold text-white">🤖 AI Score Fetch</h3>
          <p className="text-xs text-gray-500 mt-0.5">Search the web for all results to date, or upload a photo of scores</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={fetchWebScores}
            disabled={aiFetching !== null}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
            {aiFetching === 'web'
              ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Searching for all World Cup results...</>
              : '🌐 Fetch All Results'}
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={aiFetching !== null}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
            {aiFetching === 'image'
              ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Reading image...</>
              : '📷 Upload Screenshot'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = '' }}
          />
        </div>

        {aiError && (
          <p className="text-xs text-amber-400">{aiError}</p>
        )}

        {aiResult && (
          <div className="bg-green-900/20 border border-green-800 rounded-lg p-3 text-xs space-y-1">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 flex-1">
                <p className="text-green-400 font-medium">
                  ✓ {aiResult.updated.length} score(s) updated
                  {aiResult.message && aiResult.updated.length === 0 ? ` — ${aiResult.message}` : ''}
                </p>
                {aiResult.skipped.length > 0 && (
                  <p className="text-gray-400">{aiResult.skipped.length} already up to date</p>
                )}
                {aiResult.not_found.length > 0 && (
                  <p className="text-amber-400">⚠ Could not match: {aiResult.not_found.join(', ')}</p>
                )}
                {aiResult.updated.map(label => (
                  <p key={label} className="text-green-300">{label}</p>
                ))}
              </div>
              <button
                onClick={() => { setAiResult(null); if (aiDismissTimer.current) clearTimeout(aiDismissTimer.current) }}
                className="text-gray-500 hover:text-white flex-shrink-0 text-base leading-none">✕</button>
            </div>
          </div>
        )}
      </div>

      {/* Top tabs: Groups vs Knockout */}
      <div className="flex gap-2 p-1 bg-gray-900 border border-gray-800 rounded-xl w-fit">
        <button
          onClick={() => setAdminTab('groups')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            adminTab === 'groups' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
          }`}>
          🗂 Groups
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
          {/* Horizontally-scrollable group tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1"
               style={{ scrollbarWidth: 'none' }}>
            {groups.map(group => (
              <button
                key={group.id}
                onClick={() => setSelectedGroup(group)}
                className={`flex-shrink-0 px-3.5 py-2 rounded-lg text-sm font-bold transition-colors ${
                  selectedGroup?.id === group.id
                    ? 'bg-orange-500 text-white shadow-sm shadow-orange-900'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}>
                {group.name}
              </button>
            ))}
          </div>

          {selectedGroup && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-base font-bold text-white">Group {selectedGroup.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{completedCount}/{matches.length} matches done</p>
                </div>
                <div className="flex-1 min-w-[80px] max-w-[200px]">
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
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
          {/* Horizontally-scrollable stage tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1"
               style={{ scrollbarWidth: 'none' }}>
            {KNOCKOUT_STAGES.map(s => (
              <button
                key={s.key}
                onClick={() => setKnockoutStage(s.key)}
                className={`flex-shrink-0 px-3.5 py-2 rounded-lg text-sm font-bold transition-colors ${
                  knockoutStage === s.key
                    ? 'bg-orange-500 text-white shadow-sm shadow-orange-900'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}>
                {s.emoji} {s.label}
              </button>
            ))}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  {KNOCKOUT_STAGES.find(s => s.key === knockoutStage)?.emoji}{' '}
                  {KNOCKOUT_STAGES.find(s => s.key === knockoutStage)?.label}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">{completedCount}/{matches.length} done</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {knockoutStage === 'round_of_32' && (
                  <button onClick={populateR32} disabled={populating}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors">
                    {populating ? '⏳ Populating…' : '⚡ Auto-populate'}
                  </button>
                )}
                <div className="w-36">
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full transition-all"
                      style={{ width: matches.length > 0 ? `${(completedCount / matches.length) * 100}%` : '0%' }} />
                  </div>
                </div>
              </div>
            </div>

            {populateResult && (
              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 text-xs space-y-2">
                <div className="text-blue-300 font-medium">{populateResult.message}</div>
                {populateResult.pending_groups.length > 0 && (
                  <div className="text-yellow-500/80">
                    ⏳ Groups still in progress: {populateResult.pending_groups.join(', ')}
                  </div>
                )}
                {populateResult.needs_manual.length > 0 && (
                  <div className="text-gray-400">
                    ✏️ {populateResult.needs_manual.length} slot(s) need manual 3rd-place assignment
                  </div>
                )}
                {populateResult.third_place_ranking.length > 0 && (
                  <div className="mt-1">
                    <div className="text-gray-300 font-semibold mb-1">🥉 3rd-place ranking:</div>
                    <div className="space-y-0.5">
                      {populateResult.third_place_ranking.map((t, i) => (
                        <div key={t.id} className="flex items-center gap-2 text-gray-400">
                          <span className="w-4 text-right text-gray-600">#{i + 1}</span>
                          <span>{t.flag_emoji} {t.name}</span>
                          <span className="text-gray-600">Grp {t.group}</span>
                          <span className="text-gray-600">{t.points}pts</span>
                          <span className="text-gray-600">GD {t.goal_difference > 0 ? '+' : ''}{t.goal_difference}</span>
                        </div>
                      ))}
                    </div>
                  </div>
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
            const s        = scores[match.id] ?? { home: '', away: '' }
            const isSaving = saving === match.id
            const isSaved  = saved  === match.id
            const isDirty  =
              s.home !== (match.home_score != null ? String(match.home_score) : '') ||
              s.away !== (match.away_score != null ? String(match.away_score) : '')
            const isTbd    = !match.home_team_id && !match.away_team_id

            const saveBtnCls = `min-h-[44px] px-5 rounded-lg text-sm font-semibold transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 ${
                isSaved  ? 'bg-green-600 text-white'
              : isDirty  ? 'bg-orange-500 text-white hover:bg-orange-600'
              :            'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`

            const clearBtnCls = `min-h-[40px] w-10 flex items-center justify-center rounded-lg
              text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors disabled:opacity-40`

            return (
              <div key={match.id}
                className={`bg-gray-900 border rounded-xl overflow-hidden transition-colors ${
                  match.is_completed
                    ? 'border-green-800/40'
                    : isTbd
                    ? 'border-gray-800/30 opacity-50'
                    : 'border-gray-800'
                }`}>

                {/* ── MOBILE layout (hidden on sm+) ─────────────────────── */}
                <div className="sm:hidden p-4 space-y-0">

                  {/* Home team row */}
                  <div className="flex items-center gap-3">
                    <span className="text-2xl w-8 text-center leading-none flex-shrink-0">
                      {match.home_team?.flag_emoji ?? '🏳️'}
                    </span>
                    <div className="flex-1 min-w-0">
                      {editingSlot?.matchId === match.id && editingSlot?.slot === 'home' ? (
                        <select autoFocus
                          className="w-full bg-gray-800 border border-orange-500 rounded px-2 py-1.5 text-sm text-white"
                          defaultValue=""
                          onChange={e => assignTeam(match.id, 'home', e.target.value)}
                          onBlur={() => setEditingSlot(null)}>
                          <option value="">— Select team —</option>
                          {teams.map(t => <option key={t.id} value={t.id}>{t.flag_emoji} {t.name}</option>)}
                        </select>
                      ) : (
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-sm font-semibold text-white truncate">
                            {match.home_team?.name ?? 'TBD'}
                          </span>
                          {adminTab === 'knockout' && (
                            <button onClick={() => setEditingSlot({ matchId: match.id, slot: 'home' })}
                              className="text-gray-600 hover:text-orange-400 text-xs flex-shrink-0 ml-1">✏️</button>
                          )}
                        </div>
                      )}
                    </div>
                    <input
                      type="number" inputMode="numeric" pattern="[0-9]*"
                      min={0} max={99} value={s.home}
                      disabled={isTbd}
                      onChange={e => setScores(prev => ({ ...prev, [match.id]: { ...prev[match.id], home: e.target.value } }))}
                      placeholder="–"
                      className={scoreInputCls(isTbd)} />
                  </div>

                  {/* Divider between teams */}
                  <div className="flex items-center gap-3 py-1.5">
                    <div className="w-8 flex-shrink-0" />
                    <div className="flex-1 h-px bg-gray-800/60" />
                    <div className="w-14 flex justify-center">
                      <span className="text-xs text-gray-700 font-bold">vs</span>
                    </div>
                  </div>

                  {/* Away team row */}
                  <div className="flex items-center gap-3">
                    <span className="text-2xl w-8 text-center leading-none flex-shrink-0">
                      {match.away_team?.flag_emoji ?? '🏳️'}
                    </span>
                    <div className="flex-1 min-w-0">
                      {editingSlot?.matchId === match.id && editingSlot?.slot === 'away' ? (
                        <select autoFocus
                          className="w-full bg-gray-800 border border-orange-500 rounded px-2 py-1.5 text-sm text-white"
                          defaultValue=""
                          onChange={e => assignTeam(match.id, 'away', e.target.value)}
                          onBlur={() => setEditingSlot(null)}>
                          <option value="">— Select team —</option>
                          {teams.map(t => <option key={t.id} value={t.id}>{t.flag_emoji} {t.name}</option>)}
                        </select>
                      ) : (
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-sm font-semibold text-white truncate">
                            {match.away_team?.name ?? 'TBD'}
                          </span>
                          {adminTab === 'knockout' && (
                            <button onClick={() => setEditingSlot({ matchId: match.id, slot: 'away' })}
                              className="text-gray-600 hover:text-orange-400 text-xs flex-shrink-0 ml-1">✏️</button>
                          )}
                        </div>
                      )}
                    </div>
                    <input
                      type="number" inputMode="numeric" pattern="[0-9]*"
                      min={0} max={99} value={s.away}
                      disabled={isTbd}
                      onChange={e => setScores(prev => ({ ...prev, [match.id]: { ...prev[match.id], away: e.target.value } }))}
                      placeholder="–"
                      className={scoreInputCls(isTbd)} />
                  </div>

                  {/* Mobile footer: date + badges + save */}
                  <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-800/50">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs text-gray-600 truncate">
                        {match.match_date ? fmtDate(match.match_date) : 'Date TBC'}
                      </span>
                      {isTbd && <span className="text-xs text-gray-600">TBD</span>}
                      {match.is_completed && (
                        <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800/60 font-medium">
                          FT
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {match.is_completed && (
                        <button onClick={() => clearResult(match)} disabled={isSaving}
                          className={clearBtnCls} title="Clear result">
                          ✕
                        </button>
                      )}
                      <button
                        onClick={() => saveResult(match)}
                        disabled={isSaving || isTbd || s.home === '' || s.away === ''}
                        className={saveBtnCls}>
                        {isSaving ? '…' : isSaved ? '✓ Saved' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── DESKTOP layout (hidden on mobile) ─────────────────── */}
                <div className="hidden sm:block p-4">
                  <div className="flex items-center gap-3">

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
                                className="text-gray-600 hover:text-orange-400 text-xs flex-shrink-0">✏️</button>
                            )}
                          </div>
                        )}
                        {match.home_team && <div className="text-xs text-gray-500">#{match.home_team.fifa_ranking}</div>}
                      </div>
                    </div>

                    {/* Score inputs */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input
                        type="number" inputMode="numeric" pattern="[0-9]*"
                        min={0} max={99} value={s.home}
                        disabled={isTbd}
                        onChange={e => setScores(prev => ({ ...prev, [match.id]: { ...prev[match.id], home: e.target.value } }))}
                        placeholder="–"
                        className="w-12 min-h-[44px] bg-gray-800 border border-gray-700 rounded-lg px-2 text-center text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-30" />
                      <span className="text-gray-600 font-bold text-lg">:</span>
                      <input
                        type="number" inputMode="numeric" pattern="[0-9]*"
                        min={0} max={99} value={s.away}
                        disabled={isTbd}
                        onChange={e => setScores(prev => ({ ...prev, [match.id]: { ...prev[match.id], away: e.target.value } }))}
                        placeholder="–"
                        className="w-12 min-h-[44px] bg-gray-800 border border-gray-700 rounded-lg px-2 text-center text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-30" />
                    </div>

                    {/* Away team */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end sm:justify-start">
                      <div className="min-w-0 flex-1">
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
                          <div className="flex items-center gap-1">
                            {adminTab === 'knockout' && (
                              <button onClick={() => setEditingSlot({ matchId: match.id, slot: 'away' })}
                                className="text-gray-600 hover:text-orange-400 text-xs flex-shrink-0">✏️</button>
                            )}
                            <div className="text-sm font-medium text-white truncate">{match.away_team?.name ?? 'TBD'}</div>
                          </div>
                        )}
                        {match.away_team && <div className="text-xs text-gray-500">#{match.away_team.fifa_ranking}</div>}
                      </div>
                      <span className="text-2xl flex-shrink-0">{match.away_team?.flag_emoji ?? '🏳️'}</span>
                    </div>

                    {/* Desktop actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => saveResult(match)}
                        disabled={isSaving || isTbd || s.home === '' || s.away === ''}
                        className={`px-4 min-h-[44px] rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          isSaved ? 'bg-green-600 text-white'
                          : isDirty ? 'bg-orange-500 text-white hover:bg-orange-600'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}>
                        {isSaving ? '…' : isSaved ? '✓ Saved' : 'Save'}
                      </button>
                      {match.is_completed && (
                        <button onClick={() => clearResult(match)} disabled={isSaving}
                          className="px-3 min-h-[44px] flex items-center rounded-lg text-xs text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors disabled:opacity-40"
                          title="Clear result">
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Desktop footer: date + FT badge */}
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-800/50">
                    <span className="text-xs text-gray-600">
                      {match.match_date ? fmtDate(match.match_date) : 'Date TBC'}
                    </span>
                    {isTbd && <span className="text-xs text-gray-600">Waiting for teams to qualify</span>}
                    {match.is_completed && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800/60 font-medium">
                        FT
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Penalty winner picker (shared, knockout draws only) ─ */}
                {adminTab === 'knockout' &&
                  match.is_completed &&
                  match.home_score !== null && match.away_score !== null &&
                  match.home_score === match.away_score &&
                  match.home_team && match.away_team && (
                  <div className="px-4 pb-4 border-t border-yellow-900/30 pt-3">
                    <p className="text-xs text-yellow-500 mb-2">⚽ Draw — who advanced on penalties?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setKnockoutWinner(match, match.home_team_id)}
                        disabled={isSaving}
                        className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
                          match.winner_team_id === match.home_team_id
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}>
                        {match.home_team.flag_emoji} {match.home_team.name}
                      </button>
                      <button
                        onClick={() => setKnockoutWinner(match, match.away_team_id)}
                        disabled={isSaving}
                        className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
                          match.winner_team_id === match.away_team_id
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}>
                        {match.away_team.flag_emoji} {match.away_team.name}
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
