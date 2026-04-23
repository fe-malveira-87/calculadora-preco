import { useState } from 'react'

const input = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  border: '1px solid #ddd',
  borderRadius: 'var(--radius)',
  fontFamily: 'var(--font-main)',
  fontSize: '0.95em',
  color: 'var(--wecare-dark)',
  background: '#fff',
}

const label = {
  display: 'block',
  fontSize: '0.78em',
  fontWeight: 600,
  color: 'var(--wecare-gray)',
  marginBottom: '0.3rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

export default function Sidebar({ listings, onCalcular, loading }) {
  const today = new Date().toISOString().split('T')[0]
  const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  const [listingId, setListingId] = useState('')
  const [listingName, setListingName] = useState('')
  const [dataInicio, setDataInicio] = useState(today)
  const [dataFim, setDataFim] = useState(nextMonth)
  const [diaria, setDiaria] = useState('')
  const [repasseMinimo, setRepasseMinimo] = useState('')

  const handleListing = (e) => {
    const sel = listings.find((l) => String(l.id) === e.target.value)
    setListingId(e.target.value)
    setListingName(sel?.name || '')
    setDiaria(sel?.price ? String(sel.price) : '')
    setRepasseMinimo('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!listingId || !diaria || !repasseMinimo) return
    onCalcular({
      listing_id: listingId,
      nome: listingName,
      data_inicio: dataInicio,
      data_fim: dataFim,
      diaria_atual: parseFloat(diaria),
      repasse_minimo: parseFloat(repasseMinimo),
    })
  }

  return (
    <aside style={{
      width: 300, minWidth: 300, background: '#fff',
      boxShadow: 'var(--shadow)', padding: '1.5rem',
      display: 'flex', flexDirection: 'column', gap: '1.2rem',
      height: 'calc(100vh - 64px)', overflowY: 'auto',
    }}>
      <p style={{ fontWeight: 600, fontSize: '1em', color: 'var(--wecare-dark)' }}>Parâmetros</p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={label}>Imóvel</label>
          <select value={listingId} onChange={handleListing} style={input} required>
            <option value="">Selecione...</option>
            {listings.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        <div>
          <label style={label}>Data início</label>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={input} required />
        </div>

        <div>
          <label style={label}>Data fim</label>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} style={input} required />
        </div>

        <div>
          <label style={label}>Diária atual (R$)</label>
          <input type="number" min="0" step="0.01" value={diaria} onChange={(e) => setDiaria(e.target.value)} placeholder="Auto-preenchida pelo Hostaway" style={input} required />
        </div>

        <div>
          <label style={label}>Repasse mínimo (R$)</label>
          <input type="number" min="0" step="0.01" value={repasseMinimo} onChange={(e) => setRepasseMinimo(e.target.value)} placeholder="0,00" style={input} required />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            background: loading ? 'var(--wecare-gray)' : 'var(--wecare-red)',
            color: '#fff', border: 'none', borderRadius: 'var(--radius)',
            padding: '0.75rem', fontFamily: 'var(--font-main)', fontWeight: 600,
            fontSize: '1em', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.2s',
          }}
        >
          {loading ? 'Calculando...' : 'Calcular desconto'}
        </button>
      </form>
    </aside>
  )
}
