import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const baseLinks = [
  { to: '/',           label: 'Dashboard',  icon: '🏠' },
  { to: '/tournament', label: 'Tournament', icon: '🏆' },
  { to: '/sweepstake', label: 'Sweepstake', icon: '🎯' },
  { to: '/map',        label: 'Map',        icon: '🗺️' },
]

const adminLink = { to: '/admin', label: 'Admin', icon: '🔧' }

export default function Layout() {
  const { user, logout } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Show admin link only for admin users
  const links = user?.is_admin ? [...baseLinks, adminLink] : baseLinks

  const currentPage = links.find(l =>
    l.to === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(l.to)
  )

  return (
    <div className="min-h-screen bg-gray-950 overflow-x-hidden">

      {/* ── Mobile top bar ── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between overflow-hidden">
        <div className="flex items-center gap-3">
          <span className="text-orange-500 font-bold text-lg">⚽ WC 2026</span>
          {currentPage && (
            <span className="text-gray-400 text-sm">/ {currentPage.label}</span>
          )}
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          aria-label="Toggle menu"
        >
          <span className={`block w-5 h-0.5 bg-white transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-5 h-0.5 bg-white transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 bg-white transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </header>

      {/* ── Mobile overlay ── */}
      {menuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* ── Mobile slide-in menu ── */}
      <div className={`lg:hidden fixed top-0 right-0 h-full w-72 z-50 bg-gray-900 border-l border-gray-800 transform transition-transform duration-300 ease-in-out ${
        menuOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex items-center justify-between px-5 border-b border-gray-800" style={{ height: '60px' }}>
          <div>
            <div className="text-sm font-medium text-white">{user?.full_name ?? 'Player'}</div>
            <div className="text-xs text-gray-500">{user?.email}</div>
          </div>
          <button onClick={() => setMenuOpen(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>
        <nav className="p-4 space-y-1">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
            >
              <span className="text-lg">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
          <button
            onClick={() => { logout(); setMenuOpen(false) }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors"
          >
            <span>🚪</span> Sign out
          </button>
        </div>
      </div>

      {/* ── Desktop sidebar + main layout ── */}
      <div className="flex">
        <aside className="hidden lg:flex w-60 min-h-screen bg-gray-900 border-r border-gray-800 flex-col fixed top-0 left-0">
          <div className="p-5 border-b border-gray-800">
            <h1 className="font-bold text-lg text-orange-500">⚽ WC 2026</h1>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{user?.email}</p>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {links.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-orange-500 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <span>{l.icon}</span>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="p-3 border-t border-gray-800">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-500 hover:text-red-400 rounded-xl hover:bg-gray-800 transition-colors"
            >
              <span>🚪</span> Sign out
            </button>
          </div>
        </aside>

        <main className="flex-1 lg:ml-60 pt-16 lg:pt-0 min-w-0">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 overflow-x-hidden">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}