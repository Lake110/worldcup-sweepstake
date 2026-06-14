import { useEffect, useState } from 'react'
import api from '../services/api'

interface SyncResult {
  synced_at?: string
  updated?: string[]
  skipped?: string[]
  errors?: string[]
  total_finished?: number
  groups_updated?: number
  teams_updated?: number
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString()
}

function statusDotClass(result: SyncResult): string {
  if (!result.synced_at) return 'bg-gray-500'
  const errCount = result.errors?.length ?? 0
  return errCount > 0 ? 'bg-amber-400' : 'bg-green-400'
}

export default function SyncPanel() {
  const [status, setStatus]   = useState<SyncResult>({})
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    api.get('/sync/status').then(r => setStatus(r.data)).catch(() => {})
  }, [])

  async function runSync(endpoint: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await api.post(`/sync/${endpoint}`)
      setStatus(res.data)
    } catch {
      setError('Sync failed')
    } finally {
      setLoading(false)
    }
  }

  const dotClass = statusDotClass(status)
  const updated  = status.updated?.length ?? status.teams_updated ?? 0
  const skipped  = status.skipped?.length ?? 0
  const errCount = status.errors?.length ?? 0

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
      {/* Status row */}
      <div className="flex items-center gap-2 mb-1">
        <span
          data-testid="sync-dot"
          className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`}
        />
        <span className="text-sm text-white font-medium">
          {status.synced_at ? `Last synced: ${formatTime(status.synced_at)}` : 'Never synced'}
        </span>
      </div>
      {status.synced_at && (
        <div className="text-xs text-gray-500 ml-4 mb-3">
          {updated} updated · {skipped} skipped · {errCount} errors
        </div>
      )}

      {error && (
        <div className="text-xs text-amber-400 mb-2">{error}</div>
      )}

      {/* Buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => runSync('run')}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-1.5"
        >
          {loading ? (
            <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
          ) : '⚡'}
          Sync Results
        </button>
        <button
          onClick={() => runSync('standings')}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-1.5"
        >
          {loading ? (
            <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
          ) : '📊'}
          Sync Standings
        </button>
      </div>

      <p className="text-xs text-gray-600 mt-2">
        Rate limit: 50 requests/month — use sparingly after match days
      </p>
    </div>
  )
}
