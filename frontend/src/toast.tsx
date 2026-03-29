import { useEffect, useState } from 'react';

export type ToastState = {
  kind: 'success' | 'error' | 'info';
  message: string;
} | null;

export function useToast(timeoutMs = 3500) {
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), timeoutMs);
    return () => clearTimeout(t);
  }, [toast, timeoutMs]);

  return { toast, setToast };
}

export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;
  const bg = toast.kind === 'success' ? '#0f3d1c' : toast.kind === 'error' ? '#3d0f0f' : '#0f243d';
  const border = toast.kind === 'success' ? '#2ecc71' : toast.kind === 'error' ? '#e74c3c' : '#3498db';

  return (
    <div
      style={{
        position: 'fixed',
        right: 20,
        top: 20,
        zIndex: 9999,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: 12,
        minWidth: 280,
        maxWidth: 460,
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
      }}
      role="status"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
        <div style={{ whiteSpace: 'pre-wrap' }}>{toast.message}</div>
        <button
          style={{ width: 'auto', padding: '6px 10px', borderRadius: 10 }}
          onClick={onClose}
          aria-label="Close"
        >
          Close
        </button>
      </div>
    </div>
  );
}
