"use client";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  destructive = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-surface-0 p-5 shadow-[var(--shadow)]" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
        <h2 id="confirm-dialog-title" className="font-display text-xl font-semibold">{title}</h2>
        <p id="confirm-dialog-message" className="mt-2 text-sm text-text-secondary">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="min-h-11 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold">Cancel</button>
          <button type="button" onClick={onConfirm} className={`min-h-11 rounded-lg px-4 text-sm font-semibold text-[var(--accent-contrast)] ${destructive ? "bg-danger" : "bg-accent"}`}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
