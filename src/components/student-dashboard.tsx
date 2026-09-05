"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui";
import { StudentResultSummary } from "@/components/student-result-summary";
import { AccountSettings } from "@/components/account-settings";
import { ProfileOptionsConsole } from "@/components/profile-options-console";

type Student = {
  id: string;
  admission_no?: string | null;
  dob?: string | null;
  class_id: string | null;
  class_option_id: string | null;
  class_locked: boolean;
};
type ClassRow = { id: string; name: string; grade_level: string };
type Section = { id: string; class_id: string; code: string };
type Guardian = { id?: string; name: string; relationship: string; phone: string; email: string };

export function StudentDashboard({
  profile,
  student,
  classes,
  sections,
  guardian,
  onGuardianChange,
  onSaveGuardian,
  onSaveDateOfBirth,
  onSignOut,
  status,
}: {
  profile: { name: string; email: string };
  student: Student;
  classes: ClassRow[];
  sections: Section[];
  guardian: Guardian;
  onGuardianChange: (guardian: Guardian) => void;
  onSaveGuardian: () => void;
  onSaveDateOfBirth: (date: string) => void;
  onSignOut: () => void;
  status: string;
}) {
  const [panel, setPanel] = useState<"profile" | "guardian" | "results" | "class" | "settings" | "options" | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState(student.dob ?? "");
  const panelRef = useRef<HTMLElement>(null);
  const className = classes.find((item) => item.id === student.class_id);
  const section = sections.find((item) => item.id === student.class_option_id);
  const placementLabel = className
    ? className.name === className.grade_level ? className.name : `${className.name} · ${className.grade_level}`
    : "Class not selected";

  useEffect(() => {
    if (panel && panel !== "options") {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [panel]);

  return (
    <main className="paper-grid min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="relative overflow-visible rounded-2xl border border-[var(--border)] bg-surface-1 p-4 sm:p-7">
          <div className="absolute -right-12 -top-16 size-40 rounded-full bg-surface-2/70" aria-hidden="true" />
          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Student profile</p>
              <h1 className="font-display text-3xl font-semibold sm:text-4xl">Welcome, {profile.name}</h1>
              <p className="mt-2 text-sm text-text-secondary">{student.admission_no ? `Admission No. ${student.admission_no}` : profile.email}</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="min-w-36 rounded-xl border border-[var(--border)] bg-surface-0/80 px-4 py-3 text-left sm:text-right">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-secondary">Class</p>
                <p className="mt-1 font-semibold">{placementLabel}</p>
                <p className="text-sm text-text-secondary">{section ? `Section ${section.code}` : "Section not selected"}</p>
              </div>
            </div>
          </div>
        </header>
        <ProfileOptionsConsole options={[
          { label: "View profile", onSelect: () => setPanel("profile") },
          { label: "Guardian info", onSelect: () => setPanel("guardian") },
          { label: "Results", onSelect: () => setPanel("results") },
          { label: "Account settings", onSelect: () => setPanel("settings") },
          { label: "Sign out", onSelect: onSignOut, destructive: true },
        ]} />

        {status && <p role="status" className="rounded-lg border border-[var(--border)] bg-surface-2 p-3 text-sm">{status}</p>}

        <section className="grid gap-4 sm:grid-cols-3">
          <button type="button" onClick={() => setPanel("results")} className="text-left"><Card className="h-full transition hover:bg-surface-2"><p className="text-xs font-bold uppercase tracking-[0.12em] text-text-secondary">Academic</p><h2 className="mt-2 font-display text-xl font-semibold">Assessment record</h2><p className="mt-1 text-sm text-text-secondary">View scores, totals, and averages.</p></Card></button>
          <button type="button" onClick={() => setPanel("class")} className="text-left"><Card className="h-full transition hover:bg-surface-2"><p className="text-xs font-bold uppercase tracking-[0.12em] text-text-secondary">Placement</p><h2 className="mt-2 font-display text-xl font-semibold">Class details</h2><p className="mt-1 text-sm text-text-secondary">Review your class and section.</p></Card></button>
          <button type="button" onClick={() => setPanel("profile")} className="text-left"><Card className="h-full transition hover:bg-surface-2"><p className="text-xs font-bold uppercase tracking-[0.12em] text-text-secondary">Account</p><h2 className="mt-2 font-display text-xl font-semibold">Edit profile</h2><p className="mt-1 text-sm text-text-secondary">Update your display name.</p></Card></button>
        </section>

        {panel && panel !== "options" && <section ref={panelRef} className="scroll-mt-6 rounded-xl border border-[var(--border)] bg-surface-1 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3"><h2 className="font-display text-2xl font-semibold">{panel === "profile" ? "Edit profile" : panel === "guardian" ? "Guardian info" : panel === "results" ? "Assessment record" : panel === "settings" ? "Account settings" : "Class details"}</h2><button type="button" onClick={() => setPanel(null)} className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold">Close</button></div>
          {panel === "profile" && <div className="mt-5 grid gap-4 sm:grid-cols-2"><ReadOnlyDetail label="Name" value={profile.name} /><ReadOnlyDetail label="Email" value={profile.email} /><ReadOnlyDetail label="Admission number" value={student.admission_no ?? "Not assigned"} />{student.dob ? <ReadOnlyDetail label="Date of birth" value={student.dob} /> : <label className="rounded-lg border border-[var(--border)] bg-surface-0 px-3 py-3 text-sm font-semibold">Date of birth<input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} className="mt-2 min-h-10 w-full rounded-lg border border-[var(--border)] bg-surface-1 px-2" /><button type="button" onClick={() => onSaveDateOfBirth(dateOfBirth)} className="mt-2 min-h-10 rounded-lg bg-accent px-3 text-sm font-semibold text-[var(--accent-contrast)]">Save date</button></label>}<ReadOnlyDetail label="Class" value={placementLabel} /><ReadOnlyDetail label="Section" value={section ? `Section ${section.code}` : "Not selected"} /></div>}
          {panel === "guardian" && <div className="mt-5 max-w-lg space-y-3">{(["name", "relationship", "phone", "email"] as const).map((key) => <input key={key} value={guardian[key]} onChange={(event) => onGuardianChange({ ...guardian, [key]: event.target.value })} placeholder={key === "email" ? "Email (optional)" : key[0].toUpperCase() + key.slice(1)} className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3" />)}<button type="button" onClick={onSaveGuardian} className="min-h-11 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold">Save</button></div>}
          {panel === "results" && <div className="mt-5"><StudentResultSummary studentId={student.id} studentName={profile.name} /></div>}
          {panel === "settings" && <div className="mt-5"><AccountSettings name={profile.name} email={profile.email} role="Student" /></div>}
          {panel === "class" && <div className="mt-5 grid gap-4 sm:grid-cols-2"><ReadOnlyDetail label="Class" value={placementLabel} /><ReadOnlyDetail label="Section" value={section ? `Section ${section.code}` : "Not selected"} /><p className="sm:col-span-2 text-sm text-text-secondary">Class placement can only be changed by an administrator or teacher.</p></div>}
        </section>}
      </div>
    </main>
  );
}

function ReadOnlyDetail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-[var(--border)] bg-surface-0 px-3 py-3"><p className="text-xs font-bold uppercase tracking-[0.1em] text-text-secondary">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}
