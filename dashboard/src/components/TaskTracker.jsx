import { useState, useMemo } from 'react';

const PRIORITY_CONFIG = {
  P0: { label: 'P0', color: '#dc2626', bg: '#dc262612' },
  P1: { label: 'P1', color: '#d97706', bg: '#d9770612' },
  P2: { label: 'P2', color: '#2563eb', bg: '#2563eb12' },
};

const STATUS_CONFIG = {
  todo: { label: 'To Do', color: '#64748b', bg: '#64748b15', icon: '\u25CB' },
  'in-progress': { label: 'In Progress', color: '#d97706', bg: '#d9770615', icon: '\u25D4' },
  done: { label: 'Done', color: '#16a34a', bg: '#16a34a15', icon: '\u2713' },
  blocked: { label: 'Blocked', color: '#dc2626', bg: '#dc262615', icon: '\u2716' },
};

const S = {
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '24px 28px',
    boxShadow: 'var(--shadow-sm)',
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
};

function SummaryCards({ tasks }) {
  const total = tasks.length;
  const todo = tasks.filter(t => t.status === 'todo').length;
  const inProg = tasks.filter(t => t.status === 'in-progress').length;
  const done = tasks.filter(t => t.status === 'done').length;
  const blocked = tasks.filter(t => t.status === 'blocked').length;
  const p0Open = tasks.filter(t => t.priority === 'P0' && t.status !== 'done').length;

  const overdue = tasks.filter(t => {
    if (t.status === 'done') return false;
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < new Date();
  }).length;

  const completionPct = total > 0 ? (done / total * 100).toFixed(0) : 0;

  const cards = [
    { label: 'Total Tasks', value: total, color: 'var(--text-primary)' },
    { label: 'To Do', value: todo, color: '#64748b' },
    { label: 'In Progress', value: inProg, color: '#d97706' },
    { label: 'Done', value: done, color: '#16a34a', sub: `${completionPct}% complete` },
    { label: 'P0 Open', value: p0Open, color: '#dc2626' },
    { label: 'Overdue', value: overdue, color: overdue > 0 ? '#dc2626' : '#16a34a' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
      {cards.map((c, i) => (
        <div key={i} style={{
          ...S.card,
          padding: '16px 20px',
          animation: `fadeInUp 0.3s ease-out ${i * 0.05}s both`,
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            {c.label}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: c.color }}>
            {c.value}
          </div>
          {c.sub && <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2 }}>{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function TaskCard({ task, categories }) {
  const prio = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.P1;
  const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
  const cat = categories.find(c => c.id === task.category);

  const isOverdue = task.status !== 'done' && task.dueDate && new Date(task.dueDate) < new Date();
  const daysLeft = task.dueDate ? Math.ceil((new Date(task.dueDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${task.status === 'done' ? '#16a34a30' : isOverdue ? '#dc262630' : 'var(--border)'}`,
      borderLeft: `4px solid ${prio.color}`,
      borderRadius: 8,
      padding: '14px 18px',
      opacity: task.status === 'done' ? 0.7 : 1,
      transition: 'all 0.15s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            fontWeight: 700,
            color: prio.color,
            background: prio.bg,
            padding: '2px 7px',
            borderRadius: 3,
          }}>{prio.label}</span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            fontWeight: 600,
            color: status.color,
            background: status.bg,
            padding: '2px 7px',
            borderRadius: 3,
          }}>{status.icon} {status.label}</span>
          {cat && (
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.6rem',
              fontWeight: 500,
              color: cat.color,
              background: `${cat.color}12`,
              padding: '2px 7px',
              borderRadius: 3,
            }}>{cat.name}</span>
          )}
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6rem',
          color: 'var(--text-muted)',
          whiteSpace: 'nowrap',
        }}>{task.id}</span>
      </div>

      {/* Title */}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.8rem',
        fontWeight: 600,
        color: task.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)',
        textDecoration: task.status === 'done' ? 'line-through' : 'none',
        marginBottom: 6,
        lineHeight: 1.4,
      }}>
        {task.title}
      </div>

      {/* Description */}
      {task.description && (
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          lineHeight: 1.5,
          marginBottom: 8,
        }}>
          {task.description}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {task.kpiImpact && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: '#2563eb',
              background: '#2563eb10',
              padding: '2px 6px',
              borderRadius: 3,
            }}>{task.kpiImpact}</span>
          )}
          {task.owner && (
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.6rem',
              color: 'var(--text-muted)',
            }}>Owner: {task.owner}</span>
          )}
        </div>
        {task.dueDate && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            fontWeight: 600,
            color: task.status === 'done' ? '#16a34a' : isOverdue ? '#dc2626' : daysLeft <= 7 ? '#d97706' : 'var(--text-muted)',
          }}>
            {task.status === 'done'
              ? `Done ${task.completedDate || ''}`
              : isOverdue
                ? `Overdue (${task.dueDate})`
                : `Due ${task.dueDate} (${daysLeft}d)`
            }
          </span>
        )}
      </div>
    </div>
  );
}

function KanbanBoard({ tasks, categories }) {
  const columns = ['todo', 'in-progress', 'done'];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: 16 }}>
      {columns.map(col => {
        const cfg = STATUS_CONFIG[col];
        const colTasks = tasks.filter(t => t.status === col);
        return (
          <div key={col}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              padding: '8px 12px',
              background: cfg.bg,
              borderRadius: 6,
            }}>
              <span style={{ fontSize: '0.85rem' }}>{cfg.icon}</span>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: cfg.color,
              }}>{cfg.label}</span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
                color: cfg.color,
                marginLeft: 'auto',
                fontWeight: 700,
              }}>{colTasks.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {colTasks
                .sort((a, b) => {
                  const po = { P0: 0, P1: 1, P2: 2 };
                  return (po[a.priority] || 9) - (po[b.priority] || 9);
                })
                .map(t => <TaskCard key={t.id} task={t} categories={categories} />)
              }
              {colTasks.length === 0 && (
                <div style={{
                  padding: 20,
                  textAlign: 'center',
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  border: '1px dashed var(--border)',
                  borderRadius: 8,
                }}>No tasks</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({ tasks, categories }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {tasks.map(t => <TaskCard key={t.id} task={t} categories={categories} />)}
      {tasks.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', fontFamily: 'var(--font-display)', color: 'var(--text-muted)' }}>
          No tasks match filters
        </div>
      )}
    </div>
  );
}

function TimelineView({ tasks, categories }) {
  const grouped = useMemo(() => {
    const groups = {};
    tasks.forEach(t => {
      const key = t.dueDate || 'No date';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'No date') return 1;
      if (b === 'No date') return -1;
      return a.localeCompare(b);
    });
  }, [tasks]);

  return (
    <div style={{ position: 'relative', paddingLeft: 24 }}>
      <div style={{
        position: 'absolute',
        left: 8,
        top: 0,
        bottom: 0,
        width: 2,
        background: 'var(--border)',
      }} />
      {grouped.map(([date, dateTasks]) => {
        const isPast = date !== 'No date' && new Date(date) < new Date();
        return (
          <div key={date} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: -20,
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: isPast ? '#dc2626' : '#2563eb',
                border: '2px solid var(--bg-card)',
              }} />
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: isPast ? '#dc2626' : 'var(--text-primary)',
              }}>
                {date}
              </span>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.6rem',
                color: 'var(--text-muted)',
              }}>
                {dateTasks.length} task{dateTasks.length > 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dateTasks.map(t => <TaskCard key={t.id} task={t} categories={categories} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TaskTracker({ taskData }) {
  const [view, setView] = useState('kanban');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  if (!taskData) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-display)', color: 'var(--text-muted)' }}>
        Loading tasks...
      </div>
    );
  }

  const { tasks, categories } = taskData;

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (filterCategory !== 'all' && t.category !== filterCategory) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
      }
      return true;
    });
  }, [tasks, filterPriority, filterCategory, searchTerm]);

  const viewButtons = [
    { key: 'kanban', label: 'Board' },
    { key: 'list', label: 'List' },
    { key: 'timeline', label: 'Timeline' },
  ];

  const filterBtn = (active, onClick, label) => (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.7rem',
        fontWeight: active ? 600 : 400,
        color: active ? 'var(--accent-blue)' : 'var(--text-muted)',
        background: active ? '#2563eb10' : 'transparent',
        border: `1px solid ${active ? '#2563eb40' : 'var(--border)'}`,
        borderRadius: 5,
        padding: '4px 12px',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >{label}</button>
  );

  return (
    <div>
      <SummaryCards tasks={tasks} />

      {/* Controls bar */}
      <div style={{
        ...S.card,
        padding: '14px 20px',
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        {/* View toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          {viewButtons.map(v => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.7rem',
                fontWeight: view === v.key ? 600 : 400,
                color: view === v.key ? '#fff' : 'var(--text-muted)',
                background: view === v.key ? '#2563eb' : 'transparent',
                border: `1px solid ${view === v.key ? '#2563eb' : 'var(--border)'}`,
                borderRadius: 5,
                padding: '5px 14px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >{v.label}</button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', color: 'var(--text-muted)', marginRight: 4 }}>Priority:</span>
          {filterBtn(filterPriority === 'all', () => setFilterPriority('all'), 'All')}
          {filterBtn(filterPriority === 'P0', () => setFilterPriority('P0'), 'P0')}
          {filterBtn(filterPriority === 'P1', () => setFilterPriority('P1'), 'P1')}
          {filterBtn(filterPriority === 'P2', () => setFilterPriority('P2'), 'P2')}

          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 8, marginRight: 4 }}>Category:</span>
          {filterBtn(filterCategory === 'all', () => setFilterCategory('all'), 'All')}
          {categories.map(c => <span key={c.id}>{filterBtn(filterCategory === c.id, () => setFilterCategory(c.id), c.name)}</span>)}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search tasks..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.75rem',
            padding: '6px 12px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            outline: 'none',
            width: 180,
          }}
        />
      </div>

      {/* Filtered count */}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        marginBottom: 14,
        paddingLeft: 2,
      }}>
        Showing {filtered.length} of {tasks.length} tasks
      </div>

      {/* View */}
      {view === 'kanban' && <KanbanBoard tasks={filtered} categories={categories} />}
      {view === 'list' && <ListView tasks={filtered} categories={categories} />}
      {view === 'timeline' && <TimelineView tasks={filtered} categories={categories} />}
    </div>
  );
}