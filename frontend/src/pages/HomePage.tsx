import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className ?? ''}`}>{children}</div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-slate-600">{children}</label>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${props.className ?? ''}`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${props.className ?? ''}`}
    />
  );
}

function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'ghost' | 'danger';
    compact?: boolean;
  }
) {
  const v = props.variant ?? 'ghost';
  const compact = props.compact ?? false;

  const base = `inline-flex items-center justify-center rounded-xl border text-sm font-medium disabled:opacity-60 ${
    compact ? 'px-3 py-1.5' : 'px-4 py-2'
  }`;

  const cls =
    v === 'primary'
      ? 'border-indigo-200 bg-indigo-600 text-white hover:bg-indigo-700'
      : v === 'danger'
        ? 'border-red-200 bg-red-600 text-white hover:bg-red-700'
        : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50';

  return <button {...props} className={`${base} ${cls} ${props.className ?? ''}`} />;
}

function Badge({ children }: { children: string }) {
  return <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">{children}</span>;
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
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/55 backdrop-blur-[1px] p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <Button compact onClick={onClose} type="button" aria-label="Close">
              ✕
            </Button>
          </div>
          <div className="mt-4">{children}</div>
        </Card>
      </div>
    </div>,
    document.body
  );
}

function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="mt-4 space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-11 rounded-xl border border-slate-200 bg-slate-100" />
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
    // Ensure modals don't stack on top of each other.
    setNewOpen(false);
    setListOpen(false);

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
      setNewProjectId(res.id);
    } catch (e) {
      toast('error', formatErr(e));
    } finally {
      setIsCreatingList(false);
    }
  }

  const empty = !isLoadingTasks && taskPage && taskPage.totalElements === 0;

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Quick Task</h1>
            <p className="mt-1 text-sm text-slate-600">All tasks ordered by due date (soonest first). Tasks can be unlisted.</p>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              variant="primary"
              onClick={() => {
                setOpenMenuTaskId(null);
                setEditOpen(false);
                setListOpen(false);
                setNewOpen(true);
              }}
              type="button"
            >
              + New task
            </Button>
            <Button
              onClick={() => {
                setOpenMenuTaskId(null);
                setEditOpen(false);
                setNewOpen(false);
                setListOpen(true);
              }}
              type="button"
            >
              + New list
            </Button>
            <Button onClick={() => loadTasks(page)} disabled={isLoadingTasks} type="button">
              Reload
            </Button>
            <Button onClick={handleRefresh} type="button">
              Refresh token
            </Button>
            <Button onClick={onLogout} type="button">
              Logout
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <Card>
            <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <Label>List</Label>
                <Select value={listFilter} onChange={(e) => setListFilter(e.target.value)} disabled={isLoadingProjects}>
                  <option value="">All lists</option>
                  <option value="__unlisted__">No list</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">All</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Due from</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div>
                <Label>Due to</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Tasks</h2>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <span className="text-sm text-slate-600">
                  {isLoadingTasks
                    ? 'Loading…'
                    : taskPage
                      ? `Page ${taskPage.number + 1} / ${taskPage.totalPages} — total ${taskPage.totalElements}`
                      : '—'}
                </span>
                <Select value={String(size)} onChange={(e) => setSize(Number(e.target.value) || 15)} className="w-auto">
                  {[10, 15, 25, 50].map((n) => (
                    <option key={n} value={String(n)}>
                      {n}/page
                    </option>
                  ))}
                </Select>
                <Button compact onClick={() => loadTasks(Math.max(0, page - 1))} disabled={isLoadingTasks || page <= 0} type="button">
                  Prev
                </Button>
                <Button
                  compact
                  onClick={() => loadTasks(page + 1)}
                  disabled={isLoadingTasks || (taskPage ? page + 1 >= taskPage.totalPages : true)}
                  type="button"
                >
                  Next
                </Button>
              </div>
            </div>

            {isLoadingTasks ? (
              <SkeletonRows />
            ) : empty ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6">
                <h3 className="text-base font-semibold text-slate-900">No tasks yet</h3>
                <p className="mt-1 text-sm text-slate-600">Click “New task” to add your first task.</p>
              </div>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="mt-4 grid gap-3 md:hidden">
                  {tasks.map((t) => {
                    const saving = savingTaskId === t.id;
                    return (
                      <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {t.dueAt ? <Badge>{isoToDateUtc(t.dueAt)}</Badge> : <Badge>no due date</Badge>}
                              <span className="text-xs text-slate-500">{t.projectId ? (projectNameById.get(t.projectId) ?? 'List') : 'Unlisted'}</span>
                              {saving ? <span className="text-xs text-slate-500">Saving…</span> : null}
                            </div>
                            <div className="mt-2 truncate text-sm font-semibold text-slate-900">{t.title}</div>
                            {t.description ? <div className="mt-1 line-clamp-2 text-sm text-slate-600">{t.description}</div> : null}
                          </div>

                          <div className="relative">
                            <Button
                              compact
                              onClick={() => setOpenMenuTaskId((cur) => (cur === t.id ? null : t.id))}
                              disabled={saving}
                              type="button"
                            >
                              ⋯
                            </Button>
                            {openMenuTaskId === t.id ? (
                              <div className="absolute right-0 top-[110%] z-[9999] min-w-40 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                                <button
                                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-50"
                                  onClick={() => {
                                    setOpenMenuTaskId(null);
                                    openEdit(t);
                                  }}
                                  type="button"
                                >
                                  Edit…
                                </button>
                                <button
                                  className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    setOpenMenuTaskId(null);
                                    handleDelete(t.id);
                                  }}
                                  type="button"
                                >
                                  Delete
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-2">
                          <div>
                            <Label>List</Label>
                            <Select
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
                            </Select>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label>Status</Label>
                              <Select
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
                              </Select>
                            </div>
                            <div>
                              <Label>Priority</Label>
                              <Select
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
                              </Select>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop/tablet: table */}
                <div className="mt-4 hidden overflow-auto md:block">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead>
                      <tr className="text-left text-xs font-semibold text-slate-600">
                        <th className="border-b border-slate-200 px-3 py-2">Due</th>
                        <th className="border-b border-slate-200 px-3 py-2">Title</th>
                        <th className="border-b border-slate-200 px-3 py-2">List</th>
                        <th className="border-b border-slate-200 px-3 py-2">Status</th>
                        <th className="border-b border-slate-200 px-3 py-2">Priority</th>
                        <th className="border-b border-slate-200 px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((t) => {
                        const saving = savingTaskId === t.id;
                        return (
                          <tr key={t.id} className="align-top hover:bg-slate-50">
                            <td className="border-b border-slate-100 px-3 py-3 whitespace-nowrap">
                              {t.dueAt ? <Badge>{isoToDateUtc(t.dueAt)}</Badge> : <span className="text-sm text-slate-400">—</span>}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-sm font-semibold text-slate-900">{t.title}</div>
                                  {t.description ? <div className="mt-1 text-sm text-slate-600">{t.description}</div> : null}
                                </div>
                                {saving ? <span className="text-xs text-slate-500">Saving…</span> : null}
                              </div>
                            </td>
                            <td className="border-b border-slate-100 px-3 py-3">
                              <Select
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
                              </Select>
                              <div className="mt-1 text-xs text-slate-500">
                                {t.projectId ? projectNameById.get(t.projectId) ?? t.projectId.slice(0, 8) : 'Unlisted'}
                              </div>
                            </td>
                            <td className="border-b border-slate-100 px-3 py-3">
                              <Select
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
                              </Select>
                            </td>
                            <td className="border-b border-slate-100 px-3 py-3">
                              <Select
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
                              </Select>
                            </td>
                            <td className="border-b border-slate-100 px-3 py-3 text-right">
                              <div className="relative inline-block">
                                <Button
                                  compact
                                  onClick={() => setOpenMenuTaskId((cur) => (cur === t.id ? null : t.id))}
                                  disabled={saving}
                                  type="button"
                                >
                                  ⋯
                                </Button>
                                {openMenuTaskId === t.id ? (
                                  <div className="absolute right-0 top-[110%] z-[9999] min-w-40 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                                    <button
                                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-50"
                                      onClick={() => {
                                        setOpenMenuTaskId(null);
                                        openEdit(t);
                                      }}
                                      type="button"
                                    >
                                      Edit…
                                    </button>
                                    <button
                                      className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                                      onClick={() => {
                                        setOpenMenuTaskId(null);
                                        handleDelete(t.id);
                                      }}
                                      type="button"
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
              </>
            )}
          </Card>
        </div>

        <Modal open={newOpen} title="New task" onClose={() => setNewOpen(false)}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>List (optional)</Label>
              <Select value={newProjectId} onChange={(e) => setNewProjectId(e.target.value)} disabled={isLoadingProjects}>
                <option value="">(no list)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Due date (optional)</Label>
              <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
            </div>
          </div>

          <div className="mt-3">
            <Label>Title</Label>
            <Input placeholder="What do you need to do?" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          </div>

          <div className="mt-3">
            <Label>Description</Label>
            <Input placeholder="Optional" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>Status</Label>
              <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value as TaskStatus)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={newPriority} onChange={(e) => setNewPriority(e.target.value as TaskPriority | '')}>
                <option value="">(none)</option>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setNewOpen(false)} disabled={isCreatingTask} type="button">
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateTask} disabled={isCreatingTask} type="button">
              {isCreatingTask ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </Modal>

        <Modal open={listOpen} title="New list" onClose={() => setListOpen(false)}>
          <div>
            <Label>Name</Label>
            <Input placeholder="e.g. Work" value={listName} onChange={(e) => setListName(e.target.value)} />
          </div>
          <div className="mt-3">
            <Label>Description</Label>
            <Input placeholder="Optional" value={listDesc} onChange={(e) => setListDesc(e.target.value)} />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setListOpen(false)} disabled={isCreatingList} type="button">
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateList} disabled={isCreatingList} type="button">
              {isCreatingList ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </Modal>

        <Modal open={editOpen} title="Edit task" onClose={() => setEditOpen(false)}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>List</Label>
              <Select value={editProjectId} onChange={(e) => setEditProjectId(e.target.value)} disabled={isLoadingProjects}>
                <option value="">(no list)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Due date</Label>
              <Input type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)} />
            </div>
          </div>

          <div className="mt-3">
            <Label>Title</Label>
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          </div>

          <div className="mt-3">
            <Label>Description</Label>
            <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>Status</Label>
              <Select value={editStatus} onChange={(e) => setEditStatus(e.target.value as TaskStatus)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={editPriority} onChange={(e) => setEditPriority(e.target.value as TaskPriority | '')}>
                <option value="">(none)</option>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setEditOpen(false)} disabled={savingTaskId != null} type="button">
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveEdit} disabled={savingTaskId != null} type="button">
              {savingTaskId ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </Modal>

        <footer className="mt-8 text-sm text-slate-600">
          Backend Swagger: <a href="/swagger-ui/index.html" target="_blank" rel="noreferrer">/swagger-ui</a>
          {' '}| Backend Demo: <a href="/demo/" target="_blank" rel="noreferrer">/demo/</a>
        </footer>
      </div>
    </div>
  );
}
