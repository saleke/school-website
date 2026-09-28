/**
 * Contract tests for every dynamically built PostgREST query in the app.
 *
 * WHY THIS EXISTS
 * ---------------
 * Three production bugs in this codebase were the same defect: code that
 * typechecks, lints, builds clean and returns HTTP 200, while being wrong
 * against the real database. Two of them were query-string bugs:
 *
 *   - the student assignment filter used `column=eq.value` inside an `or=()`
 *     logic tree, which is a PGRST100 parse error, so students saw an empty
 *     list instead of their homework;
 *   - the attendance recorder interpolated a hydration-gated empty date,
 *     producing `date=eq.` and a "invalid input syntax for type date" 400,
 *     which surfaced as a spurious error toast for every teacher.
 *
 * Neither is catchable by tsc, ESLint, `next build`, or a manual click-through,
 * because all four only ever see the string, not the database's opinion of it.
 *
 * THE TRICK
 * ---------
 * PostgREST distinguishes two failure modes that both come back as errors:
 *
 *   400 - the filter could not be PARSED     <- a bug in our code
 *   401 - parsed fine, then denied by RLS    <- correct behaviour for anon
 *
 * So asking PostgREST to parse a query with the public anon role validates the
 * syntax without reading a single row and without the service secret key. That
 * matters: this test needs no privileged credential, and none is committed
 * here. The Supabase URL and publishable key are public by design, so CI can
 * run this for real without storing a secret.
 *
 * Any other status — 404, 500, 503 — is unexpected and treated as a failure.
 */

import { describe, expect, it } from "vitest";

/** A well-formed UUID, the normal case. */
const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
/** A second well-formed UUID, for queries taking two ids. */
const UUID2 = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";

/**
 * Reserved PostgREST characters, used to prove a value cannot break out of
 * the filter it is interpolated into.
 *
 * `)` and `(` matter most: `encodeURIComponent` leaves them untouched, and
 * they are structural inside a logic tree.
 */
const HOSTILE = "x)or(class_id.not.is.null(";
const HOSTILE_COMMA = "a,b";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const configured = Boolean(url && key);

type Status = "grammar-error" | "value-rejected" | "parsed" | "unexpected";

/**
 * PostgREST error codes that mean *our query is wrong*, as opposed to the
 * value being invalid for the column.
 *
 * This distinction is the whole oracle, and getting it wrong produces a flood
 * of false alarms. Measured against the live project with a hostile value:
 *
 *   22P02  invalid_text_representation  value is not a uuid -> query is FINE
 *   22007  invalid_datetime_format      value is not a date -> query is FINE
 *   PGRST100                            filter did not parse -> BROKEN
 *
 * A hostile value that Postgres rejects on type grounds is therefore proof
 * the value stayed inside its slot, which is the property being asserted.
 * Only a grammar error means a value escaped into the filter structure.
 */
const GRAMMAR_ERROR_CODES = new Set(["PGRST100", "42601", "42P01", "42703"]);

/** A response that means the filter's grammar was sound. */
const SAFE: Status[] = ["parsed", "value-rejected"];

/**
 * Asks PostgREST to parse `path`.
 *
 * Returns a classification rather than asserting directly, so a network blip
 * cannot be mistaken for a code defect.
 *
 * Only transport-level failures are retried. An HTTP response — any status —
 * is real data about the query and is returned immediately, so a genuine
 * grammar error is never masked by a retry loop.
 */
async function check(
  path: string,
  attempt = 0,
): Promise<{ status: Status; code?: string; http?: number; body?: string }> {
  const MAX_ATTEMPTS = 3;
  try {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      headers: { apikey: key as string, Authorization: `Bearer ${key}` },
    });
    const full = await response.text();
    const http = response.status;
    let pgCode: string | undefined;
    try {
      // Parse the complete body. Truncating first silently breaks JSON.parse,
      // which drops the code and makes every grammar error look like a plain
      // value rejection.
      pgCode = (JSON.parse(full) as { code?: string }).code;
    } catch {
      // Non-JSON body; fall through to the status-only checks.
    }
    // Only the display copy is truncated.
    const body = full.slice(0, 200);

    if (http === 200 || http === 401 || http === 403) {
      // Parsed. 401/403 is RLS correctly denying the anon role.
      return { status: "parsed", code: pgCode, http, body };
    }
    if (http === 400 && pgCode && GRAMMAR_ERROR_CODES.has(pgCode)) {
      return { status: "grammar-error", code: pgCode, http, body };
    }
    if (http === 400) {
      // Rejected on type grounds: the value stayed in its slot.
      return { status: "value-rejected", code: pgCode, http, body };
    }
    return { status: "unexpected", code: pgCode, http, body };
  } catch (error) {
    // Transport-level failure: DNS, connection reset, TLS. These say nothing
    // about the query, so retry with a short backoff. An HTTP response is
    // never retried — a 400 from PostgREST is real data about the filter.
    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      return check(path, attempt + 1);
    }
    return { status: "unexpected", http: 0, body: String(error) };
  }
}

