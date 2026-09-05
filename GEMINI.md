
# School Platform — Agent Execution Plan

Read this whole file before writing any code. Execute steps in order. Do not skip ahead — later steps assume earlier tables/policies exist. Where a step says "definition of done," do not mark it complete until every bullet is true.

**Non-negotiable constraints, apply to every step:**
- Total infra cost stays at $0/month. Use only: Vercel (free), Supabase (free tier: Postgres, Auth, Realtime), Cloudflare R2 (free tier: file storage).
- Every table gets Row Level Security enabled at creation — never "add RLS later."
- Every write endpoint re-checks the actor's role and scope server-side. Never trust a client-sent role.
- Student direct messages are never queryable by any admin/staff role through any code path — enforced by Postgres policy, not application logic.
- Leaderboards show only top performers (podium + rising movers) per category — never a full ranked list of every student, and never a single blended score across academic/attendance/contribution.
- This platform never becomes the system of record for money — no `Fee`/`Payment` tables it writes to.
- Alumni accounts (Step 18) never get open messaging access to current students — any alumni-to-student contact routes through a teacher-approved flow, same as peer tutoring.
- There is no parent role and no parent account anywhere in this system. Do not build parent login, a parent dashboard, or any parent-facing feature.
- Librarian is an additive privilege (`User.is_librarian`), never an exclusive role — a student or teacher who becomes librarian keeps their original role and permissions in full.
- A student's `class_id`, once self-selected, is locked — only `admin` or `teacher` can change it afterward. Never let a student edit it a second time through any endpoint.
- The app is low-data by design: text-first rendering, aggressive caching, and offline-capable where it genuinely matters (attendance, MCQ practice, Q&A drafting — see Steps 1, 7, 8, 9) — not an afterthought bolted on at the end. Every step that adds a new screen should be built with this in mind from the start, not retrofitted later.

## How to approach steps with real cross-cutting logic

Some steps are mechanical (style a button, add a column) and some require holding logic that spans multiple tables and steps at once — these are the ones most likely to go subtly wrong if rushed. Treat the following as **checkpoint steps**: before writing code for them, first explain back in plain language how the relevant pieces connect, and wait for confirmation before implementing.

- **Step 4/5**: how `Score` → `TermResultSnapshot` → `LeaderboardEntry` relate, and why ranking is never computed live.
- **Step 11**: the DM privacy policy — walk through exactly why an admin query for another user's DM thread returns nothing, at the database level, not the UI level.
- **Step 18**: the automatic promotion/graduation job — what happens to each student's `status`, `class_id`, and `role` in the batch, and why it's admin-triggered rather than fully automatic.

For these checkpoint steps specifically, prefer the strongest available model rather than a faster/lighter one — this is exactly the kind of reasoning-heavy work where model strength matters most.

---

