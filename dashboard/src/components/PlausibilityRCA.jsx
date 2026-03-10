import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, PieChart, Pie,
} from 'recharts';

const SEVERITY_COLORS = { critical: '#dc2626', warning: '#d97706' };

const RULE_LABELS = {
  pod_gt_delivery: 'POD > Delivery',
  pol_gt_pod: 'POL > POD',
  pickup_gt_pol: 'Pickup > POL',
  gap_gt_60d: 'Gap > 60 days',
};

const RULE_COLORS = {
  pod_gt_delivery: '#dc2626',
  pol_gt_pod: '#d97706',
  pickup_gt_pol: '#7c3aed',
  gap_gt_60d: '#0891b2',
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

function SummaryCards({ data }) {
  const cards = [
    { label: 'Total Shipments', value: data.total_shipments, color: 'var(--text-primary)' },
    { label: 'Affected HBLs', value: data.affected_hbls, color: '#dc2626' },
    { label: 'Total Violations', value: data.total_violations, color: '#d97706' },
    { label: 'Critical', value: data.critical_count, color: '#dc2626' },
    { label: 'Warnings', value: data.warning_count, color: '#d97706' },
    { label: 'Compliance Rate', value: `${(((data.total_shipments - data.affected_hbls) / data.total_shipments) * 100).toFixed(1)}%`,
      color: data.affected_hbls / data.total_shipments < 0.1 ? '#16a34a' : '#dc2626', isText: true },
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

function RuleBreakdownChart({ ruleCounts }) {
  const chartData = Object.entries(ruleCounts).map(([rule, count]) => ({
    name: RULE_LABELS[rule] || rule,
    count,
    rule,
  })).sort((a, b) => b.count - a.count);

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
      }}>Violations by Rule</div>
      <ResponsiveContainer width="100%" height={Math.max(140, chartData.length * 36 + 40)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 120 }}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number"
            tick={{ fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
            axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name"
            tick={{ fill: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: 11 }}
            axisLine={false} tickLine={false} width={115} />
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
                <div style={{ color: RULE_COLORS[d.rule] || '#dc2626' }}>{d.count} violations</div>
              </div>
            );
          }} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={RULE_COLORS[d.rule] || '#dc2626'} opacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GapBucketChart({ buckets }) {
  const chartData = Object.entries(buckets).map(([bucket, count]) => ({
    name: bucket,
    count,
  }));

  const COLORS = ['#16a34a', '#d97706', '#ea580c', '#dc2626', '#7f1d1d'];

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
      }}>POD {'>'} Delivery Gap Severity</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name"
            tick={{ fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}
            axisLine={false} tickLine={false} />
          <Tooltip content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            return (
              <div style={{
                background: '#fff', border: '1px solid var(--border)', borderRadius: 6,
                padding: '8px 12px', boxShadow: 'var(--shadow-md)',
                fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
              }}>
                {payload[0].payload.name}: {payload[0].value} violations
              </div>
            );
          }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={COLORS[i] || '#dc2626'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}


export default function PlausibilityRCA({ rcaData, selectedWeek }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [ruleFilter, setRuleFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  const weekData = rcaData?.find(d => d.week === selectedWeek);
  const plaus = weekData?.plausibility_rca;
  if (!plaus) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>No plausibility data for {selectedWeek}</div>;

  const filteredViolations = useMemo(() => {
    let v = plaus.violations;
    if (ruleFilter !== 'all') v = v.filter(x => x.rule === ruleFilter);
    if (severityFilter !== 'all') v = v.filter(x => x.severity === severityFilter);
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
  }, [plaus, ruleFilter, severityFilter, searchTerm]);

  const rules = ['all', ...Object.keys(plaus.rule_counts)];

  const columns = [
    { key: 'hbl', label: 'HBL' },
    { key: 'mbl', label: 'MBL' },
    { key: 'consignment', label: 'Consignment' },
    { key: 'rule_label', label: 'Rule' },
    { key: 'severity', label: 'Severity' },
    { key: 'gap_days', label: 'Gap (days)' },
    { key: 'carrier', label: 'Carrier' },
    { key: 'origin', label: 'Origin' },
    { key: 'dest', label: 'Destination' },
    { key: 'transport', label: 'Transport' },
    { key: 'dataset', label: 'Dataset' },
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
        <RuleBreakdownChart ruleCounts={plaus.rule_counts} />
        <GapBucketChart buckets={plaus.gap_buckets} />
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
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500, marginRight: 4 }}>Rule:</span>
          {rules.map(r => (
            <button key={r} style={btnStyle(ruleFilter === r)}
              onClick={() => setRuleFilter(r)}>
              {r === 'all' ? 'All' : (RULE_LABELS[r] || r)}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500, marginRight: 4 }}>Severity:</span>
          {['all', 'critical', 'warning'].map(s => (
            <button key={s} style={btnStyle(severityFilter === s)}
              onClick={() => setSeverityFilter(s)}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
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
          <span>Sequence Violations</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
            {filteredViolations.length} of {plaus.total_violation_records}
          </span>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 500 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
                <th style={thVStyle}>#</th>
                <th style={thVStyle}>HBL</th>
                <th style={thVStyle}>Consignment</th>
                <th style={thVStyle}>Rule</th>
                <th style={thVStyle}>Severity</th>
                <th style={{ ...thVStyle, textAlign: 'right' }}>Gap</th>
                <th style={thVStyle}>Carrier</th>
                <th style={thVStyle}>Origin</th>
                <th style={thVStyle}>Dest</th>
                <th style={thVStyle}>Date A</th>
                <th style={thVStyle}>Date B</th>
              </tr>
            </thead>
            <tbody>
              {filteredViolations.map((v, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8f9fb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...tdVStyle, color: 'var(--text-muted)' }}>{i + 1}</td>
                  <td style={{ ...tdVStyle, color: 'var(--accent-blue)', fontWeight: 500 }}>{v.hbl || '—'}</td>
                  <td style={tdVStyle}>{v.consignment || '—'}</td>
                  <td style={tdVStyle}>
                    <span style={{
                      fontSize: '0.65rem',
                      color: RULE_COLORS[v.rule] || '#dc2626',
                      background: `${RULE_COLORS[v.rule] || '#dc2626'}12`,
                      padding: '2px 6px',
                      borderRadius: 3,
                    }}>{v.rule_label}</span>
                  </td>
                  <td style={tdVStyle}>
                    <span style={{
                      fontSize: '0.65rem',
                      color: SEVERITY_COLORS[v.severity],
                      background: `${SEVERITY_COLORS[v.severity]}12`,
                      padding: '2px 6px',
                      borderRadius: 3,
                      textTransform: 'uppercase',
                    }}>{v.severity}</span>
                  </td>
                  <td style={{ ...tdVStyle, textAlign: 'right', color: v.gap_days > 30 ? '#dc2626' : v.gap_days > 7 ? '#d97706' : 'var(--text-secondary)' }}>
                    {v.gap_days}d
                  </td>
                  <td style={tdVStyle}>{v.carrier || '—'}</td>
                  <td style={tdVStyle}>{v.origin || '—'}</td>
                  <td style={tdVStyle}>{v.dest || '—'}</td>
                  <td style={{ ...tdVStyle, fontSize: '0.68rem' }}>{v.date_a ? v.date_a.slice(0, 10) : '—'}</td>
                  <td style={{ ...tdVStyle, fontSize: '0.68rem' }}>{v.date_b ? v.date_b.slice(0, 10) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
