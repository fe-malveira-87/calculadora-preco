export default function MetricCard({ title, value, subtitle, highlight }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow)',
      padding: '1.2rem 1.5rem',
      borderTop: `4px solid ${highlight ? 'var(--wecare-red)' : 'var(--wecare-gray)'}`,
    }}>
      <p style={{ fontSize: '0.8em', fontWeight: 600, color: 'var(--wecare-gray)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {title}
      </p>
      <p style={{ fontSize: '2em', fontWeight: 700, color: highlight ? 'var(--wecare-red)' : 'var(--wecare-dark)' }}>
        {value}
      </p>
      {subtitle && (
        <p style={{ fontSize: '0.8em', color: 'var(--wecare-gray)', marginTop: '0.3rem' }}>{subtitle}</p>
      )}
    </div>
  )
}
