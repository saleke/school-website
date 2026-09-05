import { AuthPanel } from "@/components/auth-panel";
import Link from "next/link";

export default function AuthPage() {
  return <main className="paper-grid min-h-screen px-5 py-10 sm:px-8 sm:py-16"><div className="mx-auto mb-8 max-w-5xl"><Link href="/" className="group inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-surface-1 px-3.5 text-sm font-semibold text-text-secondary shadow-sm hover:bg-surface-2"><span aria-hidden="true" className="text-base transition-transform group-hover:-translate-x-0.5">←</span><span>Back</span></Link></div><AuthPanel /></main>;
}
