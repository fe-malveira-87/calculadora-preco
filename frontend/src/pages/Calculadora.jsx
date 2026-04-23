import { useEffect } from 'react'
import Header from '../components/Header'
import MetricCard from '../components/MetricCard'
import Sidebar from '../components/Sidebar'
import { useCalculadora } from '../hooks/useCalculadora'

const fmt = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`

export default function Calculadora() {
  const { listings, loadingListings, resultado, loadingCalculo, erro, fetchListings, calcular } = useCalculadora()

  useEffect(() => {
    fetchListings()
  }, [fetchListings])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar listings={listings || []} onCalcular={calcular} loading={loadingCalculo || loadingListings} />

        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          {erro && (
            <div style={{
              background: '#fff3cd', border: '1px solid var(--wecare-yellow)',
              borderRadius: 'var(--radius)', padding: '0.75rem 1rem',
              marginBottom: '1.5rem', color: '#856404', fontSize: '0.9em',
            }}>
              {erro}
            </div>
          )}

          {!resultado ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '60vh',
              color: 'var(--wecare-gray)', textAlign: 'center',
            }}>
              <p style={{ fontSize: '1.1em' }}>Preencha os dados ao lado e clique em Calcular</p>
            </div>
          ) : (
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
