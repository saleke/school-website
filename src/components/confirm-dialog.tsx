"use client";

import { useEffect, useId, useRef } from "react";

/**
 * Modal confirmation for destructive or irreversible actions.
 *
 * Replaces `window.confirm`, which blocked the main thread, could not be
 * styled, and read as a browser error rather than part of the product.
 *
 * Accessibility handled here so every call site gets it for free:
 * - focus moves to the confirm button on open and returns to the trigger on close
 * - Tab is trapped inside the dialog
 * - Escape and backdrop click both cancel
 * - body scroll is locked while open
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  // Unique per instance so two open dialogs never duplicate ids.
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;

      // Trap focus: only the two buttons are reachable.
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        ref={panelRef}
        className="w-full max-w-md animate-scale-in rounded-2xl border border-[var(--border)] bg-surface-1 p-5 shadow-[var(--shadow-lg)]"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={`grid size-9 shrink-0 place-items-center rounded-full text-lg ${
              destructive ? "bg-danger/15 text-danger" : "bg-accent/15 text-accent-light"
            }`}
          >
            {destructive ? "!" : "?"}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-lg font-semibold">
              {title}
            </h2>
            <p id={messageId} className="mt-1 text-sm text-text-secondary">
              {message}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-[var(--radius-sm)] border border-[var(--border)] px-4 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-2"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`min-h-11 rounded-[var(--radius-sm)] px-4 text-sm font-semibold text-[var(--accent-contrast)] transition-opacity hover:opacity-90 ${
              destructive ? "bg-danger" : "bg-accent"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
