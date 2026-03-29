import { useState } from 'react';
import { api, type ApiError } from '../api';

function formatErr(e: unknown) {
  const err = e as ApiError;
  if (err?.fields) return `${err.message}\n${JSON.stringify(err.fields, null, 2)}`;
  return err?.message ?? String(e);
}

export function AuthPage({
  onAuth,
  toast,
}: {
  onAuth: (accessToken: string, refreshToken: string) => void;
  toast: (kind: 'success' | 'error' | 'info', message: string) => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  async function handleRegister() {
    try {
      const res = await api.register(regEmail, regPassword, regDisplayName);
      onAuth(res.accessToken, res.refreshToken);
      toast('success', 'Registered and logged in.');
    } catch (e) {
      toast('error', formatErr(e));
    }
  }

  async function handleLogin() {
    try {
      const res = await api.login(loginEmail, loginPassword);
      onAuth(res.accessToken, res.refreshToken);
      toast('success', 'Logged in.');
    } catch (e) {
      toast('error', formatErr(e));
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: 24 }}>
      <h1>Quick Task</h1>
      <p style={{ opacity: 0.8 }}>Login to see your tasks, or create an account.</p>

      <div className="card">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button style={{ width: 'auto' }} onClick={() => setMode('login')} disabled={mode === 'login'}>
            Login
          </button>
          <button style={{ width: 'auto' }} onClick={() => setMode('register')} disabled={mode === 'register'}>
            Register
          </button>
        </div>

        {mode === 'login' ? (
          <>
            <h2>Login</h2>
            <input placeholder="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
            <input placeholder="password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
            <button onClick={handleLogin} disabled={!loginEmail || !loginPassword}>Login</button>
          </>
        ) : (
          <>
            <h2>Register</h2>
            <input placeholder="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
            <input placeholder="password" type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} />
            <input placeholder="display name (optional)" value={regDisplayName} onChange={(e) => setRegDisplayName(e.target.value)} />
            <button onClick={handleRegister} disabled={!regEmail || !regPassword}>Register</button>
          </>
        )}
      </div>

      <footer style={{ opacity: 0.7, marginTop: 20 }}>
        API docs: <a href="/swagger-ui/index.html" target="_blank" rel="noreferrer">Swagger</a>
      </footer>
    </div>
  );
}
