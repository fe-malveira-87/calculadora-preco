import { useSignIn } from '@clerk/clerk-react'

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" style={{ marginRight: 10, verticalAlign: 'middle', flexShrink: 0 }}>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
)

export default function Login() {
  const { signIn, isLoaded } = useSignIn()
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  async function handleGoogle() {
    if (!signIn) return
    await signIn.authenticateWithRedirect({
      strategy: 'oauth_google',
      redirectUrl: `${origin}/sso-callback`,
      redirectUrlComplete: `${origin}/`,
    })
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--wecare-light)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, boxShadow: 'var(--shadow-hover)',
        padding: '3rem 2.5rem', maxWidth: 420, width: '100%', textAlign: 'center',
      }}>
        <img
          src="/logo.png"
          alt="WeCare"
          style={{ width: 180, marginBottom: '1rem' }}
          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }}
        />
        <p style={{ display: 'none', fontWeight: 700, color: 'var(--wecare-red)', fontSize: '1.4em', marginBottom: '0.5rem' }}>
          WeCare
        </p>

        <p style={{ color: 'var(--wecare-gray)', marginBottom: '2.5rem', fontSize: '0.95em' }}>
          Alta tecnologia para ser simples
        </p>

        <button
          type="button"
          disabled={!isLoaded}
          onClick={() => void handleGoogle()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '100%', padding: '0.85rem',
            background: isLoaded ? 'var(--wecare-red)' : 'var(--wecare-gray)',
            color: '#fff', border: 'none', borderRadius: 'var(--radius)',
            fontFamily: 'var(--font-main)', fontWeight: 600, fontSize: '1em',
            cursor: isLoaded ? 'pointer' : 'not-allowed', transition: 'background 0.2s',
          }}
          onMouseOver={(e) => { if (isLoaded) e.currentTarget.style.background = 'var(--wecare-orange)' }}
          onMouseOut={(e) => { if (isLoaded) e.currentTarget.style.background = 'var(--wecare-red)' }}
        >
          <GoogleIcon />
          {isLoaded ? 'Entrar com Google' : 'Carregando…'}
        </button>

        <p style={{ marginTop: '1.5rem', fontSize: '0.8em', color: 'var(--wecare-gray)' }}>
          Acesso restrito a contas @wecarehosting.com.br
        </p>
      </div>
    </div>
  )
}
