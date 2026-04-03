import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Tournament from './pages/Tournament'
import Sweepstake from './pages/Sweepstake'
import Map from './pages/Map'
import Bracket from './pages/Bracket'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index                element={<Dashboard />} />
        <Route path="tournament"    element={<Tournament />} />
        <Route path="sweepstake"    element={<Sweepstake />} />
        <Route path="map"           element={<Map />} />
        <Route path="bracket"       element={<Bracket />} />
      </Route>
    </Routes>
  )
}