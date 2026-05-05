import { useMemo, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

const MILESTONE_LABELS = {
  S00: 'Shipment created',
  S02: 'Collected',
  S04: 'Vessel departed',
  S05: 'In delivery',
  S07: 'Vessel arrived',
  S10: 'On hand origin SVC',
  S11: 'S11',
  S12: 'S12',
  S13: 'On hand dest SVC',
  S16: 'Customs initiated',
  S17: 'S17',
  S18: 'S18',
  S31: 'Delivered',
  S45: 'Handover to broker',
  S46: 'FCL loaded on vessel',
  S50: 'Rcvd origin CFS',
  S51: 'Arrived dest CFS',
  S52: 'Empty container p/u',
  S53: 'FCL loaded on vessel',
  S54: 'FCL discharge',
  S55: 'Empty container ret.',
  S60: 'Pre-booking confirmed',
};

function buildParetoData(milestones, filter) {
  if (!milestones?.length) return [];

  // Aggregate by code + scenario, summing across Actual/Estimated types
  const agg = {};
  for (const m of milestones) {
    if (filter === 'critical' && !m.is_critical) continue;
    const key = `${m.code}__${m.scenario || ''}`;
    if (!agg[key]) {
      agg[key] = {
        code: m.code,
        scenario: m.scenario || '',
        name: MILESTONE_LABELS[m.code] || m.name || m.code,
        is_critical: m.is_critical,
        missing: 0, late: 0,
        required: 0, available: 0, in_time: 0,
      };
    }
    agg[key].missing  += m.missing  || 0;
    agg[key].late     += m.late     || 0;
    agg[key].required += m.required || 0;
    agg[key].available+= m.available|| 0;
    agg[key].in_time  += m.in_time  || 0;
  }

  const rows = Object.values(agg)
    .map(r => ({ ...r, total: r.missing + r.late }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total);

  const grandTotal = rows.reduce((s, r) => s + r.total, 0) || 1;
  let cum = 0;
  return rows.map(r => {
    cum += r.total;
    return {
      ...r,
      cumPct: Math.round(cum / grandTotal * 100),
      label: `${r.code} [${r.scenario}]`,
      shortLabel: r.code,
      comp_pct: r.required > 0 ? Math.round(r.available / r.required * 100) : null,
      time_pct: r.available > 0 ? Math.round(r.in_time / r.available * 100) : null,
    };
  });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      padding: '10px 14px',
      fontFamily: 'var(--font-display)',
      fontSize: '0.72rem',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      minWidth: 200,
    }}>
      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
        {d.code} — {d.name}
        {d.is_critical && (
          <span style={{ marginLeft: 6, color: '#dc2626', fontSize: '0.62rem', fontWeight: 700 }}>CRITICAL</span>
        )}
      </div>
      <div style={{ color: '#6b7280', marginBottom: 4 }}>{d.scenario}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', color: 'var(--text-secondary)' }}>
        <span style={{ color: '#dc2626' }}>Missing: {d.missing}</span>
        <span style={{ color: '#f59e0b' }}>Late: {d.late}</span>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Total: {d.total}</span>
        <span style={{ color: '#7c3aed' }}>Cum: {d.cumPct}%</span>
        {d.comp_pct != null && <span>Comp: {d.comp_pct}%</span>}
        {d.time_pct != null && <span>Time: {d.time_pct}%</span>}
      </div>
    </div>
  );
};

const CustomXAxisTick = ({ x, y, payload, data }) => {
  const row = data.find(d => d.label === payload.value);
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0} y={0} dy={12}
        textAnchor="end"
        transform="rotate(-35)"
        style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fill: row?.is_critical ? '#dc2626' : 'var(--text-muted)' }}
      >
        {payload.value}
      </text>
    </g>
  );
};

