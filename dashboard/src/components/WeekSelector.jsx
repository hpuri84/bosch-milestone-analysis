export default function WeekSelector({ weeks, selected, onSelect }) {
  return (
    <div style={{
      display: 'flex',
      gap: 4,
      background: 'var(--bg-secondary)',
      borderRadius: 8,
      padding: 4,
      border: '1px solid var(--border)',
    }}>
      {weeks.map(w => {
        const active = w === selected;
        return (
          <button
            key={w}
            onClick={() => onSelect(w)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              fontWeight: active ? 500 : 400,
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              background: active ? 'var(--bg-accent)' : 'transparent',
              border: active ? '1px solid var(--border-accent)' : '1px solid transparent',
              borderRadius: 6,
              padding: '6px 14px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              letterSpacing: '0.02em',
            }}
            onMouseEnter={e => {
              if (!active) e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            onMouseLeave={e => {
              if (!active) e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            {w}
          </button>
        );
      })}
    </div>
  );
}
