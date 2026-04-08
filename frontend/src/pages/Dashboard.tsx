import { useEffect, useState } from 'react'
import api from '../services/api'

interface Team {
  id: string
  name: string
  code: string
  flag_emoji: string
  confederation: string
  fifa_ranking: number
}

interface GroupMember {
  team: Team
}

interface Group {
  id: string
  name: string
  members: GroupMember[]
}

const CONFEDERATION_COLOURS: Record<string, { bg: string, text: string, border: string }> = {
  UEFA:     { bg: 'bg-blue-900/30',   text: 'text-blue-300',   border: 'border-blue-700' },
  CONMEBOL: { bg: 'bg-green-900/30',  text: 'text-green-300',  border: 'border-green-700' },
  CONCACAF: { bg: 'bg-red-900/30',    text: 'text-red-300',    border: 'border-red-700' },
  CAF:      { bg: 'bg-yellow-900/30', text: 'text-yellow-300', border: 'border-yellow-700' },
  AFC:      { bg: 'bg-purple-900/30', text: 'text-purple-300', border: 'border-purple-700' },
  OFC:      { bg: 'bg-gray-700/30',   text: 'text-gray-300',   border: 'border-gray-600' },
}

const CONFEDERATION_ORDER = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC']

const KNOCKOUT_ROUNDS = [
  { round: 'R32',   matches: 16, desc: 'Top 2 + 8 best 3rd' },
  { round: 'R16',   matches: 8,  desc: '16 teams' },
  { round: 'QF',    matches: 4,  desc: '8 teams' },
  { round: 'SF',    matches: 2,  desc: '4 teams' },
  { round: 'Final', matches: 1,  desc: 'July 19, 2026' },
]

