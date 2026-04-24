import { useAuth } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import Header from '../components/Header'
import MetricCard from '../components/MetricCard'
import Sidebar from '../components/Sidebar'
import { useCalculadora } from '../hooks/useCalculadora'
import { analisarIA, getMe, solicitarAprovacao } from '../services/api'

const fmt = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`
const fmtDate = (iso) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR') : '-')

const CATEGORIA_META = {
  repasse:         { icon: '🏠', cor: 'var(--wecare-teal)',   bg: '#f0fdfa' },
  demanda:         { icon: '📊', cor: 'var(--wecare-orange)', bg: '#fff7ed' },
  disponibilidade: { icon: '📅', cor: '#3b82f6',              bg: '#eff6ff' },
  combinada:       { icon: '🔗', cor: '#8b5cf6',              bg: '#f5f3ff' },
}
const META_DEFAULT = { icon: '📌', cor: 'var(--wecare-gray)', bg: '#f3f4f6' }

function parseRegra(texto) {
  const match = texto.match(/^\[([^\]]+)\]\s*(.+)$/)
  if (!match) return { categoria: 'geral', descricao: texto }
  return { categoria: match[1].toLowerCase().trim(), descricao: match[2].trim() }
}

const PULSE_STYLE = `
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`

const MENSAGENS_LOADING = [
  'Consultando disponibilidade no Hostaway...',
  'Buscando reservas do período...',
  'Analisando dados do PriceLabs...',
  'Calculando desconto ideal...',
]

function SkeletonBlock({ height = 80 }) {
  return (
    <div style={{
      background: '#e5e7eb',
      borderRadius: 'var(--radius)',
      height,
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  )
}

function SectionTitle({ children }) {
  return (
    <p style={{
      fontWeight: 600, fontSize: '0.85em',
      color: 'var(--wecare-gray)', textTransform: 'uppercase',
      letterSpacing: '0.06em', marginBottom: '0.75rem',
    }}>
      {children}
    </p>
  )
}

function SmallCard({ title, value, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow)', padding: '0.9rem 1.1rem',
    }}>
      <p style={{
        fontSize: '0.72em', fontWeight: 600, color: 'var(--wecare-gray)',
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem',
      }}>
        {title}
      </p>
      <p style={{ fontSize: '1.15em', fontWeight: 700, color: color || 'var(--wecare-dark)' }}>
        {value}
      </p>
    </div>
  )
}

export default function Calculadora() {
  const { getToken } = useAuth()
  const { listings, loadingListings, resultado, loadingCalculo, erro, fetchListings, calcular } = useCalculadora()

  const [role, setRole] = useState(null)
  const [solicitacaoId, setSolicitacaoId] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [erroSolicitar, setErroSolicitar] = useState(null)
  const [lastPayload, setLastPayload] = useState(null)
  const [iaAnalise, setIaAnalise] = useState(null)
  const [iaLoading, setIaLoading] = useState(false)
  const [iaErro, setIaErro] = useState(null)
  const [msgIdx, setMsgIdx] = useState(0)

  useEffect(() => {
    if (!loadingCalculo) { setMsgIdx(0); return }
    const id = setInterval(() => setMsgIdx((i) => (i + 1) % MENSAGENS_LOADING.length), 2000)
    return () => clearInterval(id)
  }, [loadingCalculo])

  useEffect(() => {
    fetchListings()
    getMe(getToken).then((me) => setRole(me.role)).catch(() => {})
  }, [fetchListings, getToken])

  async function handleCalcular(payload) {
    setSolicitacaoId(null)
    setErroSolicitar(null)
    setIaAnalise(null)
    setIaErro(null)
    setLastPayload(payload)

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

  async function handleAnalisarIA() {
    if (!resultado || !lastPayload) return
    setIaLoading(true)
    setIaErro(null)
    setIaAnalise(null)
    try {
      const payload = {
        nome_imovel: lastPayload.nome || '',
        data_inicio: lastPayload.data_inicio || '',
        data_fim: lastPayload.data_fim || '',
        diaria_atual: resultado.diaria_atual ?? lastPayload.diaria_atual ?? 0,
        desconto_percentual: resultado.desconto_percentual ?? 0,
        preco_sugerido: resultado.preco_sugerido ?? 0,
        repasse_minimo: lastPayload.repasse_minimo ?? 0,
        repasse_resultante: resultado.repasse_resultante ?? 0,
        regra_determinante: resultado.regra_determinante ?? '',
        regras_aplicadas: resultado.regras_aplicadas ?? [],
        periodo: resultado.periodo ?? null,
        listing_id: lastPayload.listing_id ?? '',
      }
      const data = await analisarIA(payload, getToken)
      if (data.analise) {
        setIaAnalise(data.analise)
      } else {
        setIaErro(data.erro || 'Erro desconhecido ao consultar IA')
      }
    } catch (e) {
      setIaErro(e.message || 'Erro ao conectar com IA')
    } finally {
      setIaLoading(false)
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

          {erro && !isAtendente && (
            <div style={{
              background: '#fff3cd', border: '1px solid var(--wecare-yellow)',
              borderRadius: 'var(--radius)', padding: '0.75rem 1rem',
              marginBottom: '1.5rem', color: '#856404', fontSize: '0.9em',
            }}>
              {erro}
            </div>
          )}

          {erroSolicitar && (
            <div style={{
              background: '#fff3cd', border: '1px solid var(--wecare-yellow)',
              borderRadius: 'var(--radius)', padding: '0.75rem 1rem',
              marginBottom: '1.5rem', color: '#856404', fontSize: '0.9em',
            }}>
              {erroSolicitar}
            </div>
          )}

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

          {!isAtendente && loadingCalculo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              <style>{PULSE_STYLE}</style>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <SkeletonBlock height={90} />
                <SkeletonBlock height={90} />
                <SkeletonBlock height={90} />
                <SkeletonBlock height={90} />
              </div>
              <p style={{
                fontWeight: 600, fontSize: '0.85em',
                color: 'var(--wecare-gray)', textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                Carregando dados do imóvel...
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                <SkeletonBlock height={70} />
                <SkeletonBlock height={70} />
                <SkeletonBlock height={70} />
                <SkeletonBlock height={70} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                <SkeletonBlock height={70} />
                <SkeletonBlock height={70} />
                <SkeletonBlock height={70} />
              </div>
              <SkeletonBlock height={140} />
              <p style={{ textAlign: 'center', color: 'var(--wecare-gray)', fontSize: '0.88em' }}>
                {MENSAGENS_LOADING[msgIdx]}
              </p>
            </div>
          )}

          {!isAtendente && !resultado && !loadingCalculo && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '60vh',
              color: 'var(--wecare-gray)', textAlign: 'center',
            }}>
              <p style={{ fontSize: '1.1em' }}>Preencha os dados ao lado e clique em Calcular</p>
            </div>
          )}

          {!isAtendente && resultado && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

              {/* 1. Cards principais */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <MetricCard title="Diária atual" value={fmt(resultado.diaria_atual)} />
                <MetricCard title="Desconto sugerido" value={`${resultado.desconto_percentual ?? 0}%`} highlight />
                <MetricCard title="Preço sugerido" value={fmt(resultado.preco_sugerido)} highlight />
                <MetricCard title="Repasse resultante" value={fmt(resultado.repasse_resultante)} />
              </div>

              {/* Alertas */}
              {resultado.alertas?.length > 0 && (
                <div style={{
                  background: '#fff3cd', border: '1px solid var(--wecare-yellow)',
                  borderRadius: 'var(--radius)', padding: '1rem 1.2rem',
                }}>
                  {resultado.alertas.map((a, i) => (
                    <p key={i} style={{
                      color: '#856404', fontSize: '0.9em',
                      marginBottom: i < resultado.alertas.length - 1 ? '0.3rem' : 0,
                    }}>
                      ⚠ {a}
                    </p>
                  ))}
                </div>
              )}

              {/* 2. Ocupação do período */}
              {resultado.periodo && (
                <section>
                  <SectionTitle>Ocupação do período</SectionTitle>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                    <SmallCard title="Total de noites" value={resultado.periodo.total_noites} />
                    <SmallCard
                      title="Noites livres"
                      value={resultado.periodo.noites_livres}
                      color="var(--wecare-teal)"
                    />
                    <SmallCard
                      title="Noites ocupadas"
                      value={resultado.periodo.noites_ocupadas}
                      color="var(--wecare-red)"
                    />
                    <SmallCard
                      title="Taxa de ocupação"
                      value={`${resultado.periodo.taxa_ocupacao}%`}
                      color={
                        resultado.periodo.taxa_ocupacao >= 70 ? 'var(--wecare-teal)' :
                        resultado.periodo.taxa_ocupacao >= 40 ? 'var(--wecare-orange)' :
                        'var(--wecare-red)'
                      }
                    />
                  </div>
                </section>
              )}

              {/* 3. Custos operacionais */}
              {resultado.custos && (
                <section>
                  <SectionTitle>Custos operacionais</SectionTitle>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                    <SmallCard title="Taxa de limpeza" value={fmt(resultado.custos.taxa_limpeza)} />
                    <SmallCard title="Comissão canal %" value={`${resultado.custos.comissao_canal_percent}%`} />
                    <SmallCard title="Comissão canal R$" value={fmt(resultado.custos.comissao_canal_valor)} />
                  </div>
                </section>
              )}

              {/* 4. Reservas no período */}
              {resultado.reservas != null && (
                <section>
                  <SectionTitle>Reservas no período</SectionTitle>
                  {resultado.reservas.length === 0 ? (
                    <p style={{ color: 'var(--wecare-gray)', fontSize: '0.9em' }}>
                      Nenhuma reserva no período
                    </p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{
                        width: '100%', borderCollapse: 'collapse',
                        background: '#fff', borderRadius: 'var(--radius)',
                        boxShadow: 'var(--shadow)', fontSize: '0.85em',
                      }}>
                        <thead>
                          <tr style={{ background: 'var(--wecare-light)' }}>
                            {['Canal', 'Check-in', 'Check-out', 'Noites', 'Total', 'Limpeza', 'Taxa canal', 'Repasse host', 'Diária média'].map((h) => (
                              <th key={h} style={{
                                padding: '0.6rem 0.9rem', textAlign: 'left',
                                fontSize: '0.75em', fontWeight: 600,
                                color: 'var(--wecare-gray)', textTransform: 'uppercase',
                                letterSpacing: '0.04em', whiteSpace: 'nowrap',
                                borderBottom: '1px solid #e5e7eb',
                              }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {resultado.reservas.map((r, i) => (
                            <tr
                              key={i}
                              style={{ borderBottom: i < resultado.reservas.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                            >
                              <td style={{ padding: '0.6rem 0.9rem', fontWeight: 600, color: 'var(--wecare-dark)' }}>{r.canal || '-'}</td>
                              <td style={{ padding: '0.6rem 0.9rem', color: 'var(--wecare-gray)', whiteSpace: 'nowrap' }}>{fmtDate(r.check_in)}</td>
                              <td style={{ padding: '0.6rem 0.9rem', color: 'var(--wecare-gray)', whiteSpace: 'nowrap' }}>{fmtDate(r.check_out)}</td>
                              <td style={{ padding: '0.6rem 0.9rem', color: 'var(--wecare-dark)' }}>{r.noites}</td>
                              <td style={{ padding: '0.6rem 0.9rem', color: 'var(--wecare-dark)' }}>{fmt(r.total)}</td>
                              <td style={{ padding: '0.6rem 0.9rem', color: 'var(--wecare-gray)' }}>{fmt(r.taxa_limpeza)}</td>
                              <td style={{ padding: '0.6rem 0.9rem', color: 'var(--wecare-gray)' }}>{fmt(r.taxa_canal)}</td>
                              <td style={{ padding: '0.6rem 0.9rem', fontWeight: 600, color: 'var(--wecare-teal)' }}>{fmt(r.repasse_host)}</td>
                              <td style={{ padding: '0.6rem 0.9rem', color: 'var(--wecare-dark)' }}>{fmt(r.diaria_media)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {/* 5. Regras aplicadas */}
              {resultado.regras_aplicadas?.length > 0 && (
                <section>
                  <SectionTitle>Regras aplicadas ({resultado.regras_aplicadas.length})</SectionTitle>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {resultado.regras_aplicadas.map((r, i) => {
                      const { categoria, descricao } = parseRegra(r)
                      const meta = CATEGORIA_META[categoria] || META_DEFAULT
                      const isDeterminante = categoria === resultado.regra_determinante
                      return (
                        <div key={i} style={{
                          background: '#fff', borderRadius: 'var(--radius)',
                          boxShadow: 'var(--shadow)', padding: '0.65rem 1rem',
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                        }}>
                          <span style={{
                            background: meta.bg, color: meta.cor,
                            borderRadius: 8, padding: '2px 10px',
                            fontSize: '0.75em', fontWeight: 700,
                            whiteSpace: 'nowrap', flexShrink: 0,
                          }}>
                            {meta.icon} {categoria}
                          </span>
                          {isDeterminante && (
                            <span style={{
                              background: 'var(--wecare-red)', color: '#fff',
                              borderRadius: 8, padding: '2px 10px',
                              fontSize: '0.75em', fontWeight: 700,
                              whiteSpace: 'nowrap', flexShrink: 0,
                            }}>
                              ✓ determinou o desconto
                            </span>
                          )}
                          <span style={{ fontSize: '0.88em', color: 'var(--wecare-dark)' }}>
                            {descricao}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* 6. Análise IA */}
              {resultado && (
                <section>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <SectionTitle>Análise com IA</SectionTitle>
                  </div>
                  {!iaAnalise && (
                    <button
                      onClick={handleAnalisarIA}
                      disabled={iaLoading}
                      style={{
                        background: iaLoading ? 'var(--wecare-gray)' : 'var(--wecare-teal)',
                        color: '#fff', border: 'none', borderRadius: 'var(--radius)',
                        padding: '0.55rem 1.25rem', fontWeight: 700, fontSize: '0.9em',
                        cursor: iaLoading ? 'not-allowed' : 'pointer', display: 'flex',
                        alignItems: 'center', gap: '0.4rem',
                      }}
                    >
                      {iaLoading ? 'Consultando IA...' : '✨ Analisar com IA'}
                    </button>
                  )}
                  {iaErro && (
                    <div style={{
                      background: '#fff3cd', border: '1px solid var(--wecare-yellow)',
                      borderRadius: 'var(--radius)', padding: '0.75rem 1rem',
                      color: '#856404', fontSize: '0.88em', marginTop: '0.5rem',
                    }}>
                      {iaErro}
                    </div>
                  )}
                  {iaAnalise && (
                    <div style={{
                      background: '#f0fdfa', border: '1px solid var(--wecare-teal)',
                      borderRadius: 'var(--radius)', padding: '1rem 1.25rem',
                      marginTop: '0.5rem',
                    }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: '0.75rem',
                      }}>
                        <span style={{ fontWeight: 700, color: 'var(--wecare-teal)', fontSize: '0.85em' }}>
                          ✨ Análise da IA
                        </span>
                        <button
                          onClick={handleAnalisarIA}
                          disabled={iaLoading}
                          style={{
                            background: 'transparent', border: '1px solid var(--wecare-teal)',
                            borderRadius: 6, padding: '2px 10px', fontSize: '0.75em',
                            color: 'var(--wecare-teal)', cursor: 'pointer', fontWeight: 600,
                          }}
                        >
                          {iaLoading ? '...' : 'Regenerar'}
                        </button>
                      </div>
                      <div
                        style={{ fontSize: '0.9em', color: 'var(--wecare-dark)', lineHeight: 1.65 }}
                        dangerouslySetInnerHTML={{
                          __html: typeof window !== 'undefined' && window.marked
                            ? window.marked.parse(iaAnalise)
                            : iaAnalise.replace(/\n/g, '<br/>')
                        }}
                      />
                    </div>
                  )}
                </section>
              )}

            </div>
          )}

        </main>
      </div>
    </div>
  )
}
