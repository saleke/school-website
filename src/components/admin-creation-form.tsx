"use client";

import { FormEvent, useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { SubjectManagement } from "@/components/subject-management";
import { supabaseRequest } from "@/lib/supabase";

export function AdminCreationForm({ onStatus }: { onStatus: (message: string) => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string; class_id: string }[]>([]);
  const [schedules, setSchedules] = useState<{ subject_id: string }[]>([]);
  useEffect(() => { void (async () => { try { const [classRows, subjectRows, scheduleRows] = await Promise.all([supabaseRequest<{ id: string; name: string }[]>("Class?select=id,name&order=name"), supabaseRequest<{ id: string; name: string; class_id: string }[]>("Subject?select=id,name,class_id&order=name"), supabaseRequest<{ subject_id: string }[]>("TeachingSchedule?select=subject_id")]); setClasses(classRows ?? []); setSubjects(subjectRows ?? []); setSchedules(scheduleRows ?? []); } catch (error) { onStatus(error instanceof Error ? error.message : "Subject management could not load."); } })(); }, [onStatus]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("school_access_token") ?? ""}` }, body: JSON.stringify(form) });
      const payload = await response.json() as { message?: string; email?: string };
      if (!response.ok) throw new Error(payload.message ?? "Admin account could not be created.");
      setForm({ name: "", email: "", password: "" }); onStatus(`Admin account created for ${payload.email}.`);
    } catch (error) { onStatus(error instanceof Error ? error.message : "Admin account could not be created."); } finally { setBusy(false); }
  }
  return <div className="space-y-6"><SubjectManagement classes={classes} subjects={subjects} schedules={schedules} onSubjectsChange={setSubjects} onStatus={onStatus} /><Card><h2 className="font-display text-2xl font-semibold">Create another admin</h2><p className="mt-2 text-text-secondary">Only an existing admin can use this; public signup never offers admin.</p><form onSubmit={submit} className="mt-5 grid gap-3 md:grid-cols-3"><input required placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-[var(--border)] bg-surface-0 px-3 py-3" /><input required type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="rounded-lg border border-[var(--border)] bg-surface-0 px-3 py-3" /><input required minLength={8} type="password" placeholder="Temporary password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="rounded-lg border border-[var(--border)] bg-surface-0 px-3 py-3" /><button disabled={busy} className="rounded-lg border border-[var(--border)] px-4 py-3 font-semibold md:col-span-3">{busy ? "Creating…" : "Create admin account"}</button></form></Card></div>;
}