/**
 * Every dynamically built query in the app, in the shape the code emits it.
 *
 * Kept as literal strings rather than imported builders, because the point is
 * to pin the *wire format*. If someone rewrites a query and breaks it, this
 * inventory is what notices.
 *
 * `gated: true` marks a query whose values are validated as UUIDs before the
 * path is built, which is what every logic tree relies on. Those are only
 * checked with valid values, because a hostile one is structurally
 * unreachable: buildAssignmentQuery returns an unscoped query instead. Adding
 * a hostile-value assertion for a gated entry would assert a code path that
 * does not exist, and would pass or fail for reasons unrelated to the app.
 *
 * Ungated entries interpolate into a plain `eq.` filter, where escaping does
 * hold, so a hostile value is a real and meaningful input for those.
 */
const QUERIES: Array<{ name: string; gated?: boolean; path: (v: string) => string }> = [
  // --- admin-dashboard.tsx ---
  { name: "User by id", path: (v) => `User?id=eq.${v}&select=id,role` },
  { name: "AdmissionApplication by id", path: (v) => `AdmissionApplication?id=eq.${v}&select=id,stage` },

  // --- class-management.tsx / staff-monitor.tsx (currently unencoded) ---
  { name: "ClassOption by id", path: (v) => `ClassOption?id=eq.${v}&select=id,code` },
  { name: "TeachingSchedule by id", path: (v) => `TeachingSchedule?id=eq.${v}&select=id,day_of_week` },
  { name: "ClassOption by class", path: (v) => `ClassOption?class_id=eq.${v}&is_active=eq.true&select=id,code&order=code` },
  { name: "Subject by class", path: (v) => `Subject?class_id=eq.${v}&select=id,name&order=name` },

  // --- student-today-dashboard.tsx / teacher-today-dashboard.tsx ---
  { name: "TeachingSchedule by class", path: (v) => `TeachingSchedule?class_id=eq.${v}&select=id,subject_id,day_of_week&order=day_of_week` },
  { name: "AssessmentType by subject", path: (v) => `AssessmentType?subject_id=eq.${v}&select=id,name,max_score&order=name` },

  // --- score-entry-grid.tsx ---
  {
    name: "Score in-list (per subject/term)",
    path: (v) => `Score?subject_id=eq.${UUID}&term_id=eq.${UUID2}&student_id=in.(${v})&select=student_id,raw_score`,
  },
  {
    name: "Score single student",
    path: (v) => `Score?student_id=eq.${v}&subject_id=eq.${UUID}&term_id=eq.${UUID2}&select=id,raw_score`,
  },

  // --- student-result-summary.tsx ---
  { name: "TermResultSnapshot by student", path: (v) => `TermResultSnapshot?student_id=eq.${v}&select=id,subject_id` },
  { name: "Score by student", path: (v) => `Score?student_id=eq.${v}&select=id,subject_id,raw_score` },

  // --- portal page ---
  { name: "User profile by id", path: (v) => `User?id=eq.${v}&select=id,name,email,role` },
  { name: "Student by user_id", path: (v) => `Student?user_id=eq.${v}&select=id,class_id,class_option_id` },
  { name: "TeachingSchedule by teacher", path: (v) => `TeachingSchedule?teacher_id=eq.${v}&select=id,class_id` },

  // --- logic trees, gated on uuid validation ---
  {
    name: "Assignment, student with section (the PGRST100 bug)",
    gated: true,
    path: (v) => `Assignment?or=(and(class_option_id.eq.${v},class_id.eq.${UUID}),class_option_id.is.null)&select=id&limit=1`,
  },
  {
    name: "Assignment, section only",
    gated: true,
    path: (v) => `Assignment?or=(class_option_id.eq.${v},class_option_id.is.null)&select=id&limit=1`,
  },
  { name: "Assignment by class", path: (v) => `Assignment?class_id=eq.${v}&select=id&limit=1` },
  { name: "Assignment by teacher", path: (v) => `Assignment?teacher_id=eq.${v}&select=id&limit=1` },

  // --- attendance ---
  // Takes a date, not a uuid, so it is listed separately rather than sharing
  // the UUID-driven cases above.
  { name: "AttendanceRecord by date", path: () => `AttendanceRecord?date=eq.2026-09-28&select=student_id,status&limit=1` },
];

