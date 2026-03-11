import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, PieChart, Pie, Treemap, Legend,
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
};

const COLORS = {
  ediGap: '#dc2626',
  genuine: '#d97706',
  notInScope: '#94a3b8',
  recovered: '#16a34a',
  sc3: '#0891b2',
  sc4: '#2563eb',
};

function SummaryBanner({ summary }) {
  const pctRecoverable = ((summary.edi_recoverable / summary.total_missing) * 100).toFixed(1);

  return (
    <div style={{
      ...S.card,
      borderLeft: '4px solid #dc2626',
      marginBottom: 20,
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.9rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: 12,
      }}>EDI Transmission Gap: Data exists in TMS but never reaches Bosch</div>

      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.8rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.7,
        marginBottom: 16,
      }}>
        Comparing Maersk's T&T report (TMS data for CW08) against what Bosch receives via EDI reveals a
        significant transmission gap. Of <strong>{summary.total_missing.toLocaleString()}</strong> missing
        milestone entries, <strong style={{ color: COLORS.ediGap }}>{summary.edi_recoverable.toLocaleString()}</strong> ({pctRecoverable}%)
        have dates already recorded in the TMS but are not being transmitted via EDI.
        An additional <strong>{summary.genuinely_missing.toLocaleString()}</strong> are genuinely missing from both systems, and <strong>{summary.not_in_scope}</strong> could
        not be mapped (no T&T column equivalent).
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
        marginBottom: 16,
      }}>
        {[
          { label: 'Current Completeness (All)', value: `${(summary.all.old_completeness * 100).toFixed(1)}%`, color: '#94a3b8' },
          { label: 'If EDI Fixed', value: `${(summary.all.new_completeness * 100).toFixed(1)}%`, color: COLORS.recovered },
          { label: 'Improvement', value: `+${(summary.all.improvement * 100).toFixed(1)}pp`, color: COLORS.recovered },
          { label: 'Critical Current', value: `${(summary.critical.old_completeness * 100).toFixed(1)}%`, color: '#94a3b8' },
          { label: 'Critical If Fixed', value: `${(summary.critical.new_completeness * 100).toFixed(1)}%`, color: COLORS.recovered },
          { label: 'Critical Improvement', value: `+${(summary.critical.improvement * 100).toFixed(1)}pp`, color: COLORS.recovered },
        ].map((c, i) => (
          <div key={i} style={{
            padding: '12px 16px',
            background: 'var(--bg-secondary)',
            borderRadius: 6,
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.58rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{
        padding: '10px 14px',
        background: '#dc262608',
        border: '1px solid #dc262620',
        borderRadius: 6,
        fontFamily: 'var(--font-display)',
        fontSize: '0.72rem',
        color: '#991b1b',
        lineHeight: 1.6,
      }}>
        <strong>Root Cause:</strong> The EDI interface is not transmitting milestone data that already exists in the TMS.
        This is a pure integration fix — no operational changes needed. Fixing this single issue recovers
        <strong> {summary.edi_recoverable.toLocaleString()}</strong> milestone entries and closes
        <strong> {(summary.all.improvement * 100).toFixed(1)}pp</strong> of the completeness gap.
      </div>
    </div>
  );
}

function GapBreakdownChart({ summary }) {
  const data = [
    { name: 'EDI Recoverable', value: summary.edi_recoverable, color: COLORS.ediGap, desc: 'Data in TMS, not sent via EDI' },
    { name: 'Genuinely Missing', value: summary.genuinely_missing, color: COLORS.genuine, desc: 'Missing from both TMS and EDI' },
    { name: 'Not Mappable', value: summary.not_in_scope, color: COLORS.notInScope, desc: 'No T&T column equivalent' },
  ];
  const remaining = summary.total_missing - summary.edi_recoverable - summary.genuinely_missing - summary.not_in_scope;
  if (remaining > 0) {
    data.push({ name: 'Other', value: remaining, color: '#e2e8f0', desc: 'Other unmapped gaps' });
  }

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Missing Milestone Breakdown — Where are the gaps?</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <ResponsiveContainer width="45%" height={240}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip
              formatter={(val, name) => [`${val} milestones`, name]}
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex: 1 }}>
          {data.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < data.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{d.name}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.63rem', color: 'var(--text-muted)' }}>{d.desc}</div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700, color: d.color }}>
                {d.value.toLocaleString()}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', width: 40, textAlign: 'right' }}>
                {((d.value / summary.total_missing) * 100).toFixed(0)}%
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 0', marginTop: 4 }}>
            <div style={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>Total Missing</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {summary.total_missing.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopEDIGapChart({ milestones }) {
  const recoverableMilestones = useMemo(() =>
    milestones
      .filter(m => m.edi_recoverable > 0)
      .sort((a, b) => b.edi_recoverable - a.edi_recoverable)
      .slice(0, 15)
      .map(m => ({
        label: `${m.scenario} ${m.code} ${m.type.slice(0, 3)}`,
        name: m.name,
        ediRecoverable: m.edi_recoverable,
        genuine: m.genuinely_missing,
        notInTnt: m.not_in_tnt,
        ediGapPct: m.edi_gap_pct,
        scenario: m.scenario,
      })),
    [milestones]
  );

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Top EDI Gaps — Milestones with data in TMS but not transmitted</div>
      <ResponsiveContainer width="100%" height={Math.max(300, recoverableMilestones.length * 32 + 40)}>
        <BarChart data={recoverableMilestones} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }} />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-secondary)' }}
            width={110}
          />
          <Tooltip
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}
            formatter={(val, name) => [val, name]}
          />
          <Legend wrapperStyle={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem' }} />
          <Bar dataKey="ediRecoverable" name="EDI Recoverable" stackId="a" fill={COLORS.ediGap} radius={[0, 0, 0, 0]}>
            {recoverableMilestones.map((m, i) => (
              <Cell key={i} fill={COLORS.ediGap} opacity={0.85} />
            ))}
          </Bar>
          <Bar dataKey="genuine" name="Genuinely Missing" stackId="a" fill={COLORS.genuine} radius={[0, 0, 0, 0]} />
          <Bar dataKey="notInTnt" name="Not in T&T" stackId="a" fill={COLORS.notInScope} radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ServiceGapBreakdown({ milestones }) {
  const serviceData = useMemo(() => {
    const acc = {};
    milestones.forEach(m => {
      if (!m.gap_by_service) return;
      Object.entries(m.gap_by_service).forEach(([svc, count]) => {
        acc[svc] = (acc[svc] || 0) + count;
      });
    });
    return Object.entries(acc)
      .map(([svc, count]) => ({ name: svc, value: count }))
      .sort((a, b) => b.value - a.value);
  }, [milestones]);

  const svcColors = { LCL: '#2563eb', FCL: '#0891b2', BCO: '#7c3aed' };

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>EDI Gap by Service Type</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <ResponsiveContainer width="40%" height={200}>
          <PieChart>
            <Pie
              data={serviceData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={75}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
            >
              {serviceData.map((d, i) => <Cell key={i} fill={svcColors[d.name] || '#94a3b8'} />)}
            </Pie>
            <Tooltip
              formatter={(val, name) => [`${val} milestones`, name]}
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex: 1 }}>
          {serviceData.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < serviceData.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: svcColors[d.name] || '#94a3b8' }} />
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{d.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: svcColors[d.name] || '#94a3b8' }}>
                {d.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FullMilestoneTable({ milestones }) {
  const [sortBy, setSortBy] = useState('edi_recoverable');
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() =>
    [...milestones].sort((a, b) => b[sortBy] - a[sortBy]),
    [milestones, sortBy]
  );

  const displayed = showAll ? sorted : sorted.slice(0, 20);

  const headers = [
    { key: 'scenario', label: 'SC', width: 50 },
    { key: 'code', label: 'Code', width: 55 },
    { key: 'name', label: 'Milestone', width: 180 },
    { key: 'type', label: 'Type', width: 45 },
    { key: 'is_critical', label: 'Crit', width: 40 },
    { key: 'required', label: 'Req', width: 55 },
    { key: 'missing', label: 'Missing', width: 65 },
    { key: 'edi_recoverable', label: 'EDI Gap', width: 70 },
    { key: 'genuinely_missing', label: 'Genuine', width: 65 },
    { key: 'edi_gap_pct', label: 'EDI %', width: 60 },
    { key: 'old_completeness', label: 'Comp Now', width: 70 },
    { key: 'new_completeness', label: 'Comp Fix', width: 70 },
    { key: 'comp_improvement', label: 'Comp +', width: 65 },
  ];

  return (
    <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={S.cardTitle}>Full Milestone EDI Gap Detail</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['edi_recoverable', 'edi_gap_pct', 'missing', 'comp_improvement'].map(key => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.6rem',
                fontWeight: sortBy === key ? 600 : 400,
                color: sortBy === key ? '#fff' : 'var(--text-muted)',
                background: sortBy === key ? '#2563eb' : 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '3px 8px',
                cursor: 'pointer',
              }}
            >
              {key === 'edi_recoverable' ? 'EDI Gap' : key === 'edi_gap_pct' ? 'EDI %' : key === 'missing' ? 'Missing' : 'Impact'}
            </button>
          ))}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {headers.map(h => (
                <th key={h.key} style={{
                  padding: '8px 8px', textAlign: 'left',
                  fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600,
                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
                  cursor: 'pointer', minWidth: h.width,
                }}
                  onClick={() => setSortBy(h.key)}
                >{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map((m, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8f9fb'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '6px 8px', fontWeight: 600, color: m.scenario === 'SC4' ? COLORS.sc4 : COLORS.sc3 }}>{m.scenario}</td>
                <td style={{ padding: '6px 8px', fontWeight: 600 }}>{m.code}</td>
                <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</td>
                <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{m.type.slice(0, 3)}</td>
                <td style={{ padding: '6px 8px' }}>
                  {m.is_critical && <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.65rem' }}>YES</span>}
                </td>
                <td style={{ padding: '6px 8px' }}>{m.required}</td>
                <td style={{ padding: '6px 8px', fontWeight: 600 }}>{m.missing}</td>
                <td style={{ padding: '6px 8px' }}>
                  {m.edi_recoverable > 0 ? (
                    <span style={{
                      fontWeight: 700,
                      color: COLORS.ediGap,
                      background: '#dc262610',
                      padding: '2px 8px',
                      borderRadius: 3,
                    }}>{m.edi_recoverable}</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>0</span>
                  )}
                </td>
                <td style={{ padding: '6px 8px', color: m.genuinely_missing > 0 ? COLORS.genuine : 'var(--text-muted)' }}>{m.genuinely_missing}</td>
                <td style={{ padding: '6px 8px' }}>
                  {m.edi_gap_pct > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 40, height: 4, background: 'var(--bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(m.edi_gap_pct, 100)}%`, height: '100%', background: COLORS.ediGap, borderRadius: 2 }} />
                      </div>
                      <span style={{ color: m.edi_gap_pct > 50 ? COLORS.ediGap : 'var(--text-secondary)', fontWeight: m.edi_gap_pct > 50 ? 600 : 400 }}>
                        {m.edi_gap_pct.toFixed(0)}%
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>--</span>
                  )}
                </td>
                <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{(m.old_completeness * 100).toFixed(1)}%</td>
                <td style={{ padding: '6px 8px', color: m.edi_recoverable > 0 ? COLORS.recovered : 'var(--text-muted)' }}>{(m.new_completeness * 100).toFixed(1)}%</td>
                <td style={{ padding: '6px 8px' }}>
                  {m.comp_improvement > 0 ? (
                    <span style={{ fontWeight: 600, color: COLORS.recovered }}>+{(m.comp_improvement * 100).toFixed(1)}pp</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>--</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!showAll && sorted.length > 20 && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button
            onClick={() => setShowAll(true)}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.7rem',
              color: '#2563eb',
              background: 'transparent',
              border: '1px solid #2563eb40',
              borderRadius: 4,
              padding: '6px 16px',
              cursor: 'pointer',
            }}
          >Show all {sorted.length} milestones</button>
        </div>
      )}
    </div>
  );
}

export default function TransmissionGapAnalysis({ gapData }) {
  if (!gapData) {
    return (
      <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
        Loading transmission gap data...
      </div>
    );
  }

  return (
    <div>
      <SummaryBanner summary={gapData.summary} />

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <GapBreakdownChart summary={gapData.summary} />
        <ServiceGapBreakdown milestones={gapData.milestones} />
      </div>

      {/* Top EDI gaps */}
      <div style={{ marginBottom: 20 }}>
        <TopEDIGapChart milestones={gapData.milestones} />
      </div>

      {/* Full table */}
      <FullMilestoneTable milestones={gapData.milestones} />
    </div>
  );
}
