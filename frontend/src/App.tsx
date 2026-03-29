import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { api, type ApiError, type Page, type Project, type Task, type TaskPriority, type TaskStatus } from './api';
import { Toast, useToast } from './toast';

function formatErr(e: unknown) {
  const err = e as ApiError;
  if (err?.fields) return `${err.message}\n${JSON.stringify(err.fields, null, 2)}`;
  return err?.message ?? String(e);
}

function nowIso() {
  return new Date().toISOString();
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  // Convert ISO -> YYYY-MM-DDTHH:mm (local)
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(localValue: string): string | null {
  if (!localValue.trim()) return null;
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const STATUS_OPTIONS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELED'];
const PRIORITY_OPTIONS: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function App() {
  const [out, setOut] = useState<string>('Ready.');
  const [showDebug, setShowDebug] = useState(false);
  const { toast, setToast } = useToast();

  // Auth
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [accessToken, setAccessToken] = useState<string>(() => localStorage.getItem('accessToken') ?? '');
  const [refreshToken, setRefreshToken] = useState<string>(() => localStorage.getItem('refreshToken') ?? '');

  // Projects
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');

  // Tasks
  const [taskPage, setTaskPage] = useState<Page<Task> | null>(null);
  const tasks = taskPage?.content ?? [];

  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');

  // Edit task
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState<TaskStatus>('TODO');
  const [editPriority, setEditPriority] = useState<TaskPriority | ''>('');
  const [editDueLocal, setEditDueLocal] = useState('');

  // Filters + pagination
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [completed, setCompleted] = useState('');

  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);

  useEffect(() => {
    localStorage.setItem('accessToken', accessToken);
  }, [accessToken]);

  useEffect(() => {
    localStorage.setItem('refreshToken', refreshToken);
  }, [refreshToken]);

  const authed = useMemo(() => accessToken.trim().length > 0, [accessToken]);

  useEffect(() => {
    // When project selection changes, populate project edit fields.
    if (selectedProject) {
      setProjectName(selectedProject.name);
      setProjectDesc(selectedProject.description ?? '');
      // reset task selection
      setSelectedTaskId('');
    }
  }, [selectedProject]);

  useEffect(() => {
    // When task selection changes, populate edit fields.
    if (selectedTask) {
      setEditTitle(selectedTask.title);
      setEditDesc(selectedTask.description ?? '');
      setEditStatus(selectedTask.status);
      setEditPriority(selectedTask.priority ?? '');
      setEditDueLocal(isoToLocalInput(selectedTask.dueAt));
    }
  }, [selectedTask]);

  async function handleRegister() {
    try {
      const res = await api.register(regEmail, regPassword, regDisplayName);
      setAccessToken(res.accessToken);
      setRefreshToken(res.refreshToken);
      setOut(JSON.stringify(res, null, 2));
      setToast({ kind: 'success', message: 'Registered and logged in.' });
    } catch (e) {
      setOut(formatErr(e));
      setToast({ kind: 'error', message: formatErr(e) });
    }
  }

  async function handleLogin() {
    try {
      const res = await api.login(loginEmail, loginPassword);
      setAccessToken(res.accessToken);
      setRefreshToken(res.refreshToken);
      setOut(JSON.stringify(res, null, 2));
      setToast({ kind: 'success', message: 'Logged in.' });
    } catch (e) {
      setOut(formatErr(e));
      setToast({ kind: 'error', message: formatErr(e) });
    }
  }

  async function handleMe() {
    try {
      const res = await api.me(accessToken);
      setOut(JSON.stringify(res, null, 2));
      setToast({ kind: 'info', message: `You are ${res.email} (${res.role})` });
    } catch (e) {
      setOut(formatErr(e));
      setToast({ kind: 'error', message: formatErr(e) });
    }
  }

  async function handleRefresh() {
    try {
      const res = await api.refresh(refreshToken);
      setAccessToken(res.accessToken);
      setRefreshToken(res.refreshToken);
      setOut(JSON.stringify(res, null, 2));
      setToast({ kind: 'success', message: 'Token refreshed (rotation).'});
    } catch (e) {
      setOut(formatErr(e));
      setToast({ kind: 'error', message: formatErr(e) });
    }
  }

  async function handleLogout() {
    try {
      await api.logout(refreshToken);
      setAccessToken('');
      setRefreshToken('');
      setProjects([]);
      setTaskPage(null);
      setSelectedProjectId('');
      setSelectedTaskId('');
      setOut('Logged out');
      setToast({ kind: 'success', message: 'Logged out.' });
    } catch (e) {
      setOut(formatErr(e));
      setToast({ kind: 'error', message: formatErr(e) });
    }
  }

  async function handleListProjects(selectFirstIfEmpty = true) {
    try {
      const res = await api.listProjects(accessToken);
      setProjects(res);
      if (selectFirstIfEmpty && !selectedProjectId && res.length) {
        setSelectedProjectId(res[0].id);
      }
      setOut(JSON.stringify(res, null, 2));
    } catch (e) {
      setOut(formatErr(e));
      setToast({ kind: 'error', message: formatErr(e) });
    }
  }

  async function handleCreateProject() {
    try {
      const res = await api.createProject(accessToken, projectName, projectDesc);
      setOut(JSON.stringify(res, null, 2));
      await handleListProjects(false);
      setSelectedProjectId(res.id);
      setToast({ kind: 'success', message: 'Project created.' });
    } catch (e) {
      setOut(formatErr(e));
      setToast({ kind: 'error', message: formatErr(e) });
    }
  }

  async function handleUpdateProject() {
    if (!selectedProjectId) return;
    try {
      const res = await api.updateProject(accessToken, selectedProjectId, {
        name: projectName || null,
        description: projectDesc || null,
      });
      setOut(JSON.stringify(res, null, 2));
      await handleListProjects(false);
      setToast({ kind: 'success', message: 'Project updated.' });
    } catch (e) {
      setOut(formatErr(e));
      setToast({ kind: 'error', message: formatErr(e) });
    }
  }

  async function handleDeleteProject() {
    if (!selectedProjectId) return;
    if (!confirm('Delete this project and all tasks?')) return;

    try {
      await api.deleteProject(accessToken, selectedProjectId);
      setOut('Project deleted');
      setSelectedProjectId('');
      setTaskPage(null);
      await handleListProjects(true);
      setToast({ kind: 'success', message: 'Project deleted.' });
    } catch (e) {
      setOut(formatErr(e));
      setToast({ kind: 'error', message: formatErr(e) });
    }
  }

  async function handleListTasks(newPage?: number) {
    if (!selectedProjectId) {
      setOut('Select a project first.');
      return;
    }

    const p = newPage ?? page;

    try {
      const res = await api.listTasks(accessToken, selectedProjectId, {
        q: q || undefined,
        status: status || undefined,
        priority: priority || undefined,
        completed: completed || undefined,
        page: p,
        size,
        sort: 'createdAt,desc',
      });
      setTaskPage(res);
      setPage(p);
      setOut(JSON.stringify(res, null, 2));

      if (selectedTaskId && !res.content.some((t) => t.id === selectedTaskId)) {
        setSelectedTaskId('');
      }
    } catch (e) {
      setOut(formatErr(e));
      setToast({ kind: 'error', message: formatErr(e) });
    }
  }

  async function handleCreateTask() {
    if (!selectedProjectId) {
      setOut('Select a project first.');
      return;
    }
    try {
      const res = await api.createTask(accessToken, selectedProjectId, taskTitle, taskDesc);
      setOut(JSON.stringify(res, null, 2));
      setTaskTitle('');
      setTaskDesc('');
      await handleListTasks(0);
      setToast({ kind: 'success', message: 'Task created.' });
    } catch (e) {
      setOut(formatErr(e));
      setToast({ kind: 'error', message: formatErr(e) });
    }
  }

  async function handleUpdateTask() {
    if (!selectedProjectId || !selectedTaskId) return;
    try {
      const dueAt = localInputToIso(editDueLocal);
      const res = await api.updateTask(accessToken, selectedProjectId, selectedTaskId, {
        title: editTitle || null,
        description: editDesc || null,
        status: editStatus || null,
        priority: (editPriority || null) as TaskPriority | null,
        dueAt,
      });
      setOut(JSON.stringify(res, null, 2));
      await handleListTasks();
      setToast({ kind: 'success', message: 'Task updated.' });
    } catch (e) {
      setOut(formatErr(e));
      setToast({ kind: 'error', message: formatErr(e) });
    }
  }

  async function setTaskStatus(newStatus: TaskStatus) {
    if (!selectedProjectId || !selectedTaskId) return;
    try {
      const res = await api.updateTask(accessToken, selectedProjectId, selectedTaskId, {
        status: newStatus,
        completedAt: newStatus === 'DONE' ? nowIso() : null,
      });
      setOut(JSON.stringify(res, null, 2));
      await handleListTasks();
      setToast({ kind: 'success', message: `Status → ${newStatus}` });
    } catch (e) {
      setOut(formatErr(e));
      setToast({ kind: 'error', message: formatErr(e) });
    }
  }

  async function handleDeleteTask() {
    if (!selectedProjectId || !selectedTaskId) return;
    if (!confirm('Delete this task?')) return;

    try {
      await api.deleteTask(accessToken, selectedProjectId, selectedTaskId);
      setOut('Task deleted');
      setSelectedTaskId('');
      await handleListTasks();
      setToast({ kind: 'success', message: 'Task deleted.' });
    } catch (e) {
      setOut(formatErr(e));
      setToast({ kind: 'error', message: formatErr(e) });
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <h1>Quick Task</h1>
      <p style={{ opacity: 0.8 }}>
        React UI for the Quick Task API (Spring Boot). Dev: backend <code>localhost:8080</code>, frontend <code>localhost:5173</code>.
      </p>

      <div className="grid2">
        <div className="card">
          <h2>Register</h2>
          <input placeholder="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
          <input placeholder="password" type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} />
          <input placeholder="display name (optional)" value={regDisplayName} onChange={(e) => setRegDisplayName(e.target.value)} />
          <button onClick={handleRegister}>Register</button>
        </div>

        <div className="card">
          <h2>Login</h2>
          <input placeholder="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
          <input placeholder="password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
          <button onClick={handleLogin}>Login</button>
        </div>
      </div>

      <div className="card">
        <h2>Tokens</h2>
        <textarea rows={3} placeholder="access token" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
        <textarea rows={2} placeholder="refresh token" value={refreshToken} onChange={(e) => setRefreshToken(e.target.value)} />
        <div className="grid2">
          <button onClick={handleMe} disabled={!authed}>GET /users/me</button>
          <button onClick={handleRefresh} disabled={!refreshToken}>Refresh</button>
        </div>
        <button onClick={handleLogout} disabled={!refreshToken}>Logout</button>
      </div>

      <div className="grid2">
        <div className="card">
          <h2>Projects</h2>
          <div className="grid2">
            <button onClick={() => handleListProjects(true)} disabled={!authed}>List</button>
            <button onClick={handleCreateProject} disabled={!authed || !projectName}>Create</button>
          </div>

          <label style={{ display: 'block', marginTop: 8, opacity: 0.8 }}>Selected project</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={!projects.length}
          >
            <option value="">(select)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.id.slice(0, 8)}…)
              </option>
            ))}
          </select>

          <h3 style={{ marginTop: 12 }}>Edit / Create</h3>
          <input placeholder="project name" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
          <input placeholder="description" value={projectDesc} onChange={(e) => setProjectDesc(e.target.value)} />

          <div className="grid2">
            <button onClick={handleUpdateProject} disabled={!authed || !selectedProjectId}>Update</button>
            <button onClick={handleDeleteProject} disabled={!authed || !selectedProjectId}>Delete</button>
          </div>
        </div>

        <div className="card">
          <h2>Tasks</h2>

          <div className="grid2">
            <button onClick={() => handleListTasks(0)} disabled={!authed || !selectedProjectId}>List</button>
            <button onClick={handleCreateTask} disabled={!authed || !selectedProjectId || !taskTitle}>Create</button>
          </div>

          <h3 style={{ marginTop: 12 }}>Create</h3>
          <input placeholder="task title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
          <input placeholder="description" value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} />

          <h3 style={{ marginTop: 12 }}>Filters</h3>
          <input placeholder="q (search)" value={q} onChange={(e) => setQ(e.target.value)} />
          <input placeholder="status (e.g. TODO,IN_PROGRESS)" value={status} onChange={(e) => setStatus(e.target.value)} />
          <input placeholder="priority (LOW|MEDIUM|HIGH|URGENT)" value={priority} onChange={(e) => setPriority(e.target.value)} />
          <input placeholder="completed (true|false)" value={completed} onChange={(e) => setCompleted(e.target.value)} />

          <h3 style={{ marginTop: 12 }}>Pagination</h3>
          <div className="grid2">
            <input
              placeholder="page"
              value={String(page)}
              onChange={(e) => setPage(Number(e.target.value) || 0)}
            />
            <input
              placeholder="size"
              value={String(size)}
              onChange={(e) => setSize(Number(e.target.value) || 10)}
            />
          </div>
          <div className="grid2">
            <button
              onClick={() => handleListTasks(Math.max(0, page - 1))}
              disabled={!authed || !selectedProjectId || page <= 0}
            >
              Prev
            </button>
            <button
              onClick={() => handleListTasks(page + 1)}
              disabled={!authed || !selectedProjectId || (taskPage ? page + 1 >= taskPage.totalPages : false)}
            >
              Next
            </button>
          </div>
          <div style={{ opacity: 0.7 }}>
            {taskPage ? `Page ${taskPage.number + 1} of ${taskPage.totalPages} (total ${taskPage.totalElements})` : 'No page loaded'}
          </div>

          <h3 style={{ marginTop: 12 }}>Results</h3>
          <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid #333', borderRadius: 8, padding: 8 }}>
            {tasks.map((t) => (
              <label key={t.id} style={{ display: 'block', padding: '6px 0', borderBottom: '1px solid #222' }}>
                <input
                  type="radio"
                  name="task"
                  value={t.id}
                  checked={selectedTaskId === t.id}
                  onChange={() => setSelectedTaskId(t.id)}
                  style={{ width: 'auto', marginRight: 8 }}
                />
                <strong>{t.title}</strong>{' '}
                <span style={{ opacity: 0.7 }}>
                  ({t.status}{t.priority ? ` / ${t.priority}` : ''}{t.completedAt ? ' / completed' : ''})
                </span>
                {t.description ? <div style={{ opacity: 0.85, marginLeft: 26 }}>{t.description}</div> : null}
              </label>
            ))}
            {!tasks.length ? <div style={{ opacity: 0.7 }}>No tasks loaded.</div> : null}
          </div>

          <h3 style={{ marginTop: 12 }}>Edit selected task</h3>
          <input placeholder="title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} disabled={!selectedTaskId} />
          <input placeholder="description" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} disabled={!selectedTaskId} />

          <div className="grid2">
            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as TaskStatus)} disabled={!selectedTaskId}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select value={editPriority} onChange={(e) => setEditPriority(e.target.value as TaskPriority | '')} disabled={!selectedTaskId}>
              <option value="">(no priority)</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <label style={{ display: 'block', marginTop: 8, opacity: 0.8 }}>Due date</label>
          <input type="datetime-local" value={editDueLocal} onChange={(e) => setEditDueLocal(e.target.value)} disabled={!selectedTaskId} />

          <div className="grid2">
            <button onClick={handleUpdateTask} disabled={!authed || !selectedProjectId || !selectedTaskId}>Update</button>
            <button onClick={handleDeleteTask} disabled={!authed || !selectedProjectId || !selectedTaskId}>Delete</button>
          </div>

          <h3 style={{ marginTop: 12 }}>Quick actions</h3>
          <div className="grid2">
            <button onClick={() => setTaskStatus('TODO')} disabled={!authed || !selectedProjectId || !selectedTaskId}>Set TODO</button>
            <button onClick={() => setTaskStatus('IN_PROGRESS')} disabled={!authed || !selectedProjectId || !selectedTaskId}>Set IN_PROGRESS</button>
          </div>
          <div className="grid2">
            <button onClick={() => setTaskStatus('DONE')} disabled={!authed || !selectedProjectId || !selectedTaskId}>Set DONE</button>
            <button onClick={() => setTaskStatus('CANCELED')} disabled={!authed || !selectedProjectId || !selectedTaskId}>Set CANCELED</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Debug output</h2>
          <button style={{ width: 'auto' }} onClick={() => setShowDebug((v) => !v)}>
            {showDebug ? 'Hide' : 'Show'}
          </button>
        </div>
        {showDebug ? <pre style={{ whiteSpace: 'pre-wrap' }}>{out}</pre> : <div style={{ opacity: 0.7 }}>Hidden</div>}
      </div>

      <footer style={{ opacity: 0.7, marginTop: 24 }}>
        Backend Swagger: <a href="/swagger-ui/index.html" target="_blank" rel="noreferrer">/swagger-ui</a>
        {' '}| Backend Demo: <a href="/demo/" target="_blank" rel="noreferrer">/demo/</a>
      </footer>
    </div>
  );
}
