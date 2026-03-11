import { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine, Cell,
  BarChart, PieChart, Pie, AreaChart, Area,
} from 'recharts';

const TARGETS = {
  completeness: { label: 'Milestone Completeness', target: 0.95, color: '#2563eb' },
  timeliness: { label: 'Milestone Timeliness', target: 0.80, color: '#0891b2', note: 'Contingent on SC3 ratio 80%+' },
  eta_2p: { label: 'ETA 2P Accuracy', target: 0.75, color: '#d97706' },
  eta_2d: { label: 'ETA 2D Accuracy', target: 0.75, color: '#db2777' },
  ref_comp: { label: 'Reference Completeness', target: 0.95, color: '#ea580c' },
};

const DEADLINE_WEEK = 'CW17'; // End of April
const DEADLINE_IDX = 17;

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
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: 16,
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 16,
  },
  mb: { marginBottom: 24 },
  sectionTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    marginBottom: 16,
    paddingLeft: 2,
  },
};

function GaugeCard({ kpiKey, current, trend, weeksLeft }) {
  const t = TARGETS[kpiKey];
  const gap = t.target - current;
  const pctDone = Math.min(current / t.target, 1);
  const weeklyNeeded = weeksLeft > 0 ? gap / weeksLeft : 0;
  const weeklyActual = trend.length >= 2 ? (trend[trend.length - 1] - trend[0]) / (trend.length - 1) : 0;
  const acceleration = weeklyActual > 0 ? weeklyNeeded / weeklyActual : null;
  const projected = current + weeklyActual * weeksLeft;
  const onTrack = projected >= t.target;
  const riskLevel = acceleration === null ? 'critical' : acceleration <= 1 ? 'on-track' : acceleration <= 2 ? 'at-risk' : 'critical';
  const riskColors = { 'on-track': '#16a34a', 'at-risk': '#d97706', 'critical': '#dc2626' };
  const riskLabels = { 'on-track': 'On Track', 'at-risk': 'At Risk', 'critical': 'Critical' };

  const barWidth = 200;
  const currentW = pctDone * barWidth;

  return (
    <div style={{
      ...S.card,
      borderLeft: `4px solid ${riskColors[riskLevel]}`,
      animation: 'fadeInUp 0.4s ease-out both',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {t.label}
          </div>
          {t.note && <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2 }}>*{t.note}</div>}
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          fontWeight: 600,
          color: riskColors[riskLevel],
          background: `${riskColors[riskLevel]}12`,
          padding: '3px 10px',
          borderRadius: 4,
        }}>
          {riskLabels[riskLevel]}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700, color: t.color }}>
            {(current * 100).toFixed(1)}%
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)', alignSelf: 'flex-end' }}>
            / {(t.target * 100).toFixed(0)}%
          </span>
        </div>
        <div style={{ position: 'relative', height: 10, background: 'var(--bg-secondary)', borderRadius: 5, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%',
            width: `${pctDone * 100}%`,
            background: `linear-gradient(90deg, ${t.color}, ${t.color}cc)`,
            borderRadius: 5,
            transition: 'width 0.8s ease',
          }} />
          {/* Projected marker */}
          {projected > 0 && projected < 1.2 && (
            <div style={{
              position: 'absolute',
              left: `${Math.min(projected / t.target, 1.15) * 100}%`,
              top: -2,
              height: 14,
              width: 2,
              background: onTrack ? '#16a34a' : '#dc2626',
              borderRadius: 1,
            }} />
          )}
        </div>
      </div>

      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gap</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600, color: '#dc2626' }}>
            {gap > 0 ? '+' : ''}{(gap * 100).toFixed(1)}pp
          </div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Need/wk</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {weeklyNeeded > 0 ? '+' : ''}{(weeklyNeeded * 100).toFixed(1)}pp
          </div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pace/wk</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600, color: weeklyActual >= weeklyNeeded ? '#16a34a' : '#d97706' }}>
            {weeklyActual >= 0 ? '+' : ''}{(weeklyActual * 100).toFixed(1)}pp
          </div>
        </div>
      </div>

      {acceleration !== null && acceleration > 0 && (
        <div style={{
          marginTop: 12,
          padding: '8px 12px',
          background: `${riskColors[riskLevel]}08`,
          borderRadius: 6,
          fontFamily: 'var(--font-display)',
          fontSize: '0.7rem',
          color: 'var(--text-secondary)',
        }}>
          {onTrack
            ? `Projected ${(projected * 100).toFixed(1)}% by ${DEADLINE_WEEK} — target achievable at current pace`
            : `Need ${acceleration.toFixed(1)}x acceleration — projected ${(Math.max(projected, 0) * 100).toFixed(1)}% vs ${(t.target * 100).toFixed(0)}% target`
          }
        </div>
      )}
    </div>
  );
}

