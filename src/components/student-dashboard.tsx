"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { StudentResultSummary } from "@/components/student-result-summary";

type Student = {
  id: string;
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
  onChooseClass,
  onChooseSection,
  selectedClass,
  selectedSection,
  setSelectedClass,
  setSelectedSection,
  onProfileSave,
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
  onChooseClass: () => void;
  onChooseSection: () => void;
  selectedClass: string;
  selectedSection: string;
  setSelectedClass: (value: string) => void;
  setSelectedSection: (value: string) => void;
  onProfileSave: (name: string) => void;
  onSignOut: () => void;
  status: string;
}) {
  const [panel, setPanel] = useState<"profile" | "guardian" | "results" | "class" | null>(null);
  const [name, setName] = useState(profile.name);
  const className = classes.find((item) => item.id === student.class_id);
  const section = sections.find((item) => item.id === student.class_option_id);

  return (
    <main className="paper-grid min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl border border-[var(--border)] bg-surface-1 p-5 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Student profile</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="font-display text-3xl font-semibold sm:text-4xl">Welcome, {profile.name}</h1>
              <p className="mt-2 text-sm text-text-secondary">{profile.email}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs uppercase tracking-[0.12em] text-text-secondary">Class</p>
              <p className="mt-1 font-semibold">{className ? `${className.name} · ${className.grade_level}` : "Not selected"}</p>
              <p className="text-sm text-text-secondary">{section ? `Section ${section.code}` : "Section not selected"}</p>
            </div>
          </div>
        </header>

        {status && <p role="status" className="rounded-lg border border-[var(--border)] bg-surface-2 p-3 text-sm">{status}</p>}

        <section className="grid gap-4 sm:grid-cols-3">
          <button type="button" onClick={() => setPanel("results")} className="text-left"><Card className="h-full transition hover:bg-surface-2"><p className="text-xs font-bold uppercase tracking-[0.12em] text-text-secondary">Academic</p><h2 className="mt-2 font-display text-xl font-semibold">Assessment record</h2><p className="mt-1 text-sm text-text-secondary">View scores, totals, and averages.</p></Card></button>
          <button type="button" onClick={() => setPanel("class")} className="text-left"><Card className="h-full transition hover:bg-surface-2"><p className="text-xs font-bold uppercase tracking-[0.12em] text-text-secondary">Placement</p><h2 className="mt-2 font-display text-xl font-semibold">Class details</h2><p className="mt-1 text-sm text-text-secondary">Review your class and section.</p></Card></button>
          <button type="button" onClick={() => setPanel("profile")} className="text-left"><Card className="h-full transition hover:bg-surface-2"><p className="text-xs font-bold uppercase tracking-[0.12em] text-text-secondary">Account</p><h2 className="mt-2 font-display text-xl font-semibold">Edit profile</h2><p className="mt-1 text-sm text-text-secondary">Update your display name.</p></Card></button>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-surface-1 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Options</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setPanel("guardian")} className="min-h-11 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold">Guardian info</button>
            <button type="button" onClick={() => setPanel("results")} className="min-h-11 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold">Results</button>
            <button type="button" onClick={onSignOut} className="min-h-11 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold">Sign out</button>
          </div>
        </section>

        {panel && <section className="rounded-xl border border-[var(--border)] bg-surface-1 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3"><h2 className="font-display text-2xl font-semibold">{panel === "profile" ? "Edit profile" : panel === "guardian" ? "Guardian info" : panel === "results" ? "Assessment record" : "Class details"}</h2><button type="button" onClick={() => setPanel(null)} className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold">Close</button></div>
          {panel === "profile" && <div className="mt-5 max-w-lg space-y-3"><label className="block text-sm font-semibold">Name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3" /></label><button type="button" onClick={() => onProfileSave(name)} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-[var(--accent-contrast)]">Save profile</button></div>}
          {panel === "guardian" && <div className="mt-5 max-w-lg space-y-3">{(["name", "relationship", "phone", "email"] as const).map((key) => <input key={key} value={guardian[key]} onChange={(event) => onGuardianChange({ ...guardian, [key]: event.target.value })} placeholder={key === "email" ? "Email (optional)" : key[0].toUpperCase() + key.slice(1)} className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3" />)}<button type="button" onClick={onSaveGuardian} className="min-h-11 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold">Save guardian</button></div>}
          {panel === "results" && <div className="mt-5"><StudentResultSummary studentId={student.id} studentName={profile.name} /></div>}
          {panel === "class" && <div className="mt-5 max-w-lg space-y-4"><p className="text-sm text-text-secondary">Current placement: {className?.name ?? "No class"}{section ? ` · Section ${section.code}` : ""}</p>{!student.class_locked && <><select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)} className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3"><option value="">Select class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.grade_level}</option>)}</select><button type="button" onClick={onChooseClass} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-[var(--accent-contrast)]">Save class</button></>}{student.class_locked && !student.class_option_id && <><select value={selectedSection} onChange={(event) => setSelectedSection(event.target.value)} className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3"><option value="">Select section</option>{sections.map((item) => <option key={item.id} value={item.id}>Section {item.code}</option>)}</select><button type="button" onClick={onChooseSection} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-[var(--accent-contrast)]">Save section</button></>}</div>}
        </section>}
      </div>
    </main>
  );
}
