# STEP 19B — Teacher Home Dashboard

Read this whole file before writing any code. This spec depends on tables and design tokens already created in `school-platform-agent-execution-plan.md` (Steps 1, 2, 4, 6, 8, 16, 17) and must not duplicate any of their logic. If those steps have not been built yet, build them first — this dashboard is a read/aggregation layer on top of them, not a new source of truth.

**Hard rule for this whole step: the dashboard performs zero business logic and stores nothing new.** Every number, flag, and line of text shown here is either:
1. a direct read of a row that already exists (e.g. a `TeachingSchedule` entry), or
2. a simple, deterministic SQL aggregate over existing rows (a `COUNT`, a `%`, a date comparison against "today") — never a judgment call, never a new threshold, never a new "is this concerning" decision.

Any judgment call ("is this overdue," "is this behind schedule," "is this worth flagging") must already exist as an `AttentionFlag` row from Step 17's scheduled job. If a piece of the mockup below implies a judgment that has no corresponding `AttentionFlag` rule yet, extend the Step 17 job to produce it — do not compute it inline in the dashboard component. This keeps the rule logic in one place and the dashboard as a pure display of what the system already knows.

This is a **checkpoint step** (same designation as Steps 4/5/11/18 in the main plan): before writing code, explain back in plain language which query feeds each section below and confirm no section re-derives a judgment that Step 17 should own instead. Wait for confirmation before implementing.

---

## 0. Two schema additions required first

Neither of these exists in the current schema. Add them before building the dashboard.

```
ALTER TABLE Class ADD COLUMN form_teacher_id UUID NULL REFERENCES "User"(id);
```
- Set only by `admin`, from the Step 17 admin console (add a simple dropdown to the existing class settings UI — do not build a new screen for this).
- A class has at most one form teacher. A teacher may be form teacher of at most one class. Enforce the second constraint with a unique index on `form_teacher_id` (nullable columns allow multiple NULLs, so this only restricts non-null values, which is what we want).
- RLS: readable by `admin` and by the referenced teacher themselves (`form_teacher_id = auth.uid()`); no other role reads this column directly (form-teacher-only data it unlocks, like the absentee list, already has its own scoping from Step 8).

