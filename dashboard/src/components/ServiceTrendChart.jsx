import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';

const SVC_STYLES = {
  FCL: { color: '#2563eb', dash: undefined },
  BCO: { color: '#7c3aed', dash: '6 3' },
  LCL: { color: '#0891b2', dash: '2 2' },
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--border)',
      borderRadius: 6,
      padding: '12px 16px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.8rem',
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ color: 'var(--text-primary)', marginBottom: 8, fontFamily: 'var(--font-display)', fontWeight: 500 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 3, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span>{p.name}</span>
          <span>{(p.value).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export default function ServiceTrendChart({ data, scenario, metric = 'completeness', height = 240 }) {
  const services = ['FCL', 'BCO', 'LCL'];
  const metricLabel = metric === 'completeness' ? 'Completeness' : 'Timeliness';

  const chartData = data.map(d => {
    const point = { week: d.week };
    services.forEach(svc => {
      const val = d.service_breakdown?.[scenario]?.[svc]?.all?.[metric];
      point[svc] = val != null ? val * 100 : null;
    });
    return point;
  });

  const hasData = chartData.some(d => services.some(s => d[s] > 0));
  if (!hasData) return null;

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
        marginBottom: 4,
      }}>
        {scenario} {metricLabel} by Service Type
      </div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        marginBottom: 16,
        display: 'flex',
        gap: 16,
      }}>
        {services.map(svc => (
          <span key={svc} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 12,
              height: 2,
              background: SVC_STYLES[svc].color,
              display: 'inline-block',
              borderRadius: 1,
            }} />
            {svc}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="week"
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
          {services.map(svc => (
            <Line
              key={svc}
              type="monotone"
              dataKey={svc}
              name={svc}
              stroke={SVC_STYLES[svc].color}
              strokeWidth={2}
              strokeDasharray={SVC_STYLES[svc].dash}
              dot={{ r: 3, fill: SVC_STYLES[svc].color, strokeWidth: 0 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
