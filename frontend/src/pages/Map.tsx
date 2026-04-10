import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import api from '../services/api'

interface Team {
  id: string
  name: string
  flag_emoji: string
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

const GROUP_COLOURS: Record<string, string> = {
  A: '#ef4444', B: '#f97316', C: '#eab308', D: '#22c55e',
  E: '#14b8a6', F: '#3b82f6', G: '#8b5cf6', H: '#ec4899',
  I: '#f43f5e', J: '#06b6d4', K: '#84cc16', L: '#a855f7',
}

export default function MapPage() {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)

  const { data: teams = [], isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: async () => (await api.get('/teams/')).data,
  })

  const { data: groups = [], isLoading: groupsLoading } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: async () => (await api.get('/groups/')).data,
  })

  // Build team_id → group name lookup
  const teamGroupMap = new Map<string, string>()
  groups.forEach((group) => {
    group.members.forEach((member) => {
      teamGroupMap.set(member.team.id, group.name)
    })
  })

  // Filter teams based on selected group
  const visibleTeams = selectedGroup
    ? teams.filter((team) => teamGroupMap.get(team.id) === selectedGroup)
    : teams

  const isLoading = teamsLoading || groupsLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400">
        Loading map…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">🌍 World Map</h1>
        <p className="text-slate-400 text-sm mt-1">
          All 48 qualified nations — click a group to filter, click again to reset
        </p>
      </div>

      {/* Group colour legend — now clickable filters */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(GROUP_COLOURS).map(([group, colour]) => {
          const isActive = selectedGroup === group
          return (
            <button
              key={group}
              onClick={() => setSelectedGroup(isActive ? null : group)}
              className="text-xs px-2 py-1 rounded font-semibold outline-none transition-all"
              style={{
                backgroundColor: isActive ? colour : colour + '33',
                color: isActive ? '#ffffff' : colour,
                border: `1px solid ${colour}`,
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              Group {group}
            </button>
          )
        })}
        {selectedGroup && (
          <button
            onClick={() => setSelectedGroup(null)}
            className="text-xs px-2 py-1 rounded font-semibold outline-none text-slate-400 border border-slate-600 hover:text-white hover:border-slate-400 transition-all"
          >
            ✕ Clear filter
          </button>
        )}
      </div>

      {/* Team count hint when filtered */}
      {selectedGroup && (
        <p className="text-sm text-slate-400">
          Showing{' '}
          <span style={{ color: GROUP_COLOURS[selectedGroup] }} className="font-semibold">
            Group {selectedGroup}
          </span>
          {' '}— {visibleTeams.length} teams
        </p>
      )}

      {/* Map */}
      <div
        className="rounded-xl overflow-hidden border border-slate-700"
        style={{ height: '600px' }}
      >
        <MapContainer
          center={[20, 10]}
          zoom={2}
          minZoom={2}
          maxZoom={6}
          style={{ height: '100%', width: '100%', background: '#e5e7eb' }}
          worldCopyJump={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />

          {visibleTeams.map((team) => {
            if (!team.latitude || !team.longitude) return null

            const groupName = teamGroupMap.get(team.id) ?? 'A'
            const colour = GROUP_COLOURS[groupName] ?? '#94a3b8'

            return (
              <CircleMarker
                key={team.id}
                center={[team.latitude, team.longitude]}
                radius={8}
                pathOptions={{
                  color: colour,
                  fillColor: colour,
                  fillOpacity: 0.85,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="text-sm space-y-1 min-w-[140px]">
                    <div className="text-lg font-bold">
                      {team.flag_emoji} {team.name}
                    </div>
                    <div>
                      Group <strong>{groupName}</strong>
                    </div>
                    <div>
                      FIFA Ranking: <strong>#{team.fifa_ranking}</strong>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}