```
PeerTutoringRequest(id, requester_student_id FK, subject_id FK, status[pending|approved|rejected], reviewing_teacher_id FK nullable, matched_tutor_student_id FK nullable, created_at, resolved_at nullable)
```
- **Conditional**: only create this table, and only render section 4 below, if peer tutoring (mentioned as a future feature in the main plan's Step 17/18) is being built now. If it is not, skip section 4 entirely — do not render a placeholder or a zero count for a feature that doesn't exist yet.
- If built: a request is reviewable only by a teacher whose `TeachingSchedule` includes `subject_id`. RLS: `reviewing_teacher_id` is set on approve/reject, not on creation.

**AttentionFlag RLS extension** (the table already exists from Step 17, currently admin-only per that step's spec): add a policy so a `teacher` may `SELECT` rows where either:
- `related_entity_type = 'teacher' AND related_entity_id = auth.uid()`, or
- `related_entity_type = 'subject' AND related_entity_id IN (SELECT subject_id FROM TeachingSchedule WHERE teacher_id = auth.uid())`, or
- `related_entity_type = 'class' AND related_entity_id IN (SELECT class_id FROM TeachingSchedule WHERE teacher_id = auth.uid())`, or
- `related_entity_type = 'student' AND related_entity_id IN (SELECT s.id FROM Student s WHERE s.class_id = (SELECT id FROM Class WHERE form_teacher_id = auth.uid()))`

A teacher never sees another teacher's flags, and never sees `academic`/`admissions`-category school-wide flags that admin sees — only what's scoped to their own teaching load and (if applicable) their form class.

---

## 1. Route, entry point, and layout shell

- This is the default landing route for any authenticated `teacher` with `teacher_approval_status = 'approved'` — replace whatever generic portal menu they'd otherwise land on. A `pending` teacher still sees the existing waiting-for-approval screen from Step 2, never this dashboard.
- Single route: `/(portal)/teacher`. No tabs, no sub-navigation — everything below renders on one scrollable page, in the section order given.
- Apply the Step 1 notebook design tokens exactly: `--surface-0` page background, `--surface-1` for every card, `--accent` used in exactly the two places named in section 2 and nowhere else on this page (one-accent-per-screen rule from Step 1 applies to this page as its own screen).
- No category color-coding on this page: assessment types, subjects, and days of the week render as plain text/weight, never tinted per item.
- This page is included in the Step 1 generic offline-read cache (stale-while-revalidate). If the device is offline, show the last-fetched version of this page with the existing small "offline — showing cached data" indicator; do not build a bespoke offline mechanism for this route.

---

## 2. Header

Query: `User` row for the current session (name), plus `TeachingSchedule` for this teacher (distinct `subject_id` → `Subject.name`, for the subtitle line), plus a count of unread `Notification` rows (Step 16) for this user.

- Line 1: a greeting computed client-side from local time (`Good morning` / `Good afternoon` / `Good evening`, boundaries at 12:00 and 17:00) followed by the teacher's name.
- Line 2, smaller and `--text-secondary`: today's date, formatted long (e.g. "Tuesday, 25 August"), a middle-dot separator, then the distinct subject names this teacher teaches, comma-separated. If they teach more than 3 subjects, show the first 3 and "+N more."
- Top-right: a bell icon (`ti-bell`) with the unread `Notification` count next to it, in `--accent`. This is the **first** of the two allowed accent uses on this screen. Tapping it opens the existing notification list (Step 16) — do not build a second notification UI here.
- If unread count is 0, show the bell with no number and no accent color — an empty inbox is not an accent-worthy state.

---

## 3. "Today" — class strip

Query: `TeachingSchedule WHERE teacher_id = current_user AND day_of_week = today`, ordered by `start_time` ascending, joined to `Class.name` and `Subject.name`.

- Render as a horizontal row of cards (wrap to a grid on narrow screens), one per scheduled period today, in time order.
- Each card shows: the time range (`start_time`–`end_time`), the class + subject name, and three icon-only quick actions:
  - `ti-checklist` → deep-links to the Step 8 attendance screen, pre-filtered to `class_id` and today's date.
  - `ti-edit` → deep-links to the Step 4 score-entry grid, pre-filtered to `class_id` + `subject_id` + the currently active `Term`. This is the same default-open behavior Step 19 (main plan) already specifies for the grid — this card is simply another entry point into it, not a second implementation.
  - `ti-book` → deep-links to the Step 6 curriculum browser, pre-filtered to `subject_id` + active `Term`, in the teacher's edit mode.
- Determine "now" by comparing server time to each row's `start_time`/`end_time` window: the one card where the current time falls inside the window (if any) gets a `2px solid var(--accent)` border — this is the **second and last** allowed accent use on this screen. All other cards use the plain `--surface-1` card style with no border accent, regardless of whether they're earlier or later in the day. Do not fade or gray out past classes — a completed class is not a lesser one, and graying it implies a status judgment this section isn't making.
- Empty state (no `TeachingSchedule` rows for today — e.g. a weekend or a teacher with no classes scheduled): "No classes scheduled today." Do not render an empty card grid.

---

## 4. "Needs your input" — attention list *(build only if peer tutoring exists; otherwise this section has 3 sources, not 4)*

Query: `AttentionFlag WHERE resolved_at IS NULL AND (<the four RLS-scoped conditions from Section 0>)`, ordered by `severity` (critical → important → review) then `created_at DESC`. Cap at 5 rows with a "view all" link if more exist; the link opens a simple filtered list view, not a new page design.

- Each row: an icon mapped from `category` (`academic` → `ti-alert-circle`, `attendance` → `ti-calendar-x`, `operations` → `ti-clock`, plus for peer tutoring specifically if built, `ti-message-2`), the flag's own `message` field verbatim — **do not paraphrase, recompute, or append extra text to it; if the message needs to say "due in 2 days," that must already be baked into `message` by the Step 17 job at generation time**, and a right-aligned severity badge: `critical` uses `--text-danger`/`--bg-danger`, `important` uses `--text-warning`/`--bg-warning`, `review` renders as plain `--text-secondary` text with no color fill (matching the main plan's rule that color is reserved for genuine semantic signal — `review` is a low-stakes housekeeping item, not a warning).
- If peer tutoring is built, pending `PeerTutoringRequest` rows for subjects this teacher teaches are surfaced the same way, but note these are **not** `AttentionFlag` rows (they're actionable requests, not system-detected issues) — query them separately and merge into the same list by `created_at`, capped at the same total of 5.
- Empty state: "You're all caught up — nothing needs your input." No icon, no card border, just the line in `--text-secondary`.

---

## 5. Form teacher panel — conditional section

Render this section only if `Class.form_teacher_id = current_user.id` for some class. If not, omit the section entirely — do not show it collapsed or with a "you are not a form teacher" message.

Three numbers, each its own simple aggregate query, side by side in one card:

1. **Absent today**: `COUNT(*) FROM AttendanceRecord ar JOIN Student s ON ar.student_id = s.id WHERE s.class_id = <form class> AND ar.date = today AND ar.status = 'absent'`. Tapping the number opens the existing Step 8 form-teacher absentee list — do not rebuild that list here, just link to it.
2. **Missing guardian contact**: `COUNT(*) FROM AttentionFlag WHERE category = 'operations' AND severity = 'review' AND related_entity_type = 'student' AND resolved_at IS NULL AND related_entity_id IN (SELECT id FROM Student WHERE class_id = <form class>)`. This reuses the exact flag Step 2 already specifies for missing `GuardianContact` after the grace period — do not write a second "does this student have a guardian contact" check here.
3. **Week attendance rate**: `ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'present') / NULLIF(COUNT(*), 0), 0)` over `AttendanceRecord` joined to `Student` in the form class, for the last 7 calendar days. This is a plain aggregate, not a judgment call, so it's fine to compute directly here rather than via `AttentionFlag`.

All three render as label-over-number metric cards (per the Step 1 token system — muted 13px label, larger number below), no color coding between them.

---

## 6. "This week" — schedule overview

Query: `TeachingSchedule WHERE teacher_id = current_user`, grouped by `day_of_week`, counted.

- Five columns, Monday through Friday (or however many days the school week the `Term`/`Session` model actually uses — confirm against Step 2's day-of-week values rather than assuming a 5-day week if the schema allows 6).
- Each column: the day abbreviation, and the count of scheduled periods that day. Today's column is the only one styled differently, and only by weight (bold), never by color — this page has already spent its one accent color in sections 2 and 3.
- This is a direct implementation of the "auto-compiled my week" requirement already stated in the main plan's Step 19 — this section is that requirement, not an additional feature.

---

## 7. Loading, error, and refresh behavior

- Each of sections 3–6 loads and renders independently (skeleton placeholder per section) rather than blocking the whole page on the slowest query — a teacher with many `TeachingSchedule` rows shouldn't wait on the `AttentionFlag` query to see today's classes.
- On tab focus/visibility-change, silently re-fetch sections 3 and 4 (the two most time-sensitive) in the background; do not re-fetch on every keystroke or interaction elsewhere on the page.
- If a query fails, show the section's last cached value (via the Step 1 offline-read cache) with a small inline retry affordance for that section only — one section failing never blanks the whole dashboard.

---

## Data-source summary (every element traced to its source, nothing invented)

| Dashboard element | Source | New logic? |
|---|---|---|
| Greeting, subject list | `User`, `TeachingSchedule` | No — direct read |
| Unread count | `Notification` | No — direct read |
| Today's class cards | `TeachingSchedule` + current time | No — direct read + comparison |
| Quick-action deep links | Existing Step 4/6/8 screens | No — routing only |
| Attention list | `AttentionFlag` (scoped via new RLS) | RLS policy is new; flag content is not |
| Peer tutoring requests (if built) | `PeerTutoringRequest` | New table, conditional |
| Absent today | `AttendanceRecord` + `Student` | No — direct aggregate |
| Missing guardian contact | `AttentionFlag` (existing rule) | No — direct read |
| Week attendance rate | `AttendanceRecord` + `Student` | No — direct aggregate |
| Week schedule counts | `TeachingSchedule` | No — direct aggregate |

---

**Done when:** a teacher lands on this page immediately after login with no intermediate menu; every number and message on the page traces to a real row per the table above with no hardcoded or placeholder values; the "now" class card is the only bordered card and the notification count is the only other colored element on the page; the form-teacher section appears only for an actual form teacher and is fully absent (not empty-stated) for everyone else; the attention list shows only flags scoped to this teacher's own `TeachingSchedule`/form class, verified by logging in as a second teacher and confirming their list differs; a teacher with no classes today, no open flags, and no form-teacher assignment sees a calm, correctly-empty page rather than blank sections or errors.