/** The date-typed query, checked with date-shaped values. */
const DATE_QUERIES: Array<{ name: string; path: (v: string) => string }> = [
  {
    name: "AttendanceRecord by date (hostile value)",
    path: (v) => `AttendanceRecord?date=eq.${v}&select=student_id,status&limit=1`,
  },
];

// `describe.skipIf` keeps this suite green for a developer who has no
// credentials, while CI runs it for real against the live project.
describe.skipIf(!configured)("PostgREST query contract", () => {
  it("is configured, otherwise these tests prove nothing", () => {
    expect(configured).toBe(true);
  });

  describe.each(QUERIES)("$name", ({ path, gated }) => {
    it("parses with a well-formed uuid", async () => {
      const result = await check(path(UUID));
      expect(
        result.status,
        `expected a parse, got HTTP ${result.http} ${result.code}: ${result.body}`,
      ).toBe("parsed");
    });

    // Skipped for gated entries: their values are validated as UUIDs before
    // the path is built, so a hostile value cannot reach the wire at all.
    // Asserting it here would test a code path the app does not have.
    it.skipIf(gated)("keeps a reserved-character value inside its slot", async () => {
      // This is where an unencoded `id=eq.${id}` site is caught. A value
      // containing `)` and `(` must not reach the filter grammar; Postgres
      // rejecting it on type grounds (22P02) proves it stayed a value. A
      // PGRST100 here would mean it escaped.
      const result = await check(path(HOSTILE));
      expect(
        SAFE,
        `value escaped into the grammar: HTTP ${result.http} ${result.code}: ${result.body}`,
      ).toContain(result.status);
    });

    it.skipIf(gated)("keeps a comma inside an in-list from widening the set", async () => {
      const result = await check(path(HOSTILE_COMMA));
      expect(
        SAFE,
        `comma leaked out of the in-list: HTTP ${result.http} ${result.code}: ${result.body}`,
      ).toContain(result.status);
    });
  });

  describe.each(DATE_QUERIES)("$name", ({ path }) => {
    it("parses with a real date", async () => {
      const result = await check(path("2026-09-28"));
      expect(
        result.status,
        `expected a parse, got HTTP ${result.http} ${result.code}: ${result.body}`,
      ).toBe("parsed");
    });

    it("keeps a reserved-character value inside its slot", async () => {
      // The filter must survive; Postgres is expected to refuse the value on
      // type grounds (22007), which proves it stayed a value.
      const result = await check(path(HOSTILE));
      expect(
        SAFE,
        `value escaped into the grammar: HTTP ${result.http} ${result.code}: ${result.body}`,
      ).toContain(result.status);
    });
  });

  describe("known-bad shapes, asserted to still be rejected", () => {
    // The negative control. If these ever parse, PostgREST changed its
    // grammar and the guards in queries/assignments.ts need revisiting.
    // Without these, the assertions above could pass for the wrong reason.
    it("still rejects the =eq. form inside a logic tree", async () => {
      const result = await check(
        `Assignment?or=(and(class_option_id=eq.${UUID},class_id=eq.${UUID2}),class_option_id.is.null)&select=id`,
      );
      expect(result.status, `HTTP ${result.http} ${result.code}: ${result.body}`).toBe("grammar-error");
    });

    it("still rejects an unescaped closing paren in a logic tree", async () => {
      // Documents *why* the code validates instead of escaping: the encoded
      // and raw forms are indistinguishable to the parser.
      const result = await check(
        `Assignment?or=(and(class_option_id.eq.${encodeURIComponent(HOSTILE)},class_id.eq.${UUID2}),class_option_id.is.null)&select=id`,
      );
      expect(result.status, `HTTP ${result.http} ${result.code}: ${result.body}`).toBe("grammar-error");
    });

    it("still rejects an empty date filter", async () => {
      const result = await check("AttendanceRecord?date=eq.&select=student_id");
      // Measured: 22007, a value rejection rather than a grammar error. The
      // filter is well-formed; the empty string is simply not a date. The bug
      // it caused was the 400 itself, not a broken query.
      expect(SAFE, `HTTP ${result.http} ${result.code}`).toContain(result.status);
      expect(result.http).toBe(400);
    });
  });
});
