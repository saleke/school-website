"use client";

import { useEffect, useState } from "react";
import { supabaseRequest } from "@/lib/supabase";
import { useToast } from "@/components/toast";
import { EmptyState } from "@/components/empty-state";

type Student = {
  id: string;
  user_id: string;
  class_option_id: string | null;
  User?: { name: string; email?: string } | null;
};

type AttendanceRecord = {
  id: string;
  student_id: string;
  date: string;
  status: "present" | "absent" | "late";
  synced_at: string | null;
};

export function AttendanceRecorder({
  classOptionId,
  className,
}: {
  classOptionId: string;
  className: string;
}) {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Record<string, "present" | "absent" | "late">>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const today = mounted ? new Date().toISOString().split("T")[0] : "";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const roster = await supabaseRequest<Student[]>(
          "rpc/get_form_teacher_roster",
          { method: "POST", body: JSON.stringify({ target_class_option_id: classOptionId }) },
        );
        if (cancelled) return;
        setStudents(roster ?? []);

        const existing = await supabaseRequest<AttendanceRecord[]>(
          `AttendanceRecord?date=eq.${today}&select=student_id,status,synced_at`,
        );
        if (cancelled) return;
        const map: Record<string, "present" | "absent" | "late"> = {};
        (existing ?? []).forEach((r) => { map[r.student_id] = r.status; });
        setRecords(map);
      } catch (error) {
        if (!cancelled) toast(error instanceof Error ? error.message : "Could not load attendance", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [classOptionId, today, toast]);

  function setStatus(studentId: string, status: "present" | "absent" | "late") {
    setRecords((current) => ({ ...current, [studentId]: status }));
  }

  async function saveAll() {
    setSaving(true);
    try {
      const entries = Object.entries(records);
      await Promise.all(
        entries.map(([studentId, status]) =>
          supabaseRequest("AttendanceRecord?on_conflict=student_id,date", {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify({ student_id: studentId, date: today, status }),
          }),
        ),
      );
      toast(`Attendance saved for ${entries.length} students`, "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save attendance", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="animate-pulse space-y-3"><div className="h-12 rounded-lg bg-surface-2" /><div className="h-12 rounded-lg bg-surface-2" /><div className="h-12 rounded-lg bg-surface-2" /></div>;

  if (!students.length) {
    return <EmptyState icon="Attendance" title="No students in this section" description="Students will appear here once they are assigned to this class section." />;
  }

  const present = Object.values(records).filter((s) => s === "present").length;
  const absent = Object.values(records).filter((s) => s === "absent").length;
  const late = Object.values(records).filter((s) => s === "late").length;
  const unmarked = students.length - Object.keys(records).length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold">Attendance — {className}</h3>
          <p className="text-sm text-text-secondary">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-success">{present} present</span>
          <span className="text-danger">{absent} absent</span>
          <span className="text-text-secondary">{late} late</span>
          {unmarked > 0 && <span className="text-text-secondary">{unmarked} unmarked</span>}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)]">
        <div className="max-h-96 divide-y divide-[var(--border)] overflow-y-auto">
          {students.map((student) => {
            const status = records[student.id];
            return (
              <div key={student.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{student.User?.name ?? "Student"}</p>
                  <p className="truncate text-xs text-text-secondary">{student.User?.email ?? ""}</p>
                </div>
                <div className="flex gap-1" role="radiogroup" aria-label={`Attendance for ${student.User?.name ?? "student"}`}>
                  {(["present", "absent", "late"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={status === s}
                      onClick={() => setStatus(student.id, s)}
                      className={`min-h-10 rounded-lg px-3 text-xs font-semibold capitalize transition ${
                        status === s
                          ? s === "present"
                            ? "bg-success/20 text-success border border-[color-mix(in_srgb,var(--success)_45%,var(--border))]"
                            : s === "absent"
                              ? "bg-danger/20 text-danger border border-[color-mix(in_srgb,var(--danger)_45%,var(--border))]"
                              : "bg-accent/20 text-accent border border-[color-mix(in_srgb,var(--accent)_45%,var(--border))]"
                          : "border border-[var(--border)] text-text-secondary hover:bg-surface-2"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void saveAll()}
        disabled={saving || !Object.keys(records).length}
        className="min-h-11 rounded-lg bg-accent px-5 text-sm font-semibold text-[var(--accent-contrast)] disabled:opacity-40"
      >
        {saving ? "Saving..." : `Save attendance (${Object.keys(records).length} marked)`}
      </button>
    </section>
  );
}
