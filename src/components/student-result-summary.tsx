"use client";

import { useEffect, useState } from "react";
import { supabaseRequest } from "@/lib/supabase";

type Snapshot = {
  id: string;
  subject_id: string | null;
  term_id: string;
  weighted_average: number;
  class_position: number | null;
  cohort_size: number | null;
  Subject?: { name: string } | null;
  Term?: { name: string } | null;
};

type ScoreRecord = {
  id: string;
  subject_id: string;
  term_id: string;
  raw_score: number;
  assessment_type_id: string;
  AssessmentType?: { name: string; max_score: number; weight_pct: number } | null;
  Subject?: { name: string } | null;
  Term?: { name: string } | null;
};

type DisplayRow = Snapshot & { records: ScoreRecord[] };

export function StudentResultSummary({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName?: string;
}) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [message, setMessage] = useState("Loading results...");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [snapshotRows, scoreRows] = await Promise.all([
          supabaseRequest<Snapshot[]>(
            `TermResultSnapshot?student_id=eq.${encodeURIComponent(studentId)}&select=id,subject_id,term_id,weighted_average,class_position,cohort_size,Subject(name),Term(name)&order=computed_at.desc`,
          ),
          supabaseRequest<ScoreRecord[]>(
            `Score?student_id=eq.${encodeURIComponent(studentId)}&select=id,subject_id,term_id,raw_score,assessment_type_id,AssessmentType(name,max_score,weight_pct),Subject(name),Term(name)&order=recorded_at.desc`,
          ),
        ]);
        if (!active) return;
        setSnapshots(snapshotRows ?? []);
        setScores(scoreRows ?? []);
        setMessage("");
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Results could not be loaded.");
      }
    })();
    return () => {
      active = false;
    };
  }, [studentId]);

  const groupedScores = new Map<string, ScoreRecord[]>();
  scores.forEach((score) => {
    const key = `${score.term_id}:${score.subject_id}`;
    groupedScores.set(key, [...(groupedScores.get(key) ?? []), score]);
  });

  const snapshotByKey = new Map(
    snapshots
      .filter((snapshot) => snapshot.subject_id)
      .map((snapshot) => [`${snapshot.term_id}:${snapshot.subject_id}`, snapshot]),
  );

  const subjectRows: DisplayRow[] = Array.from(groupedScores.entries()).map(([key, records]) => {
    const [termId, subjectId] = key.split(":");
    const snapshot = snapshotByKey.get(key);
    const weightedAverage = records.reduce((sum, record) => {
      const maximum = Number(record.AssessmentType?.max_score ?? 0);
      const weight = Number(record.AssessmentType?.weight_pct ?? 0);
      return sum + (maximum > 0 ? (Number(record.raw_score) / maximum) * weight : 0);
    }, 0);

    return {
      id: snapshot?.id ?? `live-${key}`,
      subject_id: subjectId,
      term_id: termId,
      weighted_average: snapshot?.weighted_average ?? weightedAverage,
      class_position: snapshot?.class_position ?? null,
      cohort_size: snapshot?.cohort_size ?? null,
      Subject: snapshot?.Subject ?? records[0]?.Subject,
      Term: snapshot?.Term ?? records[0]?.Term,
      records,
    };
  });

  const overallRows: DisplayRow[] = Array.from(new Set(subjectRows.map((row) => row.term_id))).map((termId) => {
    const finalized = snapshots.find((snapshot) => snapshot.term_id === termId && !snapshot.subject_id);
    const subjects = subjectRows.filter((row) => row.term_id === termId);
    return {
      id: finalized?.id ?? `live-overall-${termId}`,
      subject_id: null,
      term_id: termId,
      weighted_average: finalized?.weighted_average ?? (subjects.length ? subjects.reduce((sum, row) => sum + Number(row.weighted_average), 0) / subjects.length : 0),
      class_position: finalized?.class_position ?? null,
      cohort_size: finalized?.cohort_size ?? null,
      Term: finalized?.Term ?? subjects[0]?.Term,
      records: [],
    };
  });

  const displayRows = [...subjectRows, ...overallRows].sort((a, b) => {
    const termOrder = a.term_id.localeCompare(b.term_id);
    if (termOrder !== 0) return termOrder;
    if (!a.subject_id) return 1;
    if (!b.subject_id) return -1;
    return (a.Subject?.name ?? "").localeCompare(b.Subject?.name ?? "");
  });

  return (
    <section className="rounded-xl border border-[var(--border)] bg-surface-1 p-4 sm:p-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Results</p>
        <h3 className="font-display mt-1 text-xl font-semibold">{studentName ?? "Student"}</h3>
      </div>
      {message && <p className="mt-4 text-sm text-text-secondary">{message}</p>}
      {!message && !displayRows.length && <p className="mt-4 text-sm text-text-secondary">No scores have been recorded yet.</p>}
      {!message && displayRows.length > 0 && (
        <div className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {displayRows.map((row) => {
            const total = row.records.reduce((sum, record) => sum + Number(record.raw_score), 0);
            const maximum = row.records.reduce((sum, record) => sum + Number(record.AssessmentType?.max_score ?? 0), 0);
            return (
              <div key={row.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{row.subject_id ? row.Subject?.name ?? "Subject" : "Overall average"}</p>
                    <p className="text-xs text-text-secondary">{row.Term?.name ?? "Term"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{Number(row.weighted_average).toFixed(2)}%</p>
                    {row.class_position && row.cohort_size ? <p className="text-xs text-text-secondary">Position {row.class_position} of {row.cohort_size}</p> : null}
                  </div>
                </div>
                {row.subject_id && (
                  <div className="mt-2 space-y-1 text-xs text-text-secondary">
                    <p>Recorded total: {total} / {maximum || "-"} across {row.records.length} assessment{row.records.length === 1 ? "" : "s"}.</p>
                    <p>{row.records.map((record) => `${record.AssessmentType?.name ?? "Assessment"}: ${record.raw_score}/${record.AssessmentType?.max_score ?? "-"}`).join(" · ")}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
