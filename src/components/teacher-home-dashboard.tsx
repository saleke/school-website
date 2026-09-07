"use client";

import { useEffect, useRef, useState } from "react";
import { AccountSettings } from "@/components/account-settings";
import { TimetableOverview } from "@/components/timetable-overview";
import { ProfileOptionsConsole } from "@/components/profile-options-console";

type Schedule = { id: string; class_id: string; class_option_id?: string | null; subject_id: string; day_of_week: number; start_time: string; end_time: string; Class?: { name: string } | null; Subject?: { name: string } | null };
type Named = { id: string; name: string };
type Option = { id: string; class_id: string; code: string; form_teacher_id: string | null; is_active: boolean };
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function currentWeekday() {
  return new Date().getDay();
}

export function TeacherHomeDashboard({ name, email, schedules, classes, subjects, options, onRecordAssessment, onSignOut }: { name: string; email: string; schedules: Schedule[]; classes: Named[]; subjects: Named[]; options: Option[]; onRecordAssessment: () => void; onSignOut: () => void }) {
  const [day, setDay] = useState(currentWeekday);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const today = schedules.filter(s => s.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const selectedSchedule = today.find(item => item.id === selectedScheduleId) ?? today[0];
  const owned = options.filter(o => o.form_teacher_id && o.is_active);
  const subjectNames = Array.from(new Set(schedules.map(s => s.Subject?.name ?? subjects.find(x => x.id === s.subject_id)?.name).filter(Boolean))) as string[];
  const subtitle = subjectNames.length > 3 ? `${subjectNames.slice(0, 3).join(", ")} +${subjectNames.length - 3} more` : subjectNames.join(", ");

  useEffect(() => {
    if (settingsOpen) {
      settingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [settingsOpen]);
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const timeout = window.setTimeout(() => setDay(currentWeekday()), nextMidnight.getTime() - now.getTime());
    return () => window.clearTimeout(timeout);
  }, []);

  return <main className="min-h-screen bg-surface-0 px-4 py-6 sm:px-6 sm:py-10"><div className="mx-auto max-w-6xl space-y-8">
    <header className="surface-glass accent-edge sticky top-3 z-30 rounded-[var(--radius-lg)] border border-white/10 p-5 shadow-[0_16px_40px_rgba(0,0,0,.2)] backdrop-blur-xl sm:p-7"><div><p className="accent-kicker">Teacher home</p><h1 className="font-display mt-3 text-3xl font-semibold sm:text-4xl">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {name}</h1><p className="mt-2 text-sm text-text-secondary">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}{subtitle ? ` · ${subtitle}` : ""}</p></div></header>
    <ProfileOptionsConsole options={[{ label: "Record assessment", onSelect: onRecordAssessment }, { label: "Account settings", onSelect: () => setSettingsOpen(true) }, { label: "Sign out", onSelect: onSignOut, destructive: true }]} />
    {settingsOpen && <div ref={settingsRef} className="scroll-mt-6 space-y-3"><button type="button" onClick={() => setSettingsOpen(false)} className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold">Close settings</button><AccountSettings name={name} email={email} role="Teacher" /></div>}
    {owned.length > 0 && <section><p className="accent-kicker">Form teacher</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{owned.map(o => <div key={o.id} className="rounded-xl border border-[var(--border)] bg-surface-1 p-4"><p className="font-semibold">{classes.find(c => c.id === o.class_id)?.name ?? "Class"} · Section {o.code}</p><p className="mt-1 text-sm text-text-secondary">Form-teacher responsibilities</p></div>)}</div></section>}
    <section><div className="flex items-end justify-between gap-3"><div><p className="accent-kicker">Today</p><h2 className="font-display mt-2 text-2xl font-semibold">Your classes</h2></div><select value={day} onChange={e => { setDay(Number(e.target.value)); setSelectedScheduleId(null); }} className="min-h-10 w-auto max-w-[10rem] rounded-lg border border-[var(--border)] bg-surface-0 px-3 text-sm">{dayNames.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>{today.length ? <><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{today.map(s => <button type="button" key={s.id} onClick={() => setSelectedScheduleId(s.id)} className={`group rounded-xl border p-4 text-left transition hover:-translate-y-0.5 ${selectedSchedule?.id === s.id ? "border-[color-mix(in_srgb,var(--accent-light)_48%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface-1))] shadow-[0_14px_30px_color-mix(in_srgb,var(--accent)_12%,transparent)]" : "border-[var(--border)] bg-surface-1 hover:border-[color-mix(in_srgb,var(--accent-light)_35%,var(--border))]"}`}><span className={`mb-3 block h-1 rounded-full transition-all ${selectedSchedule?.id === s.id ? "w-14 bg-[var(--accent-light)]" : "w-7 bg-[var(--border)] group-hover:w-11 group-hover:bg-[var(--accent-light)]"}`} aria-hidden="true" /><p className="text-xs font-bold text-text-secondary">{s.start_time}–{s.end_time}</p><h3 className="mt-2 font-semibold">{s.Class?.name ?? classes.find(c => c.id === s.class_id)?.name ?? "Class"}{s.class_option_id ? ` · Section ${options.find(o => o.id === s.class_option_id)?.code ?? ""}` : ""}</h3><p className="mt-1 text-sm text-text-secondary">{s.Subject?.name ?? subjects.find(x => x.id === s.subject_id)?.name ?? "Subject"}</p></button>)}</div><div className="mt-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-surface-1 p-5"><p className="accent-kicker">Selected class</p><div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><h3 className="font-display text-xl font-semibold">{selectedSchedule?.Subject?.name ?? subjects.find(x => x.id === selectedSchedule?.subject_id)?.name ?? "Subject"}</h3><p className="mt-1 text-sm text-text-secondary">{selectedSchedule?.Class?.name ?? classes.find(c => c.id === selectedSchedule?.class_id)?.name ?? "Class"} · {selectedSchedule?.start_time}–{selectedSchedule?.end_time}</p></div><button type="button" onClick={onRecordAssessment} className="min-h-10 rounded-[var(--radius-sm)] bg-accent px-4 text-sm font-semibold text-[var(--accent-contrast)] shadow-[0_8px_20px_color-mix(in_srgb,var(--accent)_24%,transparent)] hover:bg-[var(--accent-light)]">Record assessment <span aria-hidden="true">→</span></button></div></div></> : <p className="mt-4 text-sm text-text-secondary">No classes scheduled for {dayNames[day].toLowerCase()}.</p>}</section>
    <TimetableOverview schedules={schedules.map(s => ({ ...s, teacher_id: "self" }))} teachers={[{ id: "self", name }]} classes={classes} subjects={subjects} options={options} />
  </div></main>;
}
