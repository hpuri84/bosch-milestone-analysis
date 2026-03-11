import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, PieChart, Pie, Legend,
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
  seeburger: '#9333ea',
  ediGap: '#dc2626',
  genuine: '#d97706',
  fixed: '#16a34a',
  sc3: '#0891b2',
  sc4: '#2563eb',
  unexplained: '#f59e0b',
};

const ERROR_COLORS = [
  '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#65a30d',
  '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#c026d3',
];

function SummaryBanner({ summary }) {
  return (
    <div style={{
      ...S.card,
      borderLeft: '4px solid #9333ea',
      marginBottom: 20,
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.9rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          background: 'linear-gradient(135deg, #9333ea, #7c3aed)',
          borderRadius: 6,
          fontSize: '0.7rem',
          fontWeight: 700,
          color: '#fff',
        }}>SB</span>
        Seeburger EDI Gateway: Filtering {summary.total_error_records.toLocaleString()} messages
      </div>

      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.8rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.7,
        marginBottom: 16,
      }}>
        The Seeburger B2B gateway sits between Maersk's TMS and Bosch's EDI interface.
        It validates outgoing IFTSTA messages and <strong style={{ color: COLORS.seeburger }}>rejects messages that fail validation</strong>.
        Analysis shows <strong>{summary.total_error_records.toLocaleString()}</strong> error records
        across <strong>{summary.unique_hbls_filtered.toLocaleString()}</strong> unique HBLs.
        These rejections account for <strong style={{ color: COLORS.seeburger }}>{summary.seeburger_explains_pct}%</strong> of
        the EDI transmission gap ({summary.seeburger_explains} of {summary.total_edi_gap} recoverable milestone entries).
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 10,
        marginBottom: 16,
      }}>
        {[
          { label: 'Error Records', value: summary.total_error_records.toLocaleString(), color: COLORS.seeburger },
          { label: 'Unique HBLs', value: summary.unique_hbls_filtered.toLocaleString(), color: COLORS.seeburger },
          { label: 'SC4 Errors', value: summary.sc4_errors.toLocaleString(), color: COLORS.sc4 },
          { label: 'SC4 HBLs', value: summary.sc4_hbls.toLocaleString(), color: COLORS.sc4 },
          { label: 'SC3 Errors', value: summary.sc3_errors.toLocaleString(), color: COLORS.sc3 },
          { label: 'SC3 HBLs', value: summary.sc3_hbls.toLocaleString(), color: COLORS.sc3 },
          { label: 'EDI Gap Explained', value: `${summary.seeburger_explains_pct}%`, color: COLORS.fixed },
          { label: 'Milestones Recovered', value: summary.seeburger_explains, color: COLORS.fixed },
        ].map((c, i) => (
          <div key={i} style={{
            padding: '10px 14px',
            background: 'var(--bg-secondary)',
            borderRadius: 6,
            border: '1px solid var(--border)',
            animation: `fadeInUp 0.3s ease-out ${i * 0.04}s both`,
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.55rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{
        padding: '10px 14px',
        background: '#9333ea08',
        border: '1px solid #9333ea20',
        borderRadius: 6,
        fontFamily: 'var(--font-display)',
        fontSize: '0.72rem',
        color: '#581c87',
        lineHeight: 1.6,
      }}>
        <strong>Three-layer problem:</strong> (1) Data exists in TMS → (2) Seeburger rejects the IFTSTA message due
        to missing/invalid fields → (3) Bosch never receives the milestone. Fix the validation errors at source
        (populate missing fields in TMS) and Seeburger will pass the messages through.
      </div>
    </div>
  );
}

function ErrorCategoryChart({ errorCategories }) {
  const chartData = useMemo(() =>
    errorCategories.map(e => ({
      name: e.error.length > 30 ? e.error.slice(0, 28) + '...' : e.error,
      fullName: e.error,
      count: e.count,
    })),
    [errorCategories]
  );

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Top Error Categories — Why Seeburger rejects messages</div>
      <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 30 + 40)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 180, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--text-secondary)' }}
            width={170}
          />
          <Tooltip
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}
            formatter={(val, name, props) => [val, props.payload.fullName]}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={ERROR_COLORS[i % ERROR_COLORS.length]} opacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EventBreakdownChart({ eventStats }) {
  const chartData = useMemo(() =>
    eventStats.slice(0, 15).map(e => ({
      name: e.event,
      count: e.count,
    })),
    [eventStats]
  );

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Filtered Events by Milestone — Message volume blocked</div>
      <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 28 + 40)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-secondary)' }}
            width={90}
          />
          <Tooltip
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.name.startsWith('S31') ? '#dc2626' : d.name.startsWith('S07') ? '#d97706' : d.name.startsWith('S04') ? '#2563eb' : '#9333ea'} opacity={0.75} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GapWaterfallChart({ summary }) {
  const data = [
    { name: 'Total Missing', value: summary.total_edi_gap, color: '#94a3b8' },
    { name: 'Seeburger Blocked', value: summary.seeburger_explains, color: COLORS.seeburger },
    { name: 'Other EDI Issues', value: summary.total_edi_gap - summary.seeburger_explains, color: COLORS.unexplained },
  ];

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>EDI Gap Attribution — Seeburger vs Other</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <ResponsiveContainer width="40%" height={200}>
          <PieChart>
            <Pie
              data={[
                { name: 'Seeburger Blocked', value: summary.seeburger_explains },
                { name: 'Other EDI Issues', value: summary.total_edi_gap - summary.seeburger_explains },
              ]}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={80}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={COLORS.seeburger} />
              <Cell fill={COLORS.unexplained} />
            </Pie>
            <Tooltip
              formatter={(val, name) => [`${val} milestones`, name]}
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex: 1 }}>
          {data.map((d, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
              borderBottom: i < data.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{d.name}</div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: d.color }}>{d.value}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', width: 40, textAlign: 'right' }}>
                {((d.value / summary.total_edi_gap) * 100).toFixed(0)}%
              </div>
            </div>
          ))}
          <div style={{
            marginTop: 12,
            padding: '8px 12px',
            background: '#9333ea08',
            borderRadius: 6,
            fontFamily: 'var(--font-display)',
            fontSize: '0.68rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}>
            Fixing Seeburger validation errors recovers <strong style={{ color: COLORS.seeburger }}>{summary.seeburger_explains}</strong> of {summary.total_edi_gap} EDI-recoverable milestones.
            The remaining {summary.total_edi_gap - summary.seeburger_explains} may be due to TMS trigger issues or unmapped event types.
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionPlanTable({ errorCategories }) {
  const actions = useMemo(() => {
    const grouped = {};
    errorCategories.forEach(e => {
      const err = e.error;
      let category, fix, effort;
      if (err.includes('Deliver to party')) {
        category = 'Party Data'; fix = 'Populate consignee/deliver-to party in booking'; effort = 'Medium';
      } else if (err.includes('Discharge port')) {
        category = 'Routing Data'; fix = 'Ensure discharge port is set on all bookings'; effort = 'Low';
      } else if (err.includes('Pick-up from party')) {
        category = 'Party Data'; fix = 'Populate shipper/pick-up party in booking'; effort = 'Medium';
      } else if (err.includes('Load port')) {
        category = 'Routing Data'; fix = 'Ensure load port is set on all bookings'; effort = 'Low';
      } else if (err.includes('delivery DTM')) {
        category = 'Date/Time'; fix = 'Populate S00 delivery date-time in booking'; effort = 'Medium';
      } else if (err.includes('pick-up DTM')) {
        category = 'Date/Time'; fix = 'Populate S00 pick-up date-time in booking'; effort = 'Medium';
      } else if (err.includes('DLV Mode')) {
        category = 'Reference Data'; fix = 'Set HBL delivery mode field'; effort = 'Low';
      } else if (err.includes('TSR details')) {
        category = 'Reference Data'; fix = 'Populate TSR (Transport Service Requirement) details'; effort = 'Medium';
      } else if (err.includes('TO number')) {
        category = 'Reference Data'; fix = 'Truncate or fix Transport Order number length'; effort = 'Low';
      } else if (err.includes('Package')) {
        category = 'Cargo Data'; fix = 'Ensure package details are present on booking'; effort = 'Low';
      } else {
        category = 'Other'; fix = 'Investigate error pattern'; effort = 'TBD';
      }

      if (!grouped[category]) grouped[category] = { category, fix, count: 0, errors: [] };
      grouped[category].count += e.count;
      grouped[category].errors.push(err);
    });
    return Object.values(grouped).sort((a, b) => b.count - a.count);
  }, [errorCategories]);

  const effortColors = { Low: '#16a34a', Medium: '#d97706', High: '#dc2626', TBD: '#94a3b8' };

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Remediation Action Plan — Fix these to unblock Seeburger</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            {['Category', 'Fix Required', 'Error Count', 'Effort'].map(h => (
              <th key={h} style={{
                padding: '8px 10px', textAlign: 'left',
                fontFamily: 'var(--font-display)', fontSize: '0.63rem', fontWeight: 600,
                color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {actions.map((a, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8f9fb'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <td style={{ padding: '8px 10px', fontWeight: 600, color: COLORS.seeburger }}>{a.category}</td>
              <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: '0.73rem' }}>{a.fix}</td>
              <td style={{ padding: '8px 10px' }}>
                <span style={{
                  fontWeight: 700,
                  color: COLORS.ediGap,
                  background: '#dc262610',
                  padding: '2px 8px',
                  borderRadius: 3,
                }}>{a.count.toLocaleString()}</span>
              </td>
              <td style={{ padding: '8px 10px' }}>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: effortColors[a.effort],
                  background: `${effortColors[a.effort]}10`,
                  padding: '2px 8px',
                  borderRadius: 3,
                  border: `1px solid ${effortColors[a.effort]}30`,
                }}>{a.effort}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MilestoneDetailTable({ milestones }) {
  const [sortBy, setSortBy] = useState('seeburger_filtered');

  const sorted = useMemo(() =>
    [...milestones]
      .filter(m => m.seeburger_filtered > 0 || m.edi_recoverable > 0)
      .sort((a, b) => b[sortBy] - a[sortBy]),
    [milestones, sortBy]
  );

  return (
    <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={S.cardTitle}>Per-Milestone: Seeburger Rejections vs EDI Gap</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'seeburger_filtered', label: 'SB Filtered' },
            { key: 'edi_recoverable', label: 'EDI Gap' },
            { key: 'missing', label: 'Missing' },
          ].map(btn => (
            <button
              key={btn.key}
              onClick={() => setSortBy(btn.key)}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.6rem',
                fontWeight: sortBy === btn.key ? 600 : 400,
                color: sortBy === btn.key ? '#fff' : 'var(--text-muted)',
                background: sortBy === btn.key ? '#9333ea' : 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '3px 8px',
                cursor: 'pointer',
              }}
            >{btn.label}</button>
          ))}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['SC', 'Code', 'Milestone', 'Type', 'Missing', 'EDI Gap', 'SB Filtered', 'Top Error'].map(h => (
                <th key={h} style={{
                  padding: '8px 8px', textAlign: 'left',
                  fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600,
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
                <td style={{ padding: '6px 8px', fontWeight: 600, color: m.scenario === 'SC4' ? COLORS.sc4 : COLORS.sc3 }}>{m.scenario}</td>
                <td style={{ padding: '6px 8px', fontWeight: 600 }}>{m.code}</td>
                <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</td>
                <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{m.type.slice(0, 3)}</td>
                <td style={{ padding: '6px 8px' }}>{m.missing}</td>
                <td style={{ padding: '6px 8px' }}>
                  {m.edi_recoverable > 0 ? (
                    <span style={{ fontWeight: 700, color: COLORS.ediGap, background: '#dc262610', padding: '2px 8px', borderRadius: 3 }}>
                      {m.edi_recoverable}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>0</span>
                  )}
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <span style={{
                    fontWeight: 700,
                    color: COLORS.seeburger,
                    background: '#9333ea10',
                    padding: '2px 8px',
                    borderRadius: 3,
                  }}>{m.seeburger_filtered}</span>
                </td>
                <td style={{ padding: '6px 8px', fontFamily: 'var(--font-display)', fontSize: '0.63rem', color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.top_errors.length > 0 ? m.top_errors[0].error : '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SeeburgerAnalysis({ seeburgerData }) {
  if (!seeburgerData) {
    return (
      <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
        Loading Seeburger analysis data...
      </div>
    );
  }

  return (
    <div>
      <SummaryBanner summary={seeburgerData.summary} />

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <GapWaterfallChart summary={seeburgerData.summary} />
        <EventBreakdownChart eventStats={seeburgerData.event_stats} />
      </div>

      {/* Error categories */}
      <div style={{ marginBottom: 20 }}>
        <ErrorCategoryChart errorCategories={seeburgerData.error_categories} />
      </div>

      {/* Action plan */}
      <div style={{ marginBottom: 20 }}>
        <ActionPlanTable errorCategories={seeburgerData.error_categories} />
      </div>

      {/* Per-milestone detail */}
      <MilestoneDetailTable milestones={seeburgerData.milestones} />
    </div>
  );
}
