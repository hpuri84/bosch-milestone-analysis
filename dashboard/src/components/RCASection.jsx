import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, ReferenceLine,
} from 'recharts';

const SEVERITY_COLORS = {
  critical: '#f87171',
  warning: '#fbbf24',
  ok: '#34d399',
};

const SEVERITY_BG = {
  critical: 'rgba(248,113,113,0.12)',
  warning: 'rgba(251,191,36,0.08)',
  ok: 'rgba(52,211,153,0.06)',
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
    { label: 'Critical', value: data.critical_issues, color: SEVERITY_COLORS.critical },
    { label: 'Warning', value: data.warning_issues, color: SEVERITY_COLORS.warning },
    { label: 'On Target', value: data.ok_issues, color: SEVERITY_COLORS.ok },
    { label: 'Missing Statuses', value: data.total_missing, color: 'var(--text-primary)' },
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
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
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
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-accent)',
                  borderRadius: 6,
                  padding: '10px 14px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
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

function MilestoneTable({ milestones, onSelectMilestone, selectedMilestone }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-accent)' }}>
              {['#', 'Milestone', 'Scenario', 'Type', 'Required', 'Available', 'In Time', 'Comp%', 'Time%', 'Missing', 'Late', 'Severity'].map(h => (
                <th key={h} style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.65rem',
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '10px 10px',
                  textAlign: h === 'Milestone' ? 'left' : 'right',
                  whiteSpace: 'nowrap',
                }}>
                  {h}
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
                    if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
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
                        opacity: 0.7,
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

function ShipmentDrilldown({ milestone }) {
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
      }}>
        {milestone
          ? `No missing shipments for ${milestone.scenario} ${milestone.code} (${milestone.type})`
          : 'Click a milestone row above to see missing shipments'}
      </div>
    );
  }

  const issc4 = milestone.scenario === 'SC4';

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      overflow: 'hidden',
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
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}>
          Showing {milestone.missing_shipments.length} of {milestone.total_missing_shipments}
        </div>
      </div>
      <div style={{ overflowX: 'auto', maxHeight: 400 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-accent)', position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
              {['#', 'HBL', issc4 ? 'MBL' : 'MBL', issc4 ? 'Consignment' : 'Load/TO', 'Service'].map(h => (
                <th key={h} style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.65rem',
                  fontWeight: 500,
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
            {milestone.missing_shipments.map((s, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ ...shipCell, color: 'var(--text-muted)' }}>{i + 1}</td>
                <td style={{ ...shipCell, color: 'var(--accent-blue)', fontWeight: 500 }}>
                  {s.hbl || '—'}
                </td>
                <td style={shipCell}>{s.mbl || '—'}</td>
                <td style={shipCell}>{issc4 ? (s.consignment || '—') : (s.load_to || '—')}</td>
                <td style={shipCell}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-accent)',
                    padding: '2px 6px',
                    borderRadius: 3,
                  }}>{s.service}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const shipCell = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.75rem',
  padding: '6px 12px',
  color: 'var(--text-secondary)',
};

// Filters component
function Filters({ filters, setFilters }) {
  const btnStyle = (active) => ({
    fontFamily: 'var(--font-mono)',
    fontSize: '0.7rem',
    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
    background: active ? 'var(--bg-accent)' : 'transparent',
    border: active ? '1px solid var(--border-accent)' : '1px solid transparent',
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
    }}>
      {/* Scenario filter */}
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', color: 'var(--text-muted)', marginRight: 4 }}>Scenario:</span>
        {['All', 'SC3', 'SC4'].map(s => (
          <button key={s} style={btnStyle(filters.scenario === s)}
            onClick={() => setFilters(f => ({ ...f, scenario: s }))}>{s}</button>
        ))}
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', color: 'var(--text-muted)', marginRight: 4 }}>Type:</span>
        {['All', 'Actual', 'Estimated'].map(t => (
          <button key={t} style={btnStyle(filters.type === t)}
            onClick={() => setFilters(f => ({ ...f, type: t }))}>{t}</button>
        ))}
      </div>

      {/* Critical only */}
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <button style={btnStyle(filters.criticalOnly)}
          onClick={() => setFilters(f => ({ ...f, criticalOnly: !f.criticalOnly }))}>
          Key Milestones Only
        </button>
      </div>

      {/* Severity filter */}
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', color: 'var(--text-muted)', marginRight: 4 }}>Severity:</span>
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


export default function RCASection({ rcaData, selectedWeek }) {
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [filters, setFilters] = useState({
    scenario: 'All',
    type: 'All',
    criticalOnly: false,
    severity: 'All',
  });

  const weekData = rcaData?.find(d => d.week === selectedWeek);
  if (!weekData) return null;

  const filteredMilestones = useMemo(() => {
    let ms = weekData.milestones;
    if (filters.scenario !== 'All') ms = ms.filter(m => m.scenario === filters.scenario);
    if (filters.type !== 'All') ms = ms.filter(m => m.type === filters.type);
    if (filters.criticalOnly) ms = ms.filter(m => m.is_critical);
    if (filters.severity !== 'All') ms = ms.filter(m => m.severity === filters.severity);
    return ms;
  }, [weekData, filters]);

  return (
    <div>
      <SummaryCards data={weekData} />
      <Filters filters={filters} setFilters={setFilters} />

      {/* Gap charts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: 16,
        marginBottom: 20,
      }}>
        <GapChart milestones={filteredMilestones} metric="completeness" />
        <GapChart milestones={filteredMilestones} metric="timeliness" />
      </div>

      {/* Milestone table */}
      <div style={{ marginBottom: 20 }}>
        <MilestoneTable
          milestones={filteredMilestones}
          onSelectMilestone={setSelectedMilestone}
          selectedMilestone={selectedMilestone}
        />
      </div>

      {/* Shipment drilldown */}
      <ShipmentDrilldown milestone={selectedMilestone} />
    </div>
  );
}
