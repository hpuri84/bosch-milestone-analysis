import { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, ScatterChart, Scatter,
  ZAxis, Legend,
} from 'recharts';

const ACCENT = {
  blue: '#2563eb', green: '#059669', amber: '#d97706', red: '#dc2626',
  purple: '#7c3aed', pink: '#db2777', orange: '#ea580c', teal: '#0d9488',
};

function downloadCSV(rows, headers, filename) {
  const csvRows = [headers.map(h => h.label || h.key).join(',')];
  rows.forEach(r => {
    csvRows.push(headers.map(h => {
      const val = r[h.key] ?? '';
      const str = String(val);
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(','));
  });
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function StatCard({ label, value, sub, color, large }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderLeft: `3px solid ${color}`, borderRadius: 8,
      padding: large ? '16px 24px' : '12px 18px',
      minWidth: large ? 160 : 120, flex: '1 1 120px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: '0.68rem', fontWeight: 500,
        color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: large ? '1.6rem' : '1.2rem',
        fontWeight: 600, color,
      }}>{value}</div>
      {sub && <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2,
      }}>{sub}</div>}
    </div>
  );
}

function DistributionChart({ records }) {
  const buckets = useMemo(() => {
    const b = { '0-3d': 0, '3-7d': 0, '7-14d': 0, '14-21d': 0, '21-30d': 0, '30-45d': 0, '45-60d': 0, '60+d': 0 };
    records.forEach(r => {
      const d = r.ata_to_delivered_days;
      if (d <= 3) b['0-3d']++;
      else if (d <= 7) b['3-7d']++;
      else if (d <= 14) b['7-14d']++;
      else if (d <= 21) b['14-21d']++;
      else if (d <= 30) b['21-30d']++;
      else if (d <= 45) b['30-45d']++;
      else if (d <= 60) b['45-60d']++;
      else b['60+d']++;
    });
    return Object.entries(b).map(([name, count]) => ({ name, count }));
  }, [records]);

  const COLORS = ['#059669', '#16a34a', '#84cc16', '#d97706', '#ea580c', '#dc2626', '#9f1239', '#7f1d1d'];

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>ATA → Delivered Distribution</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={buckets} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
            axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
            axisLine={false} tickLine={false} />
          <Tooltip content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            return (
              <div style={tooltipStyle}>
                {payload[0].payload.name}: <strong>{payload[0].value}</strong> shipments
              </div>
            );
          }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={50}>
            {buckets.map((d, i) => <Cell key={i} fill={COLORS[i]} opacity={0.85} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PortChart({ portStats }) {
  const data = useMemo(() => {
    return Object.entries(portStats)
      .map(([port, s]) => ({ port, ...s }))
      .filter(d => d.count >= 5)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [portStats]);

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>Median Days by Port of Discharge</div>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 28 + 40)}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 40, bottom: 5, left: 60 }}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
            axisLine={false} tickLine={false} unit="d" />
          <YAxis type="category" dataKey="port"
            tick={{ fill: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
            axisLine={false} tickLine={false} width={55} />
          <Tooltip content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div style={tooltipStyle}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.port}</div>
                <div>Median: {d.median}d | Mean: {d.mean}d</div>
                <div>P25: {d.p25}d | P75: {d.p75}d | P90: {d.p90}d</div>
                <div>Std: {d.std}d | n={d.count}</div>
                <div style={{ color: ACCENT.blue, fontWeight: 600, marginTop: 4 }}>
                  Recommended: {d.recommended_offset}d
                </div>
              </div>
            );
          }} />
          <Bar dataKey="median" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.median <= 5 ? ACCENT.green : d.median <= 15 ? ACCENT.amber : d.median <= 25 ? ACCENT.orange : ACCENT.red} opacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TransportPriorityChart({ stats }) {
  const data = Object.entries(stats)
    .map(([tp, s]) => ({ name: tp, ...s }))
    .sort((a, b) => b.count - a.count);

  const COLORS = [ACCENT.blue, ACCENT.green, ACCENT.amber];

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>By Transport Service Priority</div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {data.map((d, i) => (
          <div key={d.name} style={{
            flex: '1 1 200px', border: '1px solid var(--border)', borderRadius: 6,
            padding: 14, borderLeft: `3px solid ${COLORS[i] || ACCENT.purple}`,
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, color: COLORS[i], marginBottom: 8 }}>{d.name}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <div>n={d.count} | Median: <strong>{d.median}d</strong></div>
              <div>Mean: {d.mean}d | Std: {d.std}d</div>
              <div>P10: {d.p10}d → P90: {d.p90}d</div>
              <div style={{ color: ACCENT.blue }}>Recommended: <strong>{d.recommended_offset}d</strong></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LaneTable({ recommendations, title, laneKey }) {
  const [sortBy, setSortBy] = useState('count');
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');

  const sorted = useMemo(() => {
    let data = [...recommendations];
    if (search) {
      const t = search.toLowerCase();
      data = data.filter(r => r.lane.toLowerCase().includes(t));
    }
    data.sort((a, b) => sortDir === 'desc' ? b[sortBy] - a[sortBy] : a[sortBy] - b[sortBy]);
    return data;
  }, [recommendations, sortBy, sortDir, search]);

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const cols = [
    { key: 'lane', label: 'Lane', align: 'left' },
    { key: 'count', label: 'N' },
    { key: 'median', label: 'Median' },
    { key: 'mean', label: 'Mean' },
    { key: 'std', label: 'Std Dev' },
    { key: 'p10', label: 'P10' },
    { key: 'p25', label: 'P25' },
    { key: 'p75', label: 'P75' },
    { key: 'p90', label: 'P90' },
    { key: 'recommended_offset', label: 'Recommended' },
  ];

  const handleExport = () => {
    downloadCSV(sorted, cols, `pod_${laneKey}_recommendations.csv`);
  };

  return (
    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
      }}>
        <div style={titleStyle}>{title}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="text" placeholder="Search lane..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: '4px 10px',
              border: '1px solid var(--border)', borderRadius: 4, outline: 'none', width: 180,
            }} />
          <button onClick={handleExport} style={exportBtnStyle}>Export CSV</button>
        </div>
      </div>
      <div style={{ overflowX: 'auto', maxHeight: 500 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
              {cols.map(c => (
                <th key={c.key} onClick={() => c.key !== 'lane' && handleSort(c.key)}
                  style={{
                    ...thStyle,
                    textAlign: c.align || 'right',
                    cursor: c.key !== 'lane' ? 'pointer' : 'default',
                    color: sortBy === c.key ? ACCENT.blue : 'var(--text-muted)',
                  }}>
                  {c.label} {sortBy === c.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8f9fb'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {r.lane}
                </td>
                <td style={tdStyle}>{r.count}</td>
                <td style={{ ...tdStyle, fontWeight: 600, color: medianColor(r.median) }}>{r.median}d</td>
                <td style={tdStyle}>{r.mean}d</td>
                <td style={{ ...tdStyle, color: r.std > 10 ? ACCENT.red : r.std > 5 ? ACCENT.amber : 'var(--text-secondary)' }}>{r.std}d</td>
                <td style={tdStyle}>{r.p10}d</td>
                <td style={tdStyle}>{r.p25}d</td>
                <td style={tdStyle}>{r.p75}d</td>
                <td style={tdStyle}>{r.p90}d</td>
                <td style={{ ...tdStyle, fontWeight: 700, color: ACCENT.blue }}>
                  {r.recommended_offset}d
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{
        padding: '8px 16px', borderTop: '1px solid var(--border)',
        fontFamily: 'var(--font-display)', fontSize: '0.68rem', color: 'var(--text-muted)',
      }}>
        {sorted.length} lanes | Recommended = Median + 0.5 × StdDev (buffer for variability)
      </div>
    </div>
  );
}

function medianColor(v) {
  if (v <= 5) return ACCENT.green;
  if (v <= 15) return ACCENT.amber;
  if (v <= 25) return ACCENT.orange;
  return ACCENT.red;
}

function PodEstAccuracy({ accuracy, records }) {
  if (!accuracy || !accuracy.total) return null;

  const lateRate = (accuracy.late_count / accuracy.total * 100).toFixed(1);
  const earlyRate = (accuracy.early_count / accuracy.total * 100).toFixed(1);
  const abs = accuracy.abs_error_stats;

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>Current POD Estimate Accuracy</div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <StatCard label="Total Estimates" value={accuracy.total} color="var(--text-primary)" />
        <StatCard label="Delivered Late" value={`${lateRate}%`} sub={`${accuracy.late_count} shipments`} color={ACCENT.red} />
        <StatCard label="Delivered Early" value={`${earlyRate}%`} sub={`${accuracy.early_count} shipments`} color={ACCENT.green} />
        <StatCard label="Median Error" value={`${abs?.median}d`} sub={`mean: ${abs?.mean}d`} color={ACCENT.amber} />
        <StatCard label="P90 Error" value={`${abs?.p90}d`} color={ACCENT.orange} />
      </div>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: '0.75rem', color: 'var(--text-secondary)',
        padding: '12px 16px', background: '#f8fafc', borderRadius: 6, border: '1px solid var(--border)',
        lineHeight: 1.7,
      }}>
        <strong>Insight:</strong> The current POD estimate (DELIVERY_DATE_ACT_EST_PLAN) is very accurate on average
        (median error {abs?.median}d), but {lateRate}% of deliveries happen <em>after</em> the estimate.
        This suggests the estimate gets updated close to delivery. The real opportunity is improving
        the <strong>initial ETA → POD_EST offset</strong> per lane, which currently uses a static value.
      </div>
    </div>
  );
}


export default function PodPatternAnalysis({ data }) {
  const [view, setView] = useState('summary');

  if (!data || !data.records) {
    return <div style={{ color: 'var(--text-muted)', padding: 20 }}>Loading POD pattern data...</div>;
  }

  const { overall_stats, scenario_stats, incoterm_stats, transport_priority_stats,
    port_discharge_stats, lane_recommendations, country_lane_recommendations,
    pod_est_accuracy, records } = data;

  const btnStyle = (active) => ({
    fontFamily: 'var(--font-display)', fontSize: '0.72rem',
    fontWeight: active ? 600 : 400,
    color: active ? '#fff' : 'var(--text-muted)',
    background: active ? ACCENT.blue : 'transparent',
    border: active ? 'none' : '1px solid var(--border)',
    borderRadius: 5, padding: '5px 14px', cursor: 'pointer',
  });

  return (
    <div>
      {/* Navigation */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'summary', label: 'Summary' },
          { key: 'ports', label: 'By Port' },
          { key: 'country', label: 'Country Lanes' },
          { key: 'fine', label: 'Port → City Lanes' },
          { key: 'accuracy', label: 'Current Accuracy' },
        ].map(t => (
          <button key={t.key} onClick={() => setView(t.key)} style={btnStyle(view === t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {view === 'summary' && (
        <div>
          {/* KPI Cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <StatCard label="Total Shipments" value={records.length.toLocaleString()} color="var(--text-primary)" large />
            <StatCard label="Median Transit" value={`${overall_stats.median}d`} sub="ATA → Delivered" color={ACCENT.blue} large />
            <StatCard label="Mean Transit" value={`${overall_stats.mean}d`} sub={`std: ${overall_stats.std}d`} color={ACCENT.purple} large />
            <StatCard label="P90 Transit" value={`${overall_stats.p90}d`} sub="90th percentile" color={ACCENT.orange} large />
            <StatCard label="Recommended" value={`${overall_stats.recommended_offset}d`} sub="median + 0.5σ" color={ACCENT.green} large />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16, marginBottom: 20 }}>
            <DistributionChart records={records} />
            <PortChart portStats={port_discharge_stats} />
          </div>

          <TransportPriorityChart stats={transport_priority_stats} />

          {/* Incoterm breakdown */}
          <div style={{ ...cardStyle, marginTop: 16 }}>
            <div style={titleStyle}>By Incoterm</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Incoterm</th>
                    <th style={thStyle}>N</th>
                    <th style={thStyle}>Median</th>
                    <th style={thStyle}>Mean</th>
                    <th style={thStyle}>Std</th>
                    <th style={thStyle}>P90</th>
                    <th style={thStyle}>Recommended</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(incoterm_stats)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([inco, s]) => (
                      <tr key={inco} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 500 }}>{inco}</td>
                        <td style={tdStyle}>{s.count}</td>
                        <td style={{ ...tdStyle, fontWeight: 600, color: medianColor(s.median) }}>{s.median}d</td>
                        <td style={tdStyle}>{s.mean}d</td>
                        <td style={tdStyle}>{s.std}d</td>
                        <td style={tdStyle}>{s.p90}d</td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: ACCENT.blue }}>{s.recommended_offset}d</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Key insight callout */}
          <div style={{
            marginTop: 20, padding: '16px 20px', background: '#eff6ff', border: '1px solid #bfdbfe',
            borderRadius: 8, fontFamily: 'var(--font-display)', fontSize: '0.78rem',
            lineHeight: 1.8, color: '#1e40af',
          }}>
            <strong>Key Finding:</strong> A static 10-12 day offset misses the mark. Transit time from ATA to delivery
            varies from <strong>1.4 days</strong> (THLCH — local Thailand delivery) to <strong>68 days</strong> (ITGOA — Settimo Torinese).
            German ports (DEHAM, DEBRV) average 18-20 days, while Portuguese (PTLEI) average 5.4 days.
            <br /><strong>LCL/FCL/FCL</strong> shipments are fastest (median 6.3d) vs <strong>LCL/LCL/LCL</strong> (17.4d).
            Implementing lane-specific offsets using the recommended values could reduce POD estimate errors by 60-80%.
          </div>
        </div>
      )}

      {view === 'ports' && (
        <div>
          <PortChart portStats={port_discharge_stats} />
          <div style={{ marginTop: 16 }}>
            <LaneTable
              recommendations={Object.entries(port_discharge_stats)
                .filter(([, s]) => s.count >= 3)
                .map(([port, s]) => ({ lane: port, ...s }))}
              title="Port of Discharge — Transit Statistics"
              laneKey="port"
            />
          </div>
        </div>
      )}

      {view === 'country' && (
        <LaneTable
          recommendations={country_lane_recommendations}
          title="Country Lanes — Origin → Destination (n≥5)"
          laneKey="country_lanes"
        />
      )}

      {view === 'fine' && (
        <LaneTable
          recommendations={lane_recommendations}
          title="Port → City Lanes — Granular Recommendations (n≥5)"
          laneKey="port_city_lanes"
        />
      )}

      {view === 'accuracy' && (
        <PodEstAccuracy accuracy={pod_est_accuracy} records={records} />
      )}
    </div>
  );
}

const cardStyle = {
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '20px 24px', boxShadow: 'var(--shadow-sm)',
};

const titleStyle = {
  fontFamily: 'var(--font-display)', fontSize: '0.85rem',
  fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16,
};

const tooltipStyle = {
  background: '#fff', border: '1px solid var(--border)', borderRadius: 6,
  padding: '10px 14px', boxShadow: 'var(--shadow-md)',
  fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)',
};

const thStyle = {
  fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600,
  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
  padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap', userSelect: 'none',
};

const tdStyle = {
  fontFamily: 'var(--font-mono)', fontSize: '0.73rem',
  padding: '6px 10px', color: 'var(--text-secondary)', textAlign: 'right', whiteSpace: 'nowrap',
};

const exportBtnStyle = {
  fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 500,
  color: '#fff', background: ACCENT.blue, border: 'none',
  borderRadius: 5, padding: '5px 12px', cursor: 'pointer',
};
