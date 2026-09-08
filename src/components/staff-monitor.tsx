"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseRequest } from "@/lib/supabase";
import { TimetableOverview } from "@/components/timetable-overview";
type Teacher = {
  id: string;
  name: string;
  teacher_approval_status: "pending" | "approved" | "rejected" | null;
};
type Row = {
  id: string;
  teacher_id: string;
  class_id: string;
  class_option_id?: string | null;
  subject_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};
type Named = { id: string; name: string; class_id?: string };
type Option = {
  id: string;
  class_id: string;
  code: string;
  form_teacher_id: string | null;
  is_active: boolean;
};
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const gradeOrder = new Map([
  ["JSS1", 1],
  ["JSS2", 2],
  ["JSS3", 3],
  ["SSS1", 4],
  ["SSS2", 5],
  ["SSS3", 6],
]);

function compareClassOptions(
  a: Option,
  b: Option,
  classes: Named[],
) {
  const className = (id: string) =>
    classes.find((item) => item.id === id)?.name.trim().toUpperCase() ?? "";
  const gradeA = gradeOrder.get(className(a.class_id)) ?? Number.MAX_SAFE_INTEGER;
  const gradeB = gradeOrder.get(className(b.class_id)) ?? Number.MAX_SAFE_INTEGER;

  if (gradeA !== gradeB) return gradeA - gradeB;

  const classComparison = className(a.class_id).localeCompare(className(b.class_id));
  if (classComparison !== 0) return classComparison;

  return a.code.localeCompare(b.code, undefined, { numeric: true });
}

