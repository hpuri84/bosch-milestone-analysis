import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell
} from 'recharts';

const SVC_COLORS = {
  FCL: '#3b82f6',
  BCO: '#a78bfa',
  LCL: '#22d3ee',
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-accent)',
      borderRadius: 6,
      padding: '12px 16px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.8rem',
    }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 8, fontFamily: 'var(--font-display)', fontWeight: 500 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.fill || p.color, marginBottom: 3, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span>{p.name}</span>
          <span>{(p.value).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export default function ServiceBreakdown({ weekData, scenario, metric = 'completeness' }) {
  if (!weekData) return null;

  const svcData = weekData.service_breakdown?.[scenario];
  if (!svcData) return null;

  const barData = Object.entries(svcData).map(([svc, data]) => ({
    service: svc,
    value: (data?.all?.[metric] || 0) * 100,
    critical: (data?.critical?.[metric] || 0) * 100,
  }));

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
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: scenario === 'SC3' ? 'var(--accent-cyan)' : 'var(--accent-blue)',
          display: 'inline-block',
        }} />
        {scenario} — {metric === 'completeness' ? 'Completeness' : 'Timeliness'} by Service
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={barData} barGap={4} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="service"
            tick={{ fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}%`}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem' }} />
          <Bar dataKey="value" name="All" radius={[3, 3, 0, 0]} maxBarSize={40}>
            {barData.map((d, i) => (
              <Cell key={i} fill={SVC_COLORS[d.service] || 'var(--accent-blue)'} opacity={0.7} />
            ))}
          </Bar>
          <Bar dataKey="critical" name="Critical" radius={[3, 3, 0, 0]} maxBarSize={40}>
            {barData.map((d, i) => (
              <Cell key={i} fill={SVC_COLORS[d.service] || 'var(--accent-blue)'} opacity={1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
