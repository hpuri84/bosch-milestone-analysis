const styles = {
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '20px 24px',
    position: 'relative',
    overflow: 'hidden',
    transition: 'border-color 0.2s, background 0.2s',
  },
  label: {
    fontFamily: 'var(--font-display)',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 8,
  },
  value: {
    fontFamily: 'var(--font-mono)',
    fontSize: '2rem',
    fontWeight: 500,
    lineHeight: 1,
    marginBottom: 6,
  },
  delta: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8rem',
    fontWeight: 400,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 3,
    borderRadius: '0 0 2px 0',
    transition: 'width 0.6s ease-out',
  },
};

export default function KPICard({ label, value, prevValue, color = 'var(--accent-blue)', barPercent, delay = 0 }) {
  const delta = prevValue != null && value != null ? value - prevValue : null;
  const deltaUp = delta > 0;
  const deltaColor = deltaUp ? 'var(--accent-green)' : delta < 0 ? 'var(--accent-red)' : 'var(--text-muted)';

  const fmtPct = (v) => v != null ? `${(v * 100).toFixed(1)}%` : 'N/A';
  const fmtDelta = (d) => {
    const abs = Math.abs(d * 100).toFixed(1);
    return deltaUp ? `+${abs}pp` : `-${abs}pp`;
  };

  return (
    <div
      style={{
        ...styles.card,
        animation: `fadeInUp 0.4s ease-out ${delay}s both`,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.background = 'var(--bg-card-hover)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.background = 'var(--bg-card)';
      }}
    >
      <div style={{ ...styles.bar, width: barPercent ? `${barPercent * 100}%` : '0%', background: color, opacity: 0.6 }} />
      <div style={styles.label}>{label}</div>
      <div style={{ ...styles.value, color }}>{fmtPct(value)}</div>
      {delta != null && (
        <div style={{ ...styles.delta, color: deltaColor }}>
          <span style={{ fontSize: '0.65rem' }}>{deltaUp ? '▲' : delta < 0 ? '▼' : '─'}</span>
          {fmtDelta(delta)} vs prev week
        </div>
      )}
    </div>
  );
}