export default function ParetoChart({ rcaData, selectedWeek }) {
  const [filter, setFilter] = useState('all');
  const [topN, setTopN] = useState(10);

  const weekData = rcaData?.find(d => d.week === selectedWeek);
  const milestones = weekData?.milestones || [];

  const allRows = useMemo(() => buildParetoData(milestones, filter), [milestones, filter]);
  const rows = allRows.slice(0, topN);
  const grandTotal = allRows.reduce((s, r) => s + r.total, 0);

  // Recompute cumulative % for the visible slice
  const chartData = useMemo(() => {
    let cum = 0;
    const sliceTotal = allRows.reduce((s, r) => s + r.total, 0);
    return rows.map(r => {
      cum += r.total;
      return { ...r, cumPct: Math.round(cum / sliceTotal * 100) };
    });
  }, [rows, allRows]);

  const topNCoverage = rows.length > 0 ? rows[rows.length - 1].cumPct : 0;
  const topNTotal = rows.reduce((s, r) => s + r.total, 0);

  if (!milestones.length) {
    return (
      <div style={{ color: 'var(--text-muted)', padding: 20, fontFamily: 'var(--font-display)', fontSize: '0.8rem' }}>
        No milestone data for {selectedWeek}.
      </div>
    );
  }

  const btnStyle = (active) => ({
    fontFamily: 'var(--font-display)',
    fontSize: '0.7rem',
    fontWeight: active ? 600 : 400,
    color: active ? '#fff' : 'var(--text-muted)',
    background: active ? 'var(--accent-blue)' : 'transparent',
    border: active ? 'none' : '1px solid var(--border)',
    borderRadius: 4,
    padding: '4px 12px',
    cursor: 'pointer',
  });

  return (
    <div>
      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        marginBottom: 16,
        padding: '10px 14px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={btnStyle(filter === 'all')} onClick={() => setFilter('all')}>All Milestones</button>
          <button style={btnStyle(filter === 'critical')} onClick={() => setFilter('critical')}>Critical Only</button>
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          {[5, 10, 15].map(n => (
            <button key={n} style={btnStyle(topN === n)} onClick={() => setTopN(n)}>Top {n}</button>
          ))}
        </div>
        <div style={{
          marginLeft: 'auto',
          fontFamily: 'var(--font-display)',
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
        }}>
          Top {rows.length} = <strong style={{ color: 'var(--text-primary)' }}>{topNCoverage}%</strong> of {grandTotal.toLocaleString()} total issues
        </div>
      </div>

      {/* Chart */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '20px 16px 8px',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: 16,
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 4,
          paddingLeft: 8,
        }}>
          {selectedWeek} — Top {rows.length} Issue Sources (Missing + Late)
          <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.68rem' }}>
            Red labels = Critical milestone
          </span>
        </div>

        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 50, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={<CustomXAxisTick data={chartData} />}
              interval={0}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
            />
            <YAxis
              yAxisId="left"
              tickStyle={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem' }}
              tick={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'Issues (count)', angle: -90, position: 'insideLeft', offset: 12,
                style: { fontFamily: 'var(--font-display)', fontSize: '0.62rem', fill: 'var(--text-muted)' } }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tickFormatter={v => `${v}%`}
              tick={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', fill: '#7c3aed' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            <Legend
              wrapperStyle={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', paddingTop: 8 }}
            />
            <Bar yAxisId="left" dataKey="missing" name="Missing (completeness)" stackId="a" fill="#dc2626" maxBarSize={48} radius={[0, 0, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.is_critical ? '#dc2626' : '#f87171'}
                  opacity={entry.is_critical ? 1 : 0.7}
                />
              ))}
            </Bar>
            <Bar yAxisId="left" dataKey="late" name="Late (timeliness)" stackId="a" fill="#f59e0b" maxBarSize={48} radius={[3, 3, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.is_critical ? '#f59e0b' : '#fcd34d'}
                  opacity={entry.is_critical ? 1 : 0.75}
                />
              ))}
            </Bar>
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cumPct"
              name="Cumulative %"
              stroke="#7c3aed"
              strokeWidth={2}
              dot={{ r: 4, fill: '#7c3aed', strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
            <ReferenceLine yAxisId="right" y={80} stroke="#7c3aed" strokeDasharray="4 4" strokeOpacity={0.5}
              label={{ value: '80%', position: 'right', style: { fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fill: '#7c3aed' } }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
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
          fontFamily: 'var(--font-display)',
          fontSize: '0.78rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          Pareto Breakdown — {selectedWeek}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-card)' }}>
                {['#', 'Milestone', 'Scenario', 'Crit', 'Missing', 'Late', 'Total', 'Share', 'Cum %', 'Comp%', 'Time%', 'Required'].map(h => (
                  <th key={h} style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.62rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '7px 10px',
                    textAlign: h === 'Milestone' ? 'left' : 'right',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chartData.map((r, i) => {
                const share = Math.round(r.total / grandTotal * 100);
                const prevCum = i === 0 ? 0 : chartData[i-1].cumPct;
                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: r.is_critical ? 'rgba(220,38,38,0.03)' : 'transparent',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = r.is_critical ? 'rgba(220,38,38,0.03)' : 'transparent'}
                  >
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', padding: '6px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ fontFamily: 'var(--font-display)', fontSize: '0.73rem', padding: '6px 10px', fontWeight: 500, color: r.is_critical ? '#dc2626' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {r.code} — {r.name}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', padding: '6px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>{r.scenario}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', padding: '6px 10px', textAlign: 'right', color: r.is_critical ? '#dc2626' : 'var(--text-muted)' }}>
                      {r.is_critical ? '★' : ''}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: '6px 10px', textAlign: 'right', color: '#dc2626', fontWeight: 500 }}>{r.missing}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: '6px 10px', textAlign: 'right', color: '#f59e0b', fontWeight: 500 }}>{r.late}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{r.total}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                        <div style={{ width: 60, height: 5, background: 'var(--border)', borderRadius: 3 }}>
                          <div style={{ width: `${share}%`, height: '100%', background: '#7c3aed', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#7c3aed', minWidth: 28 }}>{share}%</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: '6px 10px', textAlign: 'right', color: '#7c3aed', fontWeight: r.cumPct >= 80 ? 600 : 400 }}>
                      {r.cumPct}%
                    </td>
                    <td style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: '6px 10px', textAlign: 'right',
                      color: r.comp_pct == null ? 'var(--text-muted)' : r.comp_pct >= 90 ? '#16a34a' : r.comp_pct >= 70 ? '#d97706' : '#dc2626',
                    }}>
                      {r.comp_pct != null ? `${r.comp_pct}%` : '—'}
                    </td>
                    <td style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: '6px 10px', textAlign: 'right',
                      color: r.time_pct == null ? 'var(--text-muted)' : r.time_pct >= 70 ? '#16a34a' : r.time_pct >= 50 ? '#d97706' : '#dc2626',
                    }}>
                      {r.time_pct != null ? `${r.time_pct}%` : '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', padding: '6px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>{r.required}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <td colSpan={6} style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, padding: '7px 10px', color: 'var(--text-secondary)' }}>
                  Top {rows.length} subtotal
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {topNTotal.toLocaleString()}
                </td>
                <td colSpan={5} style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', padding: '7px 10px', textAlign: 'right', color: '#7c3aed', fontWeight: 600 }}>
                  {topNCoverage}% of all {grandTotal.toLocaleString()} issues
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
