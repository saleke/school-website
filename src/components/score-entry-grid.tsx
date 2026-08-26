"use client";
import { useEffect, useState } from "react";
import { supabaseRequest } from "@/lib/supabase";
type Student = { id: string; user_id: string; name?: string };
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
  useEffect(() => { void (async () => { try { const scores = await supabaseRequest<{ student_id: string; assessment_type_id: string; raw_score: number }[]>(`Score?subject_id=eq.${encodeURIComponent(subjectId)}&term_id=eq.${encodeURIComponent(termId)}&select=student_id,assessment_type_id,raw_score`); const next: Record<string, string> = {}; (scores ?? []).forEach(score => { next[`${score.student_id}:${score.assessment_type_id}`] = String(score.raw_score); }); setValues(next); } catch { /* empty grid is valid for a new term */ } })(); }, [subjectId, termId]);
  async function save(studentId: string, assessment: Assessment, raw: string) { const value = Number(raw); if (raw === "") return; if (!Number.isFinite(value) || value < 0 || value > assessment.max_score) { setMessage(`${assessment.name} must be between 0 and ${assessment.max_score}.`); return; } try { await supabaseRequest("Score", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ student_id: studentId, subject_id: subjectId, term_id: termId, assessment_type_id: assessment.id, raw_score: value, recorded_by: sessionStorage.getItem("school_user_id") }) }); setMessage("Score saved."); } catch (error) { setMessage(error instanceof Error ? error.message : "Score could not be saved."); } }
  return <section className="overflow-hidden border-y border-[var(--border)]"><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-[var(--border)] bg-surface-1"><th className="p-3 font-semibold">Student</th>{orderedAssessments.map(item => <th key={item.id} className="p-3 font-semibold">{item.name}<span className="block text-xs font-normal text-text-secondary">/{item.max_score}</span></th>)}</tr></thead><tbody>{students.map(student => <tr key={student.id} className="border-b border-[var(--border)]"><td className="p-3 font-semibold">{student.name ?? student.user_id}</td>{orderedAssessments.map(item => { const key = `${student.id}:${item.id}`; return <td key={item.id} className="p-2"><input type="number" min={0} max={item.max_score} inputMode="decimal" value={values[key] ?? ""} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} onBlur={event => void save(student.id, item, event.target.value)} className="min-h-11 w-20 rounded-lg border border-[var(--border)] bg-surface-0 px-2" aria-label={`${student.name ?? "Student"} ${item.name}`} /></td>; })}</tr>)}</tbody></table></div>{message && <p role="status" className="border-t border-[var(--border)] bg-surface-2 px-3 py-2 text-sm">{message}</p>}</section>;
}
