"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIsHydrated } from "@/lib/use-is-hydrated";

type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const mounted = useIsHydrated();
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  // Toasts and their auto-dismiss timers are queued in provider state, so
  // a re-render must not restart the countdown or leave orphaned timers.
  const timersRef = timers;

  useEffect(() => {
    const pending = timersRef.current;
    return () => {
      pending.forEach((handle) => clearTimeout(handle));
      pending.clear();
    };
  }, [timersRef]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const handle = timersRef.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timersRef.current.delete(id);
    }
  }, [timersRef]);

  const toast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, variant }]);
    timersRef.current.set(
      id,
      setTimeout(() => dismiss(id), 4000),
    );
  }, [dismiss, timersRef]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed bottom-4 left-1/2 z-[200] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4" role="status" aria-live="polite">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur-xl ${
                  t.variant === "success"
                    ? "border-[color-mix(in_srgb,var(--success)_45%,var(--border))] bg-surface-2/95 text-success"
                    : t.variant === "error"
                      ? "border-[color-mix(in_srgb,var(--danger)_45%,var(--border))] bg-surface-2/95 text-danger"
                      : "border-[var(--border)] bg-surface-2/95 text-text-primary"
                }`}
              >
                {t.message}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