function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0, hours: 0, minutes: 0, seconds: 0
  })

  useEffect(() => {
    const tick = () => {
      const now  = new Date().getTime()
      const diff = targetDate.getTime() - now
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }
      setTimeLeft({
        days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours:   Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      })
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  return timeLeft
}

export default function Dashboard() {
  const [teams, setTeams]     = useState<Team[]>([])
  const [groups, setGroups]   = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  const tournamentStart = new Date('2026-06-11T00:00:00')
  const countdown = useCountdown(tournamentStart)

  useEffect(() => {
    Promise.all([
      api.get('/teams/'),
      api.get('/groups/'),
    ]).then(([teamsRes, groupsRes]) => {
      setTeams(teamsRes.data)
      setGroups(groupsRes.data)
    }).finally(() => setLoading(false))
  }, [])

  const strongestGroup = groups.reduce((best, group) => {
    if (group.members.length === 0) return best
    const avg = group.members.reduce((sum, m) => sum + m.team.fifa_ranking, 0) / group.members.length
    if (!best || avg < best.avg) return { group, avg }
    return best
  }, null as { group: Group, avg: number } | null)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full overflow-x-hidden">

      {/* ── Hero ── */}
      <div className="rounded-xl bg-gradient-to-br from-orange-900/40 to-gray-900 border border-orange-800/40 p-5 sm:p-8">
        {/*
          FIX: Changed from flex-col sm:flex-row to always flex-col on mobile,
          and added gap between title area and countdown.
          The countdown boxes were w-14 — shrunk to w-12 sm:w-14 to fit 320px screens.
        */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
          <div>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-2">
              ⚽ FIFA World Cup 2026
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              USA · Canada · Mexico · June 11 – July 19, 2026
            </p>
            <div className="flex gap-2 flex-wrap">
              {['🇺🇸 USA', '🇨🇦 Canada', '🇲🇽 Mexico'].map(h => (
                <span key={h} className="text-xs px-3 py-1 bg-orange-900/40 text-orange-300 border border-orange-700 rounded-full">
                  {h}
                </span>
              ))}
            </div>
          </div>

          {/* Countdown — shrink boxes on very small screens */}
          <div className="shrink-0">
            <div className="text-xs text-gray-500 mb-2 uppercase tracking-widest">
              Kicks off in
            </div>
            <div className="flex gap-2">
              {[
                { value: countdown.days,    label: 'Days' },
                { value: countdown.hours,   label: 'Hrs' },
                { value: countdown.minutes, label: 'Min' },
                { value: countdown.seconds, label: 'Sec' },
              ].map(({ value, label }) => (
                <div key={label} className="bg-gray-900 border border-gray-700 rounded-lg p-2 w-12 sm:w-14 text-center">
                  <div className="text-lg sm:text-xl font-bold text-orange-400 tabular-nums">
                    {String(value).padStart(2, '0')}
                  </div>
                  <div className="text-xs text-gray-500">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick stats ── */}
      <div>
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
          Tournament at a glance
        </h3>
        {/*
          Grid is already grid-cols-2 sm:grid-cols-4 — that's fine on mobile.
          No changes needed here.
        */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { value: '48',  label: 'Teams',    icon: '🌍' },
            { value: '12',  label: 'Groups',   icon: '🗂' },
            { value: '16',  label: 'Stadiums', icon: '🏟' },
            { value: '104', label: 'Matches',  icon: '⚽' },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
              <span className="text-3xl">{stat.icon}</span>
              <div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Opening match + Toughest group ── */}
      {/* Already grid-cols-1 lg:grid-cols-2 — no changes needed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-4">
            🎬 Opening match
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-center flex-1">
              <div className="text-3xl mb-2">🇲🇽</div>
              <div className="text-sm font-bold text-white">Mexico</div>
              <div className="text-xs text-gray-500">#18</div>
            </div>
            <div className="text-center px-2">
              <div className="text-sm font-bold text-gray-600">VS</div>
            </div>
            <div className="text-center flex-1">
              <div className="text-3xl mb-2">🇿🇦</div>
              <div className="text-sm font-bold text-white">South Africa</div>
              <div className="text-xs text-gray-500">#37</div>
            </div>
          </div>
          <div className="text-center text-xs text-gray-500 border-t border-gray-800 pt-3">
            📍 Estadio Azteca, Mexico City · June 11, 2026
          </div>
        </div>

        {strongestGroup && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              💀 Toughest group
            </div>
            <div className="text-lg font-bold text-white mb-1">
              Group {strongestGroup.group.name}
            </div>
            <div className="text-xs text-gray-500 mb-4">
              Avg FIFA ranking: #{strongestGroup.avg.toFixed(1)}
            </div>
            <div className="space-y-2">
              {strongestGroup.group.members
                .sort((a, b) => a.team.fifa_ranking - b.team.fifa_ranking)
                .map(m => (
                  <div key={m.team.id} className="flex items-center gap-3">
                    <span className="text-xl">{m.team.flag_emoji}</span>
                    <span className="text-sm text-white flex-1">{m.team.name}</span>
                    <span className="text-xs text-orange-400 font-bold">
                      #{m.team.fifa_ranking}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Confederation breakdown ── */}
      <div>
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
          🌐 Confederation breakdown
        </h3>
        {/*
          FIX 1: Changed from grid-cols-3 xl:grid-cols-6 to grid-cols-2 sm:grid-cols-3 xl:grid-cols-6.
          3 columns on a 375px phone meant ~110px per card — too tight for the text.
          2 columns gives ~165px which is comfortable.

          FIX 2: Removed hidden sm:flex from the flags div so flags show on mobile too.
          They're just emoji so they add visual richness without taking up much space.
        */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
          {CONFEDERATION_ORDER.map(conf => {
            const confTeams = teams.filter(t => t.confederation === conf)
            const colours   = CONFEDERATION_COLOURS[conf]
            return (
              <div key={conf} className={`${colours.bg} border ${colours.border} rounded-xl p-3 sm:p-4`}>
                <div className={`text-xs font-bold ${colours.text} mb-2`}>{conf}</div>
                <div className="text-3xl font-bold text-white mb-0.5">{confTeams.length}</div>
                <div className="text-xs text-gray-500 mb-2">teams</div>
                {/* FIX: removed hidden sm:flex so flags are visible on mobile */}
                <div className="flex flex-wrap gap-0.5">
                  {confTeams.slice(0, 4).map(t => (
                    <span key={t.id} className="text-base" title={t.name}>
                      {t.flag_emoji}
                    </span>
                  ))}
                  {confTeams.length > 4 && (
                    <span className="text-xs text-gray-500 self-center">
                      +{confTeams.length - 4}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Knockout bracket overview ── */}
      <div>
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
          🏆 Knockout stage overview
        </h3>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          {/*
            FIX: Added a scroll hint ("scroll →") below the container on mobile
            so users know it's horizontally scrollable.
            Also added scroll-smooth and a slight padding-bottom so the scrollbar
            doesn't clip the bottom of cards.
          */}
          <div className="overflow-x-auto pb-3 scroll-smooth">
            <div className="flex items-stretch min-w-max">
              {KNOCKOUT_ROUNDS.map((round, index) => (
                <div key={round.round} className="flex items-stretch">
                  <div className="flex flex-col w-24 sm:w-32">
                    <div className={`text-center px-2 py-2 rounded-t-lg text-xs font-bold mb-2 ${
                      index === KNOCKOUT_ROUNDS.length - 1
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-800 text-gray-300'
                    }`}>
                      {round.round}
                    </div>
                    <div className="flex-1 flex flex-col justify-center gap-1 px-1">
                      {Array.from({ length: round.matches }).map((_, i) => (
                        <div key={i} className={`rounded border text-center py-1 text-xs ${
                          index === KNOCKOUT_ROUNDS.length - 1
                            ? 'border-orange-700 bg-orange-900/20 text-orange-400 font-bold'
                            : 'border-gray-700 bg-gray-800/50 text-gray-600'
                        }`}>
                          {index === KNOCKOUT_ROUNDS.length - 1 ? '🏆 Final' : 'TBD v TBD'}
                        </div>
                      ))}
                    </div>
                    <div className="text-center text-xs text-gray-600 mt-2 px-1 pb-1">
                      {round.desc}
                    </div>
                  </div>
                  {index < KNOCKOUT_ROUNDS.length - 1 && (
                    <div className="flex items-center px-1 text-gray-700">→</div>
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* Scroll hint — only visible on small screens */}
          <div className="flex items-center justify-end gap-1 mt-1 sm:hidden">
            <span className="text-xs text-gray-600">scroll</span>
            <span className="text-xs text-gray-600">→</span>
          </div>
        </div>
      </div>

    </div>
  )
}
