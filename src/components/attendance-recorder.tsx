"use client";

import { useCallback, useEffect, useState } from "react";
import { useIsHydrated } from "@/lib/use-is-hydrated";
import { supabaseRequest } from "@/lib/supabase";
import { queueMutation, syncPendingMutations } from "@/lib/offline-queue";
import {
  ATTENDANCE_SAVE_HEADERS,
  buildAttendanceDayQuery,
  buildAttendanceSavePath,
} from "@/lib/queries/attendance";
import { useToast } from "@/components/toast";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui";

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

type Status = "present" | "absent" | "late";

const SAVE_PATH = buildAttendanceSavePath();
const SAVE_HEADERS = ATTENDANCE_SAVE_HEADERS;

export function AttendanceRecorder({
  classOptionId,
  className,
}: {
  classOptionId: string;
  className: string;
}) {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const mounted = useIsHydrated();

  // Derived from the hydrated clock so SSR and the first client render agree.
  const today = mounted ? new Date().toISOString().slice(0, 10) : "";
  const longDate = mounted
    ? new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
    : "";

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

        // `today` is empty until the hydration gate opens. Interpolating that
        // produced `date=eq.`, which Postgres rejects as an invalid date
        // (SQLSTATE 22007) and which surfaced as a "Could not load attendance"
        // toast on every page load. buildAttendanceDayQuery returns null
        // instead of a broken query, so the fetch is skipped and retried by
        // the effect re-run once the real date arrives.
        const dayQuery = buildAttendanceDayQuery(today);
        if (!dayQuery) {
          if (!cancelled) setLoading(false);
          return;
        }
        const existing = await supabaseRequest<AttendanceRecord[]>(dayQuery);
        if (cancelled) return;
        const map: Record<string, Status> = {};
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

  // Track connectivity so the teacher gets honest feedback instead of a
  // save button that silently fails on a dead connection.
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Drain anything left queued by a previous offline session on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { getPendingMutations } = await import("@/lib/offline-queue");
        const pending = await getPendingMutations();
        if (cancelled) return;
        setPendingSync(pending.length);
        if (pending.length > 0 && navigator.onLine) {
          const result = await syncPendingMutations(() => {});
          if (cancelled) return;
          setPendingSync(result.failed);
          if (result.synced > 0) {
            toast(`Synced ${result.synced} saved change${result.synced === 1 ? "" : "s"}`, "success");
          }
        }
      } catch {
        // IndexedDB unavailable (private mode): offline queueing is a
        // best-effort enhancement, so a failure here is not surfaced.
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  const setStatus = useCallback((studentId: string, status: Status) => {
    setRecords((current) => ({ ...current, [studentId]: status }));
  }, []);

  async function saveAll() {
    const entries = Object.entries(records);
    if (!entries.length || saving) return;
    setSaving(true);

    // Offline: persist to IndexedDB and let the sync effect drain it later,
    // rather than losing a register the teacher just filled in.
    if (!navigator.onLine) {
      try {
        await Promise.all(
          entries.map(([studentId, status]) =>
            queueMutation({
              table: "AttendanceRecord",
              method: "POST",
              path: SAVE_PATH,
              body: JSON.stringify({ student_id: studentId, date: today, status }),
              headers: SAVE_HEADERS,
            }),
          ),
        );
        setPendingSync((count) => count + entries.length);
        toast(`Saved offline. ${entries.length} record${entries.length === 1 ? "" : "s"} will sync automatically.`, "info");
      } catch {
        toast("Could not store attendance offline. Reconnect and try again.", "error");
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      await Promise.all(
        entries.map(([studentId, status]) =>
          supabaseRequest(SAVE_PATH, {
            method: "POST",
            headers: SAVE_HEADERS,
            body: JSON.stringify({ student_id: studentId, date: today, status }),
          }),
        ),
      );
      toast(`Attendance saved for ${entries.length} student${entries.length === 1 ? "" : "s"}`, "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save attendance", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="animate-pulse space-y-3"><div className="h-12 rounded-lg bg-surface-2" /><div className="h-12 rounded-lg bg-surface-2" /><div className="h-12 rounded-lg bg-surface-2" /></div>;

  if (!students.length) {
    return <EmptyState icon="check" title="No students in this section" description="Students will appear here once they are assigned to this class section." />;
  }

  const present = Object.values(records).filter((s) => s === "present").length;
  const absent = Object.values(records).filter((s) => s === "absent").length;
  const late = Object.values(records).filter((s) => s === "late").length;
  const marked = Object.keys(records).length;
  const unmarked = students.length - marked;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold">Attendance — {className}</h3>
          <p className="text-sm text-text-secondary">{longDate}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-success">{present} present</span>
          <span className="text-danger">{absent} absent</span>
          <span className="text-text-secondary">{late} late</span>
          {unmarked > 0 && <span className="text-text-secondary">{unmarked} unmarked</span>}
        </div>
      </div>

      {!online && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--warning)_45%,var(--border))] bg-warning/10 px-3 py-2 text-sm text-warning"
        >
          You are offline. Marks are stored on this device and sent automatically when the connection returns.
        </p>
      )}
      {online && pendingSync > 0 && (
        <p role="status" className="rounded-lg border border-[var(--border)] bg-surface-1 px-3 py-2 text-sm text-text-secondary">
          {pendingSync} saved change{pendingSync === 1 ? "" : "s"} still waiting to sync.
        </p>
      )}

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

      <Button
        type="button"
        onClick={() => void saveAll()}
        disabled={saving || !marked}
        className="w-full sm:w-auto"
      >
        {saving ? "Saving…" : `Save attendance (${marked} marked)`}
      </Button>
    </section>
  );
}
