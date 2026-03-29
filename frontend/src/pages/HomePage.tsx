import { useEffect, useMemo, useState } from 'react';
import { api, type ApiError, type Page, type Project, type Task, type TaskPriority, type TaskStatus } from '../api';

function formatErr(e: unknown) {
  const err = e as ApiError;
  if (err?.fields) return `${err.message}\n${JSON.stringify(err.fields, null, 2)}`;
  return err?.message ?? String(e);
}

function nowIso() {
  return new Date().toISOString();
}

function dateToStartIso(date: string): string | undefined {
  if (!date) return undefined;
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function dateToEndIso(date: string): string | undefined {
  if (!date) return undefined;
  const d = new Date(`${date}T23:59:59.999`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function isoToDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const STATUS_OPTIONS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELED'];
const PRIORITY_OPTIONS: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

function Badge({ children }: { children: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        border: '1px solid #333',
        fontSize: 12,
        opacity: 0.9,
      }}
    >
      {children}
    </span>
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9998,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: 'min(720px, 94vw)', maxHeight: '90vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button style={{ width: 'auto' }} onClick={onClose}>
            Close
          </button>
        </div>
        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}

export function HomePage({
  accessToken,
  refreshToken,
  onLogout,
  toast,
}: {
  accessToken: string;
  refreshToken: string;
  onLogout: () => void;
  toast: (kind: 'success' | 'error' | 'info', message: string) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskPage, setTaskPage] = useState<Page<Task> | null>(null);

  // Filters
  const [projectId, setProjectId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Pagination
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);

  // New task modal
  const [newOpen, setNewOpen] = useState(false);
  const [newProjectId, setNewProjectId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStatus, setNewStatus] = useState<TaskStatus>('TODO');
  const [newPriority, setNewPriority] = useState<TaskPriority | ''>('');
  const [newDueDate, setNewDueDate] = useState('');

  const projectNameById = useMemo(() => {
    const m = new Map<string, string>();
    projects.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [projects]);

  const tasks = taskPage?.content ?? [];

  async function loadProjects() {
    try {
      const res = await api.listProjects(accessToken);
      setProjects(res);
      if (!newProjectId && res.length) setNewProjectId(res[0].id);
    } catch (e) {
      toast('error', formatErr(e));
    }
  }

  async function loadTasks(newPage?: number) {
    try {
      const p = newPage ?? page;
      const dueAfter = dateToStartIso(fromDate);
      const dueBefore = dateToEndIso(toDate);

      const res = await api.listAllTasks(accessToken, {
        projectId: projectId || undefined,
        status: status || undefined,
        dueAfter,
        dueBefore,
        page: p,
        size,
        sort: 'dueAt,asc',
      });

      setTaskPage(res);
      setPage(p);
    } catch (e) {
      toast('error', formatErr(e));
    }
  }

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadTasks(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, status, fromDate, toDate, size]);

  async function handleRefresh() {
    try {
      const res = await api.refresh(refreshToken);
      localStorage.setItem('accessToken', res.accessToken);
      localStorage.setItem('refreshToken', res.refreshToken);
      toast('success', 'Token refreshed. Reload the page if needed.');
    } catch (e) {
      toast('error', formatErr(e));
    }
  }

  async function handleInlineUpdate(taskId: string, patch: any) {
    try {
      await api.updateTaskById(accessToken, taskId, patch);
      await loadTasks();
    } catch (e) {
      toast('error', formatErr(e));
    }
  }

  async function handleCreateTask() {
    if (!newProjectId || !newTitle.trim()) {
      toast('error', 'Pick a list and enter a title.');
      return;
    }

    try {
      const dueAt = dateToStartIso(newDueDate) ?? null;
      await api.createTask(accessToken, newProjectId, {
        title: newTitle.trim(),
        description: newDesc.trim() ? newDesc.trim() : null,
        status: newStatus,
        priority: (newPriority || null) as TaskPriority | null,
        dueAt,
      });
      toast('success', 'Task created.');
      setNewOpen(false);
      setNewTitle('');
      setNewDesc('');
      setNewStatus('TODO');
      setNewPriority('');
      setNewDueDate('');
      await loadTasks(0);
    } catch (e) {
      toast('error', formatErr(e));
    }
  }

  const empty = taskPage && taskPage.totalElements === 0;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Quick Task</h1>
          <div style={{ opacity: 0.8 }}>All tasks ordered by due date (soonest first).</div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button style={{ width: 'auto' }} onClick={() => setNewOpen(true)}>
            + New task
          </button>
          <button style={{ width: 'auto' }} onClick={handleRefresh}>
            Refresh token
          </button>
          <button style={{ width: 'auto' }} onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2 style={{ marginTop: 0 }}>Filters</h2>
        <div className="grid2">
          <div>
            <label style={{ display: 'block', opacity: 0.8, marginBottom: 4 }}>List</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">All lists</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', opacity: 0.8, marginBottom: 4 }}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', opacity: 0.8, marginBottom: 4 }}>Due from</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>

          <div>
            <label style={{ display: 'block', opacity: 0.8, marginBottom: 4 }}>Due to</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Tasks</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ opacity: 0.75 }}>
              {taskPage ? `Page ${taskPage.number + 1} / ${taskPage.totalPages} — total ${taskPage.totalElements}` : 'Loading…'}
            </span>
            <select value={String(size)} onChange={(e) => setSize(Number(e.target.value) || 15)} style={{ width: 'auto' }}>
              {[10, 15, 25, 50].map((n) => (
                <option key={n} value={String(n)}>
                  {n}/page
                </option>
              ))}
            </select>
            <button style={{ width: 'auto' }} onClick={() => loadTasks(Math.max(0, page - 1))} disabled={page <= 0}>
              Prev
            </button>
            <button
              style={{ width: 'auto' }}
              onClick={() => loadTasks(page + 1)}
              disabled={taskPage ? page + 1 >= taskPage.totalPages : true}
            >
              Next
            </button>
          </div>
        </div>

        {empty ? (
          <div style={{ padding: 18, opacity: 0.8 }}>
            <h3 style={{ marginTop: 0 }}>No tasks yet</h3>
            <p style={{ marginBottom: 0 }}>Click “New task” to add your first task.</p>
          </div>
        ) : (
          <div style={{ overflow: 'auto', marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #222' }}>
                  <th style={{ padding: '10px 8px' }}>Due</th>
                  <th style={{ padding: '10px 8px' }}>Title</th>
                  <th style={{ padding: '10px 8px' }}>List</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px' }}>Priority</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #151515' }}>
                    <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                      {t.dueAt ? <Badge>{isoToDate(t.dueAt)}</Badge> : <span style={{ opacity: 0.6 }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ fontWeight: 600 }}>{t.title}</div>
                      {t.description ? <div style={{ opacity: 0.8, marginTop: 2 }}>{t.description}</div> : null}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <select
                        value={t.projectId}
                        onChange={(e) => handleInlineUpdate(t.id, { projectId: e.target.value })}
                      >
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <div style={{ opacity: 0.6, fontSize: 12, marginTop: 4 }}>
                        {projectNameById.get(t.projectId) ?? t.projectId.slice(0, 8)}
                      </div>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <select
                        value={t.status}
                        onChange={(e) =>
                          handleInlineUpdate(t.id, {
                            status: e.target.value,
                            completedAt: e.target.value === 'DONE' ? nowIso() : null,
                          })
                        }
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <select
                        value={t.priority ?? ''}
                        onChange={(e) => handleInlineUpdate(t.id, { priority: e.target.value || null })}
                      >
                        <option value="">(none)</option>
                        {PRIORITY_OPTIONS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={newOpen} title="New task" onClose={() => setNewOpen(false)}>
        <div className="grid2">
          <div>
            <label style={{ display: 'block', opacity: 0.8, marginBottom: 4 }}>List</label>
            <select value={newProjectId} onChange={(e) => setNewProjectId(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', opacity: 0.8, marginBottom: 4 }}>Due date</label>
            <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
          </div>
        </div>

        <label style={{ display: 'block', opacity: 0.8, marginTop: 10, marginBottom: 4 }}>Title</label>
        <input placeholder="What do you need to do?" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />

        <label style={{ display: 'block', opacity: 0.8, marginTop: 10, marginBottom: 4 }}>Description</label>
        <input placeholder="Optional" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />

        <div className="grid2" style={{ marginTop: 10 }}>
          <div>
            <label style={{ display: 'block', opacity: 0.8, marginBottom: 4 }}>Status</label>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as TaskStatus)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', opacity: 0.8, marginBottom: 4 }}>Priority</label>
            <select value={newPriority} onChange={(e) => setNewPriority(e.target.value as TaskPriority | '')}>
              <option value="">(none)</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'end', marginTop: 14 }}>
          <button style={{ width: 'auto' }} onClick={() => setNewOpen(false)}>
            Cancel
          </button>
          <button style={{ width: 'auto' }} onClick={handleCreateTask}>
            Create
          </button>
        </div>
      </Modal>
    </div>
  );
}
