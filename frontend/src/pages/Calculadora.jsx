import { useAuth } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import Header from '../components/Header'
import MetricCard from '../components/MetricCard'
import Sidebar from '../components/Sidebar'
import { useCalculadora } from '../hooks/useCalculadora'
import { getMe, solicitarAprovacao } from '../services/api'

const fmt = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`

export default function Calculadora() {
  const { getToken } = useAuth()
  const { listings, loadingListings, resultado, loadingCalculo, erro, fetchListings, calcular } = useCalculadora()

  const [role, setRole] = useState(null)
  const [solicitacaoId, setSolicitacaoId] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [erroSolicitar, setErroSolicitar] = useState(null)

  useEffect(() => {
    fetchListings()
    getMe(getToken).then((me) => setRole(me.role)).catch(() => {})
  }, [fetchListings, getToken])

  async function handleCalcular(payload) {
    setSolicitacaoId(null)
    setErroSolicitar(null)

    if (role === 'atendente') {
      setEnviando(true)
      try {
        const res = await solicitarAprovacao(payload, getToken)
        setSolicitacaoId(res.id)
      } catch (e) {
        setErroSolicitar(e.message || 'Erro ao enviar solicitação')
      } finally {
        setEnviando(false)
      }
    } else {
      calcular(payload)
    }
  }

  const isAtendente = role === 'atendente'
  const isLoading = loadingCalculo || loadingListings || enviando

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar
          listings={listings || []}
          onCalcular={handleCalcular}
          loading={isLoading}
          submitLabel={isAtendente ? 'Solicitar desconto' : 'Calcular desconto'}
        />
        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>

          {/* Erro de cálculo (admin/aprovador) */}
          {erro && !isAtendente && (
            <div style={{
              background: '#fff3cd', border: '1px solid var(--wecare-yellow)',
              borderRadius: 'var(--radius)', padding: '0.75rem 1rem',
              marginBottom: '1.5rem', color: '#856404', fontSize: '0.9em',
            }}>
              {erro}
            </div>
          )}

          {/* Erro de solicitação (atendente) */}
          {erroSolicitar && (
            <div style={{
              background: '#fff3cd', border: '1px solid var(--wecare-yellow)',
              borderRadius: 'var(--radius)', padding: '0.75rem 1rem',
              marginBottom: '1.5rem', color: '#856404', fontSize: '0.9em',
            }}>
              {erroSolicitar}
            </div>
          )}

          {/* Confirmação de solicitação enviada (atendente) */}
          {isAtendente && solicitacaoId && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '1rem',
              background: '#f0fdf4', border: '1px solid #86efac',
              borderRadius: 'var(--radius)', padding: '2.5rem 2rem',
              textAlign: 'center',
            }}>
              <span style={{ fontSize: '2.5em' }}>✓</span>
              <p style={{ fontWeight: 700, fontSize: '1.1em', color: '#15803d' }}>
                Solicitação enviada para aprovação
              </p>
              <p style={{ fontFamily: 'monospace', fontSize: '0.85em', color: 'var(--wecare-gray)' }}>
                #{solicitacaoId}
              </p>
              <p style={{ fontSize: '0.9em', color: 'var(--wecare-gray)' }}>
                Aguarde o retorno do aprovador. Você pode acompanhar em Aprovações.
              </p>
            </div>
          )}

          {/* Empty state atendente */}
          {isAtendente && !solicitacaoId && !enviando && !erroSolicitar && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '60vh',
              color: 'var(--wecare-gray)', textAlign: 'center',
            }}>
              <p style={{ fontSize: '1.1em' }}>Preencha os dados ao lado e clique em Solicitar desconto</p>
              <p style={{ fontSize: '0.85em', marginTop: '0.5rem' }}>
                Sua solicitação será enviada para aprovação
              </p>
            </div>
          )}

          {/* Resultado admin/aprovador */}
          {!isAtendente && !resultado && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '60vh',
              color: 'var(--wecare-gray)', textAlign: 'center',
            }}>
              <p style={{ fontSize: '1.1em' }}>Preencha os dados ao lado e clique em Calcular</p>
            </div>
          )}

          {!isAtendente && resultado && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <MetricCard title="Diária atual" value={fmt(resultado.diaria_atual)} />
                <MetricCard title="Desconto sugerido" value={`${resultado.desconto_percentual ?? 0}%`} highlight />
                <MetricCard title="Preço sugerido" value={fmt(resultado.preco_sugerido)} highlight />
                <MetricCard title="Repasse resultante" value={fmt(resultado.repasse_resultante)} />
              </div>

              {resultado.alertas?.length > 0 && (
                <div style={{
                  background: '#fff3cd', border: '1px solid var(--wecare-yellow)',
                  borderRadius: 'var(--radius)', padding: '1rem 1.2rem',
                }}>
                  {resultado.alertas.map((a, i) => (
                    <p key={i} style={{ color: '#856404', fontSize: '0.9em', marginBottom: i < resultado.alertas.length - 1 ? '0.3rem' : 0 }}>
                      ⚠ {a}
                    </p>
                  ))}
                </div>
              )}

              {resultado.regras_aplicadas?.length > 0 && (
                <details style={{
                  background: '#fff', borderRadius: 'var(--radius)',
                  boxShadow: 'var(--shadow)', padding: '1rem 1.2rem',
                }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--wecare-dark)' }}>
                    Regras aplicadas
                  </summary>
                  <ul style={{ marginTop: '0.8rem', paddingLeft: '1.2rem' }}>
                    {resultado.regras_aplicadas.map((r, i) => (
                      <li key={i} style={{ fontSize: '0.9em', color: 'var(--wecare-gray)', marginBottom: '0.3rem' }}>{r}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
