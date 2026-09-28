"use client";

import { useEffect, useState } from "react";
import { supabaseRequest } from "@/lib/supabase";
import { useToast } from "@/components/toast";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";
import { StudentResultSummary } from "@/components/student-result-summary";
import { AssignmentBoard } from "@/components/assignment-board";
import { AnnouncementFeed } from "@/components/announcement-feed";
import { Avatar, Badge, Button, Card } from "@/components/ui";

type Student = {
  id: string;
  user_id: string;
  admission_no?: string | null;
  class_id: string | null;
  class_option_id: string | null;
  class_locked: boolean;
};

type Schedule = { id: string; subject_id: string; day_of_week: number; start_time: string; end_time: string; Subject?: { name: string } | null };

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const tabs = [
  { id: "today" as const, label: "Today", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> },
  { id: "results" as const, label: "Results", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/></svg> },
  { id: "assignments" as const, label: "Assignments", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
  { id: "announcements" as const, label: "News", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg> },
];

export function StudentTodayDashboard({
  profile,
  student,
  classOption,
  onSignOut,
}: {
  profile: { name: string; email: string; id: string };
  student: Student;
  classOption: { id: string; code: string } | null;
  onSignOut: () => void;
}) {
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"today" | "results" | "assignments" | "announcements">("today");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const today = mounted ? new Date().getDay() : 0;
  const todaySchedules = schedules
    .filter((s) => s.day_of_week === today)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const nextClass = mounted ? todaySchedules.find((s) => {
    const now = new Date();
    const [hours, minutes] = s.end_time.split(":").map(Number);
    const end = new Date();
    end.setHours(hours, minutes, 0, 0);
    return end > now;
  }) : undefined;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!student.class_id) {
          if (!cancelled) setLoading(false);
          return;
        }
        const rows = await supabaseRequest<Schedule[]>(
          `TeachingSchedule?class_id=eq.${student.class_id}&select=id,subject_id,day_of_week,start_time,end_time,Subject(name)&order=day_of_week,start_time`,
        );
        if (!cancelled) setSchedules(rows ?? []);
      } catch (error) {
        if (!cancelled) toast(error instanceof Error ? error.message : "Could not load schedule", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [student.class_id, toast]);

  return (
    <main className="paper-grid min-h-screen px-4 pb-20 pt-6 sm:px-6 sm:pt-10 lg:pb-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Header */}
        <header className="surface-glass accent-edge sticky top-3 z-30 rounded-2xl border border-white/10 p-4 shadow-[0_16px_40px_rgba(0,0,0,.2)] backdrop-blur-xl sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar name={profile.name} size="lg" />
              <div>
                <p className="accent-kicker">Student portal</p>
                <h1 className="font-display mt-1 text-2xl font-semibold sm:text-3xl">
                  {mounted ? (new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening") : "Welcome"}, {profile.name}
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                  {mounted ? new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : ""}
                  {student.admission_no ? ` · Admission No. ${student.admission_no}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {classOption && (
                <div className="rounded-xl border border-[var(--border)] bg-surface-0/80 px-4 py-2 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-secondary">Section</p>
                  <p className="text-sm font-semibold">{classOption.code}</p>
                </div>
              )}
              <Button variant="ghost" onClick={onSignOut}>Sign out</Button>
            </div>
          </div>
        </header>

        {/* Tab navigation */}
        <nav className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-surface-1 p-1" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition ${
                activeTab === tab.id ? "bg-surface-2 text-text-primary shadow-sm" : "text-text-secondary hover:bg-surface-2/50"
              }`}
            >
              <span aria-hidden="true">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        {activeTab === "today" && (
          <div className="space-y-6">
            {/* Next class card */}
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : nextClass ? (
              <div className="rounded-2xl border border-[color-mix(in_srgb,var(--accent-light)_35%,var(--border))] bg-surface-1 p-5 shadow-[var(--shadow)] animate-fade-in">
                <p className="accent-kicker">Up next</p>
                <h2 className="font-display mt-2 text-2xl font-semibold">{nextClass.Subject?.name ?? "Class"}</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  {nextClass.start_time} – {nextClass.end_time} · {dayNames[nextClass.day_of_week]}
                </p>
              </div>
            ) : todaySchedules.length > 0 ? (
              <div className="rounded-2xl border border-[var(--border)] bg-surface-1 p-5 animate-fade-in">
                <p className="accent-kicker">Today</p>
                <h2 className="font-display mt-2 text-2xl font-semibold">No more classes today</h2>
                <p className="mt-1 text-sm text-text-secondary">You&apos;re done for the day. Check your results or assignments.</p>
              </div>
            ) : (
              <EmptyState icon="Today" title="No classes scheduled" description="Your timetable will appear once your class is assigned." />
            )}

            {/* Today's schedule */}
            {todaySchedules.length > 0 && (
              <section>
                <h3 className="font-display text-lg font-semibold">Today&apos;s schedule</h3>
                <div className="mt-3 space-y-2">
                  {todaySchedules.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-surface-1 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">{s.Subject?.name ?? "Subject"}</p>
                        <p className="text-xs text-text-secondary">{s.start_time} – {s.end_time}</p>
                      </div>
                      {nextClass?.id === s.id && (
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">Next</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === "results" && <StudentResultSummary studentId={student.id} studentName={profile.name} />}
        {activeTab === "assignments" && <AssignmentBoard studentId={student.id} classId={student.class_id} classOptionId={student.class_option_id} role="student" />}
        {activeTab === "announcements" && <AnnouncementFeed userId={profile.id} role="student" />}
      </div>
    </main>
  );
}
