"use client";

import { useEffect, useState } from "react";
import { useIsHydrated } from "@/lib/use-is-hydrated";
import { supabaseRequest } from "@/lib/supabase";
import { useToast } from "@/components/toast";
import { EmptyState } from "@/components/empty-state";
import { AttendanceRecorder } from "@/components/attendance-recorder";
import { AnnouncementFeed } from "@/components/announcement-feed";
import { AssignmentForm } from "@/components/assignment-form";
import { AssignmentBoard } from "@/components/assignment-board";
import { ScoreEntryGrid } from "@/components/score-entry-grid";
import { Avatar, Button } from "@/components/ui";

type Schedule = {
  id: string;
  class_id: string;
  class_option_id: string | null;
  subject_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_form_teacher: boolean;
  Class?: { name: string } | null;
  Subject?: { name: string } | null;
};

type ClassOption = { id: string; class_id: string; code: string; form_teacher_id: string | null; is_active: boolean };
type Term = { id: string; name: string };
type Student = { id: string; user_id: string; name?: string; User?: { name?: string } | null };
type Assessment = { id: string; name: string; max_score: number };

const tabs = [
  { id: "today" as const, label: "Today", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> },
  { id: "attendance" as const, label: "Attendance", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { id: "assessment" as const, label: "Assessment", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg> },
  { id: "assignments" as const, label: "Assignments", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
  { id: "announcements" as const, label: "News", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg> },
];

export function TeacherTodayDashboard({
  profile,
  schedules,
  classOptions,
  onSignOut,
}: {
  profile: { name: string; email: string; id: string };
  schedules: Schedule[];
  classOptions: ClassOption[];
  onSignOut: () => void;
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"today" | "attendance" | "assessment" | "assignments" | "announcements">("today");
  const [scoreContext, setScoreContext] = useState<{
    termId: string;
    classOptionId: string;
    subjectId: string;
    subjectName: string;
    students: Student[];
    assessments: Assessment[];
  } | null>(null);
  const [loadingScores, setLoadingScores] = useState(false);
  const [subjects, setSubjects] = useState<{ id: string; name: string; class_id: string }[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const mounted = useIsHydrated();

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

  const mySections = classOptions.filter((o) => o.form_teacher_id === profile.id && o.is_active);

  async function startAssessment() {
    if (!mySections.length) {
      toast("No class sections assigned to you", "error");
      return;
    }
    setLoadingScores(true);
    try {
      const terms = await supabaseRequest<Term[]>("Term?is_active=eq.true&select=id,name&limit=1");
      const term = terms?.[0];
      if (!term) {
        toast("No active term", "error");
        return;
      }
      const section = mySections[0];
      const students = await supabaseRequest<Student[]>(
        "rpc/get_form_teacher_roster",
        { method: "POST", body: JSON.stringify({ target_class_option_id: section.id }) },
      );
      const subjectList = await supabaseRequest<{ id: string; name: string }[]>(
        `Subject?class_id=eq.${section.class_id}&select=id,name&order=name`,
      );
      const subject = subjectList?.[0];
      if (!subject) {
        toast("No subjects for this class", "error");
        return;
      }
      const assessments = await supabaseRequest<Assessment[]>(
        `AssessmentType?subject_id=eq.${subject.id}&select=id,name,max_score&order=name`,
      );
      setScoreContext({
        termId: term.id,
        classOptionId: section.id,
        subjectId: subject.id,
        subjectName: subject.name,
        students: students ?? [],
        assessments: assessments ?? [],
      });
      setActiveTab("assessment");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not load assessment", "error");
    } finally {
      setLoadingScores(false);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const rows = await supabaseRequest<{ id: string; name: string; class_id: string }[]>(
          "Subject?select=id,name,class_id&order=name",
        );
        setSubjects(rows ?? []);
      } catch {
        // Silent fail for subjects
      }
    })();
  }, []);

  return (
    <main className="paper-grid min-h-screen px-4 pb-20 pt-6 sm:px-6 sm:pt-10 lg:pb-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Header */}
        <header className="surface-glass accent-edge sticky top-3 z-30 rounded-2xl border border-white/10 p-4 shadow-[0_16px_40px_rgba(0,0,0,.2)] backdrop-blur-xl sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar name={profile.name} size="lg" />
              <div>
                <p className="accent-kicker">Teacher portal</p>
                <h1 className="font-display mt-1 text-2xl font-semibold sm:text-3xl">
                  {mounted ? (new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening") : "Welcome"}, {profile.name}
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                  {mounted ? new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : ""}
                  {mySections.length > 0 ? ` · Form teacher: ${mySections.map((s) => s.code).join(", ")}` : ""}
                </p>
              </div>
            </div>
            <Button variant="ghost" onClick={onSignOut}>Sign out</Button>
          </div>
        </header>

        {/* Tab navigation - horizontal scroll on mobile, grid on desktop */}
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
            {/* Quick actions - direct buttons, not dropdowns */}
            <div className="grid gap-3 sm:grid-cols-2 stagger-children">
              <button
                type="button"
                onClick={() => setActiveTab("attendance")}
                className="group rounded-2xl border border-[var(--border)] bg-surface-1 p-5 text-left transition hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent-light)_35%,var(--border))] animate-slide-up"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-[var(--radius-sm)] bg-surface-2 text-accent-light" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-semibold">Take attendance</h3>
                    <p className="text-sm text-text-secondary">Mark present, absent, or late</p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => void startAssessment()}
                disabled={loadingScores}
                className="group rounded-2xl border border-[var(--border)] bg-surface-1 p-5 text-left transition hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent-light)_35%,var(--border))] disabled:opacity-50 animate-slide-up"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-[var(--radius-sm)] bg-surface-2 text-accent-light" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-semibold">Record assessment</h3>
                    <p className="text-sm text-text-secondary">Enter scores for your class</p>
                  </div>
                </div>
              </button>
            </div>

            {/* Next class */}
            {nextClass ? (
              <div className="rounded-2xl border border-[color-mix(in_srgb,var(--accent-light)_35%,var(--border))] bg-surface-1 p-5 shadow-[var(--shadow)] animate-fade-in">
                <p className="accent-kicker">Teaching next</p>
                <h2 className="font-display mt-2 text-2xl font-semibold">{nextClass.Subject?.name ?? "Class"}</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  {nextClass.Class?.name ?? "Class"} · {nextClass.start_time} – {nextClass.end_time}
                </p>
              </div>
            ) : todaySchedules.length > 0 ? (
              <div className="rounded-2xl border border-[var(--border)] bg-surface-1 p-5 animate-fade-in">
                <p className="accent-kicker">Today</p>
                <h2 className="font-display mt-2 text-2xl font-semibold">No more classes today</h2>
                <p className="mt-1 text-sm text-text-secondary">You&apos;re done teaching for the day.</p>
              </div>
            ) : (
              <EmptyState icon="calendar" title="No classes scheduled today" description="Your teaching schedule will appear here." />
            )}

            {/* Today's schedule */}
            {todaySchedules.length > 0 && (
              <section>
                <h3 className="font-display text-lg font-semibold">Today&apos;s classes</h3>
                <div className="mt-3 space-y-2">
                  {todaySchedules.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-surface-1 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">{s.Subject?.name ?? "Subject"}</p>
                        <p className="text-xs text-text-secondary">{s.Class?.name ?? "Class"} · {s.start_time} – {s.end_time}</p>
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

        {activeTab === "attendance" && (
          <div className="space-y-6">
            {mySections.length > 0 ? (
              mySections.map((section) => (
                <AttendanceRecorder key={section.id} classOptionId={section.id} className={section.code} />
              ))
            ) : (
              <EmptyState icon="check" title="No sections assigned" description="You need to be assigned as a form teacher to take attendance." />
            )}
          </div>
        )}

        {activeTab === "assessment" && (
          <div className="space-y-4">
            {scoreContext ? (
              <ScoreEntryGrid
                key={`${scoreContext.classOptionId}:${scoreContext.subjectId}:${scoreContext.termId}`}
                students={scoreContext.students}
                assessments={scoreContext.assessments}
                termId={scoreContext.termId}
                subjectId={scoreContext.subjectId}
              />
            ) : (
              <EmptyState icon="chart" title="No assessment selected" description="Go to the Today tab and click 'Record assessment' to get started." />
            )}
          </div>
        )}

        {activeTab === "assignments" && (
          <div className="space-y-6">
            <AssignmentForm
              subjects={subjects}
              classOptions={mySections}
              teacherId={profile.id}
              onCreated={() => { toast("Assignment created", "success"); setRefreshKey((k) => k + 1); }}
            />
            <div className="space-y-6">
              <AssignmentBoard classId={null} classOptionId={null} role="teacher" teacherId={profile.id} refreshKey={refreshKey} />
            </div>
          </div>
        )}

        {activeTab === "announcements" && <AnnouncementFeed role="teacher" />}
      </div>
    </main>
  );
}
