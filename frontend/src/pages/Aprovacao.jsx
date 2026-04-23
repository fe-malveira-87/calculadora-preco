import { useAuth } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import Header from '../components/Header'
import {
  aprovarSolicitacao,
  getAuditoriaAprovacao,
  getFilaAprovacao,
  getHistoricoAprovacao,
  getMe,
  rejeitarSolicitacao,
} from '../services/api'

const fmt = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`
const fmtDate = (iso) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

const STATUS_BADGE = {
  pendente:  { bg: '#fef3c7', color: '#92400e', label: 'pendente' },
  aprovado:  { bg: '#d1fae5', color: '#065f46', label: 'aprovado' },
  rejeitado: { bg: '#fee2e2', color: '#991b1b', label: 'rejeitado' },
}

function Badge({ status }) {
  const s = STATUS_BADGE[status] || STATUS_BADGE.pendente
  return (
    <span style={{
      background: s.bg, color: s.color,
      borderRadius: 10, padding: '2px 10px',
      fontSize: '0.75em', fontWeight: 700,
    }}>
      {s.label}
    </span>
  )
}

export default function Aprovacao() {
  const { getToken } = useAuth()

  const [tab, setTab] = useState('fila')
  const [role, setRole] = useState(null)
  const [fila, setFila] = useState([])
  const [historico, setHistorico] = useState([])
  const [auditoria, setAuditoria] = useState([])
  const [selecionada, setSelecionada] = useState(null)
  const [loading, setLoading] = useState(false)
  const [acao, setAcao] = useState(null)
  const [comentario, setComentario] = useState('')
  const [showRejeitar, setShowRejeitar] = useState(false)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(null)

  useEffect(() => {
    getMe(getToken).then((me) => setRole(me.role)).catch(() => {})
  }, [getToken])

  useEffect(() => {
    if (!role) return
    loadTab(tab)
  }, [tab, role])

  async function loadTab(t) {
    setLoading(true)
    setErro(null)
    try {
      if (t === 'fila') {
        const data = await getFilaAprovacao(getToken)
        setFila(data)
      } else if (t === 'historico') {
        const data = await getHistoricoAprovacao(getToken)
        setHistorico(data)
      } else if (t === 'auditoria' && role === 'admin') {
        const data = await getAuditoriaAprovacao(getToken)
        setAuditoria(data)
      }
    } catch (e) {
      setErro(e.message || 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  async function handleAprovar() {
    if (!selecionada) return
    setAcao('aprovando')
    setErro(null)
    try {
      await aprovarSolicitacao(selecionada.id, comentario, getToken)
      setFila((prev) => prev.filter((s) => s.id !== selecionada.id))
      setSelecionada(null)
      setComentario('')
      setSucesso('Solicitação aprovada com sucesso.')
      setTimeout(() => setSucesso(null), 4000)
    } catch (e) {
      setErro(e.message || 'Erro ao aprovar')
    } finally {
      setAcao(null)
    }
  }

  async function handleRejeitar() {
    if (!selecionada || !motivoRejeicao.trim()) return
    setAcao('rejeitando')
    setErro(null)
    try {
      await rejeitarSolicitacao(selecionada.id, motivoRejeicao, getToken)
      setFila((prev) => prev.filter((s) => s.id !== selecionada.id))
      setSelecionada(null)
      setMotivoRejeicao('')
      setShowRejeitar(false)
      setSucesso('Solicitação rejeitada.')
      setTimeout(() => setSucesso(null), 4000)
    } catch (e) {
      setErro(e.message || 'Erro ao rejeitar')
    } finally {
      setAcao(null)
    }
  }

  const tabs = [
    { key: 'fila', label: 'Fila' },
    { key: 'historico', label: 'Histórico' },
    ...(role === 'admin' ? [{ key: 'auditoria', label: 'Auditoria' }] : []),
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Tab bar */}
        <div style={{
          background: '#fff', borderBottom: '1px solid #e5e7eb',
          padding: '0 2rem', display: 'flex', gap: '0.25rem',
        }}>
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setSelecionada(null); setErro(null) }}
              style={{
                background: 'none', border: 'none',
                padding: '1rem 1.25rem', cursor: 'pointer',
                fontFamily: 'var(--font-main)', fontSize: '0.9em',
                fontWeight: tab === key ? 700 : 400,
                color: tab === key ? 'var(--wecare-red)' : 'var(--wecare-gray)',
                borderBottom: tab === key ? '2px solid var(--wecare-red)' : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              {label}
              {key === 'fila' && fila.length > 0 && (
                <span style={{
                  marginLeft: 6, background: 'var(--wecare-red)', color: '#fff',
                  borderRadius: 10, padding: '1px 7px', fontSize: '0.75em',
                }}>
                  {fila.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Feedback */}
        {sucesso && (
          <div style={{
            margin: '1rem 2rem 0',
            background: '#d1fae5', border: '1px solid #6ee7b7',
            borderRadius: 'var(--radius)', padding: '0.6rem 1rem',
            color: '#065f46', fontSize: '0.9em',
          }}>
            ✓ {sucesso}
          </div>
        )}
        {erro && (
          <div style={{
            margin: '1rem 2rem 0',
            background: '#fff3cd', border: '1px solid var(--wecare-yellow)',
            borderRadius: 'var(--radius)', padding: '0.6rem 1rem',
            color: '#856404', fontSize: '0.9em',
          }}>
            {erro}
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ── ABA FILA ── */}
          {tab === 'fila' && (
            <>
              {/* Lista */}
              <aside style={{
                width: '40%', minWidth: 280,
                borderRight: '1px solid #e5e7eb',
                overflowY: 'auto', padding: '1.5rem 1rem',
                background: 'var(--wecare-light)',
              }}>
                {loading && <p style={{ color: 'var(--wecare-gray)', fontSize: '0.9em' }}>Carregando…</p>}
                {!loading && fila.length === 0 && (
                  <p style={{ color: 'var(--wecare-gray)', fontSize: '0.9em' }}>Nenhuma solicitação pendente.</p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {fila.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => { setSelecionada(s); setComentario(''); setErro(null) }}
                      style={{
                        background: '#fff',
                        borderRadius: 'var(--radius)',
                        boxShadow: selecionada?.id === s.id ? '0 0 0 2px var(--wecare-teal)' : 'var(--shadow)',
                        borderLeft: '4px solid var(--wecare-orange)',
                        padding: '0.9rem 1rem',
                        cursor: 'pointer',
                        transition: 'box-shadow 0.15s',
                      }}
                    >
                      <p style={{ fontWeight: 600, fontSize: '0.95em', marginBottom: '0.2rem', color: 'var(--wecare-dark)' }}>
                        {s.nome_imovel}
                      </p>
                      <p style={{ fontSize: '0.82em', color: 'var(--wecare-gray)', marginBottom: '0.3rem' }}>
                        {s.solicitante?.nome || s.solicitante?.email}
                      </p>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85em' }}>
                        <span style={{ color: 'var(--wecare-teal)', fontWeight: 600 }}>
                          -{s.resultado?.desconto_percentual ?? 0}%
                        </span>
                        <span>{fmt(s.resultado?.preco_sugerido)}</span>
                      </div>
                      <p style={{ fontSize: '0.78em', color: 'var(--wecare-gray)', marginTop: '0.3rem' }}>
                        {fmtDate(s.criado_em)}
                      </p>
                    </div>
                  ))}
                </div>
              </aside>

              {/* Detalhe */}
              <main style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
                {!selecionada ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: '60vh', color: 'var(--wecare-gray)',
                  }}>
                    Selecione uma solicitação para revisar
                  </div>
                ) : (
                  <DetalhePanel
                    sol={selecionada}
                    comentario={comentario}
                    onComentario={setComentario}
                    onAprovar={handleAprovar}
                    onRejeitar={() => { setShowRejeitar(true); setMotivoRejeicao(''); setErro(null) }}
                    acao={acao}
                    role={role}
                  />
                )}
              </main>
            </>
          )}

          {/* ── ABA HISTÓRICO ── */}
          {tab === 'historico' && (
            <main style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
              {loading && <p style={{ color: 'var(--wecare-gray)' }}>Carregando…</p>}
              {!loading && historico.length === 0 && (
                <p style={{ color: 'var(--wecare-gray)' }}>Nenhuma solicitação encontrada.</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {historico.map((s) => (
                  <div key={s.id} style={{
                    background: '#fff', borderRadius: 'var(--radius)',
                    boxShadow: 'var(--shadow)', padding: '1rem 1.5rem',
                    display: 'grid', gridTemplateColumns: '1fr auto',
                    alignItems: 'start', gap: '1rem',
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                        <p style={{ fontWeight: 600, fontSize: '0.95em', color: 'var(--wecare-dark)' }}>{s.nome_imovel}</p>
                        <Badge status={s.status} />
                      </div>
                      <p style={{ fontSize: '0.82em', color: 'var(--wecare-gray)' }}>
                        Solicitante: {s.solicitante?.nome || s.solicitante?.email}
                        {' · '}Desconto: {s.resultado?.desconto_percentual ?? 0}%
                        {' · '}Preço: {fmt(s.resultado?.preco_sugerido)}
                      </p>
                      {s.comentario && (
                        <p style={{ fontSize: '0.82em', color: 'var(--wecare-gray)', marginTop: '0.3rem', fontStyle: 'italic' }}>
                          "{s.comentario}"
                        </p>
                      )}
                      {s.aprovador && (
                        <p style={{ fontSize: '0.78em', color: 'var(--wecare-gray)', marginTop: '0.2rem' }}>
                          {s.status === 'aprovado' ? 'Aprovado' : 'Rejeitado'} por {s.aprovador.nome || s.aprovador.email}
                        </p>
                      )}
                    </div>
                    <p style={{ fontSize: '0.78em', color: 'var(--wecare-gray)', whiteSpace: 'nowrap' }}>
                      {fmtDate(s.criado_em)}
                    </p>
                  </div>
                ))}
              </div>
            </main>
          )}

          {/* ── ABA AUDITORIA ── */}
          {tab === 'auditoria' && (
            <main style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
              {loading && <p style={{ color: 'var(--wecare-gray)' }}>Carregando…</p>}
              {!loading && auditoria.length === 0 && (
                <p style={{ color: 'var(--wecare-gray)' }}>Nenhuma entrada no log de auditoria.</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {auditoria.map((e) => (
                  <div key={e.id} style={{
                    background: '#fff', borderRadius: 'var(--radius)',
                    boxShadow: 'var(--shadow)', padding: '0.75rem 1.25rem',
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    flexWrap: 'wrap',
                  }}>
                    <Badge status={e.acao} />
                    <span style={{ fontSize: '0.85em', fontFamily: 'monospace', color: 'var(--wecare-gray)' }}>
                      {e.solicitacao_id?.slice(0, 8)}…
                    </span>
                    <span style={{ fontSize: '0.85em', color: 'var(--wecare-dark)' }}>
                      {e.aprovador?.nome || e.aprovador?.email}
                    </span>
                    {e.comentario && (
                      <span style={{ fontSize: '0.82em', color: 'var(--wecare-gray)', fontStyle: 'italic' }}>
                        "{e.comentario}"
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: '0.78em', color: 'var(--wecare-gray)', whiteSpace: 'nowrap' }}>
                      {fmtDate(e.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </main>
          )}

        </div>
      </div>

      {/* Modal de rejeição */}
      {showRejeitar && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{
            background: '#fff', borderRadius: 'var(--radius)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            padding: '2rem', width: '100%', maxWidth: 440,
          }}>
            <h3 style={{ fontWeight: 700, fontSize: '1.05em', marginBottom: '1rem', color: 'var(--wecare-dark)' }}>
              Rejeitar solicitação
            </h3>
            <label style={{ display: 'block', fontSize: '0.88em', fontWeight: 600, marginBottom: '0.3rem' }}>
              Motivo <span style={{ color: 'var(--wecare-red)' }}>*</span>
            </label>
            <textarea
              value={motivoRejeicao}
              onChange={(e) => setMotivoRejeicao(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Informe o motivo da rejeição…"
              style={{
                width: '100%', borderRadius: 'var(--radius)',
                border: '1px solid #d1d5db', padding: '0.5rem 0.75rem',
                fontSize: '0.88em', fontFamily: 'var(--font-main)',
                resize: 'vertical', boxSizing: 'border-box', marginBottom: '1rem',
              }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowRejeitar(false); setMotivoRejeicao('') }}
                disabled={acao !== null}
                style={{
                  background: 'none', border: '1px solid var(--wecare-gray)',
                  borderRadius: 'var(--radius)', padding: '0.45rem 1.2rem',
                  fontSize: '0.9em', cursor: 'pointer',
                  fontFamily: 'var(--font-main)', color: 'var(--wecare-gray)',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleRejeitar}
                disabled={acao !== null || !motivoRejeicao.trim()}
                style={{
                  background: acao !== null || !motivoRejeicao.trim() ? 'var(--wecare-gray)' : 'var(--wecare-red)',
                  color: '#fff', border: 'none',
                  borderRadius: 'var(--radius)', padding: '0.45rem 1.2rem',
                  fontSize: '0.9em', fontWeight: 600,
                  cursor: acao !== null || !motivoRejeicao.trim() ? 'not-allowed' : 'pointer',
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

function DetalhePanel({ sol, comentario, onComentario, onAprovar, onRejeitar, acao, role }) {
  const canAct = role === 'admin' || role === 'aprovador'
  const fmt = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`

  return (
    <div style={{
      background: '#fff', borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow)', padding: '1.5rem', maxWidth: 680,
    }}>
      <h3 style={{ fontWeight: 700, fontSize: '1.05em', marginBottom: '1.25rem', color: 'var(--wecare-dark)' }}>
        Solicitação #{sol.id.slice(0, 8)}…
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem', marginBottom: '1.25rem' }}>
        <Campo label="Imóvel" value={sol.nome_imovel} />
        <Campo label="Solicitante" value={sol.solicitante?.nome || sol.solicitante?.email} />
        <Campo label="Período" value={`${sol.data_inicio} → ${sol.data_fim}`} />
        <Campo label="Diária atual" value={fmt(sol.diaria_atual)} />
        <Campo label="Desconto sugerido" value={`${sol.resultado?.desconto_percentual ?? 0}%`} destaque />
        <Campo label="Preço sugerido" value={fmt(sol.resultado?.preco_sugerido)} destaque />
        <Campo label="Repasse mínimo" value={fmt(sol.repasse_minimo)} />
        <Campo label="Repasse resultante" value={fmt(sol.resultado?.repasse_resultante)} />
      </div>

      {sol.resultado?.alertas?.length > 0 && (
        <div style={{
          background: '#fff3cd', border: '1px solid var(--wecare-yellow)',
          borderRadius: 'var(--radius)', padding: '0.75rem 1rem', marginBottom: '1rem',
        }}>
          {sol.resultado.alertas.map((a, i) => (
            <p key={i} style={{ color: '#856404', fontSize: '0.87em' }}>⚠ {a}</p>
          ))}
        </div>
      )}

      {sol.resultado?.regras_aplicadas?.length > 0 && (
        <details style={{ marginBottom: '1.25rem' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.9em' }}>
            Regras aplicadas ({sol.resultado.regras_aplicadas.length})
          </summary>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1.2rem' }}>
            {sol.resultado.regras_aplicadas.map((r, i) => (
              <li key={i} style={{ fontSize: '0.85em', color: 'var(--wecare-gray)', marginBottom: '0.2rem' }}>{r}</li>
            ))}
          </ul>
        </details>
      )}

      {canAct && (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.88em', fontWeight: 600, marginBottom: '0.3rem' }}>
              Comentário (opcional para aprovação)
            </label>
            <textarea
              value={comentario}
              onChange={(e) => onComentario(e.target.value)}
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
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onAprovar}
              disabled={acao !== null}
              style={{
                background: acao ? 'var(--wecare-gray)' : 'var(--wecare-teal)',
                color: '#fff', border: 'none', borderRadius: 'var(--radius)',
                padding: '0.5rem 1.4rem', fontSize: '0.95em', fontWeight: 600,
                cursor: acao ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-main)',
              }}
            >
              {acao === 'aprovando' ? 'Aprovando…' : 'Aprovar'}
            </button>
            <button
              onClick={onRejeitar}
              disabled={acao !== null}
              style={{
                background: acao ? 'var(--wecare-gray)' : 'var(--wecare-red)',
                color: '#fff', border: 'none', borderRadius: 'var(--radius)',
                padding: '0.5rem 1.4rem', fontSize: '0.95em', fontWeight: 600,
                cursor: acao ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-main)',
              }}
            >
              Rejeitar
            </button>
          </div>
        </>
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
