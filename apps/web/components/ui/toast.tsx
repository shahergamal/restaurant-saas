'use client';

import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { createContext, useCallback, useContext, useState } from 'react';
import { cn } from '@/lib/cn';

type Toast = { id: number; kind: 'success' | 'error'; text: string };
const Ctx = createContext<(kind: Toast['kind'], text: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s.slice(-2), { id, kind, text }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 start-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2 rtl:translate-x-1/2" aria-live="polite" role="status">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              'animate-fade-in pointer-events-auto flex min-w-[280px] max-w-[440px] items-center gap-3 rounded-lg border bg-surface px-4 py-3 text-sm font-medium shadow-pop',
              t.kind === 'success' ? 'border-success/20' : 'border-danger/25',
            )}
          >
            {t.kind === 'success' ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : <AlertCircle className="size-5 shrink-0 text-danger" />}
            <span className="flex-1">{t.text}</span>
            <button className="text-ink-subtle hover:text-ink" onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} aria-label="Dismiss">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
