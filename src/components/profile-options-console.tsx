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
      className="profile-console z-50"
      style={{
        position: "fixed",
        top: "max(1rem, env(safe-area-inset-top))",
        right: "max(1rem, env(safe-area-inset-right))",
        zIndex: 9999,
        transform: "translateZ(0)",
        WebkitTransform: "translateZ(0)",
      }}
    >
      <div className="relative">
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          title="Quick actions"
          onClick={() => setOpen(value => !value)}
          className={`profile-console-trigger glass-control relative grid size-12 place-items-center rounded-xl text-lg font-semibold leading-none ${open ? "border-accent bg-accent/90 text-[var(--accent-contrast)]" : ""}`}
        >
          <span className="sr-only">{open ? "Close quick actions" : "Open quick actions"}</span>
          <span className="profile-console-icon" aria-hidden="true">
            {open ? "×" : "☷"}
          </span>
        </button>
      </div>
      {open && (
        <div className="profile-console-panel absolute right-0 top-[calc(100%+0.75rem)] w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl" role="menu" aria-label="Quick actions">
          <div className="profile-console-heading border-b border-[var(--border)] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Quick actions</p>
            <p className="mt-1 text-sm text-text-secondary">Move around your workspace.</p>
          </div>
          <div className="space-y-1 p-2.5">
          {options.map(option => (
            <button
              key={option.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                option.onSelect();
              }}
              className={`profile-console-item flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold ${option.destructive ? "mt-2 border-t border-[var(--border)] pt-3 text-danger" : ""}`}
            >
              <span className={`grid size-9 shrink-0 place-items-center rounded-lg text-sm ${option.destructive ? "bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]" : "bg-surface-2"}`} aria-hidden="true">
                {actionIcon(option.label)}
              </span>
              <span className="min-w-0 flex-1"><span className="block">{option.label}</span><span className="mt-0.5 block text-xs font-normal text-text-secondary">{actionDescription(option.label)}</span></span>
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

function actionDescription(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("assessment") || normalized.includes("result")) return "Review academic progress";
  if (normalized.includes("guardian")) return "Manage emergency contact details";
  if (normalized.includes("profile")) return "View your personal information";
  if (normalized.includes("setting")) return "Update account preferences";
  if (normalized.includes("sign out")) return "End this session securely";
  return "Open this workspace";
}
