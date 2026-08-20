import { AuthPanel } from "@/components/auth-panel";
import Link from "next/link";

export default function AuthPage() {
  return <main className="paper-grid min-h-screen px-5 py-10 sm:px-8 sm:py-16"><div className="mx-auto mb-8 max-w-5xl"><Link href="/" className="text-sm font-semibold text-text-secondary">Back to home</Link></div><AuthPanel /></main>;
}
