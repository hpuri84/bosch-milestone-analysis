const fmtPct = (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—';

const cellStyle = (value, threshold) => ({
  fontFamily: 'var(--font-mono)',
  fontSize: '0.8rem',
  padding: '8px 12px',
  textAlign: 'right',
  color: value == null ? 'var(--text-muted)' :
    value >= (threshold || 0.85) ? 'var(--accent-green)' :
    value >= (threshold ? threshold * 0.85 : 0.7) ? 'var(--accent-amber)' :
    'var(--accent-red)',
});

export default function DataTable({ data, title }) {
  const weeks = data.map(d => d.week);

  const rows = [
    { label: 'Completeness (Critical)', key: d => d.critical?.completeness, threshold: 0.9 },
    { label: 'Timeliness (Critical)', key: d => d.critical?.timeliness, threshold: 0.7 },
    { label: 'Completeness (All)', key: d => d.all?.completeness, threshold: 0.85 },
    { label: 'Timeliness (All)', key: d => d.all?.timeliness, threshold: 0.7 },
    { section: 'SC3 / SC4 Split' },
    { label: 'SC3 Completeness', key: d => d.sc3_total?.completeness, threshold: 0.85 },
    { label: 'SC3 Timeliness', key: d => d.sc3_total?.timeliness, threshold: 0.7 },
    { label: 'SC4 Completeness', key: d => d.sc4_total?.completeness, threshold: 0.85 },
    { label: 'SC4 Timeliness', key: d => d.sc4_total?.timeliness, threshold: 0.7 },
    { section: 'ETA & Reference' },
    { label: 'ETA 2P (±48h port)', key: d => d.eta_2p, threshold: 0.5 },
    { label: 'ETA 2D (±48h delivery)', key: d => d.eta_2d, threshold: 0.3 },
    { label: 'Reference Completeness', key: d => d.ref_comp, threshold: 0.8 },
  ];

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      {title && (
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          fontFamily: 'var(--font-display)',
          fontSize: '0.85rem',
          fontWeight: 600,
        }}>
          {title}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          minWidth: 700,
        }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-accent)' }}>
              <th style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.7rem',
                fontWeight: 500,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '10px 16px',
                textAlign: 'left',
                position: 'sticky',
                left: 0,
                background: 'var(--bg-card)',
                zIndex: 1,
              }}>
                KPI
              </th>
              {weeks.map(w => (
                <th key={w} style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  fontWeight: 400,
                  color: 'var(--text-muted)',
                  padding: '10px 12px',
                  textAlign: 'right',
                  letterSpacing: '0.04em',
                }}>
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              if (row.section) {
                return (
                  <tr key={i}>
                    <td
                      colSpan={weeks.length + 1}
                      style={{
                        padding: '12px 16px 6px',
                        fontFamily: 'var(--font-display)',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        borderTop: '1px solid var(--border)',
                      }}
                    >
                      {row.section}
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={i}
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-accent)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.8rem',
                    fontWeight: 400,
                    color: 'var(--text-secondary)',
                    padding: '8px 16px',
                    whiteSpace: 'nowrap',
                    position: 'sticky',
                    left: 0,
                    background: 'inherit',
                  }}>
                    {row.label}
                  </td>
                  {data.map((d, j) => {
                    const v = row.key(d);
                    return (
                      <td key={j} style={cellStyle(v, row.threshold)}>
                        {fmtPct(v)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