export function StaffMonitor({
  teachers,
  schedules,
  subjects,
  classes,
  options,
  onOptionsChange,
  onSchedulesChange,
  onStatus,
}: {
  teachers: Teacher[];
  schedules: Row[];
  subjects: Named[];
  classes: Named[];
  options: Option[];
  onOptionsChange: (v: Option[]) => void;
  onSchedulesChange: (v: Row[]) => void;
  onStatus: (v: string) => void;
}) {
  const [view, setView] = useState<"people" | "schedule" | "forms">("people");
  const [edit, setEdit] = useState<Row | null>(null);
  const [form, setForm] = useState({
    teacher_id: "",
    class_id: "",
    class_option_id: "",
    subject_id: "",
    day: "1",
    start: "08:00",
    end: "09:00",
  });
  const [loadedSubjects, setLoadedSubjects] = useState<Named[]>([]);
  const [loadedOptions, setLoadedOptions] = useState<Option[]>([]);
  const scheduleOptions = useMemo(
    () =>
      Array.from(
        new Map(
          [...options, ...loadedOptions].map((option) => [option.id, option]),
        ).values(),
      ),
    [loadedOptions, options],
  );
  useEffect(() => {
    if (view !== "schedule") return;
    const needSections = options.length === 0 && loadedOptions.length === 0;
    const needSubjects = subjects.length === 0 && loadedSubjects.length === 0;
    if (!needSections && !needSubjects) return;
    void (async () => {
      try {
        const [loadedSections, loadedSubjects] = await Promise.all([
          !needSections
            ? Promise.resolve(options)
            : supabaseRequest<Option[]>("ClassOption?is_active=eq.true&select=id,class_id,code,form_teacher_id,is_active&order=class_id,code"),
          !needSubjects
            ? Promise.resolve(subjects)
            : supabaseRequest<Named[]>("Subject?select=id,name,class_id&order=name"),
        ]);
        if (needSections && loadedSections) {
          const uniqueSections = Array.from(new Map(loadedSections.map((option) => [option.id, option])).values());
          setLoadedOptions(uniqueSections);
          onOptionsChange(uniqueSections);
        }
        if (needSubjects) setLoadedSubjects(loadedSubjects ?? []);
      } catch (error) {
        onStatus(error instanceof Error ? error.message : "Schedule options could not be loaded.");
      }
    })();
  }, [loadedOptions.length, loadedSubjects.length, onOptionsChange, onStatus, options, subjects, view]);
  const approved = teachers
    .filter((t) => t.teacher_approval_status === "approved")
    .sort((a, b) => a.name.localeCompare(b.name));
  const sortedClasses = [...classes].sort((a, b) => a.name.localeCompare(b.name));
  const classSubjects = Array.from(
    new Map(
      (loadedSubjects.length ? loadedSubjects : subjects)
        .filter((subject) => subject.id && subject.class_id === form.class_id)
        .map((subject) => [subject.id, subject]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));
    const sortedScheduleOptions = [...scheduleOptions]
      .filter((option) => option.class_id === form.class_id && option.is_active)
      .sort((a, b) => a.code.localeCompare(b.code));
  async function save() {
    if (
      !form.teacher_id ||
      !form.class_id ||
      !form.class_option_id ||
      !form.subject_id
    ) {
      onStatus("Choose teacher, class, section, and subject.");
      return;
    }
    try {
      const body = {
        teacher_id: form.teacher_id,
        class_id: form.class_id,
        class_option_id: form.class_option_id,
        subject_id: form.subject_id,
        day_of_week: Number(form.day),
        start_time: form.start,
        end_time: form.end,
      };
      const rows = await supabaseRequest<Row[]>(
        edit ? `TeachingSchedule?id=eq.${edit.id}` : "TeachingSchedule",
        {
          method: edit ? "PATCH" : "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(body),
        },
      );
      if (rows?.[0])
        onSchedulesChange(
          edit
            ? schedules.map((s) => (s.id === edit.id ? rows[0] : s))
            : [...schedules, rows[0]],
        );
      setEdit(null);
      onStatus(
        edit ? "Teaching schedule updated." : "Teaching schedule created.",
      );
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Schedule could not be saved.");
    }
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this teaching schedule?")) return;
    try {
      await supabaseRequest(`TeachingSchedule?id=eq.${id}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      onSchedulesChange(schedules.filter((s) => s.id !== id));
      onStatus("Teaching schedule deleted.");
    } catch (e) {
      onStatus(
        e instanceof Error ? e.message : "Schedule could not be deleted.",
      );
    }
  }
  async function assign(o: Option, teacher: string) {
    try {
      await supabaseRequest(`ClassOption?id=eq.${o.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ form_teacher_id: teacher || null }),
      });
      const updated = scheduleOptions.map((x) =>
        x.id === o.id ? { ...x, form_teacher_id: teacher || null } : x,
      );
      setLoadedOptions(updated);
      onOptionsChange(updated);
      onStatus("Form teacher assignment saved.");
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Assignment failed.");
    }
  }
  async function chooseClass(classId: string) {
    setForm((current) => ({ ...current, class_id: classId, class_option_id: "", subject_id: "" }));
    if (!classId) return;
    try {
      const [loadedSections, loadedSubjects] = await Promise.all([
        supabaseRequest<Option[]>(`ClassOption?class_id=eq.${encodeURIComponent(classId)}&is_active=eq.true&select=id,class_id,code,form_teacher_id,is_active&order=code`),
        supabaseRequest<Named[]>(`Subject?class_id=eq.${encodeURIComponent(classId)}&select=id,name,class_id&order=name`),
      ]);
      const uniqueSections = Array.from(new Map((loadedSections ?? []).map((option) => [option.id, option])).values());
      setLoadedOptions(uniqueSections);
      onOptionsChange(Array.from(new Map([...options, ...uniqueSections].map((option) => [option.id, option])).values()));
      setLoadedSubjects(loadedSubjects ?? []);
      if (!uniqueSections.length && !(loadedSubjects ?? []).length) {
        onStatus("No active sections or subjects are configured for this class.");
      } else if (!uniqueSections.length) {
        onStatus("No active sections are configured for this class.");
      } else if (!(loadedSubjects ?? []).length) {
        onStatus("No subjects are configured for this class.");
      } else {
        onStatus("");
      }
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Class sections and subjects could not be loaded.");
    }
  }
  const set = (key: string, value: string) =>
    setForm((x) => ({ ...x, [key]: value }));
  return (
    <div className="space-y-5">
      <nav className="grid grid-cols-3 rounded-xl border border-[var(--border)] bg-surface-1 p-1">
        {(
          [
            ["people", "Overview"],
            ["schedule", "Teaching schedule"],
            ["forms", "Form teachers"],
          ] as const
        ).map(([id, label]) => (
          <button
            type="button"
            key={id}
            onClick={() => setView(id)}
            className={`min-h-11 rounded-lg px-2 text-xs font-semibold sm:text-sm ${view === id ? "bg-surface-0 shadow-sm" : "text-text-secondary"}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {view === "people" && (
        <TimetableOverview
          schedules={schedules}
          teachers={teachers}
          classes={classes}
          subjects={subjects}
          options={options}
        />
      )}{" "}
      {view === "schedule" && (
        <>
          <div className="grid gap-3 rounded-xl border border-[var(--border)] bg-surface-1 p-4 sm:grid-cols-2">
            <select
              value={form.teacher_id}
              onChange={(e) => set("teacher_id", e.target.value)}
              className="min-h-11 rounded-lg border border-[var(--border)] bg-surface-0 px-3"
            >
              <option value="">Teacher</option>
              {approved.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              value={form.class_id}
              onChange={(e) => void chooseClass(e.target.value)}
              className="min-h-11 rounded-lg border border-[var(--border)] bg-surface-0 px-3"
            >
              <option value="">Class</option>
              {sortedClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={form.class_option_id}
              onChange={(e) => set("class_option_id", e.target.value)}
              className="min-h-11 rounded-lg border border-[var(--border)] bg-surface-0 px-3"
            >
              <option value="">Section</option>
              {sortedScheduleOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    Section {o.code}
                  </option>
                ))}
            </select>
            <select
              value={form.subject_id}
              onChange={(e) => set("subject_id", e.target.value)}
              className="min-h-11 rounded-lg border border-[var(--border)] bg-surface-0 px-3"
            >
              <option value="">Subject</option>
              {classSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
              ))}
            </select>
            <select
              value={form.day}
              onChange={(e) => set("day", e.target.value)}
              className="min-h-11 rounded-lg border border-[var(--border)] bg-surface-0 px-3"
            >
              {days.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={form.start}
              onChange={(e) => set("start", e.target.value)}
              className="min-h-11 rounded-lg border border-[var(--border)] bg-surface-0 px-3"
            />
            <input
              type="time"
              value={form.end}
              onChange={(e) => set("end", e.target.value)}
              className="min-h-11 rounded-lg border border-[var(--border)] bg-surface-0 px-3"
            />
            <div className="flex gap-2 sm:col-span-2">
              <button
                type="button"
                onClick={() => void save()}
                className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-[var(--accent-contrast)]"
              >
                {edit ? "Save changes" : "Add teaching slot"}
              </button>
              {edit && (
                <button
                  type="button"
                  onClick={() => setEdit(null)}
                  className="min-h-11 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
          <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {schedules.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold">
                    {teachers.find((t) => t.id === s.teacher_id)?.name ??
                      "Teacher"}{" "}
                    ·{" "}
                    {classes.find((c) => c.id === s.class_id)?.name ?? "Class"}{" "}
                    · Section{" "}
                    {options.find((o) => o.id === s.class_option_id)?.code ??
                      ""}
                  </p>
                  <p className="text-text-secondary">
                    {subjects.find((x) => x.id === s.subject_id)?.name ??
                      "Subject"}{" "}
                    · {days[s.day_of_week]} {s.start_time}–{s.end_time}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEdit(s);
                      setForm({
                        teacher_id: s.teacher_id,
                        class_id: s.class_id,
                        class_option_id: s.class_option_id ?? "",
                        subject_id: s.subject_id,
                        day: String(s.day_of_week),
                        start: s.start_time,
                        end: s.end_time,
                      });
                    }}
                    className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(s.id)}
                    className="min-h-10 rounded-lg border border-[var(--danger)] px-3 text-xs font-semibold text-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {view === "forms" && (
        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {[...scheduleOptions]
            .filter((o) => o.is_active)
            .sort((a, b) => compareClassOptions(a, b, classes))
            .map((o) => (
              <div
                key={o.id}
                className="grid gap-2 py-4 sm:grid-cols-[1fr_220px] sm:items-center"
              >
                <div>
                  <p className="font-semibold">
                    {classes.find((c) => c.id === o.class_id)?.name} · Section{" "}
                    {o.code}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {o.form_teacher_id
                      ? teachers.find((t) => t.id === o.form_teacher_id)?.name
                      : "Unassigned"}
                  </p>
                </div>
                <select
                  value={o.form_teacher_id ?? ""}
                  onChange={(e) => void assign(o, e.target.value)}
                  className="min-h-11 rounded-lg border border-[var(--border)] bg-surface-0 px-3"
                >
                  <option value="">Unassigned</option>
                  {approved.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
