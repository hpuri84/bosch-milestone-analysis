import { useState, useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

const STATUS_COLOR = {
  worsened: '#dc2626',
  new:      '#7c3aed',
  stable:   '#6b7280',
  improved: '#16a34a',
  gone:     '#9ca3af',
};

// Week-specific RCA narratives. Keyed by current week label.
const WEEK_NARRATIVES = {
  CW15: {
    headline: 'CW15 — two distinct stories',
    bullets: [
      <>A single new lane <strong>DE→TH</strong> drove most of the 2P degradation (<strong>21 shipments</strong>).</>,
      <>2D worsened on <strong>Asia → Europe</strong> via two different mechanisms: <em>stale-baseline</em> early failures (Asia → PT) and <em>real lateness</em> on <strong>CN → DE</strong> (~+11d late).</>,
      <>The <strong>real-late</strong> pattern on CN → DE is distinct from the &quot;early&quot; (stale baseline) pattern — it suggests an actual delivery slowdown to Germany rather than a measurement gap.</>,
    ],
  },
  CW16: {
    headline: 'CW16 — Asia → Europe delivery slowdown deepens (2D drops 14.1% → 6.5%)',
    bullets: [
      <>2P actually <strong>improved</strong> (80.4% → 92.4%); the 2D collapse is the story. Late deliveries dominate failures <strong>148 vs 34 early</strong> (4 : 1 ratio, up from 2 : 1 in CW15) — this is a <em>real lateness</em> shift, not a stale-baseline artefact.</>,
      <><strong>CN → DE</strong> is the single biggest driver: <strong>50 late shipments</strong> averaging <strong>~9.8d late</strong> (more than doubled from 22 in CW15).</>,
      <>Multiple new Asia-origin lanes opened with consistent late patterns — <strong>JP → CZ (15)</strong>, <strong>MY → DE (10)</strong>, <strong>HK → DE (6, avg ~21d late)</strong>, <strong>TW → DE (5)</strong>. None of these existed in CW15.</>,
      <>Stale-baseline (early) bucket is roughly flat (31 → 34 ships) — the deterioration is concentrated in real transit delays, not measurement noise.</>,
      <><strong>Suggested cause to investigate:</strong> systemic Asia → Europe transit slowdown (Suez/Red Sea routing, port congestion, or carrier service reliability) rather than ETA quality.</>,
    ],
  },
};

const STATUS_BG = {
  worsened: 'rgba(220,38,38,0.08)',
  new:      'rgba(124,58,237,0.08)',
  stable:   'transparent',
  improved: 'rgba(22,163,74,0.08)',
  gone:     'transparent',
};

function Badge({ status }) {
  return (
    <span style={{
      fontFamily: 'var(--font-display)',
      fontSize: '0.62rem',
      fontWeight: 600,
      color: STATUS_COLOR[status] || '#6b7280',
      background: STATUS_BG[status] || 'transparent',
      border: `1px solid ${STATUS_COLOR[status] || '#6b7280'}`,
      borderRadius: 4,
      padding: '1px 6px',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    }}>{status}</span>
  );
}

function AccBar({ value, color = '#2563eb' }) {
  if (value == null) return <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>—</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
      <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)', minWidth: 36, textAlign: 'right' }}>
        {value.toFixed(0)}%
      </span>
    </div>
  );
}

function DeltaChip({ delta }) {
  if (delta == null) return <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>—</span>;
  const color = delta < -5 ? '#dc2626' : delta > 5 ? '#16a34a' : '#6b7280';
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600, color }}>
      {arrow} {Math.abs(delta).toFixed(0)}pp
    </span>
  );
}

