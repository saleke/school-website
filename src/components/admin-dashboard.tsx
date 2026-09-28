"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseRequest } from "@/lib/supabase";
import { SubjectManagement } from "@/components/subject-management";
import { AccountDirectory } from "@/components/account-directory";
import { StaffMonitor } from "@/components/staff-monitor";
import { ClassManagement } from "@/components/class-management";
import { AcademicCalendar } from "@/components/academic-calendar";
import { Avatar, Badge, Button, Card, StatCard } from "@/components/ui";
import { DashboardSkeleton } from "@/components/skeleton";
import { useToast } from "@/components/toast";

type Tab = "pulse" | "attention" | "classes" | "staff" | "resources" | "settings";

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

type SessionRow = { id: string; name: string; start_date: string; end_date: string };
type TermRow = { id: string; session_id: string; name: string; start_date: string; end_date: string; is_active: boolean };
type Application = { id: string; applicant_name: string; source: string; stage: "applied" | "interviewed" | "accepted" | "enrolled" | "rejected"; created_at: string };

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "pulse", label: "Overview", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/></svg> },
  { id: "attention", label: "Attention", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg> },
  { id: "classes", label: "Classes", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { id: "staff", label: "Staff", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { id: "resources", label: "Accounts", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { id: "settings", label: "Settings", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
];

const tabDescriptions: Record<Tab, string> = {
  pulse: "A quick read of the school platform today.",
  attention: "Items that need a decision or follow-up.",
  classes: "Manage class sections, rosters, and subjects.",
  staff: "Review schedules and form-teacher assignments.",
  resources: "Manage accounts and access privileges.",
  settings: "Set academic sessions, terms, and timing.",
};

export function AdminDashboard({ name, email, onSignOut }: { name: string; email: string; onSignOut: () => void }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("pulse");
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<Named[]>([]);
  const [options, setOptions] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<Named[]>([]);
  const [schedules, setSchedules] = useState<Named[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!moreOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [moreOpen]);

  useEffect(() => {
    void (async () => {
      try {
        const requests = await Promise.allSettled([
          supabaseRequest<User[]>("User?select=id,name,email,role,is_librarian,teacher_approval_status&order=name"),
          supabaseRequest<Named[]>("Class?select=id,name,grade_level,max_capacity&order=grade_level,name"),
          supabaseRequest<ClassOption[]>("ClassOption?select=id,class_id,code,form_teacher_id,is_active&order=class_id,code"),
          supabaseRequest<Named[]>("Subject?select=id,name,class_id&order=name"),
          supabaseRequest<Named[]>("TeachingSchedule?select=id,teacher_id,class_id,subject_id,day_of_week,start_time,end_time,is_form_teacher&order=day_of_week,start_time"),
          supabaseRequest<SessionRow[]>("Session?select=id,name,start_date,end_date&order=start_date.desc"),
          supabaseRequest<TermRow[]>("Term?select=id,session_id,name,start_date,end_date,is_active&order=start_date.desc"),
          supabaseRequest<Application[]>("AdmissionApplication?select=id,applicant_name,source,stage,created_at&order=created_at.desc"),
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
      } catch (error) {
        toast(error instanceof Error ? error.message : "Dashboard could not sync.", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  async function updateUser(id: string, changes: Partial<User>) {
    try {
      await supabaseRequest(`User?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(changes),
      });
      setUsers((items) => items.map((item) => (item.id === id ? { ...item, ...changes } as User : item)));
      toast("Account updated", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Account update failed.", "error");
    }
  }

  async function updateApp(id: string, stage: Application["stage"]) {
    try {
      await supabaseRequest(`AdmissionApplication?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ stage, updated_at: new Date().toISOString() }),
      });
      setApplications((items) => items.map((item) => (item.id === id ? { ...item, stage } : item)));
      toast("Application updated", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Application update failed.", "error");
    }
  }

  if (loading) return <DashboardSkeleton />;

  const teachers = users.filter((u) => u.role === "teacher");
  const pending = teachers.filter((u) => u.teacher_approval_status === "pending");
  const freshApps = applications.filter((a) => a.stage === "applied");

  return (
    <main className="min-h-screen bg-surface-0">
      {/* Top header bar */}
      <header className="surface-glass sticky top-0 z-40 border-b border-white/10 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-[var(--radius-sm)] bg-accent text-sm font-bold text-accent-contrast">S</div>
            <div>
              <p className="text-sm font-bold">School Platform</p>
              <p className="text-xs text-text-secondary">Admin Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar navigation - always visible on desktop, drawer on mobile */}
        <aside className="hidden w-56 shrink-0 border-r border-[var(--border)] p-4 lg:block">
          <nav className="space-y-1">
            {tabs.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setTab(item.id)}
                aria-current={tab === item.id ? "page" : undefined}
                className={`flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 text-left text-sm font-semibold transition ${
                  tab === item.id
                    ? "bg-accent/15 text-accent-light"
                    : "text-text-secondary hover:bg-surface-1 hover:text-text-primary"
                }`}
              >
                <span className={tab === item.id ? "text-accent-light" : "text-text-muted"} aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <section className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold sm:text-3xl">
                {tab === "pulse" ? "Overview" : tab === "attention" ? "Attention" : tab === "classes" ? "Classes" : tab === "staff" ? "Staff" : tab === "resources" ? "Accounts" : "Settings"}
              </h1>
              <p className="mt-1 text-sm text-text-secondary">{tabDescriptions[tab]}</p>
            </div>
            {tab === "pulse" && (
              <span className="rounded-full border border-[var(--border)] bg-surface-1 px-3 py-1 text-xs font-semibold text-text-secondary">
                {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>

          {tab === "pulse" && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 stagger-children">
              <StatCard label="Students" value={users.filter((u) => u.role === "student").length} icon="●" />
              <StatCard label="Teachers" value={teachers.length} icon="◆" />
              <StatCard label="Applications" value={freshApps.length} icon="✦" />
              <StatCard label="Classes" value={classes.length} icon="▦" />
            </div>
          )}

          {tab === "attention" && (
            <div className="mt-6 space-y-3 animate-fade-in">
              <div className="rounded-2xl border border-[var(--border)] bg-surface-1 p-4">
                <p className="text-sm font-semibold">
                  {pending.length + freshApps.length
                    ? `${pending.length + freshApps.length} item${pending.length + freshApps.length === 1 ? "" : "s"} need attention`
                    : "Everything is up to date"}
                </p>
                <p className="mt-1 text-sm text-text-secondary">Review these items and keep the school moving.</p>
              </div>
              {pending.map((user) => (
                <article key={user.id} className="border-l-4 border-[var(--danger)] bg-surface-1 p-4 rounded-r-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">Teacher approval pending</p>
                      <p className="text-sm text-text-secondary">{user.name} · {user.email}</p>
                    </div>
                    <Button size="sm" onClick={() => void updateUser(user.id, { teacher_approval_status: "approved" })}>
                      Approve
                    </Button>
                  </div>
                </article>
              ))}
              {freshApps.map((app) => (
                <article key={app.id} className="border-l-4 border-[var(--border)] bg-surface-1 p-4 rounded-r-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">New admission application</p>
                      <p className="text-sm text-text-secondary">{app.applicant_name} · {app.source}</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => void updateApp(app.id, "interviewed")}>
                      Mark interviewed
                    </Button>
                  </div>
                </article>
              ))}
              {!pending.length && !freshApps.length && (
                <p className="py-10 text-center text-text-secondary">No urgent actions.</p>
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
                onStatus={() => {}}
              />
            </div>
          )}

          {tab === "classes" && (
            <div className="mt-6 space-y-8">
              <ClassManagement classes={classes} options={options} users={users} onOptionsChange={setOptions} onStatus={() => {}} />
              <SubjectManagement classes={classes as never[]} subjects={subjects as never[]} schedules={schedules as never[]} onSubjectsChange={setSubjects} onStatus={() => {}} />
            </div>
          )}

          {tab === "settings" && (
            <div className="mt-6">
              <AcademicCalendar sessions={sessions} terms={terms} onSessionsChange={setSessions} onTermsChange={setTerms} onStatus={() => {}} />
            </div>
          )}

          {tab === "resources" && (
            <div className="mt-6">
              <AccountDirectory users={users} onUpdate={(id, changes) => void updateUser(id, changes)} />
            </div>
          )}


        </section>
      </div>

      {/* Mobile bottom navigation - 4 main + More */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-surface-1/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {tabs.slice(0, 4).map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? "page" : undefined}
              className={`flex min-h-12 flex-col items-center justify-center rounded-[var(--radius-sm)] px-1 text-[10px] font-semibold leading-tight ${
                tab === item.id ? "bg-accent/15 text-accent-light" : "text-text-secondary"
              }`}
            >
              <span aria-hidden="true" className="mb-0.5">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className={`flex min-h-12 flex-col items-center justify-center rounded-[var(--radius-sm)] px-1 text-[10px] font-semibold leading-tight ${
              moreOpen || tabs.slice(4).some((t) => t.id === tab) ? "bg-accent/15 text-accent-light" : "text-text-secondary"
            }`}
          >
            <span aria-hidden="true" className="mb-0.5 text-base">⋯</span>
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* More sheet */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/25 lg:hidden"
          role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setMoreOpen(false); }}
        >
          <section className="mobile-command-sheet absolute inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] mx-auto max-w-md overflow-hidden rounded-2xl" role="dialog" aria-modal="true" aria-label="More admin sections">
            <div className="mobile-command-heading flex items-start justify-between border-b border-[var(--border)] bg-surface-1/75 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">More sections</p>
                <p className="mt-1 text-sm text-text-secondary">Open less-frequent admin tools.</p>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close more sections" className="grid size-9 place-items-center rounded-full border border-[var(--border)] text-lg hover:bg-surface-2">×</button>
            </div>
            <div className="grid gap-1.5 p-2.5">
              {tabs.slice(4).map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => { setTab(item.id); setMoreOpen(false); }}
                  className={`mobile-command-item flex min-h-16 items-center gap-3 rounded-xl px-3.5 text-left font-semibold ${tab === item.id ? "is-selected" : ""}`}
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-surface-2 text-lg" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>
                    <span className="block">{item.label}</span>
                    <span className="mt-0.5 block text-xs font-normal text-text-secondary">
                      {item.id === "resources" ? "Accounts and access" : "Academic calendar and terms"}
                    </span>
                  </span>
                  <span className="ml-auto text-lg text-text-secondary" aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
