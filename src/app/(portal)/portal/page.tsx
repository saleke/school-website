"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAuthSession, getCurrentUser, supabaseRequest } from "@/lib/supabase";
import { AdminDashboard } from "@/components/admin-dashboard";
import { StudentTodayDashboard } from "@/components/student-today-dashboard";
import { TeacherTodayDashboard } from "@/components/teacher-today-dashboard";
import { schoolContent } from "@/content/school";

type Profile = { id: string; name: string; email: string; role: "student" | "teacher" | "admin" | "alumni"; teacher_approval_status: "pending" | "approved" | "rejected" | null };
type Student = { id: string; user_id: string; admission_no?: string | null; class_id: string | null; class_option_id: string | null; class_locked: boolean };
type Schedule = { id: string; class_id: string; class_option_id: string | null; subject_id: string; day_of_week: number; start_time: string; end_time: string; is_form_teacher: boolean; Class?: { name: string } | null; Subject?: { name: string } | null };
type ClassOption = { id: string; class_id: string; code: string; form_teacher_id: string | null; is_active: boolean };

export default function PortalPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);

  function signOut() {
    if (!window.confirm("Sign out of your school account?")) return;
    clearAuthSession();
    router.push("/");
  }

  useEffect(() => {
    void (async () => {
      try {
        const authUser = await getCurrentUser();
        const userId = authUser?.id;
        if (!userId) throw new Error("Your session is missing. Please log in again.");
        const users = await supabaseRequest<Profile[]>(`User?id=eq.${encodeURIComponent(userId)}&select=id,name,email,role,teacher_approval_status&limit=1`);
        const current = users[0];
        if (!current) throw new Error("Profile not found.");
        setProfile(current);

        if (current.role === "student") {
          const students = await supabaseRequest<Student[]>(`Student?user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,admission_no,class_id,class_option_id,class_locked`);
          setStudent(students[0] ?? null);
        }

        if (current.role === "teacher" && current.teacher_approval_status === "approved") {
          const [teacherSchedules, allOptions] = await Promise.all([
            supabaseRequest<Schedule[]>(`TeachingSchedule?teacher_id=eq.${encodeURIComponent(userId)}&select=id,class_id,class_option_id,subject_id,day_of_week,start_time,end_time,is_form_teacher,Class(name),Subject(name)&order=day_of_week,start_time`),
            supabaseRequest<ClassOption[]>("ClassOption?is_active=eq.true&select=id,class_id,code,form_teacher_id,is_active&order=class_id,code"),
          ]);
          setSchedules(teacherSchedules ?? []);
          setClassOptions(allOptions ?? []);
        }
      } catch (error) {
        console.error("Portal load error:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <main className="paper-grid flex min-h-screen items-center px-5 py-10">
        <div className="mx-auto w-full max-w-md">
          <section className="portal-loading-card surface-glass rounded-[var(--radius-lg)] p-7 text-center sm:p-9" role="status" aria-live="polite">
            <div className="portal-loading-mark mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-xl font-bold text-[var(--accent-contrast)] shadow-[0_12px_28px_color-mix(in_srgb,var(--accent)_28%,transparent)]">
              {schoolContent.identity.shortName[0]}
            </div>
            <p className="eyebrow mt-6">{schoolContent.identity.name}</p>
            <h1 className="font-display mt-2 text-2xl font-semibold">Preparing your workspace</h1>
            <p className="mt-3 text-sm leading-6 text-text-secondary">Loading your school dashboard...</p>
            <div className="portal-loading-track mt-6 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <span className="portal-loading-progress block h-full w-2/5 rounded-full bg-accent" />
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!profile) return null;

  if (profile.role === "admin") {
    return <AdminDashboard name={profile.name} email={profile.email} onSignOut={signOut} />;
  }

  if (profile.role === "teacher" && profile.teacher_approval_status !== "approved") {
    return (
      <main className="paper-grid min-h-screen px-5 py-10">
        <div className="mx-auto max-w-3xl">
          <section className="rounded-2xl border border-[var(--border)] bg-surface-1 p-6 text-center">
            <h1 className="font-display text-3xl font-semibold">Waiting for admin approval</h1>
            <p className="mt-3 text-text-secondary">Your account is active, but your teaching portal stays locked until a school admin approves it.</p>
            <button type="button" onClick={signOut} className="mt-6 min-h-11 rounded-lg border border-[var(--border)] px-5 text-sm font-semibold hover:bg-surface-2">
              Sign out
            </button>
          </section>
        </div>
      </main>
    );
  }

  if (profile.role === "teacher") {
    return <TeacherTodayDashboard profile={profile} schedules={schedules} classOptions={classOptions} onSignOut={signOut} />;
  }

  if (profile.role === "student" && student) {
    const section = classOptions.find((o) => o.id === student.class_option_id);
    return <StudentTodayDashboard profile={profile} student={student} classOption={section ?? null} onSignOut={signOut} />;
  }

  return (
    <main className="paper-grid min-h-screen px-5 py-10">
      <div className="mx-auto max-w-3xl">
        <section className="rounded-2xl border border-[var(--border)] bg-surface-1 p-6 text-center">
          <h1 className="font-display text-3xl font-semibold">Welcome, {profile.name}</h1>
          <p className="mt-3 text-text-secondary">Your role is being set up. Please check back soon.</p>
          <button type="button" onClick={signOut} className="mt-6 min-h-11 rounded-lg border border-[var(--border)] px-5 text-sm font-semibold hover:bg-surface-2">
            Sign out
          </button>
        </section>
      </div>
    </main>
  );
}
