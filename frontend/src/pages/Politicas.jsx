import { useAuth } from '@clerk/clerk-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import { getMe, getRule, getRuleHistory, getRules, updateRule } from '../services/api'

const label = {
  display: 'block',
  fontSize: '0.78em',
  fontWeight: 600,
  color: 'var(--wecare-gray)',
  marginBottom: '0.4rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const fmtDate = (iso) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function Politicas() {
  const { getToken } = useAuth()

  const [rules, setRules] = useState([])
  const [selected, setSelected] = useState(null)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [role, setRole] = useState(null)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingContent, setLoadingContent] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const canEdit = role === 'admin' || role === 'aprovador'
  const isDirty = content !== savedContent

  const fetchList = useCallback(async () => {
    setLoadingList(true)
    try {
      const data = await getRules(getToken)
      setRules(data)
    } catch (e) {
      setErro('Erro ao carregar políticas: ' + e.message)
    } finally {
      setLoadingList(false)
    }
  }, [getToken])

  useEffect(() => {
    getMe(getToken).then((me) => setRole(me.role)).catch(() => {})
    fetchList()
  }, [getToken, fetchList])

  async function handleSelectRule(rule) {
    setSelected(rule)
    setErro(null)
    setSuccessMsg(null)
    setShowHistory(false)
    setHistory([])
    setLoadingContent(true)
    try {
      const data = await getRule(rule.nome, getToken)
      setContent(data.conteudo)
      setSavedContent(data.conteudo)
    } catch (e) {
      setErro('Erro ao carregar conteúdo: ' + e.message)
    } finally {
      setLoadingContent(false)
    }
  }

  async function handleSave() {
    if (!selected || !canEdit || !isDirty) return
    setSaving(true)
    setErro(null)
    try {
      await updateRule(selected.nome, content, getToken)
      setSavedContent(content)
      setSuccessMsg('Salvo com sucesso!')
      setTimeout(() => setSuccessMsg(null), 3000)
      fetchList()
    } catch (e) {
      setErro('Erro ao salvar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleHistory() {
    const next = !showHistory
    setShowHistory(next)
    if (next && selected) {
      setLoadingHistory(true)
      try {
        const data = await getRuleHistory(selected.nome, getToken)
        setHistory(data)
      } catch (e) {
        setErro('Erro ao carregar histórico: ' + e.message)
      } finally {
        setLoadingHistory(false)
      }
    }
  }

  const previewHtml = useMemo(() => {
    if (!content) return ''
    if (typeof window !== 'undefined' && window.marked) return window.marked.parse(content)
    return `<pre style="white-space:pre-wrap">${content}</pre>`
  }, [content])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Sidebar — lista de políticas */}
        <aside style={{
          width: 280, minWidth: 280, background: '#fff',
          boxShadow: 'var(--shadow)', padding: '1.5rem',
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
          height: 'calc(100vh - 64px)', overflowY: 'auto',
        }}>
          <p style={{ fontWeight: 600, fontSize: '1em', color: 'var(--wecare-dark)', marginBottom: '0.5rem' }}>
            Políticas de Desconto
          </p>

          {loadingList && <p style={{ color: 'var(--wecare-gray)', fontSize: '0.88em' }}>Carregando...</p>}

          {rules.map((rule) => {
            const active = selected?.nome === rule.nome
            return (
              <div
                key={rule.nome}
                onClick={() => handleSelectRule(rule)}
                style={{
                  padding: '0.9rem 1rem',
                  borderRadius: 'var(--radius)',
                  border: `2px solid ${active ? 'var(--wecare-red)' : '#eee'}`,
                  background: active ? '#fff5f5' : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <p style={{ fontWeight: 600, fontSize: '0.92em', color: 'var(--wecare-dark)', marginBottom: '0.25rem' }}>
                  {rule.titulo}
                </p>
                <p style={{ fontSize: '0.74em', color: 'var(--wecare-gray)' }}>
                  {fmtDate(rule.modificado)}
                </p>
              </div>
            )
          })}
        </aside>

        {/* Painel principal — editor + preview */}
        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!selected ? (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              height: '60vh', color: 'var(--wecare-gray)', textAlign: 'center',
            }}>
              <p style={{ fontSize: '1.1em' }}>Selecione uma política para visualizar ou editar</p>
              {!canEdit && role && (
                <p style={{ fontSize: '0.85em', marginTop: '0.5rem' }}>
                  Visualização apenas — edição restrita a admin e aprovador
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Barra de ações */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <h2 style={{ fontSize: '1.2em', fontWeight: 700, color: 'var(--wecare-dark)' }}>
                  {selected.titulo}
                </h2>

                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                  {successMsg && (
                    <span style={{ color: 'var(--wecare-teal)', fontWeight: 600, fontSize: '0.88em' }}>
                      ✓ {successMsg}
                    </span>
                  )}

                  <button
                    onClick={handleToggleHistory}
                    style={{
                      background: 'none',
                      border: '1px solid var(--wecare-gray)',
                      borderRadius: 'var(--radius)',
                      padding: '0.4rem 1rem',
                      cursor: 'pointer',
                      fontSize: '0.85em',
                      color: 'var(--wecare-gray)',
                      fontFamily: 'var(--font-main)',
                    }}
                  >
                    {showHistory ? 'Fechar histórico' : 'Ver histórico'}
                  </button>

                  {canEdit && (
                    <button
                      onClick={handleSave}
                      disabled={saving || !isDirty}
                      style={{
                        background: saving || !isDirty ? 'var(--wecare-gray)' : 'var(--wecare-red)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 'var(--radius)',
                        padding: '0.45rem 1.25rem',
                        cursor: saving || !isDirty ? 'not-allowed' : 'pointer',
                        fontFamily: 'var(--font-main)',
                        fontWeight: 600,
                        fontSize: '0.9em',
                        transition: 'background 0.2s',
                      }}
                    >
                      {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                  )}
                </div>
              </div>

              {/* Alerta de erro */}
              {erro && (
                <div style={{
                  background: '#fff3cd', border: '1px solid var(--wecare-yellow)',
                  borderRadius: 'var(--radius)', padding: '0.75rem 1rem',
                  color: '#856404', fontSize: '0.88em',
                }}>
                  {erro}
                </div>
              )}

              {/* Histórico */}
              {showHistory && (
                <div style={{
                  background: '#fff', borderRadius: 'var(--radius)',
                  boxShadow: 'var(--shadow)', padding: '1rem 1.5rem',
                }}>
                  <p style={{ fontWeight: 600, fontSize: '0.88em', marginBottom: '0.75rem', color: 'var(--wecare-dark)' }}>
                    Histórico de versões — {selected.titulo}
                  </p>
                  {loadingHistory ? (
                    <p style={{ color: 'var(--wecare-gray)', fontSize: '0.85em' }}>Carregando...</p>
                  ) : history.length === 0 ? (
                    <p style={{ color: 'var(--wecare-gray)', fontSize: '0.85em' }}>Nenhuma versão anterior.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {history.map((h) => (
                        <li key={h.arquivo} style={{ fontSize: '0.83em', color: 'var(--wecare-gray)', display: 'flex', gap: '1rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--wecare-dark)' }}>{fmtDate(h.modificado)}</span>
                          <span style={{ fontFamily: 'monospace' }}>{h.arquivo}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Editor + Preview */}
              {loadingContent ? (
                <p style={{ color: 'var(--wecare-gray)' }}>Carregando...</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', flex: 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <p style={label}>Editor {!canEdit && '(somente leitura)'}</p>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      readOnly={!canEdit}
                      spellCheck={false}
                      style={{
                        flex: 1,
                        minHeight: 480,
                        padding: '1rem',
                        border: '1px solid #ddd',
                        borderRadius: 'var(--radius)',
                        fontFamily: 'monospace',
                        fontSize: '0.88em',
                        lineHeight: 1.6,
                        resize: 'vertical',
                        background: canEdit ? '#fff' : '#f9f9f9',
                        color: 'var(--wecare-dark)',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <p style={label}>Preview</p>
                    <div
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                      style={{
                        flex: 1,
                        minHeight: 480,
                        padding: '1rem 1.5rem',
                        border: '1px solid #eee',
                        borderRadius: 'var(--radius)',
                        background: '#fff',
                        overflowY: 'auto',
                        lineHeight: 1.7,
                        fontSize: '0.92em',
                        color: 'var(--wecare-dark)',
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
