"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/supabase";
import { Button, Card } from "@/components/ui";

type Role = "student" | "teacher";

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [role, setRole] = useState<Role>("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const result = mode === "signup"
        ? await signUp(email, password, name, role)
        : await signIn(email, password);
      if (result.access_token) {
        localStorage.setItem("school_access_token", result.access_token);
        if (result.user?.id) localStorage.setItem("school_user_id", result.user.id);
        router.push("/portal");
      } else {
        setMessage(mode === "signup" && role === "teacher"
          ? "Account created. Confirm your email, then log in to see the admin approval waiting screen."
          : "Account created. Confirm your email, then log in.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Something went wrong."); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[.9fr_1.1fr]">
    <section className="pt-4 lg:pt-12"><p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-text-secondary">School Platform</p><h1 className="font-display text-5xl font-semibold leading-tight">Your school identity, in one place.</h1><p className="mt-5 max-w-md text-lg text-text-secondary">Students choose their class later in profile settings. Guardian contacts are optional and never part of signup.</p></section>
    <Card className="p-7 sm:p-9">
      <div className="mb-7 flex gap-2" role="group" aria-label="Authentication action"><button type="button" onClick={() => setMode("signup")} className={`rounded-lg px-4 py-2 font-semibold ${mode === "signup" ? "bg-accent text-[var(--accent-contrast)]" : "border border-[var(--border)]"}`}>Create account</button><button type="button" onClick={() => setMode("login")} className={`rounded-lg px-4 py-2 font-semibold ${mode === "login" ? "bg-accent text-[var(--accent-contrast)]" : "border border-[var(--border)]"}`}>Log in</button></div>
      <h2 className="font-display text-3xl font-semibold">{mode === "signup" ? "Who are you?" : "Welcome back"}</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2" role="group" aria-label="Choose account type"><button type="button" aria-pressed={role === "student"} onClick={() => setRole("student")} className={`rounded-xl border p-5 text-left transition ${role === "student" ? "border-accent bg-surface-2" : "border-[var(--border)]"}`}><span className="block text-lg font-bold">I&apos;m a Student</span><span className="mt-1 block text-sm text-text-secondary">Learn, practice, and grow.</span></button><button type="button" aria-pressed={role === "teacher"} onClick={() => setRole("teacher")} className={`rounded-xl border p-5 text-left transition ${role === "teacher" ? "border-accent bg-surface-2" : "border-[var(--border)]"}`}><span className="block text-lg font-bold">I&apos;m a Teacher</span><span className="mt-1 block text-sm text-text-secondary">Teacher access starts pending admin approval.</span></button></div>
      <form className="mt-7 space-y-4" onSubmit={submit}>{mode === "signup" && <label className="block text-sm font-semibold">Full name<input required value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3 py-3" /></label>}<label className="block text-sm font-semibold">Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3 py-3" /></label><label className="block text-sm font-semibold">Password<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3 py-3" /></label><Button type="submit" disabled={busy} className="w-full">{busy ? "Please wait…" : mode === "signup" ? `Create ${role} account` : "Log in"}</Button></form>
      {message && <p className="mt-5 rounded-lg border border-[var(--border)] bg-surface-2 p-3 text-sm" role="status">{message}</p>}
      <p className="mt-6 text-xs text-text-secondary">Admin and alumni accounts are never selectable here. Librarian access is granted later by an admin.</p>
    </Card>
  </div>;
}
