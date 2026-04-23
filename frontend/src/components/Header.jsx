import { useAuth, useClerk, useUser } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getMe } from '../services/api'

const roleBadge = {
  admin: { bg: 'var(--wecare-red)', label: 'admin' },
  aprovador: { bg: 'var(--wecare-teal)', label: 'aprovador' },
  atendente: { bg: 'var(--wecare-gray)', label: 'atendente' },
}

export default function Header() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const { getToken } = useAuth()
  const { pathname } = useLocation()
  const [role, setRole] = useState(null)

  useEffect(() => {
    getMe(getToken).then((me) => setRole(me.role)).catch(() => {})
  }, [getToken])

  const badge = roleBadge[role] || roleBadge.atendente

  const navLinks = [
    { to: '/', label: 'Calculadora' },
    { to: '/politicas', label: 'Políticas' },
    { to: '/aprovacao', label: 'Aprovações' },
    { to: '/dashboard', label: 'Dashboard' },
  ]

  return (
    <header style={{
      height: 64,
      background: '#fff',
      boxShadow: 'var(--shadow)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 2rem',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <img
          src="/logo.png"
          alt="WeCare"
          style={{ height: 36 }}
          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }}
        />
        <span style={{ display: 'none', fontWeight: 700, color: 'var(--wecare-red)', fontSize: '1.2em' }}>WeCare</span>

        <nav style={{ display: 'flex', gap: '0.25rem' }}>
          {navLinks.map(({ to, label }) => {
            const active = pathname === to
            return (
              <Link
                key={to}
                to={to}
                style={{
                  padding: '0.35rem 0.9rem',
                  borderRadius: 'var(--radius)',
                  fontWeight: active ? 600 : 400,
                  fontSize: '0.9em',
                  color: active ? 'var(--wecare-red)' : 'var(--wecare-gray)',
                  background: active ? '#fff5f5' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </div>

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          {user.imageUrl && (
            <img src={user.imageUrl} alt={user.fullName} style={{ width: 36, height: 36, borderRadius: '50%' }} />
          )}
          <span style={{ fontWeight: 600, fontSize: '0.95em' }}>{user.fullName}</span>
          {role && (
            <span style={{
              background: badge.bg,
              color: '#fff',
              borderRadius: 12,
              padding: '2px 10px',
              fontSize: '0.75em',
              fontWeight: 600,
            }}>
              {badge.label}
            </span>
          )}
          <button
            onClick={() => signOut({ redirectUrl: '/entrar' })}
            style={{
              background: 'none',
              border: '1px solid var(--wecare-gray)',
              borderRadius: 'var(--radius)',
              padding: '4px 14px',
              cursor: 'pointer',
              fontSize: '0.85em',
              color: 'var(--wecare-gray)',
              fontFamily: 'var(--font-main)',
            }}
          >
            Sair
          </button>
        </div>
      )}
    </header>
  )
}