function ProjectionChart({ data, weeksLeft }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const last = data[data.length - 1];
    const lastIdx = parseInt(last.week.replace('CW', ''), 10);

    const actual = data.map(d => ({
      week: d.week,
      comp: d.all.completeness * 100,
      time: d.all.timeliness * 100,
      eta2p: d.eta_2p != null ? d.eta_2p * 100 : null,
      eta2d: d.eta_2d != null ? d.eta_2d * 100 : null,
      ref: d.ref_comp != null ? d.ref_comp * 100 : null,
    }));

    // Linear regression for each metric
    const regress = (vals) => {
      const n = vals.length;
      const xs = vals.map((_, i) => i);
      const ys = vals;
      const mx = xs.reduce((a, b) => a + b, 0) / n;
      const my = ys.reduce((a, b) => a + b, 0) / n;
      const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
      const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
      const slope = den ? num / den : 0;
      const intercept = my - slope * mx;
      return { slope, intercept, predict: (x) => slope * x + intercept };
    };

    const compVals = data.map(d => d.all.completeness * 100);
    const timeVals = data.map(d => d.all.timeliness * 100);
    const compReg = regress(compVals);
    const timeReg = regress(timeVals);

    // Project forward
    const projected = [];
    for (let i = 1; i <= weeksLeft; i++) {
      const cwNum = lastIdx + i;
      projected.push({
        week: `CW${String(cwNum).padStart(2, '0')}`,
        comp_proj: Math.min(compReg.predict(data.length - 1 + i), 100),
        time_proj: Math.min(timeReg.predict(data.length - 1 + i), 100),
      });
    }

    // Mark the last actual point for connection
    const lastActual = actual[actual.length - 1];
    const bridgePoint = {
      week: lastActual.week,
      comp_proj: lastActual.comp,
      time_proj: lastActual.time,
    };

    return [...actual, bridgePoint, ...projected];
  }, [data, weeksLeft]);

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Projected Trajectory — Completeness & Timeliness</div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="week" tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }} />
          <Tooltip
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
            formatter={(v) => v != null ? `${v.toFixed(1)}%` : '—'}
          />
          <Legend wrapperStyle={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem' }} />
          <ReferenceLine y={95} stroke="#2563eb" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: 'Comp Target 95%', position: 'right', fontSize: 10, fill: '#2563eb', fontFamily: 'var(--font-mono)' }} />
          <ReferenceLine y={80} stroke="#0891b2" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: 'Time Target 80%', position: 'right', fontSize: 10, fill: '#0891b2', fontFamily: 'var(--font-mono)' }} />
          <Line type="monotone" dataKey="comp" name="Completeness (Actual)" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
          <Line type="monotone" dataKey="time" name="Timeliness (Actual)" stroke="#0891b2" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
          <Line type="monotone" dataKey="comp_proj" name="Completeness (Projected)" stroke="#2563eb" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls />
          <Line type="monotone" dataKey="time_proj" name="Timeliness (Projected)" stroke="#0891b2" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function ParetoChart({ rcaData, selectedWeek }) {
  const chartData = useMemo(() => {
    if (!rcaData) return [];
    const weekData = rcaData.find(w => w.week === selectedWeek);
    if (!weekData) return [];

    const sorted = [...weekData.milestones]
      .filter(m => m.missing > 0)
      .sort((a, b) => b.missing - a.missing)
      .slice(0, 12);

    const totalMissing = weekData.milestones.reduce((s, m) => s + m.missing, 0);
    let cum = 0;
    return sorted.map(m => {
      cum += m.missing;
      return {
        name: `${m.scenario} ${m.code}`,
        fullName: `${m.scenario} ${m.code} ${m.name} (${m.type})`,
        missing: m.missing,
        cumPct: (cum / totalMissing) * 100,
        completeness: m.completeness * 100,
        scenario: m.scenario,
      };
    });
  }, [rcaData, selectedWeek]);

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Top Missing Volume — Pareto (Fix These First)</div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 40, left: -10, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }} angle={-35} textAnchor="end" />
          <YAxis yAxisId="left" tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }} tickFormatter={v => `${v}%`} />
          <Tooltip
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}
            formatter={(v, name) => name === 'Cum %' ? `${v.toFixed(1)}%` : v}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
          />
          <Bar yAxisId="left" dataKey="missing" name="Missing" radius={[3, 3, 0, 0]}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.scenario === 'SC3' ? '#0891b2' : '#2563eb'} opacity={0.85} />
            ))}
          </Bar>
          <Line yAxisId="right" type="monotone" dataKey="cumPct" name="Cum %" stroke="#dc2626" strokeWidth={2} dot={{ r: 3, fill: '#dc2626' }} />
        </ComposedChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: '#0891b2', borderRadius: 2, display: 'inline-block' }} /> SC3
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: '#2563eb', borderRadius: 2, display: 'inline-block' }} /> SC4
        </span>
      </div>
    </div>
  );
}

