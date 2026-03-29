import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { api, type ApiError, type Project, type Task } from './api';

function formatErr(e: unknown) {
  const err = e as ApiError;
  if (err?.fields) return `${err.message}\n${JSON.stringify(err.fields, null, 2)}`;
  return err?.message ?? String(e);
}

export default function App() {
  const [out, setOut] = useState<string>('Ready.');

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
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Tasks
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);

  // Filters
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [completed, setCompleted] = useState('');

  useEffect(() => {
    localStorage.setItem('accessToken', accessToken);
  }, [accessToken]);

  useEffect(() => {
    localStorage.setItem('refreshToken', refreshToken);
  }, [refreshToken]);

  const authed = useMemo(() => accessToken.trim().length > 0, [accessToken]);

  async function handleRegister() {
    try {
      const res = await api.register(regEmail, regPassword, regDisplayName);
      setAccessToken(res.accessToken);
      setRefreshToken(res.refreshToken);
      setOut(JSON.stringify(res, null, 2));
    } catch (e) {
      setOut(formatErr(e));
    }
  }

  async function handleLogin() {
    try {
      const res = await api.login(loginEmail, loginPassword);
      setAccessToken(res.accessToken);
      setRefreshToken(res.refreshToken);
      setOut(JSON.stringify(res, null, 2));
    } catch (e) {
      setOut(formatErr(e));
    }
  }

  async function handleMe() {
    try {
      const res = await api.me(accessToken);
      setOut(JSON.stringify(res, null, 2));
    } catch (e) {
      setOut(formatErr(e));
    }
  }

  async function handleRefresh() {
    try {
      const res = await api.refresh(refreshToken);
      setAccessToken(res.accessToken);
      setRefreshToken(res.refreshToken);
      setOut(JSON.stringify(res, null, 2));
    } catch (e) {
      setOut(formatErr(e));
    }
  }

  async function handleLogout() {
    try {
      await api.logout(refreshToken);
      setAccessToken('');
      setRefreshToken('');
      setProjects([]);
      setTasks([]);
      setSelectedProjectId('');
      setOut('Logged out');
    } catch (e) {
      setOut(formatErr(e));
    }
  }

  async function handleListProjects() {
    try {
      const res = await api.listProjects(accessToken);
      setProjects(res);
      if (!selectedProjectId && res.length) setSelectedProjectId(res[0].id);
      setOut(JSON.stringify(res, null, 2));
    } catch (e) {
      setOut(formatErr(e));
    }
  }

  async function handleCreateProject() {
    try {
      const res = await api.createProject(accessToken, projectName, projectDesc);
      setOut(JSON.stringify(res, null, 2));
      await handleListProjects();
    } catch (e) {
      setOut(formatErr(e));
    }
  }

  async function handleListTasks() {
    if (!selectedProjectId) {
      setOut('Select a project first.');
      return;
    }
    try {
      const page = await api.listTasks(accessToken, selectedProjectId, {
        q: q || undefined,
        status: status || undefined,
        priority: priority || undefined,
        completed: completed || undefined,
        page: 0,
        size: 50,
        sort: 'createdAt,desc',
      });
      setTasks(page.content);
      setOut(JSON.stringify(page, null, 2));
    } catch (e) {
      setOut(formatErr(e));
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
      await handleListTasks();
    } catch (e) {
      setOut(formatErr(e));
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <h1>Tasks API — React Demo</h1>
      <p style={{ opacity: 0.8 }}>
        Dev: run backend on <code>localhost:8080</code> and frontend on <code>localhost:5173</code>.
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
            <button onClick={handleListProjects} disabled={!authed}>List Projects</button>
            <button onClick={handleCreateProject} disabled={!authed || !projectName}>Create Project</button>
          </div>
          <input placeholder="project name" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
          <input placeholder="description" value={projectDesc} onChange={(e) => setProjectDesc(e.target.value)} />

          <label style={{ display: 'block', marginTop: 8, opacity: 0.8 }}>Selected project</label>
          <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} disabled={!projects.length}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.id.slice(0, 8)}…)
              </option>
            ))}
          </select>
        </div>

        <div className="card">
          <h2>Tasks</h2>
          <div className="grid2">
            <button onClick={handleListTasks} disabled={!authed || !selectedProjectId}>List Tasks</button>
            <button onClick={handleCreateTask} disabled={!authed || !selectedProjectId || !taskTitle}>Create Task</button>
          </div>
          <input placeholder="task title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
          <input placeholder="description" value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} />

          <h3 style={{ marginTop: 12 }}>Filters</h3>
          <input placeholder="q (search)" value={q} onChange={(e) => setQ(e.target.value)} />
          <input placeholder="status (e.g. TODO,IN_PROGRESS)" value={status} onChange={(e) => setStatus(e.target.value)} />
          <input placeholder="priority (LOW|MEDIUM|HIGH|URGENT)" value={priority} onChange={(e) => setPriority(e.target.value)} />
          <input placeholder="completed (true|false)" value={completed} onChange={(e) => setCompleted(e.target.value)} />

          <h3 style={{ marginTop: 12 }}>Latest results</h3>
          <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid #333', borderRadius: 8, padding: 8 }}>
            {tasks.map((t) => (
              <div key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid #222' }}>
                <div><strong>{t.title}</strong> <span style={{ opacity: 0.7 }}>({t.status}{t.priority ? ` / ${t.priority}` : ''})</span></div>
                {t.description ? <div style={{ opacity: 0.8 }}>{t.description}</div> : null}
              </div>
            ))}
            {!tasks.length ? <div style={{ opacity: 0.7 }}>No tasks loaded.</div> : null}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Output</h2>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{out}</pre>
      </div>

      <footer style={{ opacity: 0.7, marginTop: 24 }}>
        Backend Swagger: <a href="/swagger-ui/index.html" target="_blank" rel="noreferrer">/swagger-ui</a>
        {' '}| Backend Demo: <a href="/demo/" target="_blank" rel="noreferrer">/demo/</a>
      </footer>
    </div>
  );
}
