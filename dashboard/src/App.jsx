import { useState, useEffect } from 'react';
import { injectGlobalStyles } from './styles';
import KPICard from './components/KPICard';
import TrendChart from './components/TrendChart';
import ServiceBreakdown from './components/ServiceBreakdown';
import ServiceTrendChart from './components/ServiceTrendChart';
import DataTable from './components/DataTable';
import WeekSelector from './components/WeekSelector';
import RCASection from './components/RCASection';
import ETARefRCA from './components/ETARefRCA';
import PlausibilityRCA from './components/PlausibilityRCA';
import TargetAnalysis from './components/TargetAnalysis';
import TaskTracker from './components/TaskTracker';
import HBLAnalysis from './components/HBLAnalysis';
import CancellationAnalysis from './components/CancellationAnalysis';
import TransmissionGapAnalysis from './components/TransmissionGapAnalysis';
import SeeburgerAnalysis from './components/SeeburgerAnalysis';

injectGlobalStyles();

const LAYOUT = {
  page: {
    maxWidth: 1320,
    margin: '0 auto',
    padding: '0 32px 64px',
  },
  header: {
    padding: '32px 0 24px',
    borderBottom: '1px solid var(--border)',
    marginBottom: 32,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    marginBottom: 16,
    paddingLeft: 2,
  },
  grid4: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: 16,
  },
};