function ServiceGapTable({ data, selectedWeek }) {
  const weekData = data?.find(d => d.week === selectedWeek);
  if (!weekData) return null;

  const rows = [];
  for (const sc of ['SC3', 'SC4']) {
    const breakdown = weekData.service_breakdown?.[sc];
    if (!breakdown) continue;
    for (const svc of ['LCL', 'BCO', 'FCL']) {
      const d = breakdown[svc];
      if (!d) continue;
      const gap = 0.95 - d.all.completeness;
      rows.push({
        scenario: sc,
        service: svc,
        required: d.all.required,
        available: d.all.available,
        missing: d.all.required - d.all.available,
        completeness: d.all.completeness,
        gap,
      });
    }
  }
  rows.sort((a, b) => b.gap - a.gap);

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Service Type Gap to 95% Completeness</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['Scenario', 'Service', 'Required', 'Available', 'Missing', 'Current', 'Gap to 95%'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 10px', fontWeight: 600, color: r.scenario === 'SC3' ? '#0891b2' : '#2563eb' }}>{r.scenario}</td>
                <td style={{ padding: '8px 10px' }}>{r.service}</td>
                <td style={{ padding: '8px 10px' }}>{r.required.toLocaleString()}</td>
                <td style={{ padding: '8px 10px' }}>{r.available.toLocaleString()}</td>
                <td style={{ padding: '8px 10px', color: '#dc2626', fontWeight: 600 }}>{r.missing.toLocaleString()}</td>
                <td style={{ padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 50, height: 5, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${r.completeness * 100}%`, height: '100%', background: r.completeness >= 0.9 ? '#16a34a' : r.completeness >= 0.75 ? '#d97706' : '#dc2626', borderRadius: 3 }} />
                    </div>
                    <span>{(r.completeness * 100).toFixed(1)}%</span>
                  </div>
                </td>
                <td style={{ padding: '8px 10px', color: r.gap > 0.2 ? '#dc2626' : r.gap > 0.1 ? '#d97706' : '#16a34a', fontWeight: 600 }}>
                  {r.gap > 0 ? `+${(r.gap * 100).toFixed(1)}pp` : 'Met'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionRoadmap({ data }) {
  if (!data || data.length === 0) return null;
  const last = data[data.length - 1];

  const actions = [
    {
      priority: 'P0',
      area: 'ETA 2D Accuracy',
      current: `${(last.eta_2d * 100).toFixed(1)}%`,
      target: '75%',
      gap: `${((0.75 - last.eta_2d) * 100).toFixed(1)}pp`,
      color: '#dc2626',
      items: [
        'Investigate delivery date estimation logic — 71% of shipments fail the +/-48h window',
        'Focus on SC4 S31 Delivered (126 missing, 293 late) — largest contributor',
        'Cross-check carrier delivery confirmation timestamps with system capture time',
      ],
    },
    {
      priority: 'P0',
      area: 'Milestone Timeliness',
      current: `${(last.all.timeliness * 100).toFixed(1)}%`,
      target: '80%',
      gap: `${((0.80 - last.all.timeliness) * 100).toFixed(1)}pp`,
      color: '#dc2626',
      items: [
        'SC4 S17/S50/S31 timeliness under 12% — root cause delayed carrier EDI updates',
        'SC3 S02 Collected at 0% timeliness with 212 late — carrier pick-up confirmation delay',
        'Implement SLA alerts for milestones not reported within 24h of expected time',
      ],
    },
    {
      priority: 'P1',
      area: 'Milestone Completeness',
      current: `${(last.all.completeness * 100).toFixed(1)}%`,
      target: '95%',
      gap: `${((0.95 - last.all.completeness) * 100).toFixed(1)}pp`,
      color: '#d97706',
      items: [
        'SC4 S05 "In delivery" only 21% complete (375 missing) — biggest single gap',
        'SC4 S45 "Handover to broker" at 2.5% (115 missing) — broker integration broken',
        'SC3 FCL completeness stuck at ~52% — FCL milestone mapping needs review',
        'Top 5 milestones account for 33% of all missing volume — fix for outsized impact',
      ],
    },
    {
      priority: 'P1',
      area: 'Reference Completeness',
      current: `${(last.ref_comp * 100).toFixed(1)}%`,
      target: '95%',
      gap: `${((0.95 - last.ref_comp) * 100).toFixed(1)}pp`,
      color: '#d97706',
      items: [
        'Stalled at ~79% for 5 weeks — systematic gap, not improving organically',
        'Identify reference fields consistently missing (PO, SO, Consignment numbers)',
        'Require reference field validation at booking creation stage',
      ],
    },
    {
      priority: 'P2',
      area: 'ETA 2P Accuracy',
      current: `${(last.eta_2p * 100).toFixed(1)}%`,
      target: '75%',
      gap: `${((0.75 - last.eta_2p) * 100).toFixed(1)}pp`,
      color: '#16a34a',
      items: [
        'Trending well: 22% to 67% over 8 weeks — closest to target',
        'Maintain momentum, focus on volatile week-over-week consistency',
        'Monitor port congestion impact on accuracy degradation',
      ],
    },
  ];

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Action Roadmap — Prioritized by Gap Severity</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {actions.map((a, i) => (
          <div key={i} style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            borderLeft: `4px solid ${a.color}`,
            padding: '16px 20px',
            animation: `fadeInUp 0.3s ease-out ${i * 0.08}s both`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  color: '#fff',
                  background: a.color,
                  padding: '2px 8px',
                  borderRadius: 4,
                }}>{a.priority}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {a.area}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', display: 'flex', gap: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>{a.current}</span>
                <span style={{ color: 'var(--text-muted)' }}>&rarr;</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.target}</span>
                <span style={{ color: a.color, fontWeight: 600 }}>({a.gap})</span>
              </div>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {a.items.map((item, j) => (
                <li key={j} style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryHeader({ data }) {
  if (!data || data.length === 0) return null;
  const last = data[data.length - 1];
  const lastIdx = parseInt(last.week.replace('CW', ''), 10);
  const weeksLeft = DEADLINE_IDX - lastIdx;

  const kpis = [
    { key: 'completeness', current: last.all.completeness },
    { key: 'timeliness', current: last.all.timeliness },
    { key: 'eta_2p', current: last.eta_2p },
    { key: 'eta_2d', current: last.eta_2d },
    { key: 'ref_comp', current: last.ref_comp },
  ];

  const onTrackCount = kpis.filter(k => {
    const t = TARGETS[k.key];
    const trend = data.map(d => {
      if (k.key === 'completeness') return d.all.completeness;
      if (k.key === 'timeliness') return d.all.timeliness;
      return d[k.key] || 0;
    });
    const rate = trend.length >= 2 ? (trend[trend.length - 1] - trend[0]) / (trend.length - 1) : 0;
    return k.current + rate * weeksLeft >= t.target;
  }).length;

  return (
    <div style={{
      ...S.card,
      background: 'linear-gradient(135deg, var(--bg-card), var(--bg-secondary))',
      marginBottom: 24,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 16,
    }}>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          April Target Gap Analysis
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {weeksLeft} weeks remaining to close gaps — deadline {DEADLINE_WEEK} (end of April)
        </div>
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: 700, color: onTrackCount >= 3 ? '#16a34a' : '#dc2626' }}>
            {onTrackCount}/{kpis.length}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>On Track</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {weeksLeft}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Weeks Left</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {last.week}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Latest Data</div>
        </div>
      </div>
    </div>
  );
}

export default function TargetAnalysis({ data, rcaData, selectedWeek }) {
  const weeksLeft = useMemo(() => {
    if (!data || data.length === 0) return 0;
    const last = data[data.length - 1];
    const lastIdx = parseInt(last.week.replace('CW', ''), 10);
    return DEADLINE_IDX - lastIdx;
  }, [data]);

  if (!data || data.length === 0) return null;

  const current = data.find(d => d.week === selectedWeek) || data[data.length - 1];

  const kpiEntries = [
    { key: 'completeness', current: current.all.completeness, trend: data.map(d => d.all.completeness) },
    { key: 'timeliness', current: current.all.timeliness, trend: data.map(d => d.all.timeliness) },
    { key: 'eta_2p', current: current.eta_2p || 0, trend: data.map(d => d.eta_2p || 0) },
    { key: 'eta_2d', current: current.eta_2d || 0, trend: data.map(d => d.eta_2d || 0) },
    { key: 'ref_comp', current: current.ref_comp || 0, trend: data.map(d => d.ref_comp || 0) },
  ];

  return (
    <div>
      <SummaryHeader data={data} />

      {/* KPI Gauge Cards */}
      <div style={{ ...S.mb }}>
        <div style={S.sectionTitle}>KPI Gap Assessment</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {kpiEntries.map(k => (
            <GaugeCard key={k.key} kpiKey={k.key} current={k.current} trend={k.trend} weeksLeft={weeksLeft} />
          ))}
        </div>
      </div>

      {/* Projection Chart */}
      <div style={{ ...S.mb }}>
        <div style={S.sectionTitle}>Trend Projection to {DEADLINE_WEEK}</div>
        <ProjectionChart data={data} weeksLeft={weeksLeft} />
      </div>

      {/* Pareto + Service Gap */}
      <div style={{ ...S.mb }}>
        <div style={S.sectionTitle}>Where to Focus — Impact Analysis</div>
        <div style={S.grid2}>
          <ParetoChart rcaData={rcaData} selectedWeek={selectedWeek} />
          <ServiceGapTable data={data} selectedWeek={selectedWeek} />
        </div>
      </div>

      {/* Action Roadmap */}
      <div style={{ ...S.mb }}>
        <div style={S.sectionTitle}>Recommended Actions</div>
        <ActionRoadmap data={data} />
      </div>
    </div>
  );
}