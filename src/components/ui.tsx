import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variants: Record<ButtonVariant, string> = {
    primary: "glass-login",
    secondary: "glass-control",
    quiet: "glass-control border-transparent text-text-secondary hover:text-text-primary",
    danger: "border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] text-danger hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]",
  };
  return <button className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-5 font-semibold ${variants[variant]} disabled:cursor-not-allowed disabled:opacity-45 ${className}`} {...props} />;
}

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`surface-glass rounded-[var(--radius-lg)] p-6 ${className}`} {...props} />;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "success" | "danger" }) {
  const tones = {
    neutral: "border-[var(--border)] text-text-secondary",
    accent: "border-[color-mix(in_srgb,var(--accent-light)_45%,var(--border))] text-[var(--accent-light)]",
    success: "border-[color-mix(in_srgb,var(--success)_45%,var(--border))] text-success",
    danger: "border-[color-mix(in_srgb,var(--danger)_45%,var(--border))] text-danger",
  };
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${tones[tone]}`}>{children}</span>;
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const sizes = { sm: "size-8 text-xs", md: "size-11 text-sm", lg: "size-14 text-base" };
  return <span aria-label={name} className={`grid shrink-0 place-items-center rounded-full border border-[var(--border)] bg-surface-2 font-bold ${sizes[size]}`}>{initials}</span>;
}

export function SectionHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-4"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 className="font-display mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>{description && <p className="mt-2 max-w-2xl text-text-secondary">{description}</p>}</div>{action}</div>;
}