export default function App() {
  const [data, setData] = useState(null);
  const [rcaData, setRcaData] = useState(null);
  const [taskData, setTaskData] = useState(null);
  const [cancelledHBLs, setCancelledHBLs] = useState([]);
  const [cancellationImpact, setCancellationImpact] = useState(null);
  const [transmissionGap, setTransmissionGap] = useState(null);
  const [ediGapDrilldown, setEdiGapDrilldown] = useState(null);
  const [seeburgerData, setSeeburgerData] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    Promise.all([
      fetch('/kpi_data.json').then(r => r.json()),
      fetch('/rca_data.json').then(r => r.json()),
      fetch('/tasks.json').then(r => r.json()),
      fetch('/cancelled_hbls.json').then(r => r.json()).catch(() => ({ hbls: [] })),
      fetch('/cancellation_impact.json').then(r => r.json()).catch(() => null),
      fetch('/transmission_gap.json').then(r => r.json()).catch(() => null),
      fetch('/edi_gap_drilldown.json').then(r => r.json()).catch(() => null),
      fetch('/seeburger_analysis.json').then(r => r.json()).catch(() => null),
    ]).then(([kpi, rca, tasks, cancelled, impact, gap, ediDrill, seeburger]) => {
      setData(kpi);
      setRcaData(rca);
      setTaskData(tasks);
      setCancelledHBLs(cancelled.hbls || []);
      setCancellationImpact(impact);
      setTransmissionGap(gap);
      setEdiGapDrilldown(ediDrill);
      setSeeburgerData(seeburger);
      setSelectedWeek(kpi[kpi.length - 1]?.week);
    });
  }, []);

  if (!data) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-muted)',
      }}>
        Loading KPI data...
      </div>
    );
  }

  const weeks = data.map(d => d.week);
  const currentIdx = data.findIndex(d => d.week === selectedWeek);
  const current = data[currentIdx];
  const prev = currentIdx > 0 ? data[currentIdx - 1] : null;

  const mainTrend = data.map(d => ({
    week: d.week,
    'Completeness (All)': d.all.completeness * 100,
    'Timeliness (All)': d.all.timeliness * 100,
    'Completeness (Critical)': d.critical.completeness * 100,
    'Timeliness (Critical)': d.critical.timeliness * 100,
  }));

  const etaTrend = data.map(d => ({
    week: d.week,
    'ETA 2P (Port)': d.eta_2p != null ? d.eta_2p * 100 : null,
    'ETA 2D (Delivery)': d.eta_2d != null ? d.eta_2d * 100 : null,
    'Reference': d.ref_comp != null ? d.ref_comp * 100 : null,
  }));

  const sc3vs4Trend = data.map(d => ({
    week: d.week,
    'SC3': d.sc3_total.completeness * 100,
    'SC4': d.sc4_total.completeness * 100,
  }));

  const sc3vs4TimeTrend = data.map(d => ({
    week: d.week,
    'SC3': d.sc3_total.timeliness * 100,
    'SC4': d.sc4_total.timeliness * 100,
  }));

  const plausibilityTrend = rcaData ? rcaData.map(w => {
    const p = w.plausibility_rca || {};
    return {
      week: w.week,
      'Violations': p.total_violations || 0,
      'Affected HBLs': p.affected_hbls || 0,
      'Critical': p.critical_count || 0,
      'Warning': p.warning_count || 0,
    };
  }) : [];

  return (
    <div style={LAYOUT.page}>
      {/* Header */}
      <div style={LAYOUT.header}>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.6rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              background: 'linear-gradient(135deg, var(--accent-bosch), #ff4444)',
              borderRadius: 8,
              fontSize: '0.9rem',
              fontWeight: 700,
              color: '#fff',
              letterSpacing: 0,
            }}>B</span>
            Milestone Analysis
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            marginTop: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--accent-green)',
              animation: 'pulseGlow 2s infinite',
            }} />
            Bosch x Maersk Supply Chain KPIs — {data.length} weeks tracked
          </div>
        </div>
        <WeekSelector weeks={weeks} selected={selectedWeek} onSelect={setSelectedWeek} />
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: 0,
        marginBottom: 28,
        borderBottom: '2px solid var(--border)',
      }}>
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'rca', label: 'Milestone RCA' },
          { key: 'eta_ref', label: 'ETA & Reference' },
          { key: 'plausibility', label: 'Plausibility' },
          { key: 'targets', label: 'April Targets' },
          { key: 'hbl', label: 'HBL Impact' },
          { key: 'cancellations', label: 'Cancellations' },
          { key: 'transmission', label: 'EDI Gap' },
          { key: 'seeburger', label: 'Seeburger' },
          { key: 'tasks', label: 'Tasks' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.85rem',
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? 'var(--accent-blue)' : 'var(--text-muted)',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent-blue)' : '2px solid transparent',
              padding: '10px 20px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              marginBottom: -2,
            }}
            onMouseEnter={e => {
              if (activeTab !== tab.key) e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            onMouseLeave={e => {
              if (activeTab !== tab.key) e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== MILESTONE RCA TAB ===== */}
      {activeTab === 'rca' && (
        <div style={LAYOUT.section}>
          <div style={LAYOUT.sectionTitle}>
            {selectedWeek} — Milestone Breakdown & Root Cause Analysis
          </div>
          <RCASection rcaData={rcaData} selectedWeek={selectedWeek} cancelledHBLs={cancelledHBLs} />
        </div>
      )}

      {/* ===== ETA & REFERENCE TAB ===== */}
      {activeTab === 'eta_ref' && (
        <div style={LAYOUT.section}>
          <div style={LAYOUT.sectionTitle}>
            {selectedWeek} — ETA Accuracy & Reference Completeness RCA
          </div>
          <ETARefRCA rcaData={rcaData} selectedWeek={selectedWeek} />
        </div>
      )}

      {/* ===== PLAUSIBILITY TAB ===== */}
      {activeTab === 'plausibility' && (
        <div style={LAYOUT.section}>
          <div style={LAYOUT.sectionTitle}>
            {selectedWeek} — Milestone Plausibility & Sequence Violations
          </div>
          <PlausibilityRCA rcaData={rcaData} selectedWeek={selectedWeek} />
        </div>
      )}

      {/* ===== TARGET ANALYSIS TAB ===== */}
      {activeTab === 'targets' && (
        <div style={LAYOUT.section}>
          <TargetAnalysis data={data} rcaData={rcaData} selectedWeek={selectedWeek} />
        </div>
      )}

      {/* ===== HBL IMPACT TAB ===== */}
      {activeTab === 'hbl' && (
        <div style={LAYOUT.section}>
          <div style={LAYOUT.sectionTitle}>
            {selectedWeek} — HBL-Level Missing Milestone Analysis
          </div>
          <HBLAnalysis rcaData={rcaData} selectedWeek={selectedWeek} cancelledHBLs={cancelledHBLs} />
        </div>
      )}

      {/* ===== CANCELLATIONS TAB ===== */}
      {activeTab === 'cancellations' && (
        <div style={LAYOUT.section}>
          <div style={LAYOUT.sectionTitle}>
            Cancellation Impact Analysis — What-If Cancelled Shipments Were Excluded
          </div>
          <CancellationAnalysis impactData={cancellationImpact} selectedWeek={selectedWeek} />
        </div>
      )}

      {/* ===== SEEBURGER TAB ===== */}
      {activeTab === 'seeburger' && (
        <div style={LAYOUT.section}>
          <div style={LAYOUT.sectionTitle}>
            Seeburger EDI Gateway — Message Filtering Analysis
          </div>
          <SeeburgerAnalysis seeburgerData={seeburgerData} />
        </div>
      )}

      {/* ===== TRANSMISSION GAP TAB ===== */}
      {activeTab === 'transmission' && (
        <div style={LAYOUT.section}>
          <div style={LAYOUT.sectionTitle}>
            {selectedWeek} — TMS vs EDI Transmission Gap Analysis
          </div>
          <TransmissionGapAnalysis gapData={transmissionGap} drilldownData={ediGapDrilldown} />
        </div>
      )}

      {/* ===== TASKS TAB ===== */}
      {activeTab === 'tasks' && (
        <div style={LAYOUT.section}>
          <div style={LAYOUT.sectionTitle}>Project Task Tracker</div>
          <TaskTracker taskData={taskData} />
        </div>
      )}

      {/* ===== OVERVIEW TAB ===== */}
      {activeTab === 'overview' && <>

      {/* KPI Cards - Current Week */}
      <div style={LAYOUT.section}>
        <div style={LAYOUT.sectionTitle}>
          {selectedWeek} Overview
        </div>
        <div style={LAYOUT.grid4}>
          <KPICard
            label="Completeness (Critical)"
            value={current.critical.completeness}
            prevValue={prev?.critical?.completeness}
            color="var(--accent-blue)"
            barPercent={current.critical.completeness}
            delay={0}
          />
          <KPICard
            label="Timeliness (Critical)"
            value={current.critical.timeliness}
            prevValue={prev?.critical?.timeliness}
            color="var(--accent-cyan)"
            barPercent={current.critical.timeliness}
            delay={0.05}
          />
          <KPICard
            label="Completeness (All)"
            value={current.all.completeness}
            prevValue={prev?.all?.completeness}
            color="var(--accent-purple)"
            barPercent={current.all.completeness}
            delay={0.1}
          />
          <KPICard
            label="Timeliness (All)"
            value={current.all.timeliness}
            prevValue={prev?.all?.timeliness}
            color="var(--accent-green)"
            barPercent={current.all.timeliness}
            delay={0.15}
          />
        </div>
      </div>

      {/* Secondary KPIs */}
      <div style={LAYOUT.section}>
        <div style={LAYOUT.grid4}>
          <KPICard
            label="ETA 2P (±48h Port)"
            value={current.eta_2p}
            prevValue={prev?.eta_2p}
            color="var(--accent-amber)"
            barPercent={current.eta_2p}
            delay={0.2}
          />
          <KPICard
            label="ETA 2D (±48h Delivery)"
            value={current.eta_2d}
            prevValue={prev?.eta_2d}
            color="#db2777"
            barPercent={current.eta_2d}
            delay={0.25}
          />
          <KPICard
            label="Reference Completeness"
            value={current.ref_comp}
            prevValue={prev?.ref_comp}
            color="#ea580c"
            barPercent={current.ref_comp}
            delay={0.3}
          />
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            animation: 'fadeInUp 0.4s ease-out 0.35s both',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.7rem',
              fontWeight: 500,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 10,
            }}>
              Volume
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                  {current.all.required.toLocaleString()}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>Required</div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: 'var(--accent-blue)', fontWeight: 500 }}>
                  {current.all.available.toLocaleString()}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>Available</div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: 'var(--accent-green)', fontWeight: 500 }}>
                  {current.all.in_time.toLocaleString()}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>In Time</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SC3 vs SC4 KPI Cards */}
      <div style={LAYOUT.section}>
        <div style={LAYOUT.sectionTitle}>SC3 vs SC4 — {selectedWeek}</div>
        <div style={LAYOUT.grid4}>
          <KPICard
            label="SC3 Completeness"
            value={current.sc3_total.completeness}
            prevValue={prev?.sc3_total?.completeness}
            color="var(--accent-cyan)"
            barPercent={current.sc3_total.completeness}
            delay={0}
          />
          <KPICard
            label="SC3 Timeliness"
            value={current.sc3_total.timeliness}
            prevValue={prev?.sc3_total?.timeliness}
            color="#06b6d4"
            barPercent={current.sc3_total.timeliness}
            delay={0.05}
          />
          <KPICard
            label="SC4 Completeness"
            value={current.sc4_total.completeness}
            prevValue={prev?.sc4_total?.completeness}
            color="var(--accent-blue)"
            barPercent={current.sc4_total.completeness}
            delay={0.1}
          />
          <KPICard
            label="SC4 Timeliness"
            value={current.sc4_total.timeliness}
            prevValue={prev?.sc4_total?.timeliness}
            color="#3b82f6"
            barPercent={current.sc4_total.timeliness}
            delay={0.15}
          />
        </div>
      </div>

      {/* Main Trend Charts */}
      <div style={LAYOUT.section}>
        <div style={LAYOUT.sectionTitle}>Trends</div>
        <div style={LAYOUT.grid2}>
          <TrendChart
            data={mainTrend}
            title="Completeness Trend"
            lines={[
              { key: 'Completeness (Critical)', name: 'Critical', color: '#2563eb' },
              { key: 'Completeness (All)', name: 'All', color: '#7c3aed' },
            ]}
            target={90}
          />
          <TrendChart
            data={mainTrend}
            title="Timeliness Trend"
            lines={[
              { key: 'Timeliness (Critical)', name: 'Critical', color: '#0891b2' },
              { key: 'Timeliness (All)', name: 'All', color: '#16a34a' },
            ]}
            target={70}
          />
        </div>
      </div>

      {/* SC3 vs SC4 Trends */}
      <div style={LAYOUT.section}>
        <div style={LAYOUT.sectionTitle}>SC3 vs SC4 Trends</div>
        <div style={LAYOUT.grid2}>
          <TrendChart
            data={sc3vs4Trend}
            title="SC3 vs SC4 Completeness"
            lines={[
              { key: 'SC3', name: 'SC3', color: '#0891b2' },
              { key: 'SC4', name: 'SC4', color: '#2563eb' },
            ]}
            target={90}
          />
          <TrendChart
            data={sc3vs4TimeTrend}
            title="SC3 vs SC4 Timeliness"
            lines={[
              { key: 'SC3', name: 'SC3', color: '#0891b2' },
              { key: 'SC4', name: 'SC4', color: '#2563eb' },
            ]}
            target={70}
          />
        </div>
      </div>

      {/* ETA & Plausibility Trends */}
      <div style={LAYOUT.section}>
        <div style={LAYOUT.sectionTitle}>ETA & Plausibility Trends</div>
        <div style={LAYOUT.grid2}>
          <TrendChart
            data={etaTrend}
            title="ETA Accuracy & Reference"
            lines={[
              { key: 'ETA 2P (Port)', name: 'ETA 2P', color: '#d97706' },
              { key: 'ETA 2D (Delivery)', name: 'ETA 2D', color: '#db2777' },
              { key: 'Reference', name: 'Ref Comp', color: '#ea580c' },
            ]}
            target={75}
          />
          {plausibilityTrend.length > 0 && (
            <TrendChart
              data={plausibilityTrend}
              title="Plausibility Violations"
              lines={[
                { key: 'Violations', name: 'Total Violations', color: '#dc2626' },
                { key: 'Affected HBLs', name: 'Affected HBLs', color: '#d97706' },
                { key: 'Critical', name: 'Critical', color: '#9333ea' },
              ]}
              isCount
            />
          )}
        </div>
      </div>

      {/* Service Breakdown - Selected Week */}
      <div style={LAYOUT.section}>
        <div style={LAYOUT.sectionTitle}>
          {selectedWeek} — Service Type Breakdown
        </div>
        <div style={LAYOUT.grid2}>
          <ServiceBreakdown weekData={current} scenario="SC3" metric="completeness" />
          <ServiceBreakdown weekData={current} scenario="SC4" metric="completeness" />
        </div>
      </div>

      {/* Service Trend Charts */}
      <div style={LAYOUT.section}>
        <div style={LAYOUT.sectionTitle}>Service Type Trends</div>
        <div style={LAYOUT.grid2}>
          <ServiceTrendChart data={data} scenario="SC3" metric="completeness" />
          <ServiceTrendChart data={data} scenario="SC4" metric="completeness" />
        </div>
      </div>

      {/* Full Data Table */}
      <div style={LAYOUT.section}>
        <div style={LAYOUT.sectionTitle}>Full KPI Matrix</div>
        <DataTable data={data} />
      </div>

      </>}

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        padding: '24px 0',
        fontFamily: 'var(--font-display)',
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border)',
      }}>
        Bosch Milestone Analysis — Generated from raw SC3/SC4 data
        <span style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
        Completeness = Available / Required — Timeliness = InTime / Required
      </div>
    </div>
  );
}