function SummaryCard({ label, priorVal, currentVal, priorLabel, color, subLabel }) {
  const delta = priorVal != null && currentVal != null ? currentVal - priorVal : null;
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${color}`,
      borderRadius: 8,
      padding: '14px 20px',
      flex: '1 1 160px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.68rem',
        fontWeight: 500,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 6,
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 500, color }}>
          {currentVal != null ? `${typeof currentVal === 'number' && currentVal < 5 ? currentVal : currentVal.toFixed(currentVal < 10 ? 1 : 0)}${subLabel || ''}` : '—'}
        </span>
        {delta != null && <DeltaChip delta={delta} />}
      </div>
      {priorVal != null && (
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4 }}>
          {priorLabel}: {typeof priorVal === 'number' ? `${priorVal.toFixed(priorVal < 10 ? 1 : 0)}${subLabel || ''}` : priorVal}
        </div>
      )}
    </div>
  );
}

function ComparisonTable({ rows, dimLabel, showHBLs = false, priorLabel, currentLabel }) {
  const [filter, setFilter] = useState('all');
  const filters = [
    { key: 'all',      label: 'All' },
    { key: 'worsened', label: 'Worsened' },
    { key: 'new',      label: 'New' },
    { key: 'improved', label: 'Improved' },
    { key: 'stable',   label: 'Stable' },
  ];

  const visible = filter === 'all' ? rows : rows.filter(r => r.status === filter);

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
    borderBottom: '2px solid var(--border)',
    position: 'sticky',
    top: 0,
    background: 'var(--bg-card)',
    zIndex: 1,
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
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {dimLabel} — {priorLabel} vs {currentLabel}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.68rem',
                fontWeight: filter === f.key ? 600 : 400,
                color: filter === f.key ? '#fff' : 'var(--text-muted)',
                background: filter === f.key ? STATUS_COLOR[f.key] || 'var(--accent-blue)' : 'transparent',
                border: `1px solid ${filter === f.key ? 'transparent' : 'var(--border)'}`,
                borderRadius: 4,
                padding: '4px 10px',
                cursor: 'pointer',
              }}
            >{f.label}</button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto', maxHeight: 420 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thS}>{dimLabel}</th>
              <th style={{ ...thS, textAlign: 'center' }}>Status</th>
              <th style={{ ...thS, textAlign: 'right' }}>{priorLabel} n</th>
              <th style={{ ...thS, minWidth: 100 }}>{priorLabel} Acc</th>
              <th style={{ ...thS, textAlign: 'right' }}>{currentLabel} n</th>
              <th style={{ ...thS, minWidth: 100 }}>{currentLabel} Acc</th>
              <th style={{ ...thS, textAlign: 'right' }}>Delta</th>
              <th style={{ ...thS, textAlign: 'right' }}>Fail/Total</th>
              <th style={{ ...thS, textAlign: 'right' }}>Late</th>
              <th style={{ ...thS, textAlign: 'right' }}>Early</th>
              <th style={{ ...thS, textAlign: 'right' }}>Avg Dev</th>
              {showHBLs && <th style={thS}>Sample HBLs</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={i}
                style={{ background: STATUS_BG[r.status] || 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.96)'}
                onMouseLeave={e => e.currentTarget.style.filter = 'none'}
              >
                <td style={{ ...tdS, fontWeight: 500, color: 'var(--text-primary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.value || '—'}
                </td>
                <td style={{ ...tdS, textAlign: 'center' }}>
                  <Badge status={r.status} />
                </td>
                <td style={{ ...tdS, textAlign: 'right', color: 'var(--text-muted)' }}>{r.prior_total || '—'}</td>
                <td style={{ ...tdS, padding: '6px 10px' }}>
                  <AccBar value={r.prior_accuracy} color="#6b7280" />
                </td>
                <td style={{ ...tdS, textAlign: 'right' }}>{r.current_total}</td>
                <td style={{ ...tdS, padding: '6px 10px' }}>
                  <AccBar
                    value={r.current_accuracy}
                    color={r.current_accuracy == null ? '#6b7280' : r.current_accuracy < 30 ? '#dc2626' : r.current_accuracy < 70 ? '#d97706' : '#16a34a'}
                  />
                </td>
                <td style={{ ...tdS, textAlign: 'right' }}>
                  <DeltaChip delta={r.delta} />
                </td>
                <td style={{ ...tdS, textAlign: 'right', color: '#dc2626', fontWeight: 500 }}>
                  {r.current_failed}/{r.current_total}
                </td>
                <td style={{ ...tdS, textAlign: 'right', color: '#dc2626' }}>{r.current_late_count}</td>
                <td style={{ ...tdS, textAlign: 'right', color: '#2563eb' }}>{r.current_early_count}</td>
                <td style={{ ...tdS, textAlign: 'right', color: r.current_avg_dev_hours > 0 ? '#dc2626' : '#2563eb' }}>
                  {r.current_avg_dev_hours != null ? `${r.current_avg_dev_hours > 0 ? '+' : ''}${(r.current_avg_dev_hours / 24).toFixed(1)}d` : '—'}
                </td>
                {showHBLs && (
                  <td style={{ ...tdS, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                    {(r.sample_hbls || []).join(', ') || '—'}
                  </td>
                )}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={showHBLs ? 12 : 11} style={{ ...tdS, textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
                  No rows match this filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DevBucketChart({ priorBuckets, currentBuckets, priorLabel, currentLabel }) {
  const keys = ['≤24h', '24-48h', '48-72h', '72-96h', '96h-7d', '>7d'];
  const priorColor = '#94a3b8';
  const currentColor = '#2563eb';

  const priorTotal = Object.values(priorBuckets || {}).reduce((a, b) => a + b, 0) || 1;
  const currentTotal = Object.values(currentBuckets || {}).reduce((a, b) => a + b, 0) || 1;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '16px 20px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.78rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: 12,
      }}>Deviation Magnitude Distribution — All Shipments</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', color: priorColor }}>■ {priorLabel}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', color: currentColor }}>■ {currentLabel}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {keys.map(k => {
          const vp = ((priorBuckets?.[k] || 0) / priorTotal * 100);
          const vc = ((currentBuckets?.[k] || 0) / currentTotal * 100);
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', width: 56, textAlign: 'right' }}>{k}</div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4 }}>
                    <div style={{ width: `${vp}%`, height: '100%', background: priorColor, borderRadius: 4 }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', width: 40 }}>
                    {vp.toFixed(0)}% ({priorBuckets?.[k] || 0})
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4 }}>
                    <div style={{ width: `${vc}%`, height: '100%', background: currentColor, borderRadius: 4 }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', width: 40 }}>
                    {vc.toFixed(0)}% ({currentBuckets?.[k] || 0})
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WhatIfTable({ priorWindows, currentWindows, priorLabel, currentLabel }) {
  if (!currentWindows?.length) return null;
  const priorMap = Object.fromEntries((priorWindows || []).map(r => [r.window_hours, r]));

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '16px 20px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.78rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: 12,
      }}>What-if: Accuracy at Broader Windows</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Window', `${priorLabel} Acc`, `${currentLabel} Acc`, `${currentLabel} n`, 'Note'].map(h => (
              <th key={h} style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.62rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '6px 10px',
                textAlign: h === 'Window' ? 'left' : 'right',
                borderBottom: '1px solid var(--border)',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {currentWindows.map((r, i) => {
            const p = priorMap[r.window_hours];
            const isCurrent = r.window_hours === 48;
            return (
              <tr key={i} style={{ background: isCurrent ? 'rgba(37,99,235,0.06)' : 'transparent' }}>
                <td style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  padding: '5px 10px',
                  fontWeight: isCurrent ? 600 : 400,
                  color: isCurrent ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  borderBottom: '1px solid var(--border)',
                }}>
                  {r.window_label} {isCurrent ? '← current' : ''}
                </td>
                <td style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  padding: '5px 10px',
                  textAlign: 'right',
                  color: 'var(--text-muted)',
                  borderBottom: '1px solid var(--border)',
                }}>
                  {p ? `${p.accuracy}%` : '—'}
                </td>
                <td style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  padding: '5px 10px',
                  textAlign: 'right',
                  fontWeight: 600,
                  color: r.accuracy >= 90 ? '#16a34a' : r.accuracy >= 60 ? '#d97706' : '#dc2626',
                  borderBottom: '1px solid var(--border)',
                }}>
                  {r.accuracy}%
                </td>
                <td style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  padding: '5px 10px',
                  textAlign: 'right',
                  color: 'var(--text-muted)',
                  borderBottom: '1px solid var(--border)',
                }}>
                  {r.accepted}/{r.total}
                </td>
                <td style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.65rem',
                  padding: '5px 10px',
                  textAlign: 'right',
                  color: r.accuracy >= 90 ? '#16a34a' : 'var(--text-muted)',
                  borderBottom: '1px solid var(--border)',
                }}>
                  {r.accuracy >= 90 ? '90% target reached' : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const PARETO_DIMS = [
  { key: 'lane_comparison',           label: 'Lane (Origin → Dest)' },
  { key: 'country_origin_comparison', label: 'Origin Country' },
  { key: 'country_dest_comparison',   label: 'Destination Country' },
  { key: 'carrier_comparison',        label: 'Carrier' },
  { key: 'service_comparison',        label: 'Service Type' },
];

const ParetoTooltip = ({ active, payload }) => {
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
      minWidth: 180,
    }}>
      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, maxWidth: 220 }}>
        {d.value}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', color: 'var(--text-secondary)' }}>
        <span style={{ color: '#dc2626' }}>Failures: {d.failed}</span>
        <span>Total: {d.total}</span>
        <span>Accuracy: {d.accuracy != null ? `${d.accuracy}%` : '—'}</span>
        <span style={{ color: '#7c3aed' }}>Cum: {d.cumPct}%</span>
      </div>
    </div>
  );
};

function ParetoETA2D({ weekBlock, currentLabel }) {
  const [dim, setDim] = useState('lane_comparison');

  const chartData = useMemo(() => {
    const rows = (weekBlock?.[dim] || [])
      .filter(r => r.current_total > 0)
      .sort((a, b) => b.current_failed - a.current_failed)
      .slice(0, 10);

    const grandTotal = rows.reduce((s, r) => s + r.current_failed, 0) || 1;
    let cum = 0;
    return rows.map(r => {
      cum += r.current_failed;
      const label = r.value?.length > 22 ? r.value.slice(0, 20) + '…' : r.value;
      return {
        ...r,
        label,
        failed: r.current_failed,
        total: r.current_total,
        accuracy: r.current_accuracy,
        cumPct: Math.round(cum / grandTotal * 100),
      };
    });
  }, [weekBlock, dim]);

  const totalFailures = chartData.reduce((s, r) => s + r.failed, 0);

  const btnStyle = (active) => ({
    fontFamily: 'var(--font-display)',
    fontSize: '0.68rem',
    fontWeight: active ? 600 : 400,
    color: active ? '#fff' : 'var(--text-muted)',
    background: active ? '#7c3aed' : 'transparent',
    border: active ? 'none' : '1px solid var(--border)',
    borderRadius: 4,
    padding: '4px 10px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

  return (
    <div>
      <div style={{
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 16,
        padding: '10px 14px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', color: 'var(--text-muted)', marginRight: 4 }}>
          Group by:
        </span>
        {PARETO_DIMS.map(d => (
          <button key={d.key} style={btnStyle(dim === d.key)} onClick={() => setDim(d.key)}>
            {d.label}
          </button>
        ))}
        <span style={{
          marginLeft: 'auto',
          fontFamily: 'var(--font-display)',
          fontSize: '0.68rem',
          color: 'var(--text-muted)',
        }}>
          Top {chartData.length} = <strong style={{ color: 'var(--text-primary)' }}>{chartData[chartData.length - 1]?.cumPct ?? 0}%</strong> of {totalFailures} failures
        </span>
      </div>

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
          {currentLabel} — Top {chartData.length} ETA 2D Failure Sources by {PARETO_DIMS.find(d => d.key === dim)?.label}
          <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.65rem' }}>
            Bars = failure count · Line = cumulative %
          </span>
        </div>

        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 60, left: 0, bottom: 70 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              interval={0}
              tick={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              angle={-35}
              textAnchor="end"
              height={70}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
              label={{
                value: 'Failures',
                angle: -90,
                position: 'insideLeft',
                offset: 12,
                style: { fontFamily: 'var(--font-display)', fontSize: '0.62rem', fill: 'var(--text-muted)' },
              }}
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
            <Tooltip content={<ParetoTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            <Bar
              yAxisId="left"
              dataKey="failed"
              name="Failures"
              fill="#dc2626"
              maxBarSize={52}
              radius={[3, 3, 0, 0]}
            />
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
            <ReferenceLine
              yAxisId="right"
              y={80}
              stroke="#7c3aed"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              label={{
                value: '80%',
                position: 'right',
                style: { fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fill: '#7c3aed' },
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

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
          {currentLabel} Pareto Breakdown — {PARETO_DIMS.find(d => d.key === dim)?.label}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['#', 'Group', 'Failures', 'Total', 'Accuracy', 'Share', 'Cum %', 'Late', 'Early', 'Avg Dev', 'Sample HBLs'].map(h => (
                  <th key={h} style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.62rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '7px 10px',
                    textAlign: h === 'Group' || h === 'Sample HBLs' ? 'left' : 'right',
                    whiteSpace: 'nowrap',
                    background: 'var(--bg-card)',
                    position: 'sticky',
                    top: 0,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chartData.map((r, i) => {
                const share = Math.round(r.failed / (totalFailures || 1) * 100);
                return (
                  <tr
                    key={i}
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', padding: '6px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ fontFamily: 'var(--font-display)', fontSize: '0.73rem', padding: '6px 10px', fontWeight: 500, color: 'var(--text-primary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.value}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: '6px 10px', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>{r.failed}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: '6px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>{r.total}</td>
                    <td style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.72rem',
                      padding: '6px 10px',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: r.accuracy == null ? 'var(--text-muted)' : r.accuracy < 30 ? '#dc2626' : r.accuracy < 70 ? '#d97706' : '#16a34a',
                    }}>
                      {r.accuracy != null ? `${r.accuracy}%` : '—'}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                        <div style={{ width: 60, height: 5, background: 'var(--border)', borderRadius: 3 }}>
                          <div style={{ width: `${share}%`, height: '100%', background: '#dc2626', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#dc2626', minWidth: 28 }}>{share}%</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: '6px 10px', textAlign: 'right', color: '#7c3aed', fontWeight: r.cumPct >= 80 ? 600 : 400 }}>
                      {r.cumPct}%
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: '6px 10px', textAlign: 'right', color: '#dc2626' }}>{r.current_late_count ?? '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: '6px 10px', textAlign: 'right', color: '#2563eb' }}>{r.current_early_count ?? '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: '6px 10px', textAlign: 'right', color: r.current_avg_dev_hours > 0 ? '#dc2626' : '#2563eb' }}>
                      {r.current_avg_dev_hours != null ? `${r.current_avg_dev_hours > 0 ? '+' : ''}${(r.current_avg_dev_hours / 24).toFixed(1)}d` : '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', padding: '6px 10px', color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(r.sample_hbls || []).join(', ') || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <td colSpan={2} style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, padding: '7px 10px', color: 'var(--text-secondary)' }}>
                  Top {chartData.length} subtotal
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                  {totalFailures}
                </td>
                <td colSpan={8} style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', padding: '7px 10px', textAlign: 'right', color: '#7c3aed', fontWeight: 600 }}>
                  {chartData[chartData.length - 1]?.cumPct ?? 0}% of all {currentLabel} failures in this dimension
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

const SUBTABS = [
  { key: 'pareto',  label: 'Pareto Top 10' },
  { key: 'lanes',   label: 'Country Lanes' },
  { key: 'origin',  label: 'Origin Country' },
  { key: 'dest',    label: 'Dest Country' },
  { key: 'service', label: 'Service Type' },
  { key: 'carrier', label: 'Carrier' },
  { key: 'dist',    label: 'Deviation Dist.' },
];

export default function ETA2DLaneRCA({ laneRcaData, selectedWeek }) {
  const [subTab, setSubTab] = useState('pareto');

  if (!laneRcaData) {
    return (
      <div style={{ color: 'var(--text-muted)', padding: 20, fontFamily: 'var(--font-display)', fontSize: '0.8rem' }}>
        No lane RCA data available. Run <code>python3 eta_2d_lane_rca.py</code> to generate.
      </div>
    );
  }

  const weekBlock = laneRcaData.weeks?.[selectedWeek];
  if (!weekBlock) {
    return (
      <div style={{ color: 'var(--text-muted)', padding: 20, fontFamily: 'var(--font-display)', fontSize: '0.8rem' }}>
        No comparison data for {selectedWeek || 'this week'}.
        {laneRcaData.available_weeks?.length ? (
          <> Available: {laneRcaData.available_weeks.join(', ')}.</>
        ) : null}
      </div>
    );
  }

  const priorLabel = weekBlock.prior_week;
  const currentLabel = weekBlock.current_week;
  const prior = weekBlock.weekly_stats?.prior;
  const current = weekBlock.weekly_stats?.current;

  const worsenedLanes = (weekBlock.lane_comparison || []).filter(r => r.status === 'worsened').length;
  const newLanes      = (weekBlock.lane_comparison || []).filter(r => r.status === 'new').length;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <SummaryCard
          label="ETA 2D Accuracy"
          priorVal={prior?.accuracy}
          currentVal={current?.accuracy}
          priorLabel={priorLabel}
          color={current?.accuracy < 30 ? '#dc2626' : '#d97706'}
          subLabel="%"
        />
        <SummaryCard
          label="Total Measured"
          priorVal={prior?.total}
          currentVal={current?.total}
          priorLabel={priorLabel}
          color="var(--accent-blue)"
        />
        <SummaryCard
          label="Late Failures"
          priorVal={prior?.late_failures}
          currentVal={current?.late_failures}
          priorLabel={priorLabel}
          color="#dc2626"
        />
        <SummaryCard
          label="Early Failures"
          priorVal={prior?.early_failures}
          currentVal={current?.early_failures}
          priorLabel={priorLabel}
          color="#2563eb"
        />
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: '3px solid #7c3aed',
          borderRadius: 8,
          padding: '14px 20px',
          flex: '1 1 160px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Lane Changes
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 600, color: '#dc2626' }}>{worsenedLanes}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 4 }}>worsened</span>
            </div>
            <div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 600, color: '#7c3aed' }}>{newLanes}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 4 }}>new</span>
            </div>
          </div>
        </div>
      </div>

      {WEEK_NARRATIVES[currentLabel] && (
        <div style={{
          background: '#fff7ed',
          border: '1px solid #fed7aa',
          borderLeft: '3px solid #d97706',
          borderRadius: 8,
          padding: '14px 18px',
          marginBottom: 16,
          fontFamily: 'var(--font-display)',
          fontSize: '0.78rem',
          color: 'var(--text-primary)',
          lineHeight: 1.6,
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.7rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#9a3412',
            marginBottom: 6,
          }}>RCA — {WEEK_NARRATIVES[currentLabel].headline}</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {WEEK_NARRATIVES[currentLabel].bullets.map((b, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.72rem',
        color: 'var(--text-muted)',
        marginBottom: 12,
      }}>
        Comparing <strong style={{ color: 'var(--text-primary)' }}>{currentLabel}</strong> against prior week <strong style={{ color: 'var(--text-primary)' }}>{priorLabel}</strong>
      </div>

      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 16,
        borderBottom: '1px solid var(--border)',
        paddingBottom: 4,
        flexWrap: 'wrap',
      }}>
        {SUBTABS.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.72rem',
              fontWeight: subTab === t.key ? 600 : 400,
              color: subTab === t.key ? 'var(--accent-blue)' : 'var(--text-muted)',
              background: 'transparent',
              border: 'none',
              borderBottom: subTab === t.key ? '2px solid var(--accent-blue)' : '2px solid transparent',
              padding: '6px 14px',
              cursor: 'pointer',
              marginBottom: -5,
            }}
          >{t.label}</button>
        ))}
      </div>

      {subTab === 'pareto' && (
        <ParetoETA2D weekBlock={weekBlock} currentLabel={currentLabel} />
      )}

      {subTab === 'lanes' && (
        <ComparisonTable
          rows={weekBlock.lane_comparison || []}
          dimLabel="Country Lane (Origin → Dest)"
          priorLabel={priorLabel}
          currentLabel={currentLabel}
          showHBLs
        />
      )}

      {subTab === 'origin' && (
        <ComparisonTable
          rows={weekBlock.country_origin_comparison || []}
          dimLabel="Origin Country"
          priorLabel={priorLabel}
          currentLabel={currentLabel}
        />
      )}

      {subTab === 'dest' && (
        <ComparisonTable
          rows={weekBlock.country_dest_comparison || []}
          dimLabel="Destination Country"
          priorLabel={priorLabel}
          currentLabel={currentLabel}
        />
      )}

      {subTab === 'service' && (
        <ComparisonTable
          rows={weekBlock.service_comparison || []}
          dimLabel="Service Type"
          priorLabel={priorLabel}
          currentLabel={currentLabel}
        />
      )}

      {subTab === 'carrier' && (
        <ComparisonTable
          rows={weekBlock.carrier_comparison || []}
          dimLabel="Carrier"
          priorLabel={priorLabel}
          currentLabel={currentLabel}
        />
      )}

      {subTab === 'dist' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
          <DevBucketChart
            priorBuckets={prior?.deviation_buckets}
            currentBuckets={current?.deviation_buckets}
            priorLabel={priorLabel}
            currentLabel={currentLabel}
          />
          <WhatIfTable
            priorWindows={prior?.what_if_windows}
            currentWindows={current?.what_if_windows}
            priorLabel={priorLabel}
            currentLabel={currentLabel}
          />
        </div>
      )}
    </div>
  );
}
