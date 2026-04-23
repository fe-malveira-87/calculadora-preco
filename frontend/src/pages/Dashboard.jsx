import { useAuth } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import Header from '../components/Header'
import MetricCard from '../components/MetricCard'
import {
  exportExcel,
  exportPdf,
  getDashboardHistorico,
  getDashboardResumo,
  getScoreImoveis,
} from '../services/api'

const fmt = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`
const fmtPct = (v) => `${Number(v || 0).toFixed(1)}%`

function scoreColor(score) {
  if (score >= 70) return '#15803d'
  if (score >= 40) return '#b45309'
  return '#b91c1c'
}

function ScoreBar({ score }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <div style={{
        flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden',
      }}>
        <div style={{
          width: `${score}%`, height: '100%',
          background: scoreColor(score),
          borderRadius: 4,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{ fontSize: '0.85em', fontWeight: 700, color: scoreColor(score), minWidth: 28 }}>
        {score}
      </span>
    </div>
  )
}

function BarChart({ data }) {
  const W = 600
  const H = 180
  const PAD_L = 40
  const PAD_B = 32
  const PAD_T = 12
  const PAD_R = 16
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_B - PAD_T

  if (!data.length) return (
    <p style={{ color: 'var(--wecare-gray)', fontSize: '0.9em', textAlign: 'center', padding: '2rem' }}>
      Sem dados para exibir.
    </p>
  )

  const maxVal = Math.max(...data.map((d) => d.total), 1)
  const barW = Math.min(chartW / data.length - 6, 48)

  const yTicks = [0, Math.round(maxVal / 2), maxVal]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block' }}>
      {/* Y grid lines */}
      {yTicks.map((t) => {
        const y = PAD_T + chartH - (t / maxVal) * chartH
        return (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">{t}</text>
          </g>
        )
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const x = PAD_L + (chartW / data.length) * i + (chartW / data.length - barW) / 2
        const barH = (d.total / maxVal) * chartH
        const y = PAD_T + chartH - barH
        return (
          <g key={d.mes}>
            <rect
              x={x} y={y} width={barW} height={barH}
              fill="var(--wecare-red)" rx={3}
              opacity={0.85}
            />
            <text
              x={x + barW / 2}
              y={y - 4}
              textAnchor="middle"
              fontSize={9}
              fill="var(--wecare-dark)"
              fontWeight="600"
            >
              {d.total}
            </text>
            <text
              x={x + barW / 2}
              y={H - 6}
              textAnchor="middle"
              fontSize={9}
              fill="#9ca3af"
            >
              {d.mes.slice(5)}
            </text>
          </g>
        )
      })}

      {/* X axis */}
      <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + chartH} y2={PAD_T + chartH} stroke="#d1d5db" strokeWidth={1} />
    </svg>
  )
}

export default function Dashboard() {
  const { getToken } = useAuth()

  const [resumo, setResumo] = useState(null)
  const [historico, setHistorico] = useState([])
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [exportando, setExportando] = useState(null)

  useEffect(() => {
    Promise.all([
      getDashboardResumo(getToken),
      getDashboardHistorico(getToken),
    ])
      .then(([r, h]) => {
        setResumo(r)
        setHistorico(h)
        const ids = (r.top_imoveis || []).map((t) => t.listing_id)
        return Promise.all(ids.map((id) => getScoreImoveis(id, getToken)))
      })
      .then(setScores)
      .catch((e) => setErro(e.message || 'Erro ao carregar dados'))
      .finally(() => setLoading(false))
  }, [getToken])

  async function handleExport(tipo) {
    setExportando(tipo)
    try {
      if (tipo === 'excel') await exportExcel(getToken)
      else await exportPdf(getToken)
    } catch (e) {
      setErro(e.message || `Erro ao exportar ${tipo}`)
    } finally {
      setExportando(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto', maxWidth: 1100, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* Título + botões export */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h1 style={{ fontSize: '1.25em', fontWeight: 700, color: 'var(--wecare-dark)', margin: 0 }}>
            Dashboard
          </h1>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              onClick={() => handleExport('excel')}
              disabled={exportando !== null || loading}
              style={{
                background: exportando === 'excel' ? 'var(--wecare-gray)' : 'var(--wecare-teal)',
                color: '#fff', border: 'none',
                borderRadius: 'var(--radius)', padding: '0.45rem 1.1rem',
                fontSize: '0.88em', fontWeight: 600, cursor: exportando !== null || loading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-main)',
              }}
            >
              {exportando === 'excel' ? 'Gerando…' : 'Exportar Excel'}
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={exportando !== null || loading}
              style={{
                background: exportando === 'pdf' ? 'var(--wecare-gray)' : 'var(--wecare-red)',
                color: '#fff', border: 'none',
                borderRadius: 'var(--radius)', padding: '0.45rem 1.1rem',
                fontSize: '0.88em', fontWeight: 600, cursor: exportando !== null || loading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-main)',
              }}
            >
              {exportando === 'pdf' ? 'Gerando…' : 'Exportar PDF'}
            </button>
          </div>
        </div>

        {erro && (
          <div style={{
            background: '#fff3cd', border: '1px solid var(--wecare-yellow)',
            borderRadius: 'var(--radius)', padding: '0.75rem 1rem',
            marginBottom: '1.5rem', color: '#856404', fontSize: '0.9em',
          }}>
            {erro}
          </div>
        )}

        {loading ? (
          <p style={{ color: 'var(--wecare-gray)' }}>Carregando…</p>
        ) : (
          <>
            {/* Seção 1 — Métricas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <MetricCard title="Total" value={resumo?.total_solicitacoes ?? 0} />
              <MetricCard title="Aprovadas" value={resumo?.aprovadas ?? 0} highlight />
              <MetricCard title="Rejeitadas" value={resumo?.rejeitadas ?? 0} />
              <MetricCard title="Pendentes" value={resumo?.pendentes ?? 0} />
              <MetricCard title="Desconto médio" value={fmtPct(resumo?.desconto_medio_percentual)} />
              <MetricCard title="Economia total" value={fmt(resumo?.economia_total)} highlight />
            </div>

            {/* Seção 2 — Gráfico de histórico */}
            <div style={{
              background: '#fff', borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow)', padding: '1.5rem',
              marginBottom: '2rem',
            }}>
              <h2 style={{ fontSize: '1em', fontWeight: 700, marginBottom: '1rem', color: 'var(--wecare-dark)' }}>
                Aprovações por mês
              </h2>
              <BarChart data={historico} />
            </div>

            {/* Seção 3 — Score por imóvel */}
            <div style={{
              background: '#fff', borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow)', padding: '1.5rem',
            }}>
              <h2 style={{ fontSize: '1em', fontWeight: 700, marginBottom: '1rem', color: 'var(--wecare-dark)' }}>
                Score por imóvel (top 5)
              </h2>
              {scores.length === 0 ? (
                <p style={{ color: 'var(--wecare-gray)', fontSize: '0.9em' }}>Sem dados suficientes.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--wecare-gray)', fontWeight: 600, fontSize: '0.8em', textTransform: 'uppercase' }}>Imóvel</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--wecare-gray)', fontWeight: 600, fontSize: '0.8em', textTransform: 'uppercase', minWidth: 160 }}>Score</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: 'var(--wecare-gray)', fontWeight: 600, fontSize: '0.8em', textTransform: 'uppercase' }}>Aprovadas</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: 'var(--wecare-gray)', fontWeight: 600, fontSize: '0.8em', textTransform: 'uppercase' }}>Desc. médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((s, i) => (
                      <tr key={s.listing_id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : 'var(--wecare-light)' }}>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: 500, color: 'var(--wecare-dark)' }}>
                          {s.listing_nome}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>
                          <ScoreBar score={s.score} />
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', color: 'var(--wecare-dark)' }}>
                          {s.aprovadas}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', color: 'var(--wecare-gray)' }}>
                          {fmtPct(s.desconto_medio)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
