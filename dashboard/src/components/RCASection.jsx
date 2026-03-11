import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from 'recharts';

const SEVERITY_COLORS = {
  critical: '#dc2626',
  warning: '#d97706',
  ok: '#16a34a',
};

function downloadCSV(rows, headers, headerLabels, filename) {
  const csvRows = [headerLabels.join(',')];
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

const SEVERITY_BG = {
  critical: 'rgba(220,38,38,0.08)',
  warning: 'rgba(217,119,6,0.06)',
  ok: 'rgba(22,163,74,0.06)',
};

function SeverityBadge({ severity }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '0.65rem',
      fontWeight: 500,
      color: SEVERITY_COLORS[severity],
      background: SEVERITY_BG[severity],
      padding: '2px 8px',
      borderRadius: 4,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
    }}>
      {severity}
    </span>
  );
}

function SummaryCards({ data }) {
  const cards = [
    { label: 'Critical', value: data.critical_issues, color: SEVERITY_COLORS.critical, bg: SEVERITY_BG.critical },
    { label: 'Warning', value: data.warning_issues, color: SEVERITY_COLORS.warning, bg: SEVERITY_BG.warning },
    { label: 'On Target', value: data.ok_issues, color: SEVERITY_COLORS.ok, bg: SEVERITY_BG.ok },
    { label: 'Missing Statuses', value: data.total_missing, color: 'var(--text-primary)', bg: 'var(--bg-accent)' },
  ];

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
      {cards.map((c, i) => (
        <div key={i} style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '14px 20px',
          minWidth: 140,
          flex: '1 1 140px',
          boxShadow: 'var(--shadow-sm)',
          borderLeft: `3px solid ${c.color}`,
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.7rem',
            fontWeight: 500,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 4,
          }}>{c.label}</div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.6rem',
            fontWeight: 500,
            color: c.color,
          }}>{c.value.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

function GapChart({ milestones, metric }) {
  const isComp = metric === 'completeness';
  const target = isComp ? 0.95 : 0.70;
  const label = isComp ? 'Completeness Gap' : 'Timeliness Gap';

  const chartData = milestones
    .filter(m => (isComp ? m.comp_gap : m.time_gap) > 0)
    .sort((a, b) => (isComp ? b.comp_gap - a.comp_gap : b.time_gap - a.time_gap))
    .slice(0, 15)
    .map(m => ({
      name: `${m.scenario} ${m.code} ${m.type.charAt(0)}`,
      gap: (isComp ? m.comp_gap : m.time_gap) * 100,
      value: (isComp ? m.completeness : m.timeliness) * 100,
      severity: m.severity,
      fullName: `${m.scenario} ${m.code} - ${m.name} (${m.type})`,
    }));

  if (!chartData.length) return null;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '20px 24px 12px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.85rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: 16,
      }}>
        {label} (top {chartData.length} — target {(target * 100).toFixed(0)}%)
      </div>
      <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 28 + 40)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 120 }}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
            tickFormatter={v => `${v}pp`}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={115}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div style={{
                  background: '#fff',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '10px 14px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  boxShadow: 'var(--shadow-md)',
                }}>
                  <div style={{ color: 'var(--text-primary)', marginBottom: 4, fontFamily: 'var(--font-display)' }}>{d.fullName}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>Current: {d.value.toFixed(1)}%</div>
                  <div style={{ color: SEVERITY_COLORS[d.severity] }}>Gap: {d.gap.toFixed(1)}pp</div>
                </div>
              );
            }}
          />
          <Bar dataKey="gap" radius={[0, 3, 3, 0]} maxBarSize={18}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={SEVERITY_COLORS[d.severity]} opacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const SORT_COLS = [
  { key: 'code', label: 'Milestone' },
  { key: 'required', label: 'Required' },
  { key: 'completeness', label: 'Comp%' },
  { key: 'timeliness', label: 'Time%' },
  { key: 'missing', label: 'Missing' },
  { key: 'late', label: 'Late' },
];

