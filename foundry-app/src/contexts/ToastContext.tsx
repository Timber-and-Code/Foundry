import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { ToastContainer } from '../components/ui/Toast';
import { on } from '../utils/events';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

export interface ToastOptions {
  action?: ToastAction;
  /** Auto-dismiss delay in ms; default 4000. */
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (message: string, type: ToastType, opts?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType, opts?: ToastOptions) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type, action: opts?.action }].slice(-3));
    const timer = setTimeout(() => dismiss(id), opts?.durationMs ?? 4000);
    timers.current.set(id, timer);
  }, [dismiss]);

  // Listen for toasts dispatched from non-React modules (e.g. sync.ts)
  useEffect(() => {
    const unsub = on('foundry:toast', (detail) => {
      showToast(detail?.message ?? 'Something went wrong', detail?.type ?? 'warning', {
        action: detail?.action,
        durationMs: detail?.durationMs,
      });
    });
    return unsub;
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
