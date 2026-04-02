import { Outlet, NavLink } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const links = [
  { to: '/',            label: '🏠 Dashboard' },
  { to: '/tournament',  label: '🏆 Tournament' },
  { to: '/sweepstake',  label: '🎯 Sweepstake' },
  { to: '/map',         label: '🗺️ Map' },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-5 border-b border-gray-800">
          <h1 className="font-bold text-lg text-orange-500">⚽ WC 2026</h1>
          <p className="text-xs text-gray-400 mt-0.5">{user?.email}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {links.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-orange-500 text-white font-medium'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3">
          <button onClick={logout}
            className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-colors">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}