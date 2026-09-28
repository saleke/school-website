"use client";

import { useEffect, useState } from "react";
import { supabaseRequest } from "@/lib/supabase";
import { useToast } from "@/components/toast";
import { EmptyState } from "@/components/empty-state";

type Assignment = {
  id: string;
  title: string;
  description: string;
  subject_id: string;
  class_id: string;
  class_option_id: string | null;
  teacher_id: string;
  due_date: string;
  max_score: number;
  created_at: string;
  Subject?: { name: string } | null;
  User?: { name: string } | null;
};

export function AssignmentBoard({
  studentId,
  classId,
  classOptionId,
  role,
  teacherId,
  refreshKey,
}: {
  studentId?: string;
  classId: string | null;
  classOptionId: string | null;
  role: string;
  teacherId?: string;
  refreshKey?: number;
}) {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const select = "select=id,title,description,subject_id,class_id,class_option_id,teacher_id,due_date,max_score,created_at,Subject(name),User(name)&order=due_date.desc&limit=20";
        let query: string;
        if (role === "student" && classId) {
          query = `Assignment?class_id=eq.${classId}&${select}`;
        } else if (role === "teacher" && teacherId) {
          query = `Assignment?teacher_id=eq.${teacherId}&${select}`;
        } else {
          query = `Assignment?${select}`;
        }
        const rows = await supabaseRequest<Assignment[]>(query);
        if (!cancelled) setAssignments(rows ?? []);
      } catch (error) {
        if (!cancelled) toast(error instanceof Error ? error.message : "Could not load assignments", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [role, classId, teacherId, refreshKey, toast]);

  if (loading) return <div className="animate-pulse space-y-3"><div className="h-20 rounded-lg bg-surface-2" /><div className="h-20 rounded-lg bg-surface-2" /></div>;

  if (!assignments.length) {
    return <EmptyState icon="Assignments" title="No assignments yet" description="Assignments will appear here when teachers post them." />;
  }

  return (
    <section className="space-y-4">
      <h3 className="font-display text-xl font-semibold">Assignments</h3>
      <div className="space-y-3">
        {assignments.map((a) => {
          const isOverdue = mounted && new Date(a.due_date) < new Date();
          return (
            <article key={a.id} className="rounded-xl border border-[var(--border)] bg-surface-1 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold">{a.title}</h4>
                  <p className="mt-1 text-sm text-text-secondary">{a.description}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  isOverdue ? "border-[color-mix(in_srgb,var(--danger)_45%,var(--border))] text-danger" : "border-[var(--border)] text-text-secondary"
                }`}>
                  {isOverdue ? "Overdue" : "Active"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                <span>{a.Subject?.name ?? "Subject"}</span>
                <span>Due {mounted ? new Date(a.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}</span>
                <span>Max {a.max_score} marks</span>
                <span>By {a.User?.name ?? "Teacher"}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
