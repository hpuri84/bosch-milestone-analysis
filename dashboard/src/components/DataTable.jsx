import { useState } from 'react';

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

const ROWS = [
  { label: 'Completeness (Critical)', key: d => d.critical?.completeness, threshold: 0.9, category: 'core' },
  { label: 'Timeliness (Critical)', key: d => d.critical?.timeliness, threshold: 0.7, category: 'core' },
  { label: 'Completeness (All)', key: d => d.all?.completeness, threshold: 0.85, category: 'core' },
  { label: 'Timeliness (All)', key: d => d.all?.timeliness, threshold: 0.7, category: 'core' },
  { label: 'SC3 Completeness', key: d => d.sc3_total?.completeness, threshold: 0.85, category: 'sc' },
  { label: 'SC3 Timeliness', key: d => d.sc3_total?.timeliness, threshold: 0.7, category: 'sc' },
  { label: 'SC4 Completeness', key: d => d.sc4_total?.completeness, threshold: 0.85, category: 'sc' },
  { label: 'SC4 Timeliness', key: d => d.sc4_total?.timeliness, threshold: 0.7, category: 'sc' },
  { label: 'SC3 Completeness (Critical)', key: d => d.sc3_critical?.completeness, threshold: 0.9, category: 'sc' },
  { label: 'SC3 Timeliness (Critical)', key: d => d.sc3_critical?.timeliness, threshold: 0.7, category: 'sc' },
  { label: 'SC4 Completeness (Critical)', key: d => d.sc4_critical?.completeness, threshold: 0.9, category: 'sc' },
  { label: 'SC4 Timeliness (Critical)', key: d => d.sc4_critical?.timeliness, threshold: 0.7, category: 'sc' },
  { label: 'ETA 2P (±48h port)', key: d => d.eta_2p, threshold: 0.5, category: 'eta' },
  { label: 'ETA 2D (±48h delivery)', key: d => d.eta_2d, threshold: 0.3, category: 'eta' },
  { label: 'Reference Completeness', key: d => d.ref_comp, threshold: 0.8, category: 'eta' },
];

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'core', label: 'Core KPIs' },
  { key: 'sc', label: 'SC3 / SC4' },
  { key: 'eta', label: 'ETA & Ref' },
];

export default function DataTable({ data }) {
  const [sortCol, setSortCol] = useState(null); // week index or null
  const [sortDir, setSortDir] = useState('desc');
  const [category, setCategory] = useState('all');

  const weeks = data.map(d => d.week);

  const filteredRows = category === 'all' ? ROWS : ROWS.filter(r => r.category === category);

  // Sort rows by a specific week's value
  const sortedRows = sortCol != null
    ? [...filteredRows].sort((a, b) => {
        const va = a.key(data[sortCol]) ?? -1;
        const vb = b.key(data[sortCol]) ?? -1;
        return sortDir === 'asc' ? va - vb : vb - va;
      })
    : filteredRows;

  const handleSort = (weekIdx) => {
    if (sortCol === weekIdx) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(weekIdx);
      setSortDir('desc');
    }
  };

  const btnStyle = (active) => ({
    fontFamily: 'var(--font-display)',
    fontSize: '0.7rem',
    fontWeight: active ? 600 : 400,
    color: active ? '#fff' : 'var(--text-muted)',
    background: active ? 'var(--accent-blue)' : 'transparent',
    border: active ? 'none' : '1px solid var(--border)',
    borderRadius: 5,
    padding: '4px 10px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
    }}>
      {/* Filter bar */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        gap: 6,
        alignItems: 'center',
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          marginRight: 4,
        }}>Filter:</span>
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            style={btnStyle(category === c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          minWidth: 700,
        }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.7rem',
                fontWeight: 600,
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
              {weeks.map((w, i) => (
                <th
                  key={w}
                  onClick={() => handleSort(i)}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                    fontWeight: 400,
                    color: sortCol === i ? 'var(--accent-blue)' : 'var(--text-muted)',
                    padding: '10px 12px',
                    textAlign: 'right',
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {w} {sortCol === i ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
