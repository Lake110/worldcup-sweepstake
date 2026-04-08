import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Tournament from './pages/Tournament'
import Sweepstake from './pages/Sweepstake'
import Map from './pages/Map'
import Admin from './pages/Admin'
import Share from './pages/Share'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_admin) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Public share page — no login needed */}
      <Route path="/share/:invite_code" element={<Share />} />

      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index                element={<Dashboard />} />
        <Route path="tournament"    element={<Tournament />} />
        <Route path="sweepstake"    element={<Sweepstake />} />
        <Route path="map"           element={<Map />} />
        <Route path="admin"         element={<AdminRoute><Admin /></AdminRoute>} />
      </Route>
    </Routes>
  )
}