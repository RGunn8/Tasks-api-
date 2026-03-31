import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Toast, useToast } from './toast';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { api } from './api';

function AppRoutes() {
  const navigate = useNavigate();
  const { toast, setToast } = useToast();

  const [accessToken, setAccessToken] = useState<string>(() => localStorage.getItem('accessToken') ?? '');
  const [refreshToken, setRefreshToken] = useState<string>(() => localStorage.getItem('refreshToken') ?? '');

  useEffect(() => {
    localStorage.setItem('accessToken', accessToken);
  }, [accessToken]);

  useEffect(() => {
    localStorage.setItem('refreshToken', refreshToken);
  }, [refreshToken]);

  const authed = useMemo(() => accessToken.trim().length > 0, [accessToken]);

  useEffect(() => {
    if (!authed) return;

    let cancelled = false;
    (async () => {
      try {
        await api.me(accessToken);
      } catch {
        if (cancelled) return;
        // Token is invalid/expired → force re-auth.
        setAccessToken('');
        setRefreshToken('');
        navigate('/auth', { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authed, accessToken, navigate]);

  function toastFn(kind: 'success' | 'error' | 'info', message: string) {
    setToast({ kind, message });
  }

  function handleAuth(at: string, rt: string) {
    setAccessToken(at);
    setRefreshToken(rt);
    navigate('/', { replace: true });
  }

  function handleLogout() {
    setAccessToken('');
    setRefreshToken('');
    navigate('/auth', { replace: true });
  }

  return (
    <>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Routes>
        <Route
          path="/auth"
          element={<AuthPage onAuth={handleAuth} toast={toastFn} />}
        />

        <Route
          path="/"
          element={
            authed ? (
              <HomePage
                accessToken={accessToken}
                refreshToken={refreshToken}
                onLogout={handleLogout}
                toast={toastFn}
              />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />

        <Route path="*" element={<Navigate to={authed ? '/' : '/auth'} replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppRoutes />
    </BrowserRouter>
  );
}
