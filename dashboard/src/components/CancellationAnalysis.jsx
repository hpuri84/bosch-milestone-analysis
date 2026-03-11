import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, LineChart, Line, Legend, ComposedChart, Area,
} from 'recharts';

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
  mono: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
  },
};

const COLORS = {
  current: '#94a3b8',
  adjusted: '#2563eb',
  improvement: '#16a34a',
  cancelled: '#dc2626',
};

function KPICompareCard({ label, current, adjusted, target, delay = 0 }) {
  const improvement = adjusted - current;
  const gapCurrent = target ? target - current : null;
  const gapAdjusted = target ? target - adjusted : null;

  return (
    <div style={{
      ...S.card,
      animation: `fadeInUp 0.35s ease-out ${delay}s both`,
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.65rem',
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 12,
      }}>{label}</div>

      <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {(current * 100).toFixed(1)}%
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', color: 'var(--text-muted)' }}>Current</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', color: 'var(--text-muted)' }}>→</span>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700, color: COLORS.adjusted }}>
            {(adjusted * 100).toFixed(1)}%
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', color: 'var(--text-muted)' }}>Adjusted</div>
        </div>
      </div>

      <div style={{
        display: 'inline-block',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem',
        fontWeight: 700,
        color: improvement > 0 ? COLORS.improvement : 'var(--text-muted)',
        background: improvement > 0 ? '#16a34a10' : 'var(--bg-secondary)',
        padding: '3px 10px',
        borderRadius: 4,
        border: `1px solid ${improvement > 0 ? '#16a34a30' : 'var(--border)'}`,
      }}>
        +{(improvement * 100).toFixed(2)}pp
      </div>

      {target && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
              Gap to {(target * 100).toFixed(0)}% target
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#dc2626' }}>
              {(gapCurrent * 100).toFixed(1)}pp → {(gapAdjusted * 100).toFixed(1)}pp
            </span>
          </div>
          <div style={{ height: 4, background: 'var(--bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(adjusted / target * 100, 100)}%`,
              background: `linear-gradient(90deg, ${COLORS.current}, ${COLORS.adjusted})`,
              borderRadius: 2,
              transition: 'width 0.6s ease-out',
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

function WeeklyTrendChart({ impactData }) {
  const chartData = useMemo(() => {
    return impactData.map(w => ({
      week: w.week,
      'Current': +(w.summary.all.old_completeness * 100).toFixed(2),
      'Adjusted': +(w.summary.all.new_completeness * 100).toFixed(2),
      'Cancelled Entries': w.total_cancelled_in_missing,
    }));
  }, [impactData]);

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Completeness (All) — Current vs Adjusted (if cancellations transmitted)</div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="week" tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }} />
          <YAxis yAxisId="pct" domain={[60, 100]} tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }} tickFormatter={v => `${v}%`} />
          <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }} />
          <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }} />
          <Legend wrapperStyle={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem' }} />
          <Line yAxisId="pct" type="monotone" dataKey="Current" stroke={COLORS.current} strokeWidth={2} dot={{ r: 3 }} />
          <Line yAxisId="pct" type="monotone" dataKey="Adjusted" stroke={COLORS.adjusted} strokeWidth={2} dot={{ r: 3 }} strokeDasharray="6 3" />
          <Bar yAxisId="count" dataKey="Cancelled Entries" fill={COLORS.cancelled} opacity={0.25} radius={[3, 3, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function TimelinessTrendChart({ impactData }) {
  const chartData = useMemo(() => {
    return impactData.map(w => ({
      week: w.week,
      'Current': +(w.summary.all.old_timeliness * 100).toFixed(2),
      'Adjusted': +(w.summary.all.new_timeliness * 100).toFixed(2),
    }));
  }, [impactData]);

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Timeliness (All) — Current vs Adjusted</div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="week" tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }} />
          <YAxis domain={[30, 70]} tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }} tickFormatter={v => `${v}%`} />
          <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }} />
          <Legend wrapperStyle={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem' }} />
          <Line type="monotone" dataKey="Current" stroke={COLORS.current} strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="Adjusted" stroke={COLORS.adjusted} strokeWidth={2} dot={{ r: 3 }} strokeDasharray="6 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MilestoneImpactTable({ milestones }) {
  const sorted = useMemo(() =>
    [...milestones].sort((a, b) => b.cancelled_in_missing - a.cancelled_in_missing),
    [milestones]
  );

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Per-Milestone Cancellation Impact (Latest Week)</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['SC', 'Code', 'Name', 'Type', 'Missing', 'Cancelled', '% of Missing', 'Comp (Old)', 'Comp (New)', 'Comp Δ'].map(h => (
                <th key={h} style={{
                  padding: '8px 10px', textAlign: 'left',
                  fontFamily: 'var(--font-display)', fontSize: '0.63rem', fontWeight: 600,
                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8f9fb'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '7px 10px', fontWeight: 600, color: m.scenario === 'SC4' ? '#2563eb' : '#0891b2' }}>{m.scenario}</td>
                <td style={{ padding: '7px 10px', fontWeight: 600 }}>{m.code}</td>
                <td style={{ padding: '7px 10px', color: 'var(--text-secondary)', maxWidth: 180 }}>{m.name}</td>
                <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{m.type.slice(0, 3)}</td>
                <td style={{ padding: '7px 10px' }}>{m.missing}</td>
                <td style={{ padding: '7px 10px' }}>
                  <span style={{
                    fontWeight: 700,
                    color: '#dc2626',
                    background: '#dc262610',
                    padding: '2px 8px',
                    borderRadius: 3,
                  }}>{m.cancelled_in_missing}</span>
                </td>
                <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>
                  {(m.pct_cancelled * 100).toFixed(1)}%
                </td>
                <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>
                  {(m.old_completeness * 100).toFixed(1)}%
                </td>
                <td style={{ padding: '7px 10px', color: COLORS.adjusted }}>
                  {(m.new_completeness * 100).toFixed(1)}%
                </td>
                <td style={{ padding: '7px 10px' }}>
                  <span style={{
                    fontWeight: 600,
                    color: m.comp_improvement > 0 ? COLORS.improvement : 'var(--text-muted)',
                  }}>+{(m.comp_improvement * 100).toFixed(2)}pp</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HypothesisSummary({ latestImpact }) {
  const s = latestImpact.summary;
  const totalCancelled = latestImpact.total_cancelled_hbls;
  const inMissing = latestImpact.total_cancelled_in_missing;

  return (
    <div style={{
      ...S.card,
      borderLeft: '4px solid #d97706',
      marginBottom: 20,
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.9rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: 12,
      }}>Hypothesis: Cancelled shipments not transmitted to Bosch</div>

      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.8rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.7,
        marginBottom: 16,
      }}>
        <strong>{totalCancelled}</strong> shipments are marked as cancelled in the Maersk T&T system.
        Of these, <strong>{inMissing}</strong> appear in the current week's missing milestone entries.
        Bosch's reporting filter (<code style={{ fontSize: '0.72rem', background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: 3 }}>SHIPMENT_CANCELLED = empty</code>)
        should exclude cancelled shipments, but these {inMissing} are still being counted as active — confirming the cancellation
        status is not being transmitted.
      </div>

      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.7,
      }}>
        <strong>Impact if fixed:</strong> Transmitting cancellation messages would remove these shipments from Bosch's
        "required" count, improving completeness by <strong style={{ color: COLORS.improvement }}>+{(s.all.comp_improvement * 100).toFixed(2)}pp</strong> and
        timeliness by <strong style={{ color: COLORS.improvement }}>+{(s.all.time_improvement * 100).toFixed(2)}pp</strong> (All milestones).
        For critical milestones: completeness <strong style={{ color: COLORS.improvement }}>+{(s.critical.comp_improvement * 100).toFixed(2)}pp</strong>,
        timeliness <strong style={{ color: COLORS.improvement }}>+{(s.critical.time_improvement * 100).toFixed(2)}pp</strong>.
      </div>

      <div style={{
        marginTop: 16,
        padding: '10px 14px',
        background: '#d9770608',
        border: '1px solid #d9770620',
        borderRadius: 6,
        fontFamily: 'var(--font-display)',
        fontSize: '0.72rem',
        color: '#92400e',
        lineHeight: 1.6,
      }}>
        <strong>Recommendation:</strong> Enable cancellation status transmission to Bosch via EDI. This is a
        low-effort, immediate improvement that requires no operational changes — just ensuring the S99 cancellation
        milestone is sent for all cancelled shipments.
      </div>
    </div>
  );
}

export default function CancellationAnalysis({ impactData, selectedWeek }) {
  if (!impactData || !impactData.length) {
    return (
      <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
        Loading cancellation impact data...
      </div>
    );
  }

  const latestIdx = impactData.findIndex(w => w.week === selectedWeek);
  const latest = latestIdx >= 0 ? impactData[latestIdx] : impactData[impactData.length - 1];
  const s = latest.summary;

  return (
    <div>
      <HypothesisSummary latestImpact={latest} />

      {/* KPI Compare Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 20 }}>
        <KPICompareCard
          label="Completeness (All)"
          current={s.all.old_completeness}
          adjusted={s.all.new_completeness}
          target={0.95}
          delay={0}
        />
        <KPICompareCard
          label="Timeliness (All)"
          current={s.all.old_timeliness}
          adjusted={s.all.new_timeliness}
          target={0.80}
          delay={0.05}
        />
        <KPICompareCard
          label="Completeness (Critical)"
          current={s.critical.old_completeness}
          adjusted={s.critical.new_completeness}
          target={0.95}
          delay={0.1}
        />
        <KPICompareCard
          label="Timeliness (Critical)"
          current={s.critical.old_timeliness}
          adjusted={s.critical.new_timeliness}
          target={0.80}
          delay={0.15}
        />
      </div>

      {/* Trend Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <WeeklyTrendChart impactData={impactData} />
        <TimelinessTrendChart impactData={impactData} />
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Cancelled HBLs', value: latest.total_cancelled_hbls, color: COLORS.cancelled },
          { label: 'Found in Missing', value: latest.total_cancelled_in_missing, color: '#d97706' },
          { label: 'Milestones Affected', value: latest.milestones.length, color: 'var(--text-primary)' },
          { label: 'Avg % of Missing', value: latest.milestones.length > 0
            ? `${(latest.milestones.reduce((s, m) => s + m.pct_cancelled, 0) / latest.milestones.length * 100).toFixed(1)}%`
            : '0%', color: '#7c3aed' },
          { label: 'Peak Week Impact', value: `+${(Math.max(...impactData.map(w => w.summary.all.comp_improvement)) * 100).toFixed(2)}pp`, color: COLORS.improvement },
        ].map((c, i) => (
          <div key={i} style={{ ...S.card, padding: '14px 18px', animation: `fadeInUp 0.3s ease-out ${0.2 + i * 0.05}s both` }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Per-milestone table */}
      {latest.milestones.length > 0 && (
        <MilestoneImpactTable milestones={latest.milestones} />
      )}
    </div>
  );
}
