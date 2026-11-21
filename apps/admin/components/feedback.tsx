'use client';

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';
interface Toast {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
}

const ToastContext = createContext<(type: ToastType, title: string, description?: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const STYLES: Record<ToastType, { cls: string; icon: React.ReactNode }> = {
  success: {
    cls: 'border-emerald-300 dark:border-emerald-800',
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
  },
  error: { cls: 'border-rose-300 dark:border-rose-800', icon: <XCircle className="w-5 h-5 text-rose-500" /> },
  warning: {
    cls: 'border-amber-300 dark:border-amber-800',
    icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  },
  info: { cls: 'border-sky-300 dark:border-sky-800', icon: <Info className="w-5 h-5 text-sky-500" /> },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const push = useCallback((type: ToastType, title: string, description?: string) => {
    counter.current += 1;
    const id = counter.current;
    setToasts((t) => [...t.slice(-3), { id, type, title, description }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'error' ? 9000 : 5000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(380px,calc(100vw-2rem))]"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={`flex items-start gap-3 p-3.5 rounded-xl bg-white dark:bg-slate-900 border shadow-lg ${STYLES[t.type].cls}`}
          >
            {STYLES[t.type].icon}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{t.title}</div>
              {t.description && (
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 break-words">{t.description}</div>
              )}
            </div>
            <button
              type="button"
              aria-label="Tutup notifikasi"
              onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function Modal({
  open,
  title,
  icon,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(520px,calc(100vw-2rem))] rounded-2xl p-0 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            {icon}
            <h2 className="text-lg font-bold flex-1">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Tutup" className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-300 space-y-3">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 pt-2">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export const btn = {
  primary:
    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
  secondary:
    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
  warning:
    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/70 text-sm font-semibold text-amber-800 dark:text-amber-300 transition-colors disabled:opacity-50',
  danger:
    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 border border-rose-200 dark:border-rose-800/60 text-sm font-semibold text-rose-700 dark:text-rose-300 transition-colors disabled:opacity-50',
  ghost:
    'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50',
};

export const input =
  'w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500';

export const card = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl';
