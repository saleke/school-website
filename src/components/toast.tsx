"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  const [mounted, setMounted] = useState(false);
  const nextId = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, variant }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 4000);
  }, []);

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
