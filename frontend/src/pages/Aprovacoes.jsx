import { useAuth } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { aprovar, getAprovacoes, getMe, rejeitar } from '../services/api'

const fmt = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`

const fmtDate = (iso) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

function urgencyColor(iso) {
  const diffDias = (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)
  if (diffDias > 2) return 'var(--wecare-red)'
  if (diffDias > 1) return 'var(--wecare-yellow)'
  return 'var(--wecare-gray)'
}

export default function Aprovacoes() {
  const { getToken } = useAuth()
  const navigate = useNavigate()

  const [aprovacoes, setAprovacoes] = useState([])
  const [selecionada, setSelecionada] = useState(null)
  const [loading, setLoading] = useState(false)
  const [acao, setAcao] = useState(null)
  const [observacao, setObservacao] = useState('')
  const [showRejeitar, setShowRejeitar] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState(null)
  const [role, setRole] = useState(null)

  useEffect(() => {
    getMe(getToken)
      .then((me) => {
        setRole(me.role)
        if (me.role === 'atendente') {
          navigate('/', { replace: true })
        }
      })
      .catch(() => navigate('/', { replace: true }))
  }, [getToken, navigate])

  useEffect(() => {
    if (role && role !== 'atendente') {
      setLoading(true)
      getAprovacoes(getToken)
        .then((data) => setAprovacoes(Array.isArray(data) ? data : data.items ?? []))
        .catch((e) => setErro(e.message || 'Erro ao carregar aprovações'))
        .finally(() => setLoading(false))
    }
  }, [role, getToken])

  async function handleAprovar() {
    if (!selecionada) return
    setAcao('aprovando')
    setErro(null)
    try {
      await aprovar(selecionada.id, observacao, getToken)
      setAprovacoes((prev) => prev.filter((a) => a.id !== selecionada.id))
      setSelecionada(null)
      setObservacao('')
    } catch (e) {
      setErro(e.message || 'Erro ao aprovar')
    } finally {
      setAcao(null)
    }
  }

  async function handleRejeitar() {
    if (!selecionada || !motivo.trim()) return
    setAcao('rejeitando')
    setErro(null)
    try {
      await rejeitar(selecionada.id, motivo, getToken)
      setAprovacoes((prev) => prev.filter((a) => a.id !== selecionada.id))
      setSelecionada(null)
      setMotivo('')
      setShowRejeitar(false)
    } catch (e) {
      setErro(e.message || 'Erro ao rejeitar')
    } finally {
      setAcao(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Lista */}
        <aside style={{
          width: '40%', minWidth: 280, borderRight: '1px solid #e5e7eb',
          overflowY: 'auto', padding: '1.5rem 1rem',
          background: 'var(--wecare-light)',
        }}>
          <h2 style={{ fontSize: '1.1em', fontWeight: 700, marginBottom: '1rem', color: 'var(--wecare-dark)' }}>
            Aprovações pendentes
          </h2>

          {loading && (
            <p style={{ color: 'var(--wecare-gray)', fontSize: '0.9em' }}>Carregando…</p>
          )}

          {!loading && aprovacoes.length === 0 && (
            <p style={{ color: 'var(--wecare-gray)', fontSize: '0.9em' }}>
              Nenhuma aprovação pendente.
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {aprovacoes.map((ap) => {
              const ativa = selecionada?.id === ap.id
              return (
                <div
                  key={ap.id}
                  onClick={() => { setSelecionada(ap); setObservacao(''); setErro(null) }}
                  style={{
                    background: '#fff',
                    borderRadius: 'var(--radius)',
                    boxShadow: ativa ? '0 0 0 2px var(--wecare-teal)' : 'var(--shadow)',
                    borderLeft: `4px solid ${urgencyColor(ap.criado_em ?? ap.created_at ?? new Date().toISOString())}`,
                    padding: '0.9rem 1rem',
                    cursor: 'pointer',
                    transition: 'box-shadow 0.15s',
                  }}
                >
                  <p style={{ fontWeight: 600, fontSize: '0.95em', marginBottom: '0.2rem', color: 'var(--wecare-dark)' }}>
                    {ap.listing_nome || ap.listing_id}
                  </p>
                  <p style={{ fontSize: '0.82em', color: 'var(--wecare-gray)', marginBottom: '0.3rem' }}>
                    {ap.solicitante_nome ?? ap.solicitante_email ?? 'Atendente'}
                  </p>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85em' }}>
                    <span style={{ color: 'var(--wecare-teal)', fontWeight: 600 }}>
                      -{ap.desconto_percentual ?? 0}%
                    </span>
                    <span style={{ color: 'var(--wecare-dark)' }}>
                      {fmt(ap.preco_sugerido)}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78em', color: 'var(--wecare-gray)', marginTop: '0.3rem' }}>
                    {fmtDate(ap.criado_em ?? ap.created_at ?? new Date().toISOString())}
                  </p>
                </div>
              )
            })}
          </div>
        </aside>

        {/* Detalhe */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
          {!selecionada ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '60vh', color: 'var(--wecare-gray)', fontSize: '1em',
            }}>
              Selecione uma solicitação para ver os detalhes
            </div>
          ) : (
            <div style={{
              background: '#fff', borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow)', padding: '1.5rem',
              maxWidth: 680,
            }}>
              <h3 style={{ fontWeight: 700, fontSize: '1.1em', marginBottom: '1.25rem', color: 'var(--wecare-dark)' }}>
                Solicitação #{selecionada.id}
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem', marginBottom: '1.25rem' }}>
                <Campo label="Imóvel" value={selecionada.listing_nome || selecionada.listing_id} />
                <Campo label="Atendente" value={selecionada.solicitante_nome ?? selecionada.solicitante_email ?? '—'} />
                <Campo label="Diária atual" value={fmt(selecionada.diaria_atual)} />
                <Campo label="Repasse mínimo" value={fmt(selecionada.repasse_minimo)} />
                <Campo label="Desconto sugerido" value={`${selecionada.desconto_percentual ?? 0}%`} destaque />
                <Campo label="Preço sugerido" value={fmt(selecionada.preco_sugerido)} destaque />
                <Campo label="Repasse resultante" value={fmt(selecionada.repasse_resultante)} />
                <Campo label="Data da solicitação" value={fmtDate(selecionada.criado_em ?? selecionada.created_at ?? new Date().toISOString())} />
              </div>

              {selecionada.alertas?.length > 0 && (
                <div style={{
                  background: '#fff3cd', border: '1px solid var(--wecare-yellow)',
                  borderRadius: 'var(--radius)', padding: '0.75rem 1rem', marginBottom: '1rem',
                }}>
                  {selecionada.alertas.map((a, i) => (
                    <p key={i} style={{ color: '#856404', fontSize: '0.87em', marginBottom: i < selecionada.alertas.length - 1 ? '0.25rem' : 0 }}>
                      ⚠ {a}
                    </p>
                  ))}
                </div>
              )}

              {selecionada.regras_aplicadas?.length > 0 && (
                <details style={{ marginBottom: '1.25rem' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.9em', color: 'var(--wecare-dark)' }}>
                    Regras aplicadas ({selecionada.regras_aplicadas.length})
                  </summary>
                  <ul style={{ marginTop: '0.5rem', paddingLeft: '1.2rem' }}>
                    {selecionada.regras_aplicadas.map((r, i) => (
                      <li key={i} style={{ fontSize: '0.85em', color: 'var(--wecare-gray)', marginBottom: '0.2rem' }}>{r}</li>
                    ))}
                  </ul>
                </details>
              )}

              {/* Observação para aprovação */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.88em', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--wecare-dark)' }}>
                  Observação (opcional)
                </label>
                <textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={2}
                  placeholder="Observação para o atendente…"
                  style={{
                    width: '100%', borderRadius: 'var(--radius)',
                    border: '1px solid #d1d5db', padding: '0.5rem 0.75rem',
                    fontSize: '0.88em', fontFamily: 'var(--font-main)',
                    resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
              </div>

              {erro && (
                <p style={{ color: 'var(--wecare-red)', fontSize: '0.85em', marginBottom: '0.75rem' }}>{erro}</p>
              )}

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={handleAprovar}
                  disabled={acao !== null}
                  style={{
                    background: acao !== null ? 'var(--wecare-gray)' : 'var(--wecare-teal)',
                    color: '#fff', border: 'none',
                    borderRadius: 'var(--radius)', padding: '0.5rem 1.4rem',
                    fontSize: '0.95em', fontWeight: 600,
                    cursor: acao !== null ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-main)',
                  }}
                >
                  {acao === 'aprovando' ? 'Aprovando…' : 'Aprovar'}
                </button>
                <button
                  onClick={() => { setShowRejeitar(true); setMotivo(''); setErro(null) }}
                  disabled={acao !== null}
                  style={{
                    background: acao !== null ? 'var(--wecare-gray)' : 'var(--wecare-red)',
                    color: '#fff', border: 'none',
                    borderRadius: 'var(--radius)', padding: '0.5rem 1.4rem',
                    fontSize: '0.95em', fontWeight: 600,
                    cursor: acao !== null ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-main)',
                  }}
                >
                  Rejeitar
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal de rejeição */}
      {showRejeitar && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200,
        }}>
          <div style={{
            background: '#fff', borderRadius: 'var(--radius)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            padding: '2rem', width: '100%', maxWidth: 440,
          }}>
            <h3 style={{ fontWeight: 700, fontSize: '1.05em', marginBottom: '1rem', color: 'var(--wecare-dark)' }}>
              Rejeitar solicitação
            </h3>
            <label style={{ display: 'block', fontSize: '0.88em', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--wecare-dark)' }}>
              Motivo <span style={{ color: 'var(--wecare-red)' }}>*</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
              placeholder="Informe o motivo da rejeição…"
              autoFocus
              style={{
                width: '100%', borderRadius: 'var(--radius)',
                border: '1px solid #d1d5db', padding: '0.5rem 0.75rem',
                fontSize: '0.88em', fontFamily: 'var(--font-main)',
                resize: 'vertical', boxSizing: 'border-box', marginBottom: '1rem',
              }}
            />
            {erro && (
              <p style={{ color: 'var(--wecare-red)', fontSize: '0.85em', marginBottom: '0.75rem' }}>{erro}</p>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowRejeitar(false); setMotivo(''); setErro(null) }}
                disabled={acao !== null}
                style={{
                  background: 'none', border: '1px solid var(--wecare-gray)',
                  borderRadius: 'var(--radius)', padding: '0.45rem 1.2rem',
                  fontSize: '0.9em', cursor: 'pointer', fontFamily: 'var(--font-main)',
                  color: 'var(--wecare-gray)',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleRejeitar}
                disabled={acao !== null || !motivo.trim()}
                style={{
                  background: acao !== null || !motivo.trim() ? 'var(--wecare-gray)' : 'var(--wecare-red)',
                  color: '#fff', border: 'none',
                  borderRadius: 'var(--radius)', padding: '0.45rem 1.2rem',
                  fontSize: '0.9em', fontWeight: 600,
                  cursor: acao !== null || !motivo.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-main)',
                }}
              >
                {acao === 'rejeitando' ? 'Rejeitando…' : 'Confirmar rejeição'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Campo({ label, value, destaque }) {
  return (
    <div>
      <p style={{ fontSize: '0.78em', color: 'var(--wecare-gray)', marginBottom: '0.1rem', fontWeight: 500 }}>
        {label}
      </p>
      <p style={{
        fontSize: '0.95em', fontWeight: destaque ? 700 : 500,
        color: destaque ? 'var(--wecare-teal)' : 'var(--wecare-dark)',
      }}>
        {value}
      </p>
    </div>
  )
}
