"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { getCurrentUser, supabaseRequest } from "@/lib/supabase";
import { AdminCreationForm } from "@/components/admin-creation-form";
import { AdminDashboard } from "@/components/admin-dashboard";
import { ScoreEntryGrid } from "@/components/score-entry-grid";

type Profile = { id: string; name: string; email: string; role: "student" | "teacher" | "admin" | "alumni"; teacher_approval_status: "pending" | "approved" | "rejected" | null };
type Student = { id: string; user_id: string; class_id: string | null; class_locked: boolean };
type ClassOption = { id: string; name: string; grade_level: string; max_capacity: number | null };
type Schedule = { id: string; teacher_id?: string; class_id: string; subject_id: string; day_of_week: number; start_time: string; end_time: string; is_form_teacher?: boolean; Class?: { name: string } | null; Subject?: { name: string } | null };
type AdminUser = Profile & { is_librarian: boolean };
type SubjectOption = { id: string; name: string; class_id: string };
type AssessmentOption = { id: string; name: string; max_score: number };

export default function PortalPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [guardian, setGuardian] = useState({ name: "", relationship: "", phone: "", email: "" });
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminClasses, setAdminClasses] = useState<ClassOption[]>([]);
  const [adminSubjects, setAdminSubjects] = useState<SubjectOption[]>([]);
  const [adminSchedules, setAdminSchedules] = useState<Schedule[]>([]);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ teacher_id: "", class_id: "", subject_id: "", day_of_week: "1", start_time: "08:00", end_time: "09:00", is_form_teacher: false });
  const [status, setStatus] = useState("Loading your school profile…");
  const [scoreContext, setScoreContext] = useState<{ termId: string; subjectId: string; subjectName: string; students: { id: string; user_id: string }[]; assessments: AssessmentOption[] } | null>(null);

  function signOut() {
    sessionStorage.removeItem("school_access_token");
    sessionStorage.removeItem("school_user_id");
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
          const students = await supabaseRequest<Student[]>(`Student?user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,class_id,class_locked`);
          const currentStudent = students[0] ?? null;
          setStudent(currentStudent);
          if (currentStudent && !currentStudent.class_locked) {
            const available = await supabaseRequest<ClassOption[]>("rpc/get_available_classes", { method: "POST", body: "{}" });
            setClasses(available ?? []);
          }
        }
        if (current.role === "teacher" && current.teacher_approval_status === "approved") {
          const teacherSchedules = await supabaseRequest<Schedule[]>(`TeachingSchedule?teacher_id=eq.${encodeURIComponent(userId)}&select=id,class_id,subject_id,day_of_week,start_time,end_time,is_form_teacher,Class(name),Subject(name)`);
          setSchedules(teacherSchedules ?? []);
          const formSchedule = (teacherSchedules ?? []).find(item => item.is_form_teacher);
          if (formSchedule) {
            const [terms, students, assessments] = await Promise.all([
              supabaseRequest<{ id: string; name: string }[]>("Term?is_active=eq.true&select=id,name&limit=1"),
              supabaseRequest<{ id: string; user_id: string; User?: { name: string } | null }[]>(`Student?class_id=eq.${encodeURIComponent(formSchedule.class_id)}&select=id,user_id,User(name)&order=user_id`),
              supabaseRequest<AssessmentOption[]>(`AssessmentType?subject_id=eq.${encodeURIComponent(formSchedule.subject_id)}&select=id,name,max_score&order=name`),
            ]);
            if (terms?.[0]) setScoreContext({ termId: terms[0].id, subjectId: formSchedule.subject_id, subjectName: formSchedule.Subject?.name ?? "Subject", students: (students ?? []).map(student => ({ id: student.id, user_id: student.user_id, name: student.User?.name })), assessments: assessments ?? [] });
          }
        }
        if (current.role === "admin") {
          const [users, availableClasses, subjects, allSchedules] = await Promise.all([
            supabaseRequest<AdminUser[]>("User?select=id,name,email,role,teacher_approval_status,is_librarian&order=created_at"),
            supabaseRequest<ClassOption[]>("Class?select=id,name,grade_level,max_capacity&order=grade_level,name"),
            supabaseRequest<SubjectOption[]>("Subject?select=id,name,class_id&order=name"),
            supabaseRequest<Schedule[]>("TeachingSchedule?select=id,teacher_id,class_id,subject_id,day_of_week,start_time,end_time,is_form_teacher,Class(name),Subject(name)&order=day_of_week,start_time"),
          ]);
          setAdminUsers(users ?? []); setAdminClasses(availableClasses ?? []); setAdminSubjects(subjects ?? []); setAdminSchedules(allSchedules ?? []);
        }
        setStatus("");
      } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to load your profile."); }
    })();
  }, []);

  async function chooseClass() {
    if (!student || !selectedClass) return;
    try {
      const updated = await supabaseRequest<Student>("rpc/select_student_class", {
        method: "POST",
        body: JSON.stringify({ target_class_id: selectedClass }),
      });
      setStudent(updated);
      setClasses([]); setStatus("Class saved. Your selection is now locked; only a teacher or admin can change it.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Class selection was rejected."); }
  }

  async function saveGuardian() {
    if (!student || !guardian.name || !guardian.relationship || !guardian.phone) return;
    try {
      await supabaseRequest("GuardianContact", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ student_id: student.id, ...guardian }) });
      setGuardian({ name: "", relationship: "", phone: "", email: "" }); setStatus("Guardian contact saved. Its details are readable only by your form teacher and school admins.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Guardian contact could not be saved."); }
  }

  async function updateUser(userId: string, changes: Partial<AdminUser>) {
    try {
      await supabaseRequest(`User?id=eq.${encodeURIComponent(userId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(changes) });
      setAdminUsers(users => users.map(user => user.id === userId ? { ...user, ...changes } as AdminUser : user));
      setStatus("Account permissions updated.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Account update was rejected."); }
  }

  async function createSchedule() {
    if (!scheduleForm.teacher_id || !scheduleForm.class_id || !scheduleForm.subject_id) return;
    try {
      const body = { ...scheduleForm, day_of_week: Number(scheduleForm.day_of_week) };
      if (editingScheduleId) {
        await supabaseRequest(`TeachingSchedule?id=eq.${editingScheduleId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(body) });
        setStatus("Teaching schedule updated.");
        setAdminSchedules(items => items.map(item => item.id === editingScheduleId ? { ...item, ...body } : item));
      } else {
        const created = await supabaseRequest<Schedule[]>("TeachingSchedule", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
        if (created?.[0]) setAdminSchedules(items => [...items, created[0]]);
        setStatus("Teaching schedule created. The teacher can now see this assignment.");
      }
      setEditingScheduleId(null);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Schedule creation was rejected."); }
  }

  async function deleteSchedule(id: string) {
    if (!window.confirm("Delete this teaching schedule?")) return;
    try {
      await supabaseRequest(`TeachingSchedule?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      setAdminSchedules(items => items.filter(item => item.id !== id));
      if (editingScheduleId === id) setEditingScheduleId(null);
      setStatus("Teaching schedule deleted.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Schedule deletion was rejected."); }
  }

  async function loadSubjectsForClass(classId: string) {
    setScheduleForm(form => ({ ...form, class_id: classId, subject_id: "" }));
    if (!classId) return;
    try {
      const subjects = await supabaseRequest<SubjectOption[]>(`Subject?class_id=eq.${encodeURIComponent(classId)}&select=id,name,class_id&order=name`);
      setAdminSubjects(items => [...items.filter(item => item.class_id !== classId), ...(subjects ?? [])]);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Subjects could not be loaded."); }
  }


  if (status && !profile) return <main className="paper-grid min-h-screen px-5 py-10"><div className="mx-auto max-w-3xl"><nav className="mb-8 flex items-center justify-between"><Link href="/" className="text-sm font-semibold text-text-secondary">Home</Link><button type="button" onClick={signOut} className="text-sm font-semibold text-text-secondary">Sign out</button></nav><Card><p role="status">{status}</p></Card></div></main>;
  if (!profile) return null;
  if (profile.role === "admin") return <AdminDashboard name={profile.name} onSignOut={signOut} />;
  if (profile.role === "teacher" && profile.teacher_approval_status !== "approved") return <main className="paper-grid min-h-screen px-5 py-10"><div className="mx-auto max-w-3xl"><nav className="mb-8 flex items-center justify-between"><Link href="/" className="text-sm font-semibold text-text-secondary">Home</Link><button type="button" onClick={signOut} className="text-sm font-semibold text-text-secondary">Sign out</button></nav><Card><p className="text-sm font-bold uppercase tracking-[0.18em] text-text-secondary">Teacher account</p><h1 className="font-display mt-3 text-4xl font-semibold">Waiting for admin approval</h1><p className="mt-4 text-text-secondary">Your account is active, but your teaching portal stays locked until a school admin approves it. You can log in again anytime to check.</p></Card></div></main>;

  if (profile.role === "admin") return <main className="paper-grid min-h-screen px-4 py-6 sm:px-6 sm:py-10"><div className="mx-auto max-w-5xl space-y-6"><nav className="flex items-center justify-between"><Link href="/" className="text-sm font-semibold text-text-secondary">School Platform</Link><button type="button" onClick={signOut} className="min-h-11 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold">Sign out</button></nav><header><p className="text-xs font-bold uppercase text-text-secondary">Admin portal</p><h1 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">Identity and schedules</h1></header>{status && <p className="rounded-lg border border-[var(--border)] bg-surface-2 p-3 text-sm" role="status">{status}</p>}<AdminCreationForm onStatus={setStatus} /><Card className="p-4 sm:p-6"><h2 className="font-display text-xl font-semibold sm:text-2xl">Accounts</h2><div className="mt-4 divide-y divide-[var(--border)]">{adminUsers.map(user => <div key={user.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto]"><div className="min-w-0"><p className="font-semibold">{user.name}</p><p className="truncate text-sm text-text-secondary">{user.email} · {user.role}</p></div><div className="flex flex-wrap gap-2">{user.role === "teacher" && <button type="button" onClick={() => updateUser(user.id, { teacher_approval_status: user.teacher_approval_status === "approved" ? "rejected" : "approved" })} className="min-h-11 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold">{user.teacher_approval_status === "approved" ? "Revoke approval" : "Approve teacher"}</button>}{(user.role === "student" || user.role === "teacher") && <button type="button" onClick={() => updateUser(user.id, { is_librarian: !user.is_librarian })} className="min-h-11 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold">{user.is_librarian ? "Revoke librarian" : "Grant librarian"}</button>}</div></div>)}</div></Card><Card className="p-4 sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-xl font-semibold sm:text-2xl">{editingScheduleId ? "Edit teaching schedule" : "Create teaching schedule"}</h2><p className="mt-1 text-sm text-text-secondary">Choose a teacher and class, then assign its subject and time.</p></div>{editingScheduleId && <button type="button" onClick={() => setEditingScheduleId(null)} className="text-sm font-semibold text-text-secondary">Cancel</button>}</div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Teacher<select value={scheduleForm.teacher_id} onChange={e => setScheduleForm({ ...scheduleForm, teacher_id: e.target.value })} className="mt-1 min-h-12 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3"><option value="">Select teacher</option>{adminUsers.filter(user => user.role === "teacher").map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label className="text-sm font-semibold">Class<select value={scheduleForm.class_id} onChange={e => void loadSubjectsForClass(e.target.value)} className="mt-1 min-h-10 w-full max-w-sm rounded-lg border border-[var(--border)] bg-surface-0 px-3 text-sm sm:min-h-12"><option value="">Select class</option>{adminClasses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{scheduleForm.class_id && <label className="text-sm font-semibold sm:col-span-2">Subject<select value={scheduleForm.subject_id} onChange={e => setScheduleForm({ ...scheduleForm, subject_id: e.target.value })} className="mt-1 min-h-12 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3"><option value="">{adminSubjects.some(item => item.class_id === scheduleForm.class_id) ? "Select subject" : "No subjects found for this class"}</option>{adminSubjects.filter(item => item.class_id === scheduleForm.class_id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<label className="text-sm font-semibold">Day<select value={scheduleForm.day_of_week} onChange={e => setScheduleForm({ ...scheduleForm, day_of_week: e.target.value })} className="mt-1 min-h-12 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3"><option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option></select></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Starts<input type="time" value={scheduleForm.start_time} onChange={e => setScheduleForm({ ...scheduleForm, start_time: e.target.value })} className="mt-1 min-h-12 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3" /></label><label className="text-sm font-semibold">Ends<input type="time" value={scheduleForm.end_time} onChange={e => setScheduleForm({ ...scheduleForm, end_time: e.target.value })} className="mt-1 min-h-12 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3" /></label></div><label className="flex min-h-12 items-center gap-3 text-sm font-semibold sm:col-span-2"><input type="checkbox" checked={scheduleForm.is_form_teacher} onChange={e => setScheduleForm({ ...scheduleForm, is_form_teacher: e.target.checked })} className="size-5" /> Form teacher for this class</label></div><button type="button" disabled={!scheduleForm.teacher_id || !scheduleForm.class_id || !scheduleForm.subject_id} onClick={createSchedule} className="mt-4 min-h-12 w-full rounded-lg bg-accent px-4 font-semibold text-[var(--accent-contrast)] disabled:opacity-40 sm:w-auto">{editingScheduleId ? "Save schedule" : "Create schedule"}</button><div className="mt-7 divide-y divide-[var(--border)] border-t border-[var(--border)]">{adminSchedules.length === 0 && <p className="py-5 text-sm text-text-secondary">No teaching schedules yet.</p>}{adminSchedules.map(item => <div key={item.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-semibold">{item.Subject?.name ?? adminSubjects.find(subject => subject.id === item.subject_id)?.name ?? "Subject"} · {item.Class?.name ?? adminClasses.find(entry => entry.id === item.class_id)?.name ?? "Class"}</p><p className="mt-1 text-sm text-text-secondary">Day {item.day_of_week} · {item.start_time}–{item.end_time}{item.is_form_teacher ? " · Form teacher" : ""}</p></div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => { setEditingScheduleId(item.id); setScheduleForm({ teacher_id: item.teacher_id ?? "", class_id: item.class_id, subject_id: item.subject_id, day_of_week: String(item.day_of_week), start_time: item.start_time, end_time: item.end_time, is_form_teacher: Boolean(item.is_form_teacher) }); }} className="min-h-11 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold">Edit</button><button type="button" onClick={() => void deleteSchedule(item.id)} className="min-h-11 rounded-lg border border-[var(--danger)] px-4 text-sm font-semibold text-danger">Delete</button></div></div>)}</div></Card></div></main>;

  return <main className="paper-grid min-h-screen px-5 py-10"><div className="mx-auto max-w-4xl space-y-6"><nav className="flex items-center justify-between"><Link href="/" className="text-sm font-semibold text-text-secondary">Home</Link><button type="button" onClick={signOut} className="text-sm font-semibold text-text-secondary">Sign out</button></nav><header><p className="text-sm font-bold uppercase tracking-[0.18em] text-text-secondary">{profile.role} portal</p><h1 className="font-display mt-2 text-4xl font-semibold">Welcome, {profile.name}</h1></header>{status && <p className="rounded-lg border border-[var(--border)] bg-surface-2 p-3 text-sm" role="status">{status}</p>}{profile.role === "teacher" && <Card><h2 className="font-display text-2xl font-semibold">Your teaching schedule</h2>{schedules.length === 0 ? <p className="mt-3 text-text-secondary">No schedules have been assigned yet.</p> : <div className="mt-4 divide-y divide-[var(--border)]">{schedules.map(item => <div key={item.id} className="flex justify-between gap-4 py-3"><span className="font-semibold">{item.Subject?.name ?? "Subject"} · {item.Class?.name ?? "Class"}</span><span className="text-sm text-text-secondary">Day {item.day_of_week}, {item.start_time}–{item.end_time}</span></div>)}</div>}</Card>}{profile.role === "teacher" && scoreContext && <Card><h2 className="font-display text-2xl font-semibold">Enter {scoreContext.subjectName} scores</h2><p className="mt-2 text-sm text-text-secondary">Scores save when you leave a cell. Maximums are enforced.</p><div className="mt-4"><ScoreEntryGrid students={scoreContext.students} assessments={scoreContext.assessments} termId={scoreContext.termId} subjectId={scoreContext.subjectId} /></div></Card>}{profile.role === "student" && student && <div className="grid gap-6 md:grid-cols-2"><Card><h2 className="font-display text-2xl font-semibold">Your class</h2>{student.class_locked ? <p className="mt-3 text-text-secondary">Class selected. It is locked for self-service changes.</p> : <><p className="mt-3 text-text-secondary">Choose once from classes with room. This is intentionally separate from signup.</p><select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="mt-5 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3 py-3"><option value="">Select a class</option>{classes.map(item => <option key={item.id} value={item.id}>{item.name} · {item.grade_level}</option>)}</select><button type="button" disabled={!selectedClass} onClick={chooseClass} className="mt-4 rounded-lg bg-accent px-4 py-3 font-semibold text-[var(--accent-contrast)] disabled:opacity-50">Save class</button></>}</Card><Card><h2 className="font-display text-2xl font-semibold">Guardian contact</h2><p className="mt-3 text-text-secondary">Optional. School management uses this only when direct contact is needed.</p><div className="mt-5 space-y-3">{([['name','Name'],['relationship','Relationship'],['phone','Phone'],['email','Email (optional)']] as const).map(([key, label]) => <input key={key} value={guardian[key]} onChange={e => setGuardian({ ...guardian, [key]: e.target.value })} placeholder={label} required={key !== 'email'} className="w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3 py-3" />)}<button type="button" onClick={saveGuardian} className="rounded-lg border border-[var(--border)] px-4 py-3 font-semibold">Add guardian contact</button></div></Card></div>}</div></main>;
}
