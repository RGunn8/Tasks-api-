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

function borderClass(kind: NonNullable<ToastState>['kind']) {
  switch (kind) {
    case 'success':
      return 'border-green-600';
    case 'error':
      return 'border-red-600';
    case 'info':
    default:
      return 'border-blue-600';
  }
}

export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;

  return (
    <div
      className={`fixed right-5 top-5 z-[9999] w-[min(520px,92vw)] rounded-xl border bg-white p-3 shadow-xl ${borderClass(toast.kind)}`}
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="whitespace-pre-wrap text-sm text-slate-900">{toast.message}</div>
        <button
          className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-900 hover:bg-slate-100"
          onClick={onClose}
          aria-label="Close"
        >
          Close
        </button>
      </div>
    </div>
  );
}
