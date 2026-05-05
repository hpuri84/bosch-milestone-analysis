import { useState, useMemo } from 'react';
import ETA2DLaneRCA from './ETA2DLaneRCA';

const PAGE_SIZE = 50;

function downloadCSV(rows, headers, filename) {
  const csvRows = [headers.join(',')];
  rows.forEach(r => {
    csvRows.push(headers.map(h => {
      const val = r[h] ?? '';
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(','));
  });
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function MetricCard({ label, value, total, rate, color }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${color}`,
      borderRadius: 8,
      padding: '14px 20px',
      minWidth: 160,
      flex: '1 1 160px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.7rem',
        fontWeight: 500,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 4,
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '1.6rem',
          fontWeight: 500,
          color,
        }}>{rate != null ? `${(rate * 100).toFixed(1)}%` : 'N/A'}</span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}>{value}/{total}</span>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const maxVisible = 7;
  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push('...');
  }
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages) {
    if (end < totalPages - 1) pages.push('...');
    pages.push(totalPages);
  }

  const btnBase = {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.72rem',
    border: '1px solid var(--border)',
    borderRadius: 4,
    padding: '4px 10px',
    cursor: 'pointer',
    background: 'transparent',
    color: 'var(--text-secondary)',
  };

  return (
    <div style={{
      display: 'flex',
      gap: 4,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px 0',
    }}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        style={{ ...btnBase, opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? 'default' : 'pointer' }}
      >Prev</button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0 4px' }}>...</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            style={{
              ...btnBase,
              background: p === page ? 'var(--accent-blue)' : 'transparent',
              color: p === page ? '#fff' : 'var(--text-secondary)',
              border: p === page ? '1px solid var(--accent-blue)' : '1px solid var(--border)',
              fontWeight: p === page ? 600 : 400,
            }}
          >{p}</button>
        )
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        style={{ ...btnBase, opacity: page === totalPages ? 0.4 : 1, cursor: page === totalPages ? 'default' : 'pointer' }}
      >Next</button>
    </div>
  );
}

function ShipmentTable({ shipments, columns, searchTerm, title, onExport }) {
  const [page, setPage] = useState(1);
  const term = searchTerm.toLowerCase();
  const filtered = useMemo(() => {
    return term
      ? shipments.filter(s =>
          columns.some(c => (String(s[c.key] ?? '')).toLowerCase().includes(term))
        )
      : shipments;
  }, [shipments, columns, term]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const currentPage = Math.min(page, totalPages || 1);
  const pageData = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const startIdx = (currentPage - 1) * PAGE_SIZE;

  // Reset page when search changes
  const prevTerm = useState(term);
  if (prevTerm[0] !== term) {
    prevTerm[0] = term;
    if (page !== 1) setPage(1);
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.85rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>{title}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
          }}>{filtered.length} records</span>
          <button
            onClick={onExport}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.7rem',
              fontWeight: 500,
              color: '#fff',
              background: 'var(--accent-blue)',
              border: 'none',
              borderRadius: 5,
              padding: '5px 12px',
              cursor: 'pointer',
            }}
          >Export CSV</button>
        </div>
      </div>
      <div style={{ overflowX: 'auto', maxHeight: 520 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
              <th style={thStyle}>#</th>
              {columns.map(c => (
                <th key={c.key} style={{ ...thStyle, textAlign: c.align || 'left' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((s, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8f9fb'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{startIdx + i + 1}</td>
                {columns.map(c => (
                  <td key={c.key} style={{
                    ...tdStyle,
                    textAlign: c.align || 'left',
                    color: c.color ? c.color(s) : 'var(--text-secondary)',
                    fontWeight: c.bold ? 500 : 400,
                  }}>
                    {c.render ? c.render(s) : (s[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

const thStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: '0.65rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  padding: '8px 12px',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.75rem',
  padding: '6px 12px',
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
};

function LaneBreakdownTable({ shipments, title }) {
  const lanes = useMemo(() => {
    const agg = {};
    for (const s of shipments) {
      const origin = s.origin_country || '—';
      const dest = s.dest_country || '—';
      const key = `${origin}__${dest}`;
      if (!agg[key]) {
        agg[key] = {
          origin, dest,
          failed: 0, late: 0, early: 0,
          dev_sum: 0, dev_count: 0,
          sample_hbls: [],
        };
      }
      const row = agg[key];
      row.failed += 1;
      if (s.direction === 'late') row.late += 1;
      else if (s.direction === 'early') row.early += 1;
      if (s.deviation_hours != null) {
        row.dev_sum += s.deviation_hours;
        row.dev_count += 1;
      }
      if (row.sample_hbls.length < 3 && s.hbl) row.sample_hbls.push(s.hbl);
    }
    const total = shipments.length || 1;
    return Object.values(agg)
      .map(r => ({
        ...r,
        avg_dev_hours: r.dev_count ? r.dev_sum / r.dev_count : null,
        share: r.failed / total * 100,
      }))
      .sort((a, b) => b.failed - a.failed);
  }, [shipments]);

  const totalFailures = shipments.length;
  let cumFailed = 0;

  const thS = {
    fontFamily: 'var(--font-display)',
    fontSize: '0.62rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    padding: '7px 10px',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    background: 'var(--bg-card)',
    position: 'sticky',
    top: 0,
  };

  const tdS = {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.72rem',
    padding: '6px 10px',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border)',
  };

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
      marginBottom: 16,
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {title}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {lanes.length} lane{lanes.length === 1 ? '' : 's'} · {totalFailures} failures
        </div>
      </div>
      <div style={{ overflowX: 'auto', maxHeight: 420 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ ...thS, textAlign: 'right' }}>#</th>
              <th style={thS}>Origin Country</th>
              <th style={thS}>Destination Country</th>
              <th style={{ ...thS, textAlign: 'right' }}>Failures</th>
              <th style={{ ...thS, textAlign: 'right' }}>Share</th>
              <th style={{ ...thS, textAlign: 'right' }}>Cum %</th>
              <th style={{ ...thS, textAlign: 'right' }}>Late</th>
              <th style={{ ...thS, textAlign: 'right' }}>Early</th>
              <th style={{ ...thS, textAlign: 'right' }}>Avg Dev</th>
              <th style={thS}>Sample HBLs</th>
            </tr>
          </thead>
          <tbody>
            {lanes.map((r, i) => {
              cumFailed += r.failed;
              const cumPct = Math.round(cumFailed / (totalFailures || 1) * 100);
              return (
                <tr key={i}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...tdS, textAlign: 'right', color: 'var(--text-muted)' }}>{i + 1}</td>
                  <td style={{ ...tdS, fontWeight: 500, color: 'var(--text-primary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.origin}</td>
                  <td style={{ ...tdS, fontWeight: 500, color: 'var(--text-primary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.dest}</td>
                  <td style={{ ...tdS, textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>{r.failed}</td>
                  <td style={{ ...tdS, padding: '6px 10px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                      <div style={{ width: 60, height: 5, background: 'var(--border)', borderRadius: 3 }}>
                        <div style={{ width: `${Math.min(r.share, 100)}%`, height: '100%', background: '#dc2626', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#dc2626', minWidth: 32 }}>
                        {r.share.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td style={{ ...tdS, textAlign: 'right', color: '#7c3aed', fontWeight: cumPct >= 80 ? 600 : 400 }}>
                    {cumPct}%
                  </td>
                  <td style={{ ...tdS, textAlign: 'right', color: '#dc2626' }}>{r.late}</td>
                  <td style={{ ...tdS, textAlign: 'right', color: '#2563eb' }}>{r.early}</td>
                  <td style={{ ...tdS, textAlign: 'right', color: r.avg_dev_hours > 0 ? '#dc2626' : '#2563eb' }}>
                    {r.avg_dev_hours != null ? `${r.avg_dev_hours > 0 ? '+' : ''}${(r.avg_dev_hours / 24).toFixed(1)}d` : '—'}
                  </td>
                  <td style={{ ...tdS, fontSize: '0.65rem', color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.sample_hbls.join(', ') || '—'}
                  </td>
                </tr>
              );
            })}
            {lanes.length === 0 && (
              <tr>
                <td colSpan={10} style={{ ...tdS, textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
                  No failures to summarise
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterBar({ activeSection, setActiveSection, searchTerm, setSearchTerm }) {
  const sections = [
    { key: 'eta_2p', label: 'ETA 2P (Port)' },
    { key: 'eta_2d', label: 'ETA 2D (Delivery)' },
    { key: 'ref', label: 'Reference Completeness' },
    { key: 'lane_rca', label: 'ETA 2D Lane RCA' },
  ];

  return (
    <div style={{
      display: 'flex',
      gap: 16,
      alignItems: 'center',
      marginBottom: 16,
      padding: '12px 16px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      boxShadow: 'var(--shadow-sm)',
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {sections.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.72rem',
              fontWeight: activeSection === s.key ? 600 : 400,
              color: activeSection === s.key ? '#fff' : 'var(--text-muted)',
              background: activeSection === s.key ? 'var(--accent-blue)' : 'transparent',
              border: activeSection === s.key ? 'none' : '1px solid var(--border)',
              borderRadius: 5,
              padding: '5px 12px',
              cursor: 'pointer',
            }}
          >{s.label}</button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Search HBL, MBL, consignment..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          padding: '5px 10px',
          border: '1px solid var(--border)',
          borderRadius: 5,
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          outline: 'none',
          width: 220,
          marginLeft: 'auto',
        }}
      />
    </div>
  );
}


export default function ETARefRCA({ rcaData, selectedWeek, laneRcaData }) {
  const [activeSection, setActiveSection] = useState('eta_2p');
  const [searchTerm, setSearchTerm] = useState('');

  const weekData = rcaData?.find(d => d.week === selectedWeek);
  const etaRef = weekData?.eta_ref_rca;
  if (!etaRef) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>No ETA/Reference data available for {selectedWeek}</div>;

  const { eta_2p, eta_2d, ref } = etaRef;

  // Count early vs late and 7-day reference
  const early2p = eta_2p.failed_shipments.filter(s => s.deviation_hours != null && s.deviation_hours < 0).length;
  const late2p = eta_2p.failed_shipments.filter(s => s.deviation_hours != null && s.deviation_hours > 0).length;
  const within7d2p = eta_2p.failed_shipments.filter(s => s.deviation_hours != null && Math.abs(s.deviation_hours) <= 168).length;
  const beyond7d2p = eta_2p.failed_shipments.filter(s => s.deviation_hours != null && Math.abs(s.deviation_hours) > 168).length;
  const early2d = eta_2d.failed_shipments.filter(s => s.deviation_hours != null && s.deviation_hours < 0).length;
  const late2d = eta_2d.failed_shipments.filter(s => s.deviation_hours != null && s.deviation_hours > 0).length;
  const within7d2d = eta_2d.failed_shipments.filter(s => s.deviation_hours != null && Math.abs(s.deviation_hours) <= 168).length;
  const beyond7d2d = eta_2d.failed_shipments.filter(s => s.deviation_hours != null && Math.abs(s.deviation_hours) > 168).length;

  const formatDate = v => v ? v.replace('T', ' ').slice(0, 16) : '—';

  const etaColumns = [
    { key: 'hbl', label: 'HBL', bold: true, color: () => 'var(--accent-blue)' },
    { key: 'mbl', label: 'MBL' },
    { key: 'consignment', label: 'Consignment' },
    { key: 'transport', label: 'Transport' },
    { key: 'origin', label: 'Origin' },
    { key: 'dest', label: 'Destination' },
    { key: 'carrier', label: 'Carrier' },
    { key: 'eta_baseline', label: 'ETA Baseline', render: s => formatDate(s.eta_baseline || s.estimated) },
    { key: 'window_start', label: 'Window -48h', render: s => formatDate(s.window_start), color: () => '#6b7280' },
    { key: 'window_end', label: 'Window +48h', render: s => formatDate(s.window_end), color: () => '#6b7280' },
    { key: 'actual', label: 'Actual', render: s => formatDate(s.actual), bold: true },
    { key: 'deviation_days', label: 'Deviation', align: 'right',
      render: s => {
        if (s.deviation_days == null) return '—';
        const arrow = s.direction === 'late' ? '↑' : '↓';
        return `${arrow} ${Math.abs(s.deviation_days).toFixed(1)}d`;
      },
      color: s => s.direction === 'late' ? '#dc2626' : '#2563eb',
      bold: true
    },
    { key: 'direction', label: 'Early/Late', align: 'center',
      render: s => s.direction ? s.direction.toUpperCase() : '—',
      color: s => s.direction === 'late' ? '#dc2626' : '#2563eb'
    },
    { key: 'bosch_7d', label: 'Bosch 7d Ref', align: 'center',
      render: s => {
        if (s.deviation_hours == null) return '—';
        const within = Math.abs(s.deviation_hours) <= 168;
        return within ? 'Pass' : 'Fail';
      },
      color: s => {
        if (s.deviation_hours == null) return 'var(--text-muted)';
        return Math.abs(s.deviation_hours) <= 168 ? '#16a34a' : '#dc2626';
      },
      bold: true,
    },
  ];

  const refColumns = [
    { key: 'hbl', label: 'HBL', bold: true, color: () => 'var(--accent-blue)' },
    { key: 'mbl', label: 'MBL' },
    { key: 'consignment', label: 'Consignment' },
    { key: 'transport', label: 'Transport' },
    { key: 'origin', label: 'Origin' },
    { key: 'dest', label: 'Destination' },
    { key: 'carrier', label: 'Carrier' },
    { key: 'has_civ', label: 'CIV', render: s => s.has_civ ? 'Yes' : 'No',
      color: s => s.has_civ ? '#16a34a' : '#dc2626' },
    { key: 'has_dn', label: 'DN', render: s => s.has_dn ? 'Yes' : 'No',
      color: s => s.has_dn ? '#16a34a' : '#dc2626' },
  ];

  const handleExport = (data, cols, filename) => {
    const headers = cols.map(c => c.key);
    downloadCSV(data, headers, filename);
  };

  return (
    <div>
      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <MetricCard label="ETA 2P Accuracy" value={eta_2p.accepted} total={eta_2p.total}
          rate={eta_2p.rate} color={eta_2p.rate >= 0.5 ? '#16a34a' : '#dc2626'} />
        <MetricCard label="ETA 2P Failed" value={eta_2p.failed} total={eta_2p.total}
          rate={eta_2p.total > 0 ? eta_2p.failed / eta_2p.total : null} color="#dc2626" />
        <MetricCard label="ETA 2D Accuracy" value={eta_2d.accepted} total={eta_2d.total}
          rate={eta_2d.rate} color={eta_2d.rate >= 0.3 ? '#16a34a' : '#dc2626'} />
        <MetricCard label="ETA 2D Failed" value={eta_2d.failed} total={eta_2d.total}
          rate={eta_2d.total > 0 ? eta_2d.failed / eta_2d.total : null} color="#dc2626" />
        <MetricCard label="Ref Completeness" value={ref.complete} total={ref.total}
          rate={ref.rate} color={ref.rate >= 0.8 ? '#16a34a' : '#d97706'} />
        <MetricCard label="Ref Incomplete" value={ref.incomplete} total={ref.total}
          rate={ref.total > 0 ? ref.incomplete / ref.total : null} color="#d97706" />
      </div>

      {/* Early vs Late breakdown */}
      <div style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 20,
      }}>
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '12px 20px',
          flex: '1 1 280px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.7rem',
            fontWeight: 500,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 8,
          }}>ETA 2P Breakdown</div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 500, color: '#2563eb' }}>{early2p}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 6 }}>Early</span>
            </div>
            <div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 500, color: '#dc2626' }}>{late2p}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 6 }}>Late</span>
            </div>
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 500, color: '#16a34a' }}>{within7d2p}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 6 }}>Within 7d</span>
            </div>
            <div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 500, color: '#dc2626' }}>{beyond7d2p}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 6 }}>Beyond 7d</span>
            </div>
          </div>
        </div>
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '12px 20px',
          flex: '1 1 280px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.7rem',
            fontWeight: 500,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 8,
          }}>ETA 2D Breakdown</div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 500, color: '#2563eb' }}>{early2d}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 6 }}>Early</span>
            </div>
            <div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 500, color: '#dc2626' }}>{late2d}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 6 }}>Late</span>
            </div>
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 500, color: '#16a34a' }}>{within7d2d}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 6 }}>Within 7d</span>
            </div>
            <div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 500, color: '#dc2626' }}>{beyond7d2d}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 6 }}>Beyond 7d</span>
            </div>
          </div>
        </div>
      </div>

      <FilterBar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
      />

      {activeSection === 'eta_2p' && (
        <>
          <LaneBreakdownTable
            shipments={eta_2p.failed_shipments}
            title="ETA 2P Lanes Affected (Origin Country → Destination Country)"
          />
          <ShipmentTable
            shipments={eta_2p.failed_shipments}
            columns={etaColumns}
            searchTerm={searchTerm}
            title={`ETA 2P Failed Shipments (${eta_2p.total_failed_shipments} total)`}
            onExport={() => handleExport(eta_2p.failed_shipments, etaColumns, `eta_2p_failed_${selectedWeek}.csv`)}
          />
        </>
      )}

      {activeSection === 'eta_2d' && (
        <ShipmentTable
          shipments={eta_2d.failed_shipments}
          columns={etaColumns}
          searchTerm={searchTerm}
          title={`ETA 2D Failed Shipments (${eta_2d.total_failed_shipments} total)`}
          onExport={() => handleExport(eta_2d.failed_shipments, etaColumns, `eta_2d_failed_${selectedWeek}.csv`)}
        />
      )}

      {activeSection === 'ref' && (
        <ShipmentTable
          shipments={ref.incomplete_shipments}
          columns={refColumns}
          searchTerm={searchTerm}
          title={`Reference Incomplete Shipments (${ref.total_incomplete_shipments} total)`}
          onExport={() => handleExport(ref.incomplete_shipments, refColumns, `ref_incomplete_${selectedWeek}.csv`)}
        />
      )}

      {activeSection === 'lane_rca' && (
        <ETA2DLaneRCA laneRcaData={laneRcaData} selectedWeek={selectedWeek} />
      )}
    </div>
  );
}
