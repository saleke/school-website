"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const primaryLinks = [
  { href: "/about", label: "About", icon: "info" },
  { href: "/admissions", label: "Admissions", icon: "admit" },
  { href: "/news", label: "News", icon: "news" },
];

const secondaryLinks = [
  { href: "/contact", label: "Contact", description: "Find the school office", icon: "contact" },
  { href: "/login", label: "Log in", description: "Open the school portal", icon: "login" },
];

function NavIcon({ name }: { name: string }) {
  const common = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "info") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 10v6M12 7h.01" /></svg>;
  if (name === "admit") return <svg {...common}><path d="M12 3v18M5 8h14M7 21h10M8 3h8l3 5H5l3-5Z" /></svg>;
  if (name === "news") return <svg {...common}><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /></svg>;
  if (name === "contact") return <svg {...common}><path d="M4 6h16v12H4zM4 7l8 6 8-6" /></svg>;
  return <svg {...common}><path d="M10 17l5-5-5-5M15 12H4M20 4v16" /></svg>;
}

export function PublicSiteNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!sheetRef.current?.contains(event.target as Node)) setMoreOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreOpen]);

  return (
    <>
      <div className="hidden h-[4.75rem] sm:block" aria-hidden="true" />
      <nav className="glass-nav glass-nav-fixed left-1/2 top-3 z-40 hidden w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2 items-center justify-between gap-4 px-3 py-2.5 sm:flex" aria-label="Main navigation">
        <Link href="/" className="glass-brand group flex items-center gap-3 rounded-xl px-2 py-1.5">
          <span className="glass-brand-mark"><span>S</span></span>
          <span><span className="font-display block text-lg font-semibold tracking-tight">School Platform</span><span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-text-secondary">School home</span></span>
        </Link>
        <div className="flex flex-wrap items-center gap-1.5">
          {[...primaryLinks, secondaryLinks[0]].map((link) => (
            <Link key={link.href} href={link.href} className={`glass-nav-link flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${pathname === link.href ? "is-active" : ""}`}>
              <NavIcon name={link.icon} />
              {link.label}
            </Link>
          ))}
          <Link href="/login" className="glass-login flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold">
            <NavIcon name="login" />
            Log in
          </Link>
        </div>
      </nav>

      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:hidden" aria-label="Primary navigation">
        <div className="glass-mobile-nav mx-auto grid max-w-md grid-cols-4 gap-1 p-2">
          {primaryLinks.map((link) => (
            <Link key={link.href} href={link.href} className={`relative z-10 flex min-h-14 flex-col items-center justify-center rounded-xl px-1 text-[11px] font-bold leading-tight ${pathname === link.href ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-text-primary" : "text-text-secondary hover:bg-[color-mix(in_srgb,var(--text-primary)_7%,transparent)]"}`}>
              <span aria-hidden="true" className="mb-1"><NavIcon name={link.icon} /></span>
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(value => !value)}
            aria-expanded={moreOpen}
            className={`relative z-10 flex min-h-14 flex-col items-center justify-center rounded-xl px-1 text-[11px] font-bold leading-tight ${moreOpen ? "bg-surface-2 text-text-primary" : "text-text-secondary hover:bg-[color-mix(in_srgb,var(--text-primary)_7%,transparent)]"}`}
          >
            <span aria-hidden="true" className="mb-1 text-base">⋯</span>
            More
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/25 sm:hidden"
          role="presentation"
          onMouseDown={event => { if (event.target === event.currentTarget) setMoreOpen(false); }}
        >
          <section ref={sheetRef} className="absolute inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] mx-auto max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-surface-0/95 shadow-[var(--shadow)] backdrop-blur-xl" role="dialog" aria-modal="true" aria-label="More school sections">
            <div className="flex items-start justify-between border-b border-[var(--border)] bg-surface-1/75 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">More sections</p>
                <p className="mt-1 text-sm text-text-secondary">Explore the school and start your journey.</p>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close more sections" className="grid size-9 place-items-center rounded-full border border-[var(--border)] text-lg text-text-secondary hover:bg-surface-2">×</button>
            </div>
            <div className="grid gap-2 p-3">
              {secondaryLinks.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setMoreOpen(false)} className="flex min-h-14 items-center gap-3 rounded-xl px-4 text-left font-semibold hover:bg-surface-1">
                  <span className="grid size-9 place-items-center rounded-lg bg-surface-2 text-text-secondary" aria-hidden="true"><NavIcon name={link.icon} /></span>
                  <span><span className="block">{link.label}</span><span className="mt-0.5 block text-xs font-normal text-text-secondary">{link.description}</span></span>
                  <span className="ml-auto text-lg text-text-secondary" aria-hidden="true">›</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
