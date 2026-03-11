import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, PieChart, Pie,
} from 'recharts';

const PAGE_SIZE = 50;
const COLORS = { SC3: '#0891b2', SC4: '#2563eb', LCL: '#7c3aed', FCL: '#d97706', BCO: '#16a34a' };

const S = {
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '24px 28px',
    boxShadow: 'var(--shadow-sm)',
  },
  cardTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: 16,
  },
};

function buildHBLData(rcaData, selectedWeek) {
  if (!rcaData) return [];
  const weekData = rcaData.find(w => w.week === selectedWeek);
  if (!weekData) return [];

  const hblMap = {};
  for (const m of weekData.milestones) {
    for (const s of (m.missing_shipments || [])) {
      const hbl = s.hbl || '';
      if (!hbl || hbl.includes('TEMPLATE')) continue;
      if (!hblMap[hbl]) {
        hblMap[hbl] = {
          hbl,
          mbl: s.mbl || '',
          service: s.service || '',
          scenario: m.scenario,
          load_to: s.load_to || '',
          consignment: s.consignment || '',
          milestones: new Set(),
          milestoneList: [],
        };
      }
      const key = `${m.scenario}_${m.code}_${m.type}`;
      if (!hblMap[hbl].milestones.has(key)) {
        hblMap[hbl].milestones.add(key);
        hblMap[hbl].milestoneList.push({
          scenario: m.scenario,
          code: m.code,
          name: m.name,
          type: m.type,
          is_critical: m.is_critical,
        });
      }
      if (!hblMap[hbl].service) hblMap[hbl].service = s.service || '';
      if (!hblMap[hbl].mbl) hblMap[hbl].mbl = s.mbl || '';
    }
  }

  return Object.values(hblMap)
    .map(h => ({ ...h, missing_count: h.milestones.size }))
    .sort((a, b) => b.missing_count - a.missing_count);
}

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }
  const btn = (label, onClick, active, disabled) => (
    <button
      key={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.7rem',
        padding: '4px 10px',
        border: `1px solid ${active ? '#2563eb' : 'var(--border)'}`,
        borderRadius: 4,
        background: active ? '#2563eb' : 'transparent',
        color: active ? '#fff' : disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >{label}</button>
  );
  return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 12 }}>
      {btn('Prev', () => onPageChange(page - 1), false, page === 1)}
      {pages.map((p, i) => p === '...'
        ? <span key={`e${i}`} style={{ padding: '4px 6px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>...</span>
        : btn(String(p), () => onPageChange(p), p === page, false)
      )}
      {btn('Next', () => onPageChange(page + 1), false, page === totalPages)}
    </div>
  );
}

