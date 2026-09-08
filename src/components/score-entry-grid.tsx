"use client";
import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import { supabaseRequest } from "@/lib/supabase";
type Student = { id: string; user_id: string; name?: string; User?: { name?: string } | null };
type Assessment = { id: string; name: string; max_score: number };
const assessmentOrder = ["note", "assignment", "test", "exam"];
function sortAssessments(items: Assessment[]) {
  return [...items].sort((a, b) => {
    const ai = assessmentOrder.indexOf(a.name.trim().toLowerCase());
    const bi = assessmentOrder.indexOf(b.name.trim().toLowerCase());
    // Keep the four standard columns first; preserve a deterministic order for any future types.
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}
export function ScoreEntryGrid({ students, assessments, termId, subjectId }: { students: Student[]; assessments: Assessment[]; termId: string; subjectId: string }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const orderedAssessments = sortAssessments(assessments);
  const studentName = (student: Student) => student.name ?? student.User?.name ?? student.user_id;
  const orderedStudents = [...students].sort((a, b) => studentName(a).localeCompare(studentName(b)));
  useEffect(() => {
    if (!subjectId || !termId || !students.length) return;
    let cancelled = false;
    void (async () => {
      try {
        type ScoreRow = { student_id: string; assessment_type_id: string; raw_score: number };
        const studentIds = students.map((student) => student.id).join(",");
        let scores = await supabaseRequest<ScoreRow[]>(
          `Score?subject_id=eq.${encodeURIComponent(subjectId)}&term_id=eq.${encodeURIComponent(termId)}&student_id=in.(${studentIds})&select=student_id,assessment_type_id,raw_score`,
        );
        if (!scores?.length) {
          const rows = await Promise.all(
            students.map((student) =>
              supabaseRequest<ScoreRow[]>(
                `Score?student_id=eq.${encodeURIComponent(student.id)}&subject_id=eq.${encodeURIComponent(subjectId)}&term_id=eq.${encodeURIComponent(termId)}&select=student_id,assessment_type_id,raw_score`,
              ),
            ),
          );
          scores = rows.flat();
        }
        if (cancelled) return;
        const next: Record<string, string> = {};
        (scores ?? []).forEach((score) => {
          next[`${score.student_id}:${score.assessment_type_id}`] = String(score.raw_score);
        });
        setValues(next);
        setMessage("");
      } catch (error) {
        if (!cancelled) {
          setValues({});
          setMessage(error instanceof Error ? error.message : "Previously saved scores could not be loaded.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [students, subjectId, termId]);
  async function save(studentId: string, assessment: Assessment, raw: string) {
    const key = `${studentId}:${assessment.id}`;
    const value = Number(raw);
    if (raw === "") return;
    if (!Number.isFinite(value) || value < 0 || value > assessment.max_score) {
      setMessage(`${assessment.name} must be between 0 and ${assessment.max_score}.`);
      return;
    }
    setSaving(current => new Set(current).add(key));
    setSaved(current => { const next = new Set(current); next.delete(key); return next; });
    try {
      await supabaseRequest("Score?on_conflict=student_id,subject_id,term_id,assessment_type_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ student_id: studentId, subject_id: subjectId, term_id: termId, assessment_type_id: assessment.id, raw_score: value, recorded_by: sessionStorage.getItem("school_user_id") }) });
      setSaved(current => new Set(current).add(key));
      setMessage("All changes saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Score could not be saved.");
    } finally {
      setSaving(current => { const next = new Set(current); next.delete(key); return next; });
    }
  }
  function moveCell(event: KeyboardEvent<HTMLInputElement>, row: number, column: number) {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const nextRow = Math.max(0, Math.min(orderedStudents.length - 1, row + (event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0)));
    const nextColumn = Math.max(0, Math.min(orderedAssessments.length - 1, column + (event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0)));
    document.querySelector<HTMLInputElement>(`[data-score-cell="${nextRow}:${nextColumn}"]`)?.focus();
  }
  function exportCsv() {
    const rows = [
      ["Student", ...orderedAssessments.map(item => item.name)],
      ...orderedStudents.map(student => [
        studentName(student),
        ...orderedAssessments.map(item => values[`${student.id}:${item.id}`] ?? ""),
      ]),
    ];
    const csv = rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `${subjectId}-scores.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  return <section className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-surface-1 shadow-[var(--shadow)]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4"><div><p className="text-sm font-semibold">Assessment grid</p><p className="mt-1 text-xs text-text-secondary">{orderedStudents.length} students · {orderedAssessments.length} assessment columns · autosaves on blur</p></div><button type="button" onClick={exportCsv} disabled={!orderedStudents.length} className="min-h-10 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 text-xs font-semibold hover:bg-surface-2 disabled:opacity-40">Export spreadsheet</button></div><div className="overflow-x-auto">{orderedStudents.length ? <table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-[var(--border)] bg-surface-2/60"><th className="sticky left-0 z-10 bg-surface-2 p-3 font-semibold">Student</th>{orderedAssessments.map(item => <th key={item.id} className="p-3 font-semibold">{item.name}<span className="block text-xs font-normal text-text-secondary">out of {item.max_score}</span></th>)}</tr></thead><tbody>{orderedStudents.map((student, row) => <tr key={student.id} className="border-b border-[var(--border)] last:border-b-0"><td className="sticky left-0 z-10 bg-surface-1 p-3 font-semibold">{studentName(student)}</td>{orderedAssessments.map((item, column) => { const key = `${student.id}:${item.id}`; const isSaving = saving.has(key); const isSaved = saved.has(key); return <td key={item.id} className="p-2"><div className="relative"><input data-score-cell={`${row}:${column}`} type="number" min={0} max={item.max_score} inputMode="decimal" value={values[key] ?? ""} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} onBlur={event => void save(student.id, item, event.target.value)} onKeyDown={event => moveCell(event, row, column)} className={`min-h-11 w-24 rounded-[var(--radius-sm)] border bg-surface-0 px-3 pr-8 outline-none transition focus:border-[var(--accent-light)] ${isSaving ? "border-[var(--accent-light)]" : isSaved ? "border-[color-mix(in_srgb,var(--success)_55%,var(--border))]" : "border-[var(--border)]"}`} aria-label={`${studentName(student)} ${item.name}`} />{(isSaving || isSaved) && <span className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs ${isSaving ? "text-[var(--accent-light)]" : "text-success"}`} aria-hidden="true">{isSaving ? "…" : "✓"}</span>}</div></td>; })}</tr>)}</tbody></table> : <p className="p-5 text-sm text-text-secondary">No students were found in this section.</p>}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-surface-2/40 px-4 py-3"><p className="text-xs text-text-secondary">Tip: use the arrow keys to move between cells.</p>{message && <p role="status" className="text-sm font-semibold">{message}</p>}</div></section>;
}
