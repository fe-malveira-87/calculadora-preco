import { ClerkProvider } from '@clerk/clerk-react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles/tokens.css'

const fromVite = String(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim()
const fromRuntime =
  typeof window !== 'undefined' && window.__CLERK_PUBLISHABLE_KEY__
    ? String(window.__CLERK_PUBLISHABLE_KEY__).trim()
    : ''
const clerkKey = fromVite || fromRuntime

function MissingClerkEnv() {
  return (
    <div style={{
      display: 'flex', minHeight: '100vh', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12,
      padding: '0 1.5rem', textAlign: 'center',
      fontFamily: 'var(--font-main)', fontSize: '0.9em', color: 'var(--wecare-gray)',
    }}>
      <p style={{ maxWidth: 480 }}>
        Configure a chave publicável do Clerk: em desenvolvimento use{' '}
        <code>VITE_CLERK_PUBLISHABLE_KEY</code> no <code>.env</code>, ou em produção defina{' '}
        <code>CLERK_PUBLISHABLE_KEY</code> no serviço backend (carregada via{' '}
        <code>/clerk-frontend-config.js</code>). Reinicie o servidor.
      </p>
    </div>
  )
}

const root = createRoot(document.getElementById('root'))

root.render(
  <StrictMode>
    {clerkKey ? (
      <ClerkProvider
        publishableKey={clerkKey}
        signInUrl="/entrar"
        signUpUrl="/entrar"
        afterSignInUrl="/"
        afterSignUpUrl="/"
      >
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ClerkProvider>
    ) : (
      <MissingClerkEnv />
    )}
  </StrictMode>
)
