import { useState } from 'react';
import { api, type ApiError } from '../api';

function formatErr(e: unknown) {
  const err = e as ApiError;
  if (err?.fields) return `${err.message}\n${JSON.stringify(err.fields, null, 2)}`;
  return err?.message ?? String(e);
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${props.className ?? ''}`}
    />
  );
}

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  const v = props.variant ?? 'primary';
  const base = 'w-full rounded-xl border px-3 py-2 text-sm font-medium disabled:opacity-60';
  const cls =
    v === 'primary'
      ? 'border-indigo-200 bg-indigo-600 text-white hover:bg-indigo-700'
      : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50';
  return (
    <button {...props} className={`${base} ${cls} ${props.className ?? ''}`} />
  );
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
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Quick Task</h1>
          <p className="mt-2 text-sm text-slate-600">Login to see your tasks, or create an account.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex gap-2">
            <button
              className={`rounded-xl border px-3 py-2 text-sm ${mode === 'login' ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              onClick={() => setMode('login')}
              disabled={mode === 'login'}
              type="button"
            >
              Login
            </button>
            <button
              className={`rounded-xl border px-3 py-2 text-sm ${mode === 'register' ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              onClick={() => setMode('register')}
              disabled={mode === 'register'}
              type="button"
            >
              Register
            </button>
          </div>

          {mode === 'login' ? (
            <>
              <h2 className="text-lg font-semibold text-slate-900">Login</h2>
              <div className="mt-3 space-y-2">
                <Input placeholder="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                <Input
                  placeholder="password"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
                <Button onClick={handleLogin} disabled={!loginEmail || !loginPassword}>
                  Login
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-slate-900">Register</h2>
              <div className="mt-3 space-y-2">
                <Input placeholder="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
                <Input
                  placeholder="password"
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
                <Input
                  placeholder="display name (optional)"
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value)}
                />
                <Button onClick={handleRegister} disabled={!regEmail || !regPassword}>
                  Register
                </Button>
              </div>
            </>
          )}
        </div>

        <footer className="mt-6 text-sm text-slate-600">
          API docs: <a href="/swagger-ui/index.html" target="_blank" rel="noreferrer">Swagger</a>
        </footer>
      </div>
    </div>
  );
}
