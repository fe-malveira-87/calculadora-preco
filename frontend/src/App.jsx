import {
  AuthenticateWithRedirectCallback,
  SignedIn,
  SignedOut,
  useAuth,
} from '@clerk/clerk-react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import Aprovacao from './pages/Aprovacao.jsx'
import Aprovacoes from './pages/Aprovacoes.jsx'
import Calculadora from './pages/Calculadora.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Login from './pages/Login.jsx'
import Politicas from './pages/Politicas.jsx'

function AuthLoading() {
  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      alignItems: 'center', justifyContent: 'center',
      fontSize: '0.9em', color: 'var(--wecare-gray)',
    }}>
      Carregando…
    </div>
  )
}

function EntrarRoute() {
  const { isLoaded } = useAuth()
  if (!isLoaded) return <AuthLoading />
  return (
    <>
      <SignedOut><Login /></SignedOut>
      <SignedIn><Navigate to="/" replace /></SignedIn>
    </>
  )
}

function RequireAuth() {
  const { isLoaded } = useAuth()
  if (!isLoaded) return <AuthLoading />
  return (
    <>
      <SignedIn><Outlet /></SignedIn>
      <SignedOut><Navigate to="/entrar" replace /></SignedOut>
    </>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<EntrarRoute />} />
      <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback />} />
      <Route element={<RequireAuth />}>
        <Route index element={<Calculadora />} />
        <Route path="/politicas" element={<Politicas />} />
        <Route path="/aprovacoes" element={<Aprovacoes />} />
        <Route path="/aprovacao" element={<Aprovacao />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
