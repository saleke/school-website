"use client";
import { useEffect, useRef, useState } from "react";
import { supabaseRequest } from "@/lib/supabase";
import { SubjectManagement } from "@/components/subject-management";
import { AccountDirectory } from "@/components/account-directory";
import { StaffMonitor } from "@/components/staff-monitor";
import { ClassManagement } from "@/components/class-management";
import { AcademicCalendar } from "@/components/academic-calendar";
import { AccountSettings } from "@/components/account-settings";
import { ProfileOptionsConsole } from "@/components/profile-options-console";
type Tab =
  "pulse" | "attention" | "classes" | "staff" | "resources" | "settings";
type User = {
  id: string;
  name: string;
  email: string;
  role: "student" | "teacher" | "admin" | "alumni";
  is_librarian: boolean;
  teacher_approval_status: "pending" | "approved" | "rejected" | null;
};
type Named = {
  id: string;
  name: string;
  grade_level?: string;
  max_capacity?: number | null;
  class_id?: string;
  teacher_id?: string;
  subject_id?: string;
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  is_form_teacher?: boolean;
};
type ClassOption = {
  id: string;
  class_id: string;
  code: string;
  form_teacher_id: string | null;
  is_active: boolean;
};
type SessionRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
};
type TermRow = {
  id: string;
  session_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};
