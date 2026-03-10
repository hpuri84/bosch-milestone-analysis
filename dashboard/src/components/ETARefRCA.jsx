import { useState, useMemo } from 'react';

const SEVERITY_COLORS = {
  critical: '#dc2626',
  warning: '#d97706',
  ok: '#16a34a',
};

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

function ShipmentTable({ shipments, columns, searchTerm, title, onExport }) {
  const term = searchTerm.toLowerCase();
  const filtered = term
    ? shipments.filter(s =>
        columns.some(c => (String(s[c.key] ?? '')).toLowerCase().includes(term))
      )
    : shipments;

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
      <div style={{ overflowX: 'auto', maxHeight: 420 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
              <th style={thStyle}>#</th>
              {columns.map(c => (
                <th key={c.key} style={{ ...thStyle, textAlign: c.align || 'left' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8f9fb'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{i + 1}</td>
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
};

const tdStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.75rem',
  padding: '6px 12px',
  color: 'var(--text-secondary)',
};

function FilterBar({ activeSection, setActiveSection, searchTerm, setSearchTerm }) {
  const sections = [
    { key: 'eta_2p', label: 'ETA 2P (Port)' },
    { key: 'eta_2d', label: 'ETA 2D (Delivery)' },
    { key: 'ref', label: 'Reference Completeness' },
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


export default function ETARefRCA({ rcaData, selectedWeek }) {
  const [activeSection, setActiveSection] = useState('eta_2p');
  const [searchTerm, setSearchTerm] = useState('');

  const weekData = rcaData?.find(d => d.week === selectedWeek);
  const etaRef = weekData?.eta_ref_rca;
  if (!etaRef) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>No ETA/Reference data available for {selectedWeek}</div>;

  const { eta_2p, eta_2d, ref } = etaRef;

  const etaColumns = [
    { key: 'hbl', label: 'HBL', bold: true, color: () => 'var(--accent-blue)' },
    { key: 'mbl', label: 'MBL' },
    { key: 'consignment', label: 'Consignment' },
    { key: 'transport', label: 'Transport' },
    { key: 'origin', label: 'Origin' },
    { key: 'dest', label: 'Destination' },
    { key: 'carrier', label: 'Carrier' },
    { key: 'deviation_hours', label: 'Deviation (h)', align: 'right',
      render: s => s.deviation_hours != null ? `${s.deviation_hours}h` : '—',
      color: s => s.deviation_hours != null ? (Math.abs(s.deviation_hours) > 48 ? '#dc2626' : '#d97706') : 'var(--text-muted)' },
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

      <FilterBar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
      />

      {activeSection === 'eta_2p' && (
        <ShipmentTable
          shipments={eta_2p.failed_shipments}
          columns={etaColumns}
          searchTerm={searchTerm}
          title={`ETA 2P Failed Shipments (${eta_2p.total_failed_shipments} total — showing ${Math.min(100, eta_2p.total_failed_shipments)})`}
          onExport={() => handleExport(eta_2p.failed_shipments, etaColumns, `eta_2p_failed_${selectedWeek}.csv`)}
        />
      )}

      {activeSection === 'eta_2d' && (
        <ShipmentTable
          shipments={eta_2d.failed_shipments}
          columns={etaColumns}
          searchTerm={searchTerm}
          title={`ETA 2D Failed Shipments (${eta_2d.total_failed_shipments} total — showing ${Math.min(100, eta_2d.total_failed_shipments)})`}
          onExport={() => handleExport(eta_2d.failed_shipments, etaColumns, `eta_2d_failed_${selectedWeek}.csv`)}
        />
      )}

      {activeSection === 'ref' && (
        <ShipmentTable
          shipments={ref.incomplete_shipments}
          columns={refColumns}
          searchTerm={searchTerm}
          title={`Reference Incomplete Shipments (${ref.total_incomplete_shipments} total — showing ${Math.min(100, ref.total_incomplete_shipments)})`}
          onExport={() => handleExport(ref.incomplete_shipments, refColumns, `ref_incomplete_${selectedWeek}.csv`)}
        />
      )}
    </div>
  );
}
