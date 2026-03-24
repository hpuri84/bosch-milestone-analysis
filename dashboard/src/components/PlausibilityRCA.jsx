import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, PieChart, Pie,
} from 'recharts';

// Color palette for milestone pairs
const PAIR_COLORS = [
  '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#059669',
  '#db2777', '#ea580c', '#4f46e5', '#0d9488', '#84cc16',
  '#6366f1', '#f43f5e', '#14b8a6', '#f59e0b', '#8b5cf6',
];

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

function SummaryCards({ data }) {
  const compliance = ((data.total_shipments - data.affected_hbls) / data.total_shipments * 100);
  const cards = [
    { label: 'Total Shipments', value: data.total_shipments, color: 'var(--text-primary)' },
    { label: 'SC3 Shipments', value: data.sc3_shipments || 0, color: '#d97706' },
    { label: 'SC4 Shipments', value: data.sc4_shipments || 0, color: '#059669' },
    { label: 'Affected HBLs', value: data.affected_hbls, color: '#dc2626' },
    { label: 'Total Violations', value: data.total_violations, color: '#d97706' },
    { label: 'Compliance Rate', value: `${compliance.toFixed(1)}%`,
      color: compliance >= 90 ? '#16a34a' : compliance >= 75 ? '#d97706' : '#dc2626', isText: true },
  ];

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
      {cards.map((c, i) => (
        <div key={i} style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: `3px solid ${c.color}`,
          borderRadius: 8,
          padding: '14px 20px',
          minWidth: 130,
          flex: '1 1 130px',
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
          }}>{c.label}</div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.4rem',
            fontWeight: 500,
            color: c.color,
          }}>{c.isText ? c.value : c.value.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

function MilestonePairChart({ pairCounts }) {
  const chartData = Object.entries(pairCounts)
    .map(([pair, count]) => ({ name: pair, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

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
      }}>Top Violations by Milestone Pair</div>
      <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 32 + 40)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 130 }}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number"
            tick={{ fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
            axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name"
            tick={{ fill: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
            axisLine={false} tickLine={false} width={125} />
          <Tooltip content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div style={{
                background: '#fff', border: '1px solid var(--border)', borderRadius: 6,
                padding: '8px 12px', boxShadow: 'var(--shadow-md)',
                fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
              }}>
                <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{d.name}</div>
                <div style={{ color: '#dc2626' }}>{d.count} violations</div>
              </div>
            );
          }} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={PAIR_COLORS[i % PAIR_COLORS.length]} opacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ScenarioSplit({ data }) {
  const sc3Rate = data.sc3_shipments > 0
    ? ((data.sc3_shipments - (data.sc3_affected || 0)) / data.sc3_shipments * 100) : 0;
  const sc4Rate = data.sc4_shipments > 0
    ? ((data.sc4_shipments - (data.sc4_affected || 0)) / data.sc4_shipments * 100) : 0;

  const items = [
    { label: 'SC3', shipments: data.sc3_shipments || 0, affected: data.sc3_affected || 0, rate: sc3Rate, color: '#d97706' },
    { label: 'SC4', shipments: data.sc4_shipments || 0, affected: data.sc4_affected || 0, rate: sc4Rate, color: '#059669' },
  ];

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '20px 24px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.85rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: 16,
      }}>Compliance by Scenario</div>
      <div style={{ display: 'flex', gap: 20 }}>
        {items.map(it => (
          <div key={it.label} style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: it.color,
              marginBottom: 8,
            }}>{it.label}</div>
            {/* Compliance bar */}
            <div style={{
              height: 8,
              background: '#f1f5f9',
              borderRadius: 4,
              overflow: 'hidden',
              marginBottom: 10,
            }}>
              <div style={{
                height: '100%',
                width: `${it.rate}%`,
                background: it.rate >= 90 ? '#16a34a' : it.rate >= 75 ? '#d97706' : '#dc2626',
                borderRadius: 4,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {it.affected} / {it.shipments} affected
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: it.rate >= 90 ? '#16a34a' : it.rate >= 75 ? '#d97706' : '#dc2626',
              }}>{it.rate.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


export default function PlausibilityRCA({ rcaData, selectedWeek }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [ruleFilter, setRuleFilter] = useState('all');
  const [scenarioFilter, setScenarioFilter] = useState('all');

  const weekData = rcaData?.find(d => d.week === selectedWeek);
  const plaus = weekData?.plausibility_rca;
  if (!plaus) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>No plausibility data for {selectedWeek}</div>;

  const filteredViolations = useMemo(() => {
    let v = plaus.violations;
    if (ruleFilter !== 'all') v = v.filter(x => x.rule === ruleFilter);
    if (scenarioFilter !== 'all') v = v.filter(x => x.scenario === scenarioFilter);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      v = v.filter(x =>
        (x.hbl || '').toLowerCase().includes(term) ||
        (x.mbl || '').toLowerCase().includes(term) ||
        (x.consignment || '').toLowerCase().includes(term) ||
        (x.carrier || '').toLowerCase().includes(term) ||
        (x.origin || '').toLowerCase().includes(term) ||
        (x.dest || '').toLowerCase().includes(term)
      );
    }
    return v;
  }, [plaus, ruleFilter, scenarioFilter, searchTerm]);

  // Get unique rules for filter buttons — show top 8 by count
  const topRules = useMemo(() => {
    return Object.entries(plaus.rule_counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([r]) => r);
  }, [plaus]);

  const columns = [
    { key: 'hbl', label: 'HBL' },
    { key: 'mbl', label: 'MBL' },
    { key: 'consignment', label: 'Consignment' },
    { key: 'scenario', label: 'Scenario' },
    { key: 'rule_label', label: 'Rule' },
    { key: 'description', label: 'Description' },
    { key: 'gap_hours', label: 'Gap (hours)' },
    { key: 'carrier', label: 'Carrier' },
    { key: 'origin', label: 'Origin' },
    { key: 'dest', label: 'Destination' },
    { key: 'date_a', label: 'Date A' },
    { key: 'date_b', label: 'Date B' },
  ];

  const handleExport = () => {
    const headers = columns.map(c => c.key);
    downloadCSV(filteredViolations, headers, `plausibility_violations_${selectedWeek}.csv`);
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
  });

  return (
    <div>
      <SummaryCards data={plaus} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: 16,
        marginBottom: 20,
      }}>
        <MilestonePairChart pairCounts={plaus.milestone_pair_counts || {}} />
        <ScenarioSplit data={plaus} />
      </div>

      {/* Filters */}
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
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500, marginRight: 4 }}>Rule:</span>
          <button style={btnStyle(ruleFilter === 'all')} onClick={() => setRuleFilter('all')}>All</button>
          {topRules.map(r => (
            <button key={r} style={btnStyle(ruleFilter === r)}
              onClick={() => setRuleFilter(r)}>
              {r}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500, marginRight: 4 }}>Scenario:</span>
          {['all', 'SC3', 'SC4'].map(s => (
            <button key={s} style={btnStyle(scenarioFilter === s)}
              onClick={() => setScenarioFilter(s)}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search HBL, carrier, origin..."
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
            width: 200,
            marginLeft: 'auto',
          }}
        />

        <button onClick={handleExport} style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.7rem',
          fontWeight: 500,
          color: '#fff',
          background: 'var(--accent-blue)',
          border: 'none',
          borderRadius: 5,
          padding: '5px 12px',
          cursor: 'pointer',
        }}>Export CSV</button>
      </div>

      {/* Violations Table */}
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
          fontFamily: 'var(--font-display)',
          fontSize: '0.85rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>Milestone Accuracy Violations</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
            {filteredViolations.length} of {plaus.total_violation_records}
          </span>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 500 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
                <th style={thVStyle}>#</th>
                <th style={thVStyle}>HBL</th>
                <th style={thVStyle}>Scenario</th>
                <th style={thVStyle}>Rule</th>
                <th style={thVStyle}>Description</th>
                <th style={{ ...thVStyle, textAlign: 'right' }}>Gap (h)</th>
                <th style={thVStyle}>Carrier</th>
                <th style={thVStyle}>Origin</th>
                <th style={thVStyle}>Dest</th>
                <th style={thVStyle}>Date A</th>
                <th style={thVStyle}>Date B</th>
              </tr>
            </thead>
            <tbody>
              {filteredViolations.slice(0, 500).map((v, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8f9fb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...tdVStyle, color: 'var(--text-muted)' }}>{i + 1}</td>
                  <td style={{ ...tdVStyle, color: 'var(--accent-blue)', fontWeight: 500 }}>{v.hbl || '—'}</td>
                  <td style={tdVStyle}>
                    <span style={{
                      fontSize: '0.65rem',
                      color: v.scenario === 'SC3' ? '#d97706' : '#059669',
                      background: v.scenario === 'SC3' ? '#d9770612' : '#05966912',
                      padding: '2px 6px',
                      borderRadius: 3,
                      fontWeight: 600,
                    }}>{v.scenario}</span>
                  </td>
                  <td style={tdVStyle}>
                    <span style={{
                      fontSize: '0.65rem',
                      color: '#7c3aed',
                      background: '#7c3aed12',
                      padding: '2px 6px',
                      borderRadius: 3,
                    }}>{v.rule_label}</span>
                  </td>
                  <td style={{ ...tdVStyle, fontSize: '0.68rem', color: 'var(--text-muted)' }}>{v.description || '—'}</td>
                  <td style={{
                    ...tdVStyle,
                    textAlign: 'right',
                    color: v.gap_hours > 720 ? '#dc2626' : v.gap_hours > 168 ? '#d97706' : 'var(--text-secondary)',
                  }}>
                    {v.gap_hours != null ? `${v.gap_hours}h` : '—'}
                  </td>
                  <td style={tdVStyle}>{v.carrier || '—'}</td>
                  <td style={tdVStyle}>{v.origin || '—'}</td>
                  <td style={tdVStyle}>{v.dest || '—'}</td>
                  <td style={{ ...tdVStyle, fontSize: '0.68rem' }}>{v.date_a ? v.date_a.slice(0, 16).replace('T', ' ') : '—'}</td>
                  <td style={{ ...tdVStyle, fontSize: '0.68rem' }}>{v.date_b ? v.date_b.slice(0, 16).replace('T', ' ') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredViolations.length > 500 && (
          <div style={{
            padding: '10px 20px',
            borderTop: '1px solid var(--border)',
            fontFamily: 'var(--font-display)',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}>
            Showing 500 of {filteredViolations.length} violations. Use Export CSV to get all records.
          </div>
        )}
      </div>
    </div>
  );
}

const thVStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: '0.65rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  padding: '8px 10px',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const tdVStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.73rem',
  padding: '6px 10px',
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
};
