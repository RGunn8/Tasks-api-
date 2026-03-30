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

// Date handling: treat date-only inputs as UTC date boundaries so the UI doesn't shift days by timezone.
function parseYmd(date: string): { y: number; m: number; d: number } | null {
  if (!date) return null;
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(date);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function dateToUtcStartIso(date: string): string | undefined {
  const p = parseYmd(date);
  if (!p) return undefined;
  return new Date(Date.UTC(p.y, p.m - 1, p.d, 0, 0, 0, 0)).toISOString();
}

function dateToUtcEndIso(date: string): string | undefined {
  const p = parseYmd(date);
  if (!p) return undefined;
  return new Date(Date.UTC(p.y, p.m - 1, p.d, 23, 59, 59, 999)).toISOString();
}

// For storing a due date chosen as date-only, set it to noon UTC to avoid DST edges.
function dateToUtcNoonIso(date: string): string | null {
  const p = parseYmd(date);
  if (!p) return null;
  return new Date(Date.UTC(p.y, p.m - 1, p.d, 12, 0, 0, 0)).toISOString();
}

function isoToDateUtc(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
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
        style={{ width: 'min(760px, 94vw)', maxHeight: '90vh', overflow: 'auto' }}
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

function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div style={{ marginTop: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 44,
            borderRadius: 10,
            border: '1px solid #e5e7eb',
            background: 'linear-gradient(90deg, #f3f4f6, #ffffff, #f3f4f6)',
            backgroundSize: '200% 100%',
            marginBottom: 10,
          }}
        />
      ))}
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

  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  // Filters
  // '' = all, '__unlisted__' = no list, otherwise projectId
  const [listFilter, setListFilter] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Pagination
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);

  // New task modal
  const [newOpen, setNewOpen] = useState(false);
  const [newProjectId, setNewProjectId] = useState<string>(''); // '' means no list
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStatus, setNewStatus] = useState<TaskStatus>('TODO');
  const [newPriority, setNewPriority] = useState<TaskPriority | ''>('');
  const [newDueDate, setNewDueDate] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Create list modal
  const [listOpen, setListOpen] = useState(false);
  const [listName, setListName] = useState('');
  const [listDesc, setListDesc] = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false);

  // Row actions
  const [openMenuTaskId, setOpenMenuTaskId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDue, setEditDue] = useState('');
  const [editStatus, setEditStatus] = useState<TaskStatus>('TODO');
  const [editPriority, setEditPriority] = useState<TaskPriority | ''>('');
  const [editProjectId, setEditProjectId] = useState<string>(''); // '' = no list

  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);

  const tasks = taskPage?.content ?? [];

  const projectNameById = useMemo(() => {
    const m = new Map<string, string>();
    projects.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [projects]);

  async function loadProjects() {
    setIsLoadingProjects(true);
    try {
      const res = await api.listProjects(accessToken);
      setProjects(res);
    } catch (e) {
      toast('error', formatErr(e));
    } finally {
      setIsLoadingProjects(false);
    }
  }

  async function loadTasks(newPage?: number) {
    setIsLoadingTasks(true);
    try {
      const p = newPage ?? page;
      const dueAfter = dateToUtcStartIso(fromDate);
      const dueBefore = dateToUtcEndIso(toDate);

      const projectId = listFilter && listFilter !== '__unlisted__' ? listFilter : undefined;
      const unlisted = listFilter === '__unlisted__' ? true : undefined;

      const res = await api.listAllTasks(accessToken, {
        projectId,
        unlisted,
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
    } finally {
      setIsLoadingTasks(false);
    }
  }

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadTasks(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listFilter, status, fromDate, toDate, size]);

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
    setSavingTaskId(taskId);
    try {
      await api.updateTaskById(accessToken, taskId, patch);
      await loadTasks();
    } catch (e) {
      toast('error', formatErr(e));
    } finally {
      setSavingTaskId(null);
    }
  }

  async function handleDelete(taskId: string) {
    if (!confirm('Delete this task?')) return;
    setSavingTaskId(taskId);
    try {
      await api.deleteTaskById(accessToken, taskId);
      toast('success', 'Task deleted.');
      await loadTasks();
    } catch (e) {
      toast('error', formatErr(e));
    } finally {
      setSavingTaskId(null);
    }
  }

  function openEdit(t: Task) {
    setEditTask(t);
    setEditTitle(t.title);
    setEditDesc(t.description ?? '');
    setEditDue(t.dueAt ? isoToDateUtc(t.dueAt) : '');
    setEditStatus(t.status);
    setEditPriority(t.priority ?? '');
    setEditProjectId(t.projectId ?? '');
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!editTask) return;
    setSavingTaskId(editTask.id);
    try {
      await api.updateTaskById(accessToken, editTask.id, {
        title: editTitle.trim() || null,
        description: editDesc.trim() ? editDesc.trim() : null,
        status: editStatus,
        priority: (editPriority || null) as TaskPriority | null,
        dueAt: editDue ? dateToUtcNoonIso(editDue) : null,
        ...(editProjectId ? { projectId: editProjectId, unlist: false } : { unlist: true }),
        completedAt: editStatus === 'DONE' ? nowIso() : null,
      });
      toast('success', 'Task updated.');
      setEditOpen(false);
      setEditTask(null);
      await loadTasks();
    } catch (e) {
      toast('error', formatErr(e));
    } finally {
      setSavingTaskId(null);
    }
  }

  async function handleCreateTask() {
    if (!newTitle.trim()) {
      toast('error', 'Enter a title.');
      return;
    }

    setIsCreatingTask(true);
    try {
      await api.createTaskGlobal(accessToken, {
        title: newTitle.trim(),
        description: newDesc.trim() ? newDesc.trim() : null,
        status: newStatus,
        priority: (newPriority || null) as TaskPriority | null,
        dueAt: newDueDate ? dateToUtcNoonIso(newDueDate) : null,
        ...(newProjectId ? { projectId: newProjectId } : {}),
      });

      toast('success', 'Task created.');
      setNewOpen(false);
      setNewTitle('');
      setNewDesc('');
      setNewStatus('TODO');
      setNewPriority('');
      setNewDueDate('');
      setNewProjectId('');
      await loadTasks(0);
    } catch (e) {
      toast('error', formatErr(e));
    } finally {
      setIsCreatingTask(false);
    }
  }

  async function handleCreateList() {
    if (!listName.trim()) {
      toast('error', 'Enter a list name.');
      return;
    }
    setIsCreatingList(true);
    try {
      const res = await api.createProject(accessToken, listName.trim(), listDesc.trim());
      toast('success', 'List created.');
      setListOpen(false);
      setListName('');
      setListDesc('');
      await loadProjects();
      // default the New Task modal list to the newly created list
      setNewProjectId(res.id);
    } catch (e) {
      toast('error', formatErr(e));
    } finally {
      setIsCreatingList(false);
    }
  }

  const empty = !isLoadingTasks && taskPage && taskPage.totalElements === 0;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Quick Task</h1>
          <div style={{ opacity: 0.8 }}>All tasks ordered by due date (soonest first). Tasks can be unlisted.</div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'end' }}>
          <button style={{ width: 'auto' }} onClick={() => setNewOpen(true)}>
            + New task
          </button>
          <button style={{ width: 'auto' }} onClick={() => setListOpen(true)}>
            + New list
          </button>
          <button style={{ width: 'auto' }} onClick={() => loadTasks(page)} disabled={isLoadingTasks}>
            Reload
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
            <select value={listFilter} onChange={(e) => setListFilter(e.target.value)} disabled={isLoadingProjects}>
              <option value="">All lists</option>
              <option value="__unlisted__">No list</option>
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'end' }}>
            <span style={{ opacity: 0.75 }}>
              {isLoadingTasks
                ? 'Loading…'
                : taskPage
                  ? `Page ${taskPage.number + 1} / ${taskPage.totalPages} — total ${taskPage.totalElements}`
                  : '—'}
            </span>
            <select value={String(size)} onChange={(e) => setSize(Number(e.target.value) || 15)} style={{ width: 'auto' }}>
              {[10, 15, 25, 50].map((n) => (
                <option key={n} value={String(n)}>
                  {n}/page
                </option>
              ))}
            </select>
            <button style={{ width: 'auto' }} onClick={() => loadTasks(Math.max(0, page - 1))} disabled={isLoadingTasks || page <= 0}>
              Prev
            </button>
            <button
              style={{ width: 'auto' }}
              onClick={() => loadTasks(page + 1)}
              disabled={isLoadingTasks || (taskPage ? page + 1 >= taskPage.totalPages : true)}
            >
              Next
            </button>
          </div>
        </div>

        {isLoadingTasks ? (
          <SkeletonRows />
        ) : empty ? (
          <div style={{ padding: 18, opacity: 0.8 }}>
            <h3 style={{ marginTop: 0 }}>No tasks yet</h3>
            <p style={{ marginBottom: 0 }}>Click “New task” to add your first task.</p>
          </div>
        ) : (
          <div style={{ overflow: 'auto', marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '10px 8px' }}>Due</th>
                  <th style={{ padding: '10px 8px' }}>Title</th>
                  <th style={{ padding: '10px 8px' }}>List</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px' }}>Priority</th>
                  <th style={{ padding: '10px 8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const saving = savingTaskId === t.id;
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                        {t.dueAt ? <Badge>{isoToDateUtc(t.dueAt)}</Badge> : <span style={{ opacity: 0.6 }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{t.title}</div>
                            {t.description ? <div style={{ opacity: 0.8, marginTop: 2 }}>{t.description}</div> : null}
                          </div>
                          {saving ? <span style={{ opacity: 0.7, fontSize: 12 }}>Saving…</span> : null}
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <select
                          value={t.projectId ?? ''}
                          disabled={saving}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) {
                              handleInlineUpdate(t.id, { unlist: true });
                            } else {
                              handleInlineUpdate(t.id, { projectId: v, unlist: false });
                            }
                          }}
                        >
                          <option value="">(no list)</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <div style={{ opacity: 0.6, fontSize: 12, marginTop: 4 }}>
                          {t.projectId ? projectNameById.get(t.projectId) ?? t.projectId.slice(0, 8) : 'Unlisted'}
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <select
                          value={t.status}
                          disabled={saving}
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
                          disabled={saving}
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
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            style={{ width: 'auto' }}
                            onClick={() => setOpenMenuTaskId((cur) => (cur === t.id ? null : t.id))}
                            disabled={saving}
                          >
                            ⋯
                          </button>
                          {openMenuTaskId === t.id ? (
                            <div
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: '110%',
                                background: '#fff',
                                border: '1px solid #e5e7eb',
                                borderRadius: 10,
                                padding: 8,
                                minWidth: 160,
                                zIndex: 9999,
                              }}
                            >
                              <button
                                style={{ width: '100%', textAlign: 'left' }}
                                onClick={() => {
                                  setOpenMenuTaskId(null);
                                  openEdit(t);
                                }}
                              >
                                Edit…
                              </button>
                              <button
                                style={{ width: '100%', textAlign: 'left', marginTop: 6 }}
                                onClick={() => {
                                  setOpenMenuTaskId(null);
                                  handleDelete(t.id);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={newOpen} title="New task" onClose={() => setNewOpen(false)}>
        <div className="grid2">
          <div>
            <label style={{ display: 'block', opacity: 0.8, marginBottom: 4 }}>List (optional)</label>
            <select value={newProjectId} onChange={(e) => setNewProjectId(e.target.value)} disabled={isLoadingProjects}>
              <option value="">(no list)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', opacity: 0.8, marginBottom: 4 }}>Due date (optional)</label>
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
          <button style={{ width: 'auto' }} onClick={() => setNewOpen(false)} disabled={isCreatingTask}>
            Cancel
          </button>
          <button style={{ width: 'auto' }} onClick={handleCreateTask} disabled={isCreatingTask}>
            {isCreatingTask ? 'Creating…' : 'Create'}
          </button>
        </div>
      </Modal>

      <Modal open={listOpen} title="New list" onClose={() => setListOpen(false)}>
        <label style={{ display: 'block', opacity: 0.8, marginBottom: 4 }}>Name</label>
        <input placeholder="e.g. Work" value={listName} onChange={(e) => setListName(e.target.value)} />

        <label style={{ display: 'block', opacity: 0.8, marginTop: 10, marginBottom: 4 }}>Description</label>
        <input placeholder="Optional" value={listDesc} onChange={(e) => setListDesc(e.target.value)} />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'end', marginTop: 14 }}>
          <button style={{ width: 'auto' }} onClick={() => setListOpen(false)} disabled={isCreatingList}>
            Cancel
          </button>
          <button style={{ width: 'auto' }} onClick={handleCreateList} disabled={isCreatingList}>
            {isCreatingList ? 'Creating…' : 'Create'}
          </button>
        </div>
      </Modal>

      <Modal open={editOpen} title="Edit task" onClose={() => setEditOpen(false)}>
        <div className="grid2">
          <div>
            <label style={{ display: 'block', opacity: 0.8, marginBottom: 4 }}>List</label>
            <select value={editProjectId} onChange={(e) => setEditProjectId(e.target.value)} disabled={isLoadingProjects}>
              <option value="">(no list)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', opacity: 0.8, marginBottom: 4 }}>Due date</label>
            <input type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)} />
          </div>
        </div>

        <label style={{ display: 'block', opacity: 0.8, marginTop: 10, marginBottom: 4 }}>Title</label>
        <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />

        <label style={{ display: 'block', opacity: 0.8, marginTop: 10, marginBottom: 4 }}>Description</label>
        <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />

        <div className="grid2" style={{ marginTop: 10 }}>
          <div>
            <label style={{ display: 'block', opacity: 0.8, marginBottom: 4 }}>Status</label>
            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as TaskStatus)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', opacity: 0.8, marginBottom: 4 }}>Priority</label>
            <select value={editPriority} onChange={(e) => setEditPriority(e.target.value as TaskPriority | '')}>
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
          <button style={{ width: 'auto' }} onClick={() => setEditOpen(false)} disabled={savingTaskId != null}>
            Cancel
          </button>
          <button style={{ width: 'auto' }} onClick={handleSaveEdit} disabled={savingTaskId != null}>
            {savingTaskId ? 'Saving…' : 'Save'}
          </button>
        </div>
      </Modal>

      <footer style={{ opacity: 0.7, marginTop: 24 }}>
        Backend Swagger: <a href="/swagger-ui/index.html" target="_blank" rel="noreferrer">/swagger-ui</a>
        {' '}| Backend Demo: <a href="/demo/" target="_blank" rel="noreferrer">/demo/</a>
      </footer>
    </div>
  );
}
