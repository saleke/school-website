"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

type Option = {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
};

export function ProfileOptionsConsole({
  label = "Open profile options",
  options,
}: {
  label?: string;
  options: Option[];
}) {
  const [open, setOpen] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (consoleRef.current && !consoleRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const console = (
    <div
      ref={consoleRef}
      className="z-50"
      style={{
        position: "fixed",
        top: "max(1rem, env(safe-area-inset-top))",
        right: "max(1rem, env(safe-area-inset-right))",
        zIndex: 9999,
        transform: "translateZ(0)",
        WebkitTransform: "translateZ(0)",
      }}
    >
      <div className="relative grid size-16 place-items-center rounded-full border border-[var(--border)] bg-surface-2/55 shadow-[var(--shadow)] backdrop-blur-md">
        {!open && <span className="pointer-events-none absolute -inset-1 rounded-full border border-accent/30" aria-hidden="true" />}
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          title="Quick actions"
          onClick={() => setOpen(value => !value)}
          className={`relative grid size-11 place-items-center rounded-full border text-xl font-semibold leading-none shadow-sm transition ${open ? "border-accent bg-accent/90 text-[var(--accent-contrast)]" : "border-[var(--border)] bg-surface-0/75 backdrop-blur-md hover:border-[var(--border)] hover:bg-surface-1/85"}`}
        >
          <span aria-hidden="true">{open ? "×" : "⋯"}</span>
        </button>
      </div>
      {open && (
        <div className="absolute right-0 top-[4.5rem] w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[var(--border)] bg-surface-0/80 shadow-[var(--shadow)] backdrop-blur-xl" role="menu" aria-label="Quick actions">
          <div className="border-b border-[var(--border)] bg-surface-1/70 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Quick actions</p>
            <p className="mt-1 text-xs text-text-secondary">Common account actions</p>
          </div>
          <div className="p-2">
          {options.map(option => (
            <button
              key={option.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                option.onSelect();
              }}
              className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition hover:bg-surface-1 ${option.destructive ? "mt-2 border-t border-[var(--border)] pt-3 text-danger" : ""}`}
            >
              <span className={`grid size-8 shrink-0 place-items-center rounded-lg text-sm ${option.destructive ? "bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]" : "bg-surface-2"}`} aria-hidden="true">
                {actionIcon(option.label)}
              </span>
              <span className="min-w-0 flex-1">{option.label}</span>
              <span className="text-base text-text-secondary" aria-hidden="true">›</span>
            </button>
          ))}
          </div>
        </div>
      )}
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(console, document.body);
}

function actionIcon(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("assessment") || normalized.includes("result")) return "▤";
  if (normalized.includes("guardian")) return "○";
  if (normalized.includes("profile")) return "◉";
  if (normalized.includes("setting")) return "⚙";
  if (normalized.includes("sign out")) return "↪";
  return "•";
}
