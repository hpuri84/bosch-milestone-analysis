import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine
} from 'recharts';

const COLORS = {
  completeness: '#3b82f6',
  timeliness: '#22d3ee',
  critical_comp: '#a78bfa',
  critical_time: '#f472b6',
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
          background: lines[0]?.color || COLORS.completeness,
          borderRadius: 2,
          display: 'inline-block',
        }} />
        {title}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
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
              stroke={l.color || COLORS.completeness}
              strokeWidth={2}
              dot={{ r: 3, fill: l.color || COLORS.completeness, strokeWidth: 0 }}
              activeDot={{ r: 5, stroke: l.color || COLORS.completeness, strokeWidth: 2, fill: 'var(--bg-primary)' }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
