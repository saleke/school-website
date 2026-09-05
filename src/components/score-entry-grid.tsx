"use client";
import { useEffect, useState } from "react";
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
  const [values, setValues] = useState<Record<string, string>>({}); const [message, setMessage] = useState("");
  const orderedAssessments = sortAssessments(assessments);
  const studentName = (student: Student) => student.name ?? student.User?.name ?? student.user_id;
  const orderedStudents = [...students].sort((a, b) => studentName(a).localeCompare(studentName(b)));
  useEffect(() => { void (async () => { try { const scores = await supabaseRequest<{ student_id: string; assessment_type_id: string; raw_score: number }[]>(`Score?subject_id=eq.${encodeURIComponent(subjectId)}&term_id=eq.${encodeURIComponent(termId)}&select=student_id,assessment_type_id,raw_score`); const next: Record<string, string> = {}; (scores ?? []).forEach(score => { next[`${score.student_id}:${score.assessment_type_id}`] = String(score.raw_score); }); setValues(next); } catch { /* empty grid is valid for a new term */ } })(); }, [subjectId, termId]);
  async function save(studentId: string, assessment: Assessment, raw: string) { const value = Number(raw); if (raw === "") return; if (!Number.isFinite(value) || value < 0 || value > assessment.max_score) { setMessage(`${assessment.name} must be between 0 and ${assessment.max_score}.`); return; } try { await supabaseRequest("Score?on_conflict=student_id,subject_id,term_id,assessment_type_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ student_id: studentId, subject_id: subjectId, term_id: termId, assessment_type_id: assessment.id, raw_score: value, recorded_by: sessionStorage.getItem("school_user_id") }) }); setMessage("Score saved."); } catch (error) { setMessage(error instanceof Error ? error.message : "Score could not be saved."); } }
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
  return <section className="overflow-hidden border-y border-[var(--border)]"><div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-surface-1 p-3"><p className="text-xs text-text-secondary">{orderedStudents.length} students · {orderedAssessments.length} assessment columns</p><button type="button" onClick={exportCsv} disabled={!orderedStudents.length} className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold disabled:opacity-40">Export CSV</button></div><div className="overflow-x-auto">{orderedStudents.length ? <table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-[var(--border)] bg-surface-1"><th className="p-3 font-semibold">Student</th>{orderedAssessments.map(item => <th key={item.id} className="p-3 font-semibold">{item.name}<span className="block text-xs font-normal text-text-secondary">/{item.max_score}</span></th>)}</tr></thead><tbody>{orderedStudents.map(student => <tr key={student.id} className="border-b border-[var(--border)]"><td className="p-3 font-semibold">{studentName(student)}</td>{orderedAssessments.map(item => { const key = `${student.id}:${item.id}`; return <td key={item.id} className="p-2"><input type="number" min={0} max={item.max_score} inputMode="decimal" value={values[key] ?? ""} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} onBlur={event => void save(student.id, item, event.target.value)} className="min-h-11 w-20 rounded-lg border border-[var(--border)] bg-surface-0 px-2" aria-label={`${studentName(student)} ${item.name}`} /></td>; })}</tr>)}</tbody></table> : <p className="p-5 text-sm text-text-secondary">No students were found in this section.</p>}</div>{message && <p role="status" className="border-t border-[var(--border)] bg-surface-2 px-3 py-2 text-sm">{message}</p>}</section>;
}
