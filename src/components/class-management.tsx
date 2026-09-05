"use client";

import { useState } from "react";
import { StudentResultSummary } from "@/components/student-result-summary";
import { supabaseRequest } from "@/lib/supabase";

type ClassRow = { id: string; name: string };
type Option = { id: string; class_id: string; code: string; form_teacher_id: string | null; is_active: boolean };
type User = { id: string; name: string; role: string; teacher_approval_status?: string | null };
type Student = { id: string; user_id: string; class_id: string | null; class_option_id: string | null; User?: { name: string; email?: string } | null };

export function ClassManagement({
  classes,
  options,
  users,
  onOptionsChange,
  onStatus,
  allowSectionSettings = true,
  readOnly = false,
}: {
  classes: ClassRow[];
  options: Option[];
  users: User[];
  onOptionsChange: (value: Option[]) => void;
  onStatus: (value: string) => void;
  allowSectionSettings?: boolean;
  readOnly?: boolean;
}) {
  const [classId, setClassId] = useState("");
  const [optionId, setOptionId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [resultStudent, setResultStudent] = useState<Student | null>(null);
  const selected = options.find((option) => option.id === optionId);
  const visibleOptions = readOnly ? options.filter((option) => option.form_teacher_id) : options;
  const classOptions = visibleOptions.filter((option) => option.class_id === classId).sort((a, b) => a.code.localeCompare(b.code));
  const visibleClassIds = new Set(visibleOptions.map((option) => option.class_id));
  const sortedClasses = classes.filter((item) => visibleClassIds.has(item.id)).sort((a, b) => a.name.localeCompare(b.name));
  const teachers = users.filter((user) => user.role === "teacher" && user.teacher_approval_status === "approved").sort((a, b) => a.name.localeCompare(b.name));
  const filtered = students
    .filter((student) => `${student.User?.name ?? ""} ${student.User?.email ?? ""}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (a.User?.name ?? "").localeCompare(b.User?.name ?? ""));

  async function open(option: Option) {
    setOptionId(option.id);
    setResultStudent(null);
    setQuery("");
    try {
      setStudents(await supabaseRequest<Student[]>("Student?select=id,user_id,class_id,class_option_id,User(name,email)&order=user_id") ?? []);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Roster could not load.");
    }
  }

  async function patch(id: string, changes: Partial<Option>) {
    try {
      await supabaseRequest(`ClassOption?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(changes) });
      onOptionsChange(options.map((option) => option.id === id ? { ...option, ...changes } : option));
      onStatus("Section settings saved.");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Section update failed.");
    }
  }

  async function move(student: Student, target: string | null) {
    try {
      const targetOption = target ? options.find((option) => option.id === target) : null;
      await supabaseRequest(`Student?id=eq.${student.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ class_id: targetOption?.class_id ?? undefined, class_option_id: target }),
      });
      setStudents((current) => current.map((item) => item.id === student.id ? { ...item, class_option_id: target } : item));
      onStatus(target ? "Student added." : "Student removed.");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Roster update failed.");
    }
  }

  const roster = filtered.filter((student) => student.class_option_id === optionId);
  const available = filtered.filter((student) => student.class_option_id !== optionId);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-surface-1 p-4 sm:p-5">
        <label className="block max-w-xs text-sm font-semibold">
          Class
          <select value={classId} onChange={(event) => { setClassId(event.target.value); setOptionId(""); setResultStudent(null); }} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3">
            <option value="">Choose JSS1–SSS3</option>
            {sortedClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        {classId && <>
          <div className="mt-5 flex items-center justify-between"><div><p className="text-sm font-semibold">Sections</p><p className="text-xs text-text-secondary">{classOptions.filter((option) => option.is_active).length} of 4 open</p></div></div>
          <div className="mt-3 grid grid-cols-4 gap-2">{classOptions.map((option) => <button type="button" key={option.id} onClick={() => void open(option)} className={`rounded-lg border p-3 text-center ${optionId === option.id ? "border-accent bg-surface-2" : "border-[var(--border)] bg-surface-0"} ${!option.is_active ? "opacity-45" : ""}`}><span className="block text-xl font-bold">{option.code}</span><span className="text-[10px] uppercase text-text-secondary">{option.is_active ? "Open" : "Closed"}</span></button>)}</div>
          {allowSectionSettings && <div className="mt-4 flex flex-wrap gap-2">{classOptions.map((option) => <button type="button" key={option.id} onClick={() => void patch(option.id, { is_active: !option.is_active })} className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold">{option.is_active ? `Close ${option.code}` : `Open ${option.code}`}</button>)}</div>}
        </>}
      </div>
      {selected?.is_active && <div className="rounded-xl border border-[var(--border)] bg-surface-1 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Section detail</p><h3 className="font-display mt-1 text-2xl font-semibold">{classes.find((item) => item.id === selected.class_id)?.name} · {selected.code}</h3><p className="mt-1 text-sm text-text-secondary">{roster.length} students assigned</p></div>{allowSectionSettings && <label className="w-full text-sm font-semibold sm:w-64">Form teacher<select value={selected.form_teacher_id ?? ""} onChange={(event) => void patch(selected.id, { form_teacher_id: event.target.value || null })} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3"><option value="">Unassigned</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label>}</div>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students" className="mt-5 min-h-11 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3" />
        <div className={`mt-5 grid gap-6 ${readOnly ? "" : "lg:grid-cols-2"}`}>
          <Roster title={readOnly ? "Students" : "In this section"} rows={roster} action="Remove" onAction={(student) => void move(student, null)} onSelect={setResultStudent} showAction={!readOnly} />
          {!readOnly && <Roster title="Available students" rows={available} action="Add" onAction={(student) => void move(student, selected.id)} onSelect={setResultStudent} showAction />}
        </div>
      </div>}
      {resultStudent && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={`${resultStudent.User?.name ?? "Student"} performance`}><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-surface-0 shadow-xl"><div className="sticky top-0 flex items-center justify-between border-b border-[var(--border)] bg-surface-0 px-4 py-3"><p className="font-semibold">Individual performance</p><button type="button" onClick={() => setResultStudent(null)} className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold">Close</button></div><div className="p-4"><StudentResultSummary studentId={resultStudent.id} studentName={resultStudent.User?.name} /></div></div></div>}
    </section>
  );
}

function Roster({ title, rows, action, onAction, onSelect, showAction }: { title: string; rows: Student[]; action: string; onAction: (student: Student) => void; onSelect: (student: Student) => void; showAction: boolean }) {
  return <div><h4 className="text-xs font-bold uppercase tracking-[0.12em] text-text-secondary">{title}</h4><div className="mt-2 max-h-72 divide-y divide-[var(--border)] overflow-y-auto border-y border-[var(--border)]">{rows.map((student) => <div key={student.id} className="flex items-center justify-between gap-3 py-3"><button type="button" onClick={() => onSelect(student)} className="min-w-0 text-left"><p className="truncate text-sm font-semibold">{student.User?.name ?? "Unnamed student"}</p><p className="truncate text-xs text-text-secondary">{student.User?.email ?? ""}</p></button>{showAction && <button type="button" onClick={() => onAction(student)} className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold">{action}</button>}</div>)}{!rows.length && <p className="py-5 text-sm text-text-secondary">No matching students.</p>}</div></div>;
}
