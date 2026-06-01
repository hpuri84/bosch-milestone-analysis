import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';

const C = {
  card: 'var(--bg-card)', sec: 'var(--bg-secondary)', acc: 'var(--bg-accent)',
  border: 'var(--border)', borderAcc: 'var(--border-accent)',
  txt: 'var(--text-primary)', txt2: 'var(--text-secondary)', txt3: 'var(--text-muted)',
  blue: 'var(--accent-blue)', cyan: 'var(--accent-cyan)', green: 'var(--accent-green)',
  amber: 'var(--accent-amber)', red: 'var(--accent-red)', purple: 'var(--accent-purple)',
  maersk: 'var(--accent-maersk)', bosch: 'var(--accent-bosch)',
  mono: 'var(--font-mono)', disp: 'var(--font-display)',
};

const label = {
  textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11,
  fontWeight: 600, color: C.txt3,
};

function KpiCard({ title, value, sub, accent, bad }) {
  return (
    <div style={{
      flex: 1, minWidth: 160, background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: '16px 18px', boxShadow: 'var(--shadow-sm)',
      borderTop: `3px solid ${accent}`,
    }}>
      <div style={label}>{title}</div>
      <div style={{
        fontFamily: C.mono, fontSize: 28, fontWeight: 600, marginTop: 6,
        color: bad ? C.red : C.txt,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.txt3, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

const SC3_COLOR = C.maersk;
const SC4_COLOR = C.amber;

export default function BookingMix({ data, bookingMix, selectedWeek }) {
  const [sortDesc, setSortDesc] = useState(true);

  // Headline trend: prefer kpi_data array (sc3_shipments/sc4_shipments); fall back to bookingMix.weekly
  const trend = useMemo(() => {
    if (Array.isArray(data) && data.length && data[0].sc3_shipments != null) {
      return data.map((d) => {
        const sc3 = d.sc3_shipments || 0;
        const sc4 = d.sc4_shipments || 0;
        const total = sc3 + sc4;
        return {
          week: d.week, sc3, sc4, total,
          sc3_share: total ? (sc3 / total) * 100 : 0,
        };
      });
    }
    if (bookingMix?.weekly) {
      return bookingMix.weekly.map((w) => ({
        week: w.week, sc3: w.sc3, sc4: w.sc4, total: w.total,
        sc3_share: w.sc3_share * 100,
      }));
    }
    return [];
  }, [data, bookingMix]);

  const targetSc3 = (bookingMix?.target_sc3 ?? 0.8) * 100;
  const latestWeek = selectedWeek || bookingMix?.latest_week || (trend.length ? trend[trend.length - 1].week : null);

  const cur = trend.find((t) => t.week === latestWeek) || trend[trend.length - 1];
  const trail = bookingMix?.trailing4_sc3_share?.[latestWeek];

  const destRows = useMemo(() => {
    const rows = bookingMix?.by_dest_country?.[latestWeek] || [];
    const copy = [...rows];
    copy.sort((a, b) => (sortDesc ? b.total - a.total : a.total - b.total));
    return copy;
  }, [bookingMix, latestWeek, sortDesc]);

  const maxDestTotal = destRows.reduce((m, r) => Math.max(m, r.total), 0) || 1;

  if (!bookingMix) {
    return (
      <div style={{ padding: 24, color: C.txt3, fontFamily: C.disp }}>
        booking_mix.json not loaded.
      </div>
    );
  }

  const curShare = cur ? cur.sc3_share : 0;
  const curSc4Share = cur ? 100 - cur.sc3_share : 0;
  const gap = curShare - targetSc3;

  return (
    <div style={{ fontFamily: C.disp, color: C.txt }}>
      <div style={{ marginBottom: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Booking Mix — SC3 vs SC4</h2>
        <div style={{ fontSize: 13, color: C.txt2, marginTop: 4 }}>
          Share of shipment count by scenario, against the {targetSc3.toFixed(0)}% SC3 / {(100 - targetSc3).toFixed(0)}% SC4 target.
          Showing <span style={{ fontFamily: C.mono }}>{latestWeek}</span>.
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '16px 0' }}>
        <KpiCard title="SC3 Share" accent={SC3_COLOR}
          value={`${curShare.toFixed(1)}%`}
          sub={cur ? `${cur.sc3.toLocaleString()} shipments` : ''} bad={curShare < targetSc3} />
        <KpiCard title="SC4 Share" accent={SC4_COLOR}
          value={`${curSc4Share.toFixed(1)}%`}
          sub={cur ? `${cur.sc4.toLocaleString()} shipments` : ''} />
        <KpiCard title="Gap to 80% SC3" accent={gap < 0 ? C.red : C.green}
          value={`${gap >= 0 ? '+' : ''}${gap.toFixed(1)} pp`}
          sub={gap < 0 ? 'below target' : 'at/above target'} bad={gap < 0} />
        <KpiCard title="Trailing 4-wk SC3" accent={C.purple}
          value={trail != null ? `${(trail * 100).toFixed(1)}%` : '—'}
          sub="smoothed mix" />
      </div>

      {/* Trend chart */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: '16px 18px 8px', boxShadow: 'var(--shadow-sm)', marginBottom: 16,
      }}>
        <div style={{ ...label, marginBottom: 12 }}>Weekly SC3 share % &amp; volume vs 80% target</div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={trend} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 11, fontFamily: C.mono, fill: C.txt3 }}
              axisLine={{ stroke: C.borderAcc }} tickLine={false} />
            <YAxis yAxisId="cnt" tick={{ fontSize: 11, fontFamily: C.mono, fill: C.txt3 }}
              axisLine={false} tickLine={false} />
            <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} unit="%"
              tick={{ fontSize: 11, fontFamily: C.mono, fill: C.txt3 }}
              axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontFamily: C.mono, fontSize: 12, borderRadius: 6, border: `1px solid ${C.border}` }}
              formatter={(v, n) => (n === 'SC3 share %' ? [`${Number(v).toFixed(1)}%`, n] : [Number(v).toLocaleString(), n])} />
            <Legend wrapperStyle={{ fontSize: 12, fontFamily: C.disp }} />
            <Bar yAxisId="cnt" dataKey="sc3" name="SC3 count" stackId="a" fill={SC3_COLOR} radius={[0, 0, 0, 0]} />
            <Bar yAxisId="cnt" dataKey="sc4" name="SC4 count" stackId="a" fill={SC4_COLOR} radius={[2, 2, 0, 0]} />
            <ReferenceLine yAxisId="pct" y={targetSc3} stroke={C.green} strokeDasharray="5 4"
              label={{ value: `${targetSc3.toFixed(0)}% target`, position: 'insideTopRight', fontSize: 11, fill: C.green, fontFamily: C.mono }} />
            <Line yAxisId="pct" type="monotone" dataKey="sc3_share" name="SC3 share %"
              stroke={C.blue} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Dest country table */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: '16px 18px', boxShadow: 'var(--shadow-sm)', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div style={label}>Destination country distribution — {latestWeek}</div>
          <button onClick={() => setSortDesc((s) => !s)} style={{
            fontSize: 11, fontFamily: C.mono, cursor: 'pointer', background: C.acc,
            border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', color: C.txt2,
          }}>
            total {sortDesc ? '↓' : '↑'}
          </button>
        </div>
        {destRows.length === 0 ? (
          <div style={{ color: C.txt3, fontSize: 13 }}>No destination data for {latestWeek}.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'right', color: C.txt3, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Country</th>
                <th style={{ padding: '6px 8px' }}>SC3</th>
                <th style={{ padding: '6px 8px' }}>SC4</th>
                <th style={{ padding: '6px 8px' }}>Total</th>
                <th style={{ padding: '6px 8px', minWidth: 160 }}>SC3 share</th>
              </tr>
            </thead>
            <tbody>
              {destRows.map((r) => {
                const share = r.sc3_share * 100;
                const far = Math.abs(share - targetSc3) > 30;
                return (
                  <tr key={r.country} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: '7px 8px', fontFamily: C.mono, fontWeight: 600 }}>{r.country}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: C.mono, color: SC3_COLOR }}>{r.sc3}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: C.mono, color: C.amber }}>{r.sc4}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: C.mono, fontWeight: 600 }}>{r.total}</td>
                    <td style={{ padding: '7px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 8, background: C.sec, borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.max(2, Math.min(100, (r.total / maxDestTotal) * 100))}%`,
                            height: '100%', background: SC3_COLOR, opacity: 0.25, position: 'relative',
                          }} />
                        </div>
                        <span style={{
                          fontFamily: C.mono, minWidth: 48, textAlign: 'right',
                          color: far ? C.red : C.txt2, fontWeight: far ? 600 : 400,
                        }}>{share.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div style={{ fontSize: 11, color: C.txt3, marginTop: 10 }}>
          SC3 dest = Leg_Delivery_Country · SC4 dest = CONSIGNEE_ADDRESS_COUNTRY.
          Red share = &gt;30pp from the {targetSc3.toFixed(0)}% SC3 target.
        </div>
      </div>

      {/* Caveats */}
      {bookingMix.notes?.length > 0 && (
        <div style={{
          background: C.card, borderLeft: `3px solid ${C.amber}`, border: `1px solid ${C.border}`,
          borderLeftWidth: 3, borderRadius: 8, padding: '12px 16px',
        }}>
          <div style={{ ...label, color: C.amber, marginBottom: 8 }}>Data caveats</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: C.txt2, lineHeight: 1.6 }}>
            {bookingMix.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