## STEP 1 — Project & infra setup
1. Initialize a Next.js app, deploy to Vercel (free tier).
2. Create a Supabase project (Postgres + Auth + Realtime, free tier).
3. Create a Cloudflare R2 bucket for file storage (free tier, 10GB).
4. Set up the design system with this explicit direction — **"notebook" identity: warm paper, not black. School colors are black and blue (matching the uniform), but the interface is built around blue as ink on paper, not black as a dominant surface.**
   - **Concept**: the visual identity is a well-kept school notebook — warm cream/parchment pages, with blue as the ink used to write on them. This isn't arbitrary; it ties the UI directly to what the platform already is — curriculum, growth profiles, yearbooks — a record of a student's school life, not a corporate dashboard.
   - **Palette (light mode, the primary identity)**: warm paper background (`--surface-0`, a soft cream, not stark white — e.g. `#F6F2E9`), a slightly deeper paper shade for cards (`--surface-1`, e.g. `#EFE8D8`), charcoal-blue ink for text (`--text-primary`, e.g. `#22262F` — softer than pure black), a muted warm gray for secondary text (`--text-secondary`, e.g. `#6B6656`), and a confident royal/cobalt blue as the signature accent (`--accent`, e.g. `#2440C4`).
   - **Palette (dark mode)**: still not black-heavy — a warm charcoal-navy background (e.g. `#1E2233`), not a near-void black. Same blue-ink identity, brightened slightly for contrast (e.g. `#5B7CFA`), cream text (`#F6F2E9`). Dark mode should feel like the same notebook under low light, not a different, colder product.
   - **One accent per screen, maximum**: blue marks the identity element, the primary action, and one highlighted stat or moment per screen (e.g. a "rising star" callout) — never painted across buttons, badges, and text all at once on the same view.
   - **Depth via paper shades, not color**: differentiate cards/sections using the surface-0/1/2 steps above, not colored borders or backgrounds. An occasional dark card (like a highlighted callout) can break the page intentionally — the way a highlighted note stands out on a real page — but this is a deliberate moment, not the default surface treatment.
   - **No category color-coding**: subject tags, Q&A tags, club badges, book genres, etc. must be monochrome/typographic (weight, small caps, an icon) — never each given a different color. This is a hard rule, not a style suggestion; a screen with five different colored tags is the failure mode to avoid.
   - **Reserve color as a semantic signal only**: red/green (or the design system's danger/success tokens) are used only for genuine error/success states — nothing else earns color.
   - Define all of the above as real design tokens (`--surface-0/1/2`, `--text-primary/secondary`, `--accent`, `--danger`, `--success`) that every component reads from — never hardcode a color value directly in a component.
   - Type scale, spacing scale, and one `Button`/`Card`/`Badge`/`Avatar` component each — reused everywhere, no one-off styles later.
5. Set up route groups: `/(public)`, `/(portal)`, `/(chat)`, `/(admin)`.
6. Build the app as a PWA from the start (manifest + service worker) — this single piece of infrastructure is reused by four later features: offline attendance (Step 8), offline MCQ practice and Q&A drafting (Steps 7 and 9), Web Push notifications (Step 16), and a generic offline-read cache described below.
7. **Generic offline-read cache**: implement a stale-while-revalidate caching strategy in the service worker for read-heavy pages — curriculum, announcements, a student's own grades, library listings, leaderboard podiums. Any page a user has already visited stays viewable offline showing last-known data with a small "offline — showing cached data" indicator, refreshing silently once reconnected. This is one mechanism serving many screens — do not build bespoke offline caching per feature.
   - **Deliberately excluded from offline support**: full chat message history (caching private DM content on-device is a real privacy risk if a device is lost or shared — bypass this entirely; a message *compose* queue that sends once reconnected is fine, full offline history sync is not) and offline score entry (interacts with term-close state and the ranking job in ways that create real conflict risk, unlike attendance). Do not extend offline capability to either of these without an explicit decision to do so.

**Done when:** empty app deploys successfully; Supabase and R2 credentials are wired into environment variables; design tokens exist and render in a sample page in both light and dark mode, matching the notebook palette above (not a black-dominant palette); blue appears on at most one element per screen; no category badges use differentiated colors; a previously-visited read-only page (e.g. curriculum) remains viewable with the browser offline.

---

## STEP 2 — Identity, roles, and core structural tables

**No parent role exists anywhere in this schema.** There are exactly four values in `User.role`: `student`, `teacher`, `admin`, `alumni` (the last one only ever set by the Step 18 graduation job, never at signup). Librarian is a separate additive flag, not a role value — see below.

Create these tables, each with RLS enabled immediately:

```
User(id, name, email, password_hash, role[student|teacher|admin|alumni], is_librarian boolean default false, teacher_approval_status[pending|approved|rejected] nullable, created_at)
  -- teacher_approval_status is only meaningful when role = teacher; null for student/admin/alumni
Session(id, name, start_date, end_date)
Term(id, session_id FK, name, start_date, end_date, is_active)
Class(id, name, grade_level, max_capacity nullable)   -- e.g. "JSS2A"; at most ~24 rows total (6 grade levels x up to 4 sections A-D) — this is intentionally a tiny reference table, not a source of database bloat
Subject(id, name, class_id FK)
Student(id, user_id FK, admission_no nullable, class_id FK nullable, class_locked boolean default false, dob)
GuardianContact(id, student_id FK, name, relationship, phone, email, is_primary)
TeachingSchedule(id, teacher_id FK, class_id FK, subject_id FK, day_of_week, start_time, end_time)
```

**Signup and login UI**: present two distinct clickable options — "I'm a Student" / "I'm a Teacher" — as separate cards/buttons, not a toggle switch. Neither `admin` nor `alumni` nor the librarian flag are ever selectable at signup:
- **Admin** is never created through the signup form at all — the very first admin account is created by manually editing the `role` column directly in Supabase's Table Editor after a normal signup (a one-time, by-hand action only the project owner can perform). Every subsequent admin is created by an existing admin through the app.
- **Teacher** signups are created with `teacher_approval_status = pending`. A pending teacher can log in and see a clear "waiting for admin approval" screen, but has no functional portal access until an admin approves them (see Step 17's admin console).
- **Librarian** is never a signup choice — it's a privilege an admin grants afterward to an existing student or teacher account by flipping `is_librarian`, and it never replaces or removes that account's original role.

**Deferred, self-service class selection**: `Student.class_id` starts `null` at signup — a brand-new student and an already-enrolled student both sign up the same way, with no class selected yet. As a **later profile-settings step** (not part of signup), the student picks their own class from the list of available `Class` rows (sections that haven't hit `max_capacity` simply don't appear as choices, no hard error). The moment they save that choice, set `class_locked = true` and enforce via RLS that only `admin` or `teacher` can update `class_id` from then on — the student's own update path is blocked entirely once locked, not just hidden in the UI.

**Guardian contact, also deferred**: never requested at signup. It lives as an optional section in the student's profile settings, feeding `GuardianContact` rows. It exists purely so school management can reach a parent/guardian directly when needed — there is no parent-facing feature anywhere that reads this data. Visibility is restricted to `admin` and the student's own form teacher only — no other teacher, no other student, ever. Do not hard-block any student feature on this being filled in; instead, a student profile with no `GuardianContact` row after some reasonable grace period should generate a `review`-severity `AttentionFlag` (Step 17) so admin can follow up directly.

RBAC rule for this step: a `teacher` may only be linked to classes/subjects via `TeachingSchedule` rows an admin created — teachers cannot self-assign to a class.

**Done when:** all four roles (student, teacher, admin, alumni) can log in via Supabase Auth; a newly-signed-up teacher sees the pending-approval screen and has no portal access until an admin approves them; a student can self-select their class exactly once and every subsequent attempt to change it themselves is rejected by RLS, not just hidden by the UI; a full section shows as unselectable once at `max_capacity`; a teacher's dashboard correctly shows only their `TeachingSchedule` entries; an admin can create/edit schedules for any teacher, approve pending teachers, and grant/revoke the librarian flag on any student or teacher account.

---

## STEP 3 — Public marketing/admissions site
1. Build: Home, About, Admissions (with an application form), News (public), Contact — using placeholder branding (logo/colors/copy as placeholders).
2. Admissions form writes to:
```
AdmissionApplication(id, applicant_name, source[website|referral|walk-in|other], stage[applied|interviewed|accepted|enrolled|rejected], created_at, updated_at)
```
3. Use static generation (ISR) for these pages — they should not hit the database on every request.

**Done when:** public site is live and navigable with no login; submitting the admissions form creates an `AdmissionApplication` row at `stage: applied`.

---

## STEP 4 — Assessment engine (scores, averages, positions)
1. Create tables:
```
AssessmentType(id, name, weight_pct, subject_id FK)   -- default CA 30% / Exam 70%, configurable per subject
Score(id, student_id FK, subject_id FK, term_id FK, assessment_type_id FK, raw_score, recorded_at, recorded_by FK)
  -- UNIQUE constraint on (student_id, subject_id, term_id, assessment_type_id)
TermResultSnapshot(id, student_id FK, subject_id FK nullable, term_id FK, weighted_average, class_position, cohort_size, computed_at)
```
2. RLS: only the teacher whose `TeachingSchedule` matches `(class_id, subject_id)` may insert/update `Score` rows for that class+subject, and only while the term is active.
3. Build the score-entry UI as a **spreadsheet-like grid** (rows = students, columns = assessment types, keyboard tab/arrow navigation) — not a one-student-at-a-time form. Each cell writes directly to `Score` on entry. Add an "export to Excel" button for teachers who want an offline copy; do not build Excel import as the primary entry path.
4. Build a background job (Supabase Edge Function, scheduled) that:
   - Recomputes `TermResultSnapshot.weighted_average` per student per subject (and an overall row with `subject_id = null`) whenever a term's scores change or the term is marked closed.
   - Ranks students within `(class_id, term_id)` by weighted average, storing `class_position` and `cohort_size`.
5. Never compute rank live on page load — always read from `TermResultSnapshot`.

**Done when:** a teacher can enter a full class's scores via the grid in under a few minutes; the background job produces correct averages and ranks; a student sees their own average, position, and cohort size.

---

## STEP 5 — Leaderboards (three separate categories, honor system not a ranked list)

**Correction to design**: academic, attendance, and contribution are three distinct leaderboards, each ranked on its own metric — never blended into a single composite score. A student can top the academic leaderboard without appearing on the attendance one, and vice versa.

1. Create:
```
LeaderboardEntry(id, category[academic|attendance|contribution], scope_type[class|school], scope_id nullable, period_type[term|session], period_id, student_id, score, rank, rank_delta, computed_at)
```
2. `score` per category is computed independently, from its own single source — not averaged with the others:
   - `academic`: `TermResultSnapshot.weighted_average` (or session aggregate of it)
   - `attendance`: attendance rate over the period, from `AttendanceRecord`
   - `contribution`: a contribution metric from Q&A answers given/accepted, library engagement, and club participation (see Step 9/10/13) — this metric itself can combine sub-signals into one contribution score, since "contribution" is its own category, but it never mixes with academic or attendance numbers
3. Compute session-level entries as an aggregate of term-level entries within that `Session`, per category. Compute `rank_delta` by comparing to the immediately preceding period's rank for the same student/scope/category.
4. Build the UI as three separate podiums (top 3) + "rising stars" per category — never render a full ranked list beyond the top of the pack, and never combine categories into one leaderboard view. A student can be shown across multiple podiums (e.g., top of attendance and top of contribution, with no academic mention) rather than one blended rank.
5. Add toggles: category (academic/attendance/contribution) × scope (class/school-wide) × period (term/session) — three independent toggle groups.
6. Every student's own position, in every category, is visible only to themselves as a percentile band and trend — never a raw rank broadcast to peers.

**Done when:** all three categories render as fully independent podiums with correct toggles across scope and period; no code path merges category scores together; a student can top one category while being unranked or mid-pack in another, and the UI reflects that honestly.

---

## STEP 6 — Curriculum browser
1. Create: `CurriculumTopic(id, subject_id FK, term_id FK, title, description, resource_links JSON, order_index)`.
2. Teacher can edit only topics for subjects in their own `TeachingSchedule`. Students get read-only, ordered by `order_index`.

**Done when:** a student can browse topics per subject per term; a teacher can add/reorder topics only for their own subjects.

---

## STEP 7 — Library
1. Create:
```
LibraryBook(id, title, author, subject_tag, exam_tag nullable[waec|jamb], uploaded_by FK, file_url, file_size_bytes, status[pending|approved|rejected], approved_by FK nullable, uploaded_at)
ReadingStatus(id, student_id FK, book_id FK, status[reading|finished], updated_at)
QuizQuestion(id, subject_id FK, exam_tag nullable, question_text, options JSON, correct_option, explanation)
QuizAttempt(id, student_id FK, quiz_question_id FK, selected_option, is_correct, attempted_at)
```
2. Upload flow: any student/teacher can upload → status `pending` → any account with `is_librarian = true` (or `admin`) reviews → `approved`/`rejected`. Enforce a hard file-size cap (10MB) client-side and server-side. PDF only for v1.
3. Files store in Cloudflare R2, not Supabase — only `file_url` and metadata live in Postgres.
4. Librarian permissions in this step, made explicit (not left vague), checked via `is_librarian = true` regardless of the account's underlying role (student or teacher): approve/reject uploads, feature/curate books on the library home, manage the WAEC/JAMB exam tag on books, moderate reported library content. A student-turned-librarian keeps every ordinary student permission (grades, chat, library browsing as a student) on top of these — the flag adds, it never replaces.
5. Build student-facing reading tracker: mark a book `reading` or `finished` via `ReadingStatus`; show "currently reading" and "finished" shelves on the student's library page.
6. Build the MCQ practice engine: student selects a subject/exam tag, answers `QuizQuestion` rows one at a time, `QuizAttempt` records the result, show immediate correct/incorrect + explanation.
7. **Offline MCQ practice**: once a student opens a practice set, cache that `QuizQuestion` batch locally (IndexedDB, via the Step 1 service worker) so they can keep practicing fully offline — genuinely useful for studying without data. Queue `QuizAttempt` writes locally and sync automatically on reconnect, same lightweight pattern as offline attendance (Step 8). No conflict risk — attempts are append-only, never edited.

**Done when:** upload → pending → librarian approval → visible-to-all flow works; file size cap enforced both client and server side; a student can mark books reading/finished and see both shelves; MCQ practice records attempts and shows explanations; a student can complete a full practice set with the device offline and see attempts sync once reconnected.

---

## STEP 8 — Announcements & attendance
1. Create:
```
Announcement(id, title, body, scope[school|grade|class], target_id nullable, author_id FK, published_at)
AttendanceRecord(id, student_id FK, date, status[present|absent|late], recorded_by FK, synced_at nullable)
```
2. Only the class's assigned teacher can record attendance, same-day only (no retroactive edits).
3. Build a **form-teacher dashboard** listing their class's absentees for the day/week. Absentee data routes to the form teacher — never to parents directly.
4. **Offline-first attendance recording** — attendance is one of the safest features to make fully usable without a live connection, and it should be:
   - Make the app a PWA with a service worker (this is also required for Web Push in Step 16 — build it once, use it for both).
   - When a teacher marks attendance offline, write immediately to IndexedDB on the device — instant save, no spinner, no blocked UI.
   - Register a Background Sync task that pushes queued records to `AttendanceRecord` the moment connectivity returns, automatically, with no action required from the teacher. Stamp `synced_at` when the server confirms receipt.
   - Show a small "saved, pending sync" indicator on each entry until `synced_at` is set, plus a manual "sync now" fallback.
   - Conflict handling can be simple last-write-wins — two teachers simultaneously marking the same class's attendance isn't a realistic scenario, so no complex merge logic is needed.
   - This costs nothing extra: IndexedDB and Background Sync are built into the browser, and attendance rows are tiny (a status + timestamp per student per day), adding negligible load to the free-tier database.

**Done when:** announcements correctly filter by scope; attendance can only be entered same-day by the assigned teacher; form teacher sees their class's absentee list; a teacher can mark a full class's attendance with the device in airplane mode, see it saved locally, and watch it sync automatically once reconnected.

---

## STEP 9 — Q&A, blogs, and contribution tracking
1. Create:
```
Post(id, author_id FK, type[blog|question], subject_tag nullable, title, body, created_at, status[visible|removed])
Answer(id, post_id FK, author_id FK, body, created_at, is_accepted)
```
2. Both students and teachers can create posts, comment/answer, and share resource links within answers. Post-first, moderate-after (no pre-approval queue) — reuse the `Report` mechanism from Step 11 for moderation.
3. An accepted answer (post author marks it) feeds into: contribution score (Step 5/16) and peer-tutoring suggestions (Step 17, if built).
4. **Offline drafting**: a `Post` or `Answer` composed while offline saves locally and queues to submit automatically on reconnect (same pattern as offline attendance/MCQ attempts) — low risk, since the worst case is a post arriving a few minutes late. This is drafting-and-queueing only, not offline browsing of the full Q&A feed (that's covered separately by the generic offline-read cache in Step 1, which handles already-viewed content, not live posting).

**Done when:** students and teachers can both post and answer; an accepted answer is recorded; reported posts/answers can be removed by teacher/admin; a post composed offline submits automatically once the device reconnects.

---

## STEP 10 — Private growth/contribution profile
1. Aggregate existing data (no new collection) into a private, per-student, per-term view: Q&A answers given/accepted, books read, attendance rate, club participation.
2. Visible only to the student themselves — never comparative, never shown to peers.

**Done when:** a student can see their own contribution summary; no other role/student can view another student's growth profile.

---

## STEP 11 — Chat (group, class, DM, teacher messaging)
1. Create:
```
ChatChannel(id, type[group|dm], scope[class|club|school] nullable, class_id nullable FK)
ChatChannelMember(channel_id FK, user_id FK, joined_at)
Message(id, channel_id FK, sender_id FK, content, sent_at, is_reported)
Report(id, message_id FK nullable, post_id FK nullable, reported_by FK, reason, status[open|reviewing|resolved], reviewed_by FK nullable, created_at)
```
2. Channel types to support: student↔student 1:1 (`dm`), student group chats, class-wide group (`group`, `scope: class`), and student↔teacher messaging (a `dm`-type channel between a student and a teacher, or teacher included as a member of a class group).
3. **Critical RLS rule**: a `dm`-type channel's `Message` rows are visible ONLY to that channel's `ChatChannelMember` rows. No admin/staff query path may read `dm` messages under any circumstance — write this as a Postgres policy, test it explicitly (log in as admin, confirm a query for another user's DM thread returns nothing).
4. `group`-type channels (including class-wide) are visible to teachers/admins for moderation.
5. Use Supabase Realtime Broadcast for delivery; persist every message to the `Message` table as it's sent (broadcast alone does not give permanent history).
6. Build the `Report` flow: a student can report any message (DM or group) or Q&A post/answer; this is the only path that surfaces a specific reported item to staff — never a blanket view into DMs.

**Done when:** all four channel types work; the admin-cannot-read-DMs test passes explicitly; reporting a DM message surfaces only that message to a reviewer, nothing else from the thread.

---

## STEP 12 — Anonymous complaints channel
1. Create: `AnonymousSubmission(id, body, category, created_at, status[open|reviewing|resolved])` — **no sender identity field at all**, not hidden, genuinely absent from the schema.
2. Admin-only view of submissions, with status tracking.

**Done when:** a submission is created with zero identifying data anywhere (verify by inspecting the row — there is nothing to redact because nothing is stored); admin can update status.

---

## STEP 13 — Clubs
1. Create: `Club(id, name, description)`, `ClubMembership(club_id FK, student_id FK, role)`.
2. Club page listing members and activity; membership feeds into house points, growth profile, and yearbook (Step 15).

**Done when:** students can join/view clubs; club membership is queryable by the features that depend on it.

---

## STEP 14 — House system
1. Create: `House(id, name)`, `HouseMembership(student_id FK, house_id FK)`.
2. House points = weighted rollup of existing data (academic averages, attendance, library engagement, Q&A participation, club activity) — no new scoring logic, just an aggregation query feeding a house-scoped `LeaderboardEntry`-style record.
3. Reuse the podium UI component from Step 5 for house display.

**Done when:** house leaderboard renders using the same podium pattern, correctly aggregating each listed data source.

---

## STEP 15 — Yearbook / time capsule
1. On `Session` close, generate a per-class static page: house results, top Q&A contributors, library milestones, club highlights, teacher-picked mentions.
2. Presentation layer only — no new data collection, reads from tables already populated by prior steps.

**Done when:** closing a session produces a viewable yearbook page per class with real data from that session.

---

## STEP 16 — Notifications (curated, not noisy)
1. Create: `Notification(id, user_id FK, type, title, body, related_entity_id nullable, created_at, read_at nullable)`, `NotificationPreference(user_id FK, type, enabled)`.
2. Trigger notifications ONLY for genuinely important events: new score published, new school/class-scope announcement, a new DM or unread group message, a report resolved, a rank change on the student's own leaderboard entry, an approaching WAEC/JAMB date. Do not notify for every minor event (e.g., not for every single Q&A reply on posts the user isn't following).
3. Use Web Push (free, no SMS/paid email gateway) via a service worker.
4. Let users toggle notification types off in `NotificationPreference` — respect it strictly.

**Done when:** only the listed trigger types produce notifications; toggling a preference off actually suppresses that type; no paid notification service is used.

---

## STEP 17 — Management Intelligence
1. Create:
```
AttentionFlag(id, severity[critical|important|review], category[academic|attendance|operations|admissions], message, related_entity_id, related_entity_type, created_at, resolved_at nullable)
HealthScoreSnapshot(id, period_id, academic_pct, attendance_pct, operations_pct, engagement_pct, admissions_pct, overall_pct, computed_at)
```
2. Dashboard shows every metric with a trend delta (↑/↓ vs previous period) — never a bare current value.
3. Scheduled job evaluates threshold rules to populate `AttentionFlag` (e.g., critical: class/subject average drop > configurable % term-over-term; important: teacher has overdue score entry or curriculum behind schedule; review: pending library approvals or admission applications older than N days).
4. `HealthScoreSnapshot.overall_pct` is a documented, visible weighted average of the five components — clicking it always shows the breakdown.
5. Teacher operations view: per-teacher status (assessments submitted vs. expected, curriculum completion, last score-entry timestamp) as attention flags — never a ranked "worst teacher" list.
6. Admissions funnel view: `AdmissionApplication` counts by stage, conversion rate at each step, and by `source` (use Cloudflare Web Analytics, free, for source attribution — no paid analytics).
7. **Guardrail**: no `Fee`/`Payment` write tables. If fee visibility is wanted later, it is a read-only display fed by an external import, never authored here.

8. **Admin — User & Settings Console.** This is a distinct, coherent surface (not scattered across pages), designed to be genuinely simple to operate:
   - **User list**, searchable/filterable by role, with a per-user librarian toggle (`is_librarian` on/off) — assigning or removing librarian privilege from any student or teacher account should take one click plus a confirmation, nothing more.
   - **Teacher approval queue**: every `User` with `role = teacher` and `teacher_approval_status = pending`, with one-click approve/reject. A rejected account should clearly show why it can't log in fully (don't leave it in a silent limbo state).
   - **Guardian-contact follow-up list**: students flagged by the `AttentionFlag` review rule for missing `GuardianContact` data, so admin can chase this down directly rather than hunting for it.
   - **System settings hub**: the configurable values introduced across this plan (assessment weight defaults, attention-flag thresholds, notification categories, `Class.max_capacity` per section) collected in one place, not buried inside each individual feature's own settings.

**Done when:** every dashboard metric shows a trend delta; the attention queue populates from real rule evaluations, not manual entry; the health score breakdown is inspectable; the teacher view never renders as a ranking; an admin can approve a pending teacher, grant/revoke librarian privilege, and review a flagged missing-guardian-contact student all from this one console without needing to know any underlying table names.

---

## STEP 18 — Automatic student lifecycle & alumni / "school memory"

**Design decision (resolved)**: the system must promote and graduate students automatically at session close — no admin manually re-typing 1,000 students into new classes or manually flagging graduates. Alumni get a lightweight real account (not just static content), scoped narrowly.

1. Extend `Student` with `status[enrolled|graduated|withdrawn]`.
2. Create:
```
GraduationBatch(id, session_id FK, processed_at)
Alumni(id, user_id FK, graduated_session_id FK, current_bio nullable, opted_into_directory boolean default false)
```
3. Build a **scheduled/triggered job that runs at session close** (same Edge Function pattern as the ranking job, triggered by an admin action "close session," never automatic-without-confirmation since this is irreversible in bulk):
   - Every `Student` whose `Class.grade_level` is the final level (SSS3) and `status = enrolled` → set `status = graduated`, create an `Alumni` row linking their `User`, and downgrade their `User.role` from `student` to `alumni`.
   - Every other enrolled student → auto-promote to the next `grade_level`'s equivalent section (JSS1A → JSS2A, etc. — preserve section letter where the target class exists; flag to admin as an `AttentionFlag` (review severity) any student whose section doesn't cleanly map, for manual resolution rather than silent guessing).
   - Log every promotion/graduation as a row for audit (who/what changed, when) — this is a bulk, irreversible-feeling action, so it must be inspectable after the fact.
4. **Alumni access, scoped narrowly** (this is the resolved scope — not full portal access):
   - Can log in, see public news and the yearbook/memory content for their own graduated class and earlier
   - Can optionally opt into a simple alumni directory (`opted_into_directory`) visible to other alumni and admin only — off by default, never opt-out-after-the-fact required
   - No access to current students' grades, chat, or any current-student data
   - If peer/mentoring contact with current students is ever wanted, route it through the same teacher-approved `TutorSession`-style pattern from Step 17's peer tutoring, never open DM access to current students — do not build open alumni-to-student messaging
5. The yearbook (Step 15) automatically pulls in each graduating class's `Alumni` records going forward — this is what makes "school memory" a living archive rather than a one-time snapshot.

**Done when:** closing a session automatically transitions the right students to `alumni` and promotes the rest, with no manual per-student data entry; an alumni account can log in and see only what's scoped to them; the directory opt-in defaults to off; a mis-mapped section produces a review flag instead of a silent error.

---

## STEP 19 — Personalization and effortless-value details (student, teacher, management)

This step is about polish that makes the system feel alive and owned, not administered. Apply these across the relevant earlier steps' UI, not as one isolated feature. There is no parent-facing item here — parents are not users of this system (see Step 2); guardian contact exists solely as staff-facing data.

**Students — "feels like their own":**
- Let students pick a profile theme/frame accent unlocked through achievements already tracked (house points, contribution, reading milestones) — cosmetic only, never pay-to-unlock, never affects any ranking.
- Home dashboard (Step 3-style "campus pulse" concept) should lead with what matters *today* for that specific student — next class from their `TeachingSchedule`-derived timetable, nearest deadline, one relevant pulse item — not a static menu.

**Teachers — "without effort":**
- Auto-compiled "my week" view: pulled automatically from `TeachingSchedule` + pending score entries + curriculum topics behind schedule — the teacher never assembles this manually, it's a read of data already in the system (consistent with the one-input-multiple-outputs principle).
- Score-entry grid (Step 4) should default-open to the teacher's next scheduled class based on `TeachingSchedule` and current time — not a blank picker every time.

**Management — "feels like their own":**
- Let admins save and name custom attention-queue filters/dashboard views (e.g., "SSS3 watch list") — a small `SavedView(id, admin_id FK, name, filter_config JSON)` table, so the dashboard adapts to how a specific admin actually works rather than one fixed layout for everyone.

**Done when:** each stakeholder's home/primary view visibly reflects their own current context (not a generic template), teachers' weekly view requires zero manual assembly, and admins can save at least one custom view.

---

## STEP 20 — Hardening & launch
1. Accessibility audit: WCAG 2.1 AA — keyboard nav, contrast, screen-reader labels on every interactive element.
2. Performance audit: Lighthouse 90+ across public and portal pages.
3. Security review: confirm RLS is enabled on every single table (check systematically, not by memory, and cross-check against Supabase's built-in Security Advisor); confirm every write endpoint re-validates role/scope server-side; explicitly re-run the DM-privacy test from Step 11; explicitly test that a pending teacher (`teacher_approval_status = pending`) cannot access any teacher-only endpoint; explicitly test that `is_librarian` grants library-management access without altering any of the account's other role-based permissions; explicitly test that a student's `class_id` update is rejected once `class_locked = true`, from a direct API call, not just from the UI.
4. Configure Supabase project settings explicitly (do not leave on defaults):
   - Data API: **on** (required for `supabase-js`).
   - "Automatically expose new tables": **off** — a new table must be manually granted Data API access after its RLS policy exists, never exposed by default the moment it's created.
   - Auth → Settings: minimum password length raised to at least 8 (12 preferred), email confirmation required, every unused OAuth provider disabled, redirect URLs whitelisted to the production domain only.
   - Rotate to the new publishable/secret key format rather than the legacy anon/service_role keys.
5. Set up a scheduled health-check ping (free GitHub Actions cron) to prevent the Supabase free project from pausing after 7 days of inactivity.
6. Set up a periodic export of `Message`/`AttendanceRecord` older than 2 sessions to keep the free-tier database size well under its cap.
7. Staff training on the CMS/gradebook.

**Done when:** every checklist item above passes, the Supabase dashboard settings match item 4 exactly (not defaults), and the platform runs at $0/month with real student/teacher/admin usage.
