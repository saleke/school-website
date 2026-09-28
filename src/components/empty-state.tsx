const ICONS = {
  calendar: (
    <path d="M7 3v3m10-3v3M4 8h16M5 5.5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z" />
  ),
  check: (
    <path d="M9 12.5 11 14.5 15.5 9.5M5 5.5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z" />
  ),
  megaphone: (
    <path d="M4 10v4a1 1 0 0 0 1 1h2l4 4V5L7 9H5a1 1 0 0 0-1 1Zm11-2a4 4 0 0 1 0 8" />
  ),
  document: (
    <path d="M7 3.5h6l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Zm6 0v5h5M9 13h7M9 17h5" />
  ),
  users: (
    <path d="M15 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-4A3.5 3.5 0 0 0 4 17.5V19m11 0v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 5.5a3 3 0 0 1 0 6M4 11V7m-2 2h4" />
  ),
  inbox: (
    <path d="M4 13h4l1.5 3h5L16 13h4m-16 0 2.5-8a1 1 0 0 1 1-.75h7a1 1 0 0 1 1 .75L20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6Z" />
  ),
  chart: (
    <path d="M4 20V4m0 16h16M8 20v-5m4 5V9m4 11v-8" />
  ),
} as const;

export type EmptyStateIconName = keyof typeof ICONS;

/**
 * Decorative glyph for an empty state. Purely presentational, so it is
 * hidden from assistive tech — the `title` carries the meaning.
 */
export function EmptyStateIcon({ name, className = "" }: { name: EmptyStateIconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`size-10 text-text-secondary/60 ${className}`}
    >
      {ICONS[name]}
    </svg>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  /** Icon name, or any custom node. */
  icon?: EmptyStateIconName | React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-surface-1/50 px-6 py-12 text-center">
      {typeof icon === "string" && icon in ICONS ? <EmptyStateIcon name={icon as EmptyStateIconName} /> : icon}
      <h3 className="font-display mt-3 text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-text-secondary">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