type Application = {
  id: string;
  applicant_name: string;
  source: string;
  stage: "applied" | "interviewed" | "accepted" | "enrolled" | "rejected";
  created_at: string;
};
const tabs: { id: Tab; label: string }[] = [
  { id: "pulse", label: "Overview" },
  { id: "attention", label: "Attention" },
  { id: "classes", label: "Classes" },
  { id: "staff", label: "Staff" },
  { id: "resources", label: "Resources" },
  { id: "settings", label: "Settings" },
];
const tabDescriptions: Record<Tab, string> = {
  pulse: "A quick read of the school platform today.",
  attention: "Items that need a decision or follow-up.",
  classes: "Manage class sections, rosters, and subjects.",
  staff: "Review schedules and form-teacher assignments.",
  resources: "Manage accounts and access privileges.",
  settings: "Set academic sessions, terms, and timing.",
};
function tabIcon(id: Tab) {
  if (id === "pulse") return "⌂";
  if (id === "attention") return "!";
  if (id === "classes") return "▦";
  if (id === "staff") return "◌";
  if (id === "resources") return "▤";
  return "⚙";
}
export function AdminDashboard({
  name,
  email,
  onSignOut,
}: {
  name: string;
  email: string;
  onSignOut: () => void;
}) {
  const [tab, setTab] = useState<Tab>("pulse");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<Named[]>([]);
  const [options, setOptions] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<Named[]>([]);
  const [schedules, setSchedules] = useState<Named[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [status, setStatus] = useState("Syncing data");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const primaryTabs = tabs.slice(0, 4);
  const secondaryTabs = tabs.slice(4);
  useEffect(() => {
    if (settingsOpen) {
      settingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [settingsOpen]);
  useEffect(() => {
    void (async () => {
      try {
        const requests = await Promise.allSettled([
          supabaseRequest<User[]>(
            "User?select=id,name,email,role,is_librarian,teacher_approval_status&order=name",
          ),
          supabaseRequest<Named[]>(
            "Class?select=id,name,grade_level,max_capacity&order=grade_level,name",
          ),
          supabaseRequest<ClassOption[]>(
            "ClassOption?select=id,class_id,code,form_teacher_id,is_active&order=class_id,code",
          ),
          supabaseRequest<Named[]>(
            "Subject?select=id,name,class_id&order=name",
          ),
          supabaseRequest<Named[]>(
            "TeachingSchedule?select=id,teacher_id,class_id,class_option_id,subject_id,day_of_week,start_time,end_time,is_form_teacher&order=day_of_week,start_time",
          ),
          supabaseRequest<SessionRow[]>(
            "Session?select=id,name,start_date,end_date&order=start_date.desc",
          ),
          supabaseRequest<TermRow[]>(
            "Term?select=id,session_id,name,start_date,end_date,is_active&order=start_date.desc",
          ),
          supabaseRequest<Application[]>(
            "AdmissionApplication?select=id,applicant_name,source,stage,created_at&order=created_at.desc",
          ),
        ]);
        const value = <T,>(index: number, fallback: T): T => {
          const result = requests[index];
          return result.status === "fulfilled" && result.value ? (result.value as T) : fallback;
        };
        setUsers(value<User[]>(0, []));
        setClasses(value<Named[]>(1, []));
        setOptions(value<ClassOption[]>(2, []));
        setSubjects(value<Named[]>(3, []));
        setSessions(value<SessionRow[]>(5, []));
        setTerms(value<TermRow[]>(6, []));
        setSchedules(value<Named[]>(4, []));
        setApplications(value<Application[]>(7, []));
        const failures = requests.filter((request) => request.status === "rejected");
        setStatus(failures.length ? "Some dashboard data could not be loaded. Refresh to retry." : "");
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : "Dashboard could not sync.",
        );
      }
    })();
  }, []);
  useEffect(() => {
    if (!moreOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [moreOpen]);
  const teachers = users.filter((u) => u.role === "teacher");
  const pending = teachers.filter(
    (u) => u.teacher_approval_status === "pending",
  );
  const freshApps = applications.filter((a) => a.stage === "applied");
  async function updateUser(id: string, changes: Partial<User>) {
    try {
      await supabaseRequest(`User?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(changes),
      });
      setUsers((items) =>
        items.map((item) => (item.id === id ? { ...item, ...changes } : item)),
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Account update failed.",
      );
    }
  }
  async function updateApp(id: string, stage: Application["stage"]) {
    try {
      await supabaseRequest(
        `AdmissionApplication?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ stage, updated_at: new Date().toISOString() }),
        },
      );
      setApplications((items) =>
        items.map((item) => (item.id === id ? { ...item, stage } : item)),
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Application update failed.",
      );
    }
  }
  return (
    <main className="min-h-screen bg-surface-0 pb-[calc(9rem+env(safe-area-inset-bottom))] lg:pb-0">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-surface-0/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-accent text-lg font-bold text-[var(--accent-contrast)]">S</div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em]">School Platform</p>
              <p className="text-xs text-text-secondary">{name} · Owner command center</p>
            </div>
          </div>
        </div>
      </header>
      <ProfileOptionsConsole options={[{ label: "Account settings", onSelect: () => setSettingsOpen(true) }, { label: "Sign out", onSelect: onSignOut, destructive: true }]} />
      {settingsOpen && <div ref={settingsRef} className="scroll-mt-6 mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8"><div className="mb-3"><button type="button" onClick={() => setSettingsOpen(false)} className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold">Close settings</button></div><AccountSettings name={name} email={email} role="Administrator" /></div>}
      <div className="mx-auto grid max-w-7xl lg:grid-cols-[220px_minmax(0,1fr)_260px]">
        <aside className="hidden border-r border-[var(--border)] p-5 lg:block">
          <nav className="space-y-1">
            {tabs.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setTab(item.id)}
                aria-current={tab === item.id ? "page" : undefined}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl border-l-2 px-3 text-left text-sm font-semibold ${tab === item.id ? "border-accent bg-surface-1 text-text-primary" : "border-transparent text-text-secondary hover:bg-surface-1"}`}
              >
                <span className={`grid size-8 place-items-center rounded-lg text-sm ${tab === item.id ? "bg-surface-2 text-accent" : "bg-surface-1"}`} aria-hidden="true">{tabIcon(item.id)}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
        <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Admin command center</p>
          <h1 className="font-display mt-1 text-3xl font-semibold sm:text-4xl">
            {tab === "pulse"
              ? "Overview"
              : tab === "attention"
                ? "Attention"
                : tab === "classes"
                  ? "Classes"
                  : tab === "staff"
                    ? "Staff"
                    : tab === "resources"
                      ? "Resources"
                      : "Settings"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">{tabDescriptions[tab]}</p>
          </div>
          {tab === "pulse" && <span className="rounded-full border border-[var(--border)] bg-surface-1 px-3 py-1 text-xs font-semibold text-text-secondary">{new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
          </div>
          {tab === "pulse" && (
            <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Students", users.filter((u) => u.role === "student").length],
                ["Teachers", teachers.length],
                ["Applications", freshApps.length],
                ["Classes", classes.length],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-2xl border border-[var(--border)] bg-surface-1 p-4 shadow-[var(--shadow)]"
                >
                  <div className="flex items-start justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[0.1em] text-text-secondary">
                    {label}
                  </p><span className="text-text-secondary/70" aria-hidden="true">{label === "Students" ? "●" : label === "Teachers" ? "◆" : label === "Applications" ? "✦" : "▦"}</span></div>
                  <p className="mt-3 text-3xl font-bold">{value}</p>
                </div>
              ))}
            </div>
          )}
          {tab === "attention" && (
            <div className="mt-6 space-y-3">
              <div className="rounded-2xl border border-[var(--border)] bg-surface-1 p-4"><p className="text-sm font-semibold">{pending.length + freshApps.length ? `${pending.length + freshApps.length} item${pending.length + freshApps.length === 1 ? "" : "s"} need attention` : "Everything is up to date"}</p><p className="mt-1 text-sm text-text-secondary">Review these items and keep the school moving.</p></div>
              {pending.map((user) => (
                <article
                  key={user.id}
                  className="border-l-4 border-[var(--danger)] bg-surface-1 p-4"
                >
                  <p className="font-semibold">Teacher approval pending</p>
                  <p className="text-sm text-text-secondary">{user.name}</p>
                  <button
                    onClick={() =>
                      void updateUser(user.id, {
                        teacher_approval_status: "approved",
                      })
                    }
                    className="mt-3 min-h-11 text-sm font-semibold text-accent"
                  >
                    Approve
                  </button>
                </article>
              ))}
              {freshApps.map((app) => (
                <article
                  key={app.id}
                  className="border-l-4 border-[var(--border)] bg-surface-1 p-4"
                >
                  <p className="font-semibold">New admission application</p>
                  <p className="text-sm text-text-secondary">
                    {app.applicant_name} · {app.source}
                  </p>
                  <button
                    onClick={() => void updateApp(app.id, "interviewed")}
                    className="mt-3 min-h-11 text-sm font-semibold text-accent"
                  >
                    Mark interviewed
                  </button>
                </article>
              ))}
              {!pending.length && !freshApps.length && (
                <p className="py-10 text-center text-text-secondary">
                  No urgent actions.
                </p>
              )}
            </div>
          )}
          {tab === "staff" && (
            <div className="mt-6">
              <StaffMonitor
                teachers={teachers}
                schedules={schedules as never[]}
                subjects={subjects as never[]}
                classes={classes as never[]}
                options={options}
                onOptionsChange={setOptions}
                onSchedulesChange={setSchedules as never}
                onStatus={setStatus}
              />
            </div>
          )}
          {tab === "classes" && (
            <div className="mt-6 space-y-8">
              <ClassManagement
                classes={classes}
                options={options}
                users={users}
                onOptionsChange={setOptions}
                onStatus={setStatus}
              />
              <SubjectManagement
                classes={classes as never[]}
                subjects={subjects as never[]}
                schedules={schedules as never[]}
                onSubjectsChange={(value) => setSubjects(value)}
                onStatus={setStatus}
              />
            </div>
          )}
          {tab === "settings" && (
            <div className="mt-6">
              <AcademicCalendar
                sessions={sessions}
                terms={terms}
                onSessionsChange={setSessions}
                onTermsChange={setTerms}
                onStatus={setStatus}
              />
            </div>
          )}
          {tab === "resources" && (
            <div className="mt-6">
              <AccountDirectory
                users={users}
                onUpdate={(id, changes) => void updateUser(id, changes)}
              />
            </div>
          )}
        </section>
        <aside className="hidden border-l border-[var(--border)] p-5 lg:block">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">
            Open queue
          </p>
          <p className="mt-3 text-4xl font-bold">
            {pending.length + freshApps.length}
          </p>
          <p className="mt-1 text-sm text-text-secondary">Pending decisions</p>
          <button
            onClick={() => setTab("attention")}
            className="mt-5 min-h-11 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold text-accent hover:bg-surface-1"
          >
            Open attention
          </button>
        </aside>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden" aria-label="Main navigation">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1 rounded-2xl border border-[var(--border)] bg-surface-0/95 p-2 shadow-[var(--shadow)] backdrop-blur">
          {primaryTabs.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => { setTab(item.id); setMoreOpen(false); }}
              aria-current={tab === item.id ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center rounded-xl px-1 text-[11px] font-bold leading-tight ${tab === item.id ? "bg-surface-2 text-accent" : "text-text-secondary hover:bg-surface-1"}`}
            >
              <span aria-hidden="true" className="mb-1 text-base">{tabIcon(item.id)}</span>
              <span>{item.id === "pulse" ? "Home" : item.label}</span>
            </button>
          ))}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen(value => !value)}
              aria-expanded={moreOpen}
              className={`flex min-h-14 w-full flex-col items-center justify-center rounded-xl px-1 text-[11px] font-bold leading-tight ${moreOpen || secondaryTabs.some(item => item.id === tab) ? "bg-surface-2 text-accent" : "text-text-secondary hover:bg-surface-1"}`}
            >
              <span aria-hidden="true" className="mb-1 text-base">⋯</span>
              <span>More</span>
            </button>
          </div>
        </div>
      </nav>
      {moreOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/25 lg:hidden"
          role="presentation"
          onMouseDown={event => { if (event.target === event.currentTarget) setMoreOpen(false); }}
        >
          <section className="absolute inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] mx-auto max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-surface-0/95 shadow-[var(--shadow)] backdrop-blur-xl" role="dialog" aria-modal="true" aria-label="More admin sections">
            <div className="flex items-start justify-between border-b border-[var(--border)] bg-surface-1/75 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">More sections</p>
                <p className="mt-1 text-sm text-text-secondary">Open less-frequent admin tools.</p>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close more sections" className="grid size-9 place-items-center rounded-full border border-[var(--border)] text-lg hover:bg-surface-2">×</button>
            </div>
            <div className="grid gap-2 p-3">
              {secondaryTabs.map(item => <button type="button" key={item.id} onClick={() => { setTab(item.id); setMoreOpen(false); }} className={`flex min-h-14 items-center gap-3 rounded-xl px-4 text-left font-semibold ${tab === item.id ? "bg-surface-2 text-accent" : "hover:bg-surface-1"}`}><span className="grid size-9 place-items-center rounded-lg bg-surface-2 text-lg" aria-hidden="true">{item.id === "resources" ? "▤" : "⚙"}</span><span><span className="block">{item.label}</span><span className="mt-0.5 block text-xs font-normal text-text-secondary">{item.id === "resources" ? "Accounts and school resources" : "Academic calendar and terms"}</span></span><span className="ml-auto text-lg text-text-secondary" aria-hidden="true">›</span></button>)}
            </div>
          </section>
        </div>
      )}
      {status && (
        <p className="fixed bottom-16 left-1/2 z-50 -translate-x-1/2 bg-surface-2 px-3 py-1 text-xs lg:bottom-3">
          {status}
        </p>
      )}
    </main>
  );
}
