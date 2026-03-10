import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine
} from 'recharts';

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

export default function TrendChart({ data, title, lines, height = 300, target }) {
  const chartData = data.map(d => ({ ...d }));

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
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{
          width: 3,
          height: 16,
          background: lines[0]?.color || '#2563eb',
          borderRadius: 2,
          display: 'inline-block',
        }} />
        {title}
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
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}
          />
          {target && (
            <ReferenceLine
              y={target}
              stroke="var(--accent-amber)"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{
                value: `Target ${target}%`,
                fill: 'var(--accent-amber)',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                position: 'right',
              }}
            />
          )}
          {lines.map((l, i) => (
            <Line
              key={i}
              type="monotone"
              dataKey={l.key}
              name={l.name}
              stroke={l.color || '#2563eb'}
              strokeWidth={2}
              dot={{ r: 3, fill: l.color || '#2563eb', strokeWidth: 0 }}
              activeDot={{ r: 5, stroke: l.color || '#2563eb', strokeWidth: 2, fill: '#fff' }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
