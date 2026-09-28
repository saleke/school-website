import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-accent text-accent-contrast shadow-[0_4px_16px_color-mix(in_srgb,var(--accent)_25%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_85%,white)] hover:shadow-[0_6px_20px_color-mix(in_srgb,var(--accent)_30%,transparent)]",
    secondary: "glass-control",
    quiet: "border border-transparent text-text-secondary hover:text-text-primary hover:bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)]",
    danger: "border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] text-danger hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]",
    ghost: "border border-[var(--border)] text-text-primary hover:bg-surface-2 hover:border-[color-mix(in_srgb,var(--accent-light)_30%,var(--border))]",
  };
  const sizes: Record<ButtonSize, string> = {
    sm: "min-h-9 px-3 text-xs rounded-[var(--radius-xs)]",
    md: "min-h-11 px-5 text-sm rounded-[var(--radius-sm)]",
    lg: "min-h-13 px-6 text-base rounded-[var(--radius-md)]",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}

export function Card({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={`surface-glass rounded-[var(--radius-lg)] p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "success" | "danger" | "warning";
  className?: string;
}) {
  const tones = {
    neutral: "border-[var(--border)] text-text-secondary",
    accent: "border-[color-mix(in_srgb,var(--accent-light)_40%,var(--border))] text-accent-light",
    success: "border-[color-mix(in_srgb,var(--success)_40%,var(--border))] text-success",
    danger: "border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] text-danger",
    warning: "border-[color-mix(in_srgb,var(--warning)_40%,var(--border))] text-warning",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Avatar({
  name,
  size = "md",
  className = "",
}: {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const initials = name.split(" ").map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const sizes = {
    sm: "size-8 text-xs rounded-[var(--radius-xs)]",
    md: "size-10 text-sm rounded-[var(--radius-sm)]",
    lg: "size-14 text-base rounded-[var(--radius-md)]",
    xl: "size-20 text-xl rounded-[var(--radius-lg)]",
  };
  return (
    <span
      aria-label={name}
      className={`grid shrink-0 place-items-center border border-[var(--border)] bg-surface-2 font-bold ${sizes[size]} ${className}`}
    >
      {initials || "?"}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 max-w-2xl text-text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  trend,
  icon,
}: {
  label: string;
  value: string | number;
  trend?: { value: string; positive: boolean };
  icon?: ReactNode;
}) {
  return (
    <div className="surface-glass rounded-[var(--radius-md)] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-secondary">{label}</p>
        {icon && <span className="text-text-secondary" aria-hidden="true">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-bold sm:text-3xl">{value}</p>
      {trend && (
        <p className={`mt-1 text-xs font-semibold ${trend.positive ? "text-success" : "text-danger"}`}>
          {trend.positive ? "↑" : "↓"} {trend.value}
        </p>
      )}
    </div>
  );
}

export function Divider({ className = "" }: { className?: string }) {
  return <hr className={`border-[var(--border)] ${className}`} />;
}
