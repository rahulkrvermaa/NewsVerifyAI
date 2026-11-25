import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        const Icon = t.type === 'success' ? CheckCircle2 : t.type === 'error' ? AlertCircle : Info;
        const accent =
          t.type === 'success'
            ? 'border-l-[var(--nv-supported)] text-[var(--nv-supported)]'
            : t.type === 'error'
              ? 'border-l-[var(--nv-contradicted)] text-[var(--nv-contradicted)]'
              : 'border-l-[var(--nv-accent)] text-[var(--nv-accent)]';

        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2.5 bg-[var(--nv-surface)] border border-[var(--nv-border)] border-l-4 ${accent} px-3.5 py-2.5 shadow-sm rounded-sm`}
          >
            <Icon className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-xs text-[var(--nv-text)] flex-1 leading-relaxed">{t.text}</p>
            <button
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss notification"
              className="text-[var(--nv-text-muted)] hover:text-[var(--nv-text)] p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