function DistributionChart({ hblData }) {
  const distData = useMemo(() => {
    const buckets = { '1': 0, '2': 0, '3-4': 0, '5-7': 0, '8-10': 0, '11+': 0 };
    hblData.forEach(h => {
      const c = h.missing_count;
      if (c === 1) buckets['1']++;
      else if (c === 2) buckets['2']++;
      else if (c <= 4) buckets['3-4']++;
      else if (c <= 7) buckets['5-7']++;
      else if (c <= 10) buckets['8-10']++;
      else buckets['11+']++;
    });
    return Object.entries(buckets).map(([name, count]) => ({ name, count }));
  }, [hblData]);

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Missing Milestone Distribution (HBL count by # missing)</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={distData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }} />
          <YAxis tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }} />
          <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }} />
          <Bar dataKey="count" name="HBLs" radius={[4, 4, 0, 0]}>
            {distData.map((_, i) => <Cell key={i} fill={i >= 4 ? '#dc2626' : i >= 2 ? '#d97706' : '#2563eb'} opacity={0.85} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function BreakdownCharts({ hblData }) {
  const scenarioData = useMemo(() => {
    const map = {};
    hblData.forEach(h => {
      map[h.scenario] = (map[h.scenario] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [hblData]);

  const serviceData = useMemo(() => {
    const map = {};
    hblData.forEach(h => {
      const svc = h.service || 'Unknown';
      map[svc] = (map[svc] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [hblData]);

  const renderLabel = ({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div style={S.card}>
        <div style={S.cardTitle}>By Scenario</div>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={scenarioData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={renderLabel}>
              {scenarioData.map((d, i) => <Cell key={i} fill={COLORS[d.name] || '#64748b'} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>By Service Type</div>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={serviceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={renderLabel}>
              {serviceData.map((d, i) => <Cell key={i} fill={COLORS[d.name] || '#64748b'} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function HBLDetail({ hbl, onClose }) {
  return (
    <div style={{
      ...S.card,
      borderLeft: `4px solid ${COLORS[hbl.scenario] || '#2563eb'}`,
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {hbl.hbl}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {hbl.scenario} | {hbl.service} | MBL: {hbl.mbl || '—'} | {hbl.load_to || hbl.consignment || ''}
          </div>
        </div>
        <button onClick={onClose} style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.75rem', background: 'var(--bg-secondary)',
          border: '1px solid var(--border)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', color: 'var(--text-muted)',
        }}>Close</button>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, color: '#dc2626', marginBottom: 10 }}>
        {hbl.missing_count} milestones missing
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
        {hbl.milestoneList.map((m, i) => (
          <div key={i} style={{
            padding: '6px 10px',
            background: m.is_critical ? '#dc262608' : 'var(--bg-secondary)',
            border: `1px solid ${m.is_critical ? '#dc262620' : 'var(--border)'}`,
            borderRadius: 5,
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ color: 'var(--text-primary)' }}>
              {m.code} {m.name.slice(0, 25)}
            </span>
            <span style={{ display: 'flex', gap: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>{m.type.slice(0, 3)}</span>
              {m.is_critical && <span style={{ color: '#dc2626', fontWeight: 700 }}>C</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function downloadCSV(data) {
  const headers = ['HBL', 'MBL', 'Scenario', 'Service', 'Missing Count', 'Missing Milestones'];
  const rows = data.map(h => [
    h.hbl,
    h.mbl,
    h.scenario,
    h.service,
    h.missing_count,
    h.milestoneList.map(m => `${m.code} ${m.name} (${m.type})`).join('; '),
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hbl_missing_milestones.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function HBLAnalysis({ rcaData, selectedWeek }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterScenario, setFilterScenario] = useState('all');
  const [filterService, setFilterService] = useState('all');
  const [minMissing, setMinMissing] = useState(1);
  const [selectedHBL, setSelectedHBL] = useState(null);

  const allHBLs = useMemo(() => buildHBLData(rcaData, selectedWeek), [rcaData, selectedWeek]);

  const filtered = useMemo(() => {
    return allHBLs.filter(h => {
      if (filterScenario !== 'all' && h.scenario !== filterScenario) return false;
      if (filterService !== 'all' && h.service !== filterService) return false;
      if (h.missing_count < minMissing) return false;
      if (search) {
        const q = search.toLowerCase();
        return h.hbl.toLowerCase().includes(q) || h.mbl.toLowerCase().includes(q);
      }
      return true;
    });
  }, [allHBLs, filterScenario, filterService, minMissing, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const currentPage = Math.min(page, totalPages || 1);
  const pageData = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset page on filter change
  const resetPage = () => setPage(1);

  const severeCount = allHBLs.filter(h => h.missing_count >= 10).length;
  const avgMissing = allHBLs.length > 0 ? (allHBLs.reduce((s, h) => s + h.missing_count, 0) / allHBLs.length).toFixed(1) : 0;

  const filterBtn = (active, onClick, label) => (
    <button
      onClick={() => { onClick(); resetPage(); }}
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.7rem',
        fontWeight: active ? 600 : 400,
        color: active ? 'var(--accent-blue)' : 'var(--text-muted)',
        background: active ? '#2563eb10' : 'transparent',
        border: `1px solid ${active ? '#2563eb40' : 'var(--border)'}`,
        borderRadius: 5,
        padding: '4px 12px',
        cursor: 'pointer',
      }}
    >{label}</button>
  );

  return (
    <div>
      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Impacted HBLs', value: allHBLs.length, color: 'var(--text-primary)' },
          { label: 'Severe (10+ missing)', value: severeCount, color: '#dc2626' },
          { label: 'Avg Missing/HBL', value: avgMissing, color: '#d97706' },
          { label: 'SC4 HBLs', value: allHBLs.filter(h => h.scenario === 'SC4').length, color: '#2563eb' },
          { label: 'SC3 HBLs', value: allHBLs.filter(h => h.scenario === 'SC3').length, color: '#0891b2' },
        ].map((c, i) => (
          <div key={i} style={{ ...S.card, padding: '14px 18px', animation: `fadeInUp 0.3s ease-out ${i * 0.05}s both` }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <DistributionChart hblData={allHBLs} />
        <BreakdownCharts hblData={allHBLs} />
      </div>

      {/* Selected HBL detail */}
      {selectedHBL && <HBLDetail hbl={selectedHBL} onClose={() => setSelectedHBL(null)} />}

      {/* Table */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={S.cardTitle}>HBL Missing Milestone Detail</div>
          <button
            onClick={() => downloadCSV(filtered)}
            style={{
              fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 500,
              color: '#2563eb', background: '#2563eb10', border: '1px solid #2563eb30',
              borderRadius: 5, padding: '5px 14px', cursor: 'pointer',
            }}
          >Export CSV ({filtered.length})</button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>Scenario:</span>
          {filterBtn(filterScenario === 'all', () => setFilterScenario('all'), 'All')}
          {filterBtn(filterScenario === 'SC3', () => setFilterScenario('SC3'), 'SC3')}
          {filterBtn(filterScenario === 'SC4', () => setFilterScenario('SC4'), 'SC4')}

          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 8 }}>Service:</span>
          {filterBtn(filterService === 'all', () => setFilterService('all'), 'All')}
          {filterBtn(filterService === 'LCL', () => setFilterService('LCL'), 'LCL')}
          {filterBtn(filterService === 'FCL', () => setFilterService('FCL'), 'FCL')}
          {filterBtn(filterService === 'BCO', () => setFilterService('BCO'), 'BCO')}

          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 8 }}>Min missing:</span>
          <select
            value={minMissing}
            onChange={e => { setMinMissing(Number(e.target.value)); resetPage(); }}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.7rem', padding: '3px 8px',
              border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-secondary)', color: 'var(--text-primary)',
            }}
          >
            {[1, 3, 5, 8, 10].map(v => <option key={v} value={v}>{v}+</option>)}
          </select>

          <input
            type="text"
            placeholder="Search HBL/MBL..."
            value={search}
            onChange={e => { setSearch(e.target.value); resetPage(); }}
            style={{
              fontFamily: 'var(--font-display)', fontSize: '0.75rem', padding: '5px 12px',
              border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)',
              color: 'var(--text-primary)', outline: 'none', width: 180, marginLeft: 'auto',
            }}
          />
        </div>

        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 10 }}>
          {filtered.length} of {allHBLs.length} HBLs — Page {currentPage} of {totalPages || 1}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['#', 'HBL', 'MBL', 'SC', 'Service', 'Missing', 'Milestones'].map(h => (
                  <th key={h} style={{
                    padding: '8px 10px', textAlign: 'left',
                    fontFamily: 'var(--font-display)', fontSize: '0.63rem', fontWeight: 600,
                    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.map((h, i) => {
                const rowNum = (currentPage - 1) * PAGE_SIZE + i + 1;
                return (
                  <tr
                    key={h.hbl}
                    onClick={() => setSelectedHBL(selectedHBL?.hbl === h.hbl ? null : h)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: selectedHBL?.hbl === h.hbl ? '#2563eb08' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#2563eb06'}
                    onMouseLeave={e => e.currentTarget.style.background = selectedHBL?.hbl === h.hbl ? '#2563eb08' : 'transparent'}
                  >
                    <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{rowNum}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>{h.hbl}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{h.mbl || '—'}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: COLORS[h.scenario] }}>{h.scenario}</td>
                    <td style={{ padding: '8px 10px' }}>{h.service}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{
                        fontWeight: 700,
                        color: h.missing_count >= 10 ? '#dc2626' : h.missing_count >= 5 ? '#d97706' : 'var(--text-primary)',
                        background: h.missing_count >= 10 ? '#dc262612' : h.missing_count >= 5 ? '#d9770612' : 'transparent',
                        padding: '2px 8px',
                        borderRadius: 3,
                      }}>{h.missing_count}</span>
                    </td>
                    <td style={{ padding: '8px 10px', maxWidth: 350 }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {h.milestoneList.slice(0, 5).map((m, j) => (
                          <span key={j} style={{
                            fontSize: '0.6rem',
                            padding: '1px 5px',
                            borderRadius: 3,
                            background: m.is_critical ? '#dc262610' : 'var(--bg-secondary)',
                            border: `1px solid ${m.is_critical ? '#dc262620' : 'var(--border)'}`,
                            color: 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                          }}>{m.code}</span>
                        ))}
                        {h.milestoneList.length > 5 && (
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', padding: '1px 4px' }}>
                            +{h.milestoneList.length - 5}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}