function MilestoneTable({ milestones, onSelectMilestone, selectedMilestone, sortConfig, onSort, selectedWeek }) {
  const sortIndicator = (col) => {
    if (sortConfig.key !== col) return '';
    return sortConfig.dir === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Milestone Detail ({milestones.length} rows)
        </span>
        <button
          onClick={() => {
            const headers = ['scenario', 'code', 'name', 'type', 'is_critical', 'required', 'available', 'in_time', 'missing', 'late', 'completeness', 'timeliness', 'severity'];
            const labels = ['Scenario', 'Code', 'Name', 'Type', 'Critical', 'Required', 'Available', 'In Time', 'Missing', 'Late', 'Completeness', 'Timeliness', 'Severity'];
            const rows = milestones.map(m => ({
              ...m,
              completeness: (m.completeness * 100).toFixed(1) + '%',
              timeliness: (m.timeliness * 100).toFixed(1) + '%',
            }));
            downloadCSV(rows, headers, labels, `milestone_rca_${selectedWeek}.csv`);
          }}
          style={{
            fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 500,
            color: '#fff', background: 'var(--accent-blue)', border: 'none',
            borderRadius: 5, padding: '5px 12px', cursor: 'pointer',
          }}
        >Export CSV</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {[
                { key: null, label: '#', align: 'right', sortable: false },
                { key: 'code', label: 'Milestone', align: 'left', sortable: true },
                { key: null, label: 'Scenario', align: 'right', sortable: false },
                { key: null, label: 'Type', align: 'right', sortable: false },
                { key: 'required', label: 'Required', align: 'right', sortable: true },
                { key: 'available', label: 'Available', align: 'right', sortable: true },
                { key: 'in_time', label: 'In Time', align: 'right', sortable: true },
                { key: 'completeness', label: 'Comp%', align: 'right', sortable: true },
                { key: 'timeliness', label: 'Time%', align: 'right', sortable: true },
                { key: 'missing', label: 'Missing', align: 'right', sortable: true },
                { key: 'late', label: 'Late', align: 'right', sortable: true },
                { key: 'severity', label: 'Severity', align: 'right', sortable: true },
              ].map(h => (
                <th
                  key={h.label}
                  onClick={h.sortable ? () => onSort(h.key) : undefined}
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: sortConfig.key === h.key ? 'var(--accent-blue)' : 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '10px 10px',
                    textAlign: h.align,
                    whiteSpace: 'nowrap',
                    cursor: h.sortable ? 'pointer' : 'default',
                    userSelect: 'none',
                  }}
                >
                  {h.label}{h.sortable ? sortIndicator(h.key) : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {milestones.map((m, i) => {
              const isSelected = selectedMilestone &&
                selectedMilestone.code === m.code &&
                selectedMilestone.type === m.type &&
                selectedMilestone.scenario === m.scenario;
              return (
                <tr
                  key={i}
                  onClick={() => onSelectMilestone(m)}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--bg-accent)' : 'transparent',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.background = '#f8f9fb';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <td style={{ ...cellBase, textAlign: 'right', color: 'var(--text-muted)' }}>{i + 1}</td>
                  <td style={{ ...cellBase, textAlign: 'left' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{m.code}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: '0.72rem' }}>
                      {m.name}
                    </span>
                    {m.is_critical && (
                      <span style={{
                        marginLeft: 6,
                        fontSize: '0.55rem',
                        color: 'var(--accent-amber)',
                        border: '1px solid var(--accent-amber)',
                        borderRadius: 3,
                        padding: '0 4px',
                        verticalAlign: 'middle',
                        opacity: 0.8,
                      }}>KEY</span>
                    )}
                  </td>
                  <td style={{ ...cellBase, textAlign: 'right' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.7rem',
                      color: m.scenario === 'SC3' ? 'var(--accent-cyan)' : 'var(--accent-blue)',
                    }}>{m.scenario}</span>
                  </td>
                  <td style={{ ...cellBase, textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                    {m.type}
                  </td>
                  <td style={{ ...cellBase, ...monoRight }}>{m.required}</td>
                  <td style={{ ...cellBase, ...monoRight }}>{m.available}</td>
                  <td style={{ ...cellBase, ...monoRight }}>{m.in_time}</td>
                  <td style={{ ...cellBase, ...monoRight, color: pctColor(m.completeness, 0.95) }}>
                    {(m.completeness * 100).toFixed(1)}%
                  </td>
                  <td style={{ ...cellBase, ...monoRight, color: pctColor(m.timeliness, 0.70) }}>
                    {(m.timeliness * 100).toFixed(1)}%
                  </td>
                  <td style={{ ...cellBase, ...monoRight, color: m.missing > 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                    {m.missing}
                  </td>
                  <td style={{ ...cellBase, ...monoRight, color: m.late > 0 ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
                    {m.late}
                  </td>
                  <td style={{ ...cellBase, textAlign: 'right' }}>
                    <SeverityBadge severity={m.severity} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const cellBase = {
  fontFamily: 'var(--font-display)',
  fontSize: '0.78rem',
  padding: '8px 10px',
};

const monoRight = {
  fontFamily: 'var(--font-mono)',
  textAlign: 'right',
  fontSize: '0.78rem',
  color: 'var(--text-secondary)',
};

function pctColor(val, target) {
  if (val >= target) return 'var(--accent-green)';
  if (val >= target * 0.85) return 'var(--accent-amber)';
  return 'var(--accent-red)';
}

const DRILLDOWN_PAGE_SIZE = 50;

function DrilldownPagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  const maxVisible = 7;
  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
  if (start > 1) { pages.push(1); if (start > 2) pages.push('...'); }
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages) { if (end < totalPages - 1) pages.push('...'); pages.push(totalPages); }

  const btnBase = {
    fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
    border: '1px solid var(--border)', borderRadius: 4,
    padding: '4px 10px', cursor: 'pointer',
    background: 'transparent', color: 'var(--text-secondary)',
  };
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center', padding: '12px 0' }}>
      <button onClick={() => onPageChange(page - 1)} disabled={page === 1}
        style={{ ...btnBase, opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? 'default' : 'pointer' }}>Prev</button>
      {pages.map((p, i) => p === '...'
        ? <span key={`e${i}`} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0 4px' }}>...</span>
        : <button key={p} onClick={() => onPageChange(p)} style={{
            ...btnBase, background: p === page ? 'var(--accent-blue)' : 'transparent',
            color: p === page ? '#fff' : 'var(--text-secondary)',
            border: p === page ? '1px solid var(--accent-blue)' : '1px solid var(--border)',
            fontWeight: p === page ? 600 : 400,
          }}>{p}</button>
      )}
      <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages}
        style={{ ...btnBase, opacity: page === totalPages ? 0.4 : 1, cursor: page === totalPages ? 'default' : 'pointer' }}>Next</button>
    </div>
  );
}

function ShipmentDrilldown({ milestone, searchTerm, setSearchTerm, cancelledHBLs }) {
  const cancelledSet = useMemo(() => new Set(cancelledHBLs || []), [cancelledHBLs]);
  const [page, setPage] = useState(1);
  const [prevMilestoneKey, setPrevMilestoneKey] = useState(null);

  // Reset page when milestone or search changes
  const milestoneKey = milestone ? `${milestone.scenario}-${milestone.code}-${milestone.type}` : null;
  if (milestoneKey !== prevMilestoneKey) {
    setPrevMilestoneKey(milestoneKey);
    if (page !== 1) setPage(1);
  }

  if (!milestone || !milestone.missing_shipments?.length) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '32px 24px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-display)',
        fontSize: '0.85rem',
        boxShadow: 'var(--shadow-sm)',
      }}>
        {milestone
          ? `No missing shipments for ${milestone.scenario} ${milestone.code} (${milestone.type})`
          : 'Click a milestone row above to see missing shipments'}
      </div>
    );
  }

  const issc4 = milestone.scenario === 'SC4';
  const term = searchTerm.toLowerCase();
  const filtered = term
    ? milestone.missing_shipments.filter(s =>
        (s.hbl || '').toLowerCase().includes(term) ||
        (s.mbl || '').toLowerCase().includes(term) ||
        (s.consignment || '').toLowerCase().includes(term) ||
        (s.load_to || '').toLowerCase().includes(term) ||
        (s.service || '').toLowerCase().includes(term)
      )
    : milestone.missing_shipments;

  const totalPages = Math.ceil(filtered.length / DRILLDOWN_PAGE_SIZE);
  const currentPage = Math.min(page, totalPages || 1);
  const pageData = filtered.slice((currentPage - 1) * DRILLDOWN_PAGE_SIZE, currentPage * DRILLDOWN_PAGE_SIZE);
  const startIdx = (currentPage - 1) * DRILLDOWN_PAGE_SIZE;

  const handleExportShipments = () => {
    const enriched = filtered.map(s => ({ ...s, status: cancelledSet.has(s.hbl) ? 'Cancelled' : 'Active' }));
    const headers = issc4
      ? ['hbl', 'mbl', 'consignment', 'service', 'status']
      : ['hbl', 'mbl', 'load_to', 'service', 'status'];
    const labels = issc4
      ? ['HBL', 'MBL', 'Consignment', 'Service', 'Status']
      : ['HBL', 'MBL', 'Load/TO', 'Service', 'Status'];
    downloadCSV(enriched, headers, labels, `${milestone.scenario}_${milestone.code}_${milestone.type}_missing.csv`);
  };

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
        }}>
          <span style={{ color: SEVERITY_COLORS[milestone.severity] }}>
            {milestone.code}
          </span>
          {' '}{milestone.name} ({milestone.type}) — Missing Shipments
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="text"
            placeholder="Search HBL, MBL..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              padding: '5px 10px',
              border: '1px solid var(--border)',
              borderRadius: 5,
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              outline: 'none',
              width: 180,
            }}
          />
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}>
            {filtered.length} of {milestone.total_missing_shipments}
          </div>
          <button
            onClick={handleExportShipments}
            style={{
              fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 500,
              color: '#fff', background: 'var(--accent-blue)', border: 'none',
              borderRadius: 5, padding: '5px 12px', cursor: 'pointer',
            }}
          >Export CSV</button>
        </div>
      </div>
      <div style={{ overflowX: 'auto', maxHeight: 520 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
              {['#', 'HBL', 'MBL', issc4 ? 'Consignment' : 'Load/TO', 'Service', 'Status'].map(h => (
                <th key={h} style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '8px 12px',
                  textAlign: 'left',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((s, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8f9fb'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ ...shipCell, color: 'var(--text-muted)' }}>{startIdx + i + 1}</td>
                <td style={{ ...shipCell, color: 'var(--accent-blue)', fontWeight: 500 }}>
                  {s.hbl || '—'}
                </td>
                <td style={shipCell}>{s.mbl || '—'}</td>
                <td style={shipCell}>{issc4 ? (s.consignment || '—') : (s.load_to || '—')}</td>
                <td style={shipCell}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    color: 'var(--text-secondary)',
                    background: 'var(--bg-accent)',
                    padding: '2px 6px',
                    borderRadius: 3,
                  }}>{s.service}</span>
                </td>
                <td style={shipCell}>
                  {(() => {
                    const isCancelled = cancelledSet.has(s.hbl);
                    return (
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.62rem',
                        fontWeight: 600,
                        padding: '2px 7px',
                        borderRadius: 3,
                        color: isCancelled ? '#dc2626' : '#16a34a',
                        background: isCancelled ? '#dc262610' : '#16a34a10',
                        border: `1px solid ${isCancelled ? '#dc262625' : '#16a34a25'}`,
                      }}>{isCancelled ? 'Cancelled' : 'Active'}</span>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DrilldownPagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

const shipCell = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.75rem',
  padding: '6px 12px',
  color: 'var(--text-secondary)',
};

function Filters({ filters, setFilters }) {
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
      display: 'flex',
      gap: 16,
      flexWrap: 'wrap',
      alignItems: 'center',
      marginBottom: 16,
      padding: '12px 16px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', color: 'var(--text-muted)', marginRight: 4, fontWeight: 500 }}>Scenario:</span>
        {['All', 'SC3', 'SC4'].map(s => (
          <button key={s} style={btnStyle(filters.scenario === s)}
            onClick={() => setFilters(f => ({ ...f, scenario: s }))}>{s}</button>
        ))}
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', color: 'var(--text-muted)', marginRight: 4, fontWeight: 500 }}>Type:</span>
        {['All', 'Actual', 'Estimated'].map(t => (
          <button key={t} style={btnStyle(filters.type === t)}
            onClick={() => setFilters(f => ({ ...f, type: t }))}>{t}</button>
        ))}
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <button style={btnStyle(filters.criticalOnly)}
          onClick={() => setFilters(f => ({ ...f, criticalOnly: !f.criticalOnly }))}>
          Key Milestones Only
        </button>
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', color: 'var(--text-muted)', marginRight: 4, fontWeight: 500 }}>Severity:</span>
        {['All', 'critical', 'warning', 'ok'].map(s => (
          <button key={s} style={btnStyle(filters.severity === s)}
            onClick={() => setFilters(f => ({ ...f, severity: s }))}>
            {s === 'All' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}


export default function RCASection({ rcaData, selectedWeek, cancelledHBLs }) {
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    scenario: 'All',
    type: 'All',
    criticalOnly: false,
    severity: 'All',
  });
  const [sortConfig, setSortConfig] = useState({ key: 'missing', dir: 'desc' });

  const weekData = rcaData?.find(d => d.week === selectedWeek);
  if (!weekData) return null;

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  };

  const filteredMilestones = useMemo(() => {
    let ms = weekData.milestones;
    if (filters.scenario !== 'All') ms = ms.filter(m => m.scenario === filters.scenario);
    if (filters.type !== 'All') ms = ms.filter(m => m.type === filters.type);
    if (filters.criticalOnly) ms = ms.filter(m => m.is_critical);
    if (filters.severity !== 'All') ms = ms.filter(m => m.severity === filters.severity);

    // Sort
    const { key, dir } = sortConfig;
    const sorted = [...ms].sort((a, b) => {
      let va = a[key], vb = b[key];
      if (typeof va === 'string') {
        va = va.toLowerCase();
        vb = (vb || '').toLowerCase();
        return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return dir === 'asc' ? (va ?? 0) - (vb ?? 0) : (vb ?? 0) - (va ?? 0);
    });
    return sorted;
  }, [weekData, filters, sortConfig]);

  return (
    <div>
      <SummaryCards data={weekData} />
      <Filters filters={filters} setFilters={setFilters} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: 16,
        marginBottom: 20,
      }}>
        <GapChart milestones={filteredMilestones} metric="completeness" />
        <GapChart milestones={filteredMilestones} metric="timeliness" />
      </div>

      <div style={{ marginBottom: 20 }}>
        <MilestoneTable
          milestones={filteredMilestones}
          onSelectMilestone={setSelectedMilestone}
          selectedMilestone={selectedMilestone}
          sortConfig={sortConfig}
          onSort={handleSort}
          selectedWeek={selectedWeek}
        />
      </div>

      <ShipmentDrilldown
        milestone={selectedMilestone}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        cancelledHBLs={cancelledHBLs}
      />
    </div>
  );
}
