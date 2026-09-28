import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_SAVE_HEADERS,
  buildAttendanceDayQuery,
  buildAttendanceSavePath,
  isUsableDate,
} from "@/lib/queries/attendance";

/**
 * Regression tests for a bug that shipped: the recorder interpolated a
 * hydration-gated date into a PostgREST filter, so `date` was the empty string
 * on the first effect run and Postgres answered:
 *
 *   {"code":"22007","message":"invalid input syntax for type date: \"\""}
 *
 * The component's catch turned that into a "Could not load attendance" toast,
 * so every teacher saw a spurious error on opening the recorder. It then
 * self-healed when the effect re-ran with the real date, which is why it was
 * never noticed: tsc, ESLint, `next build` and a manual click-through all
 * looked fine.
 */

describe("isUsableDate", () => {
  it("accepts an ISO date", () => {
    expect(isUsableDate("2026-09-28")).toBe(true);
  });

  it("rejects the empty string", () => {
    // The pre-hydration state that caused the bug.
    expect(isUsableDate("")).toBe(false);
  });

  it("rejects null and undefined", () => {
    expect(isUsableDate(null)).toBe(false);
    expect(isUsableDate(undefined)).toBe(false);
  });

  it("rejects a full ISO timestamp, which Postgres would not match", () => {
    expect(isUsableDate("2026-09-28T00:00:00.000Z")).toBe(false);
  });

  it("rejects a date with a SQL fragment appended", () => {
    // Even if a value ever became attacker-influenced, this must not be
    // treated as a valid date.
    expect(isUsableDate("2026-09-28' OR '1'='1")).toBe(false);
  });

  it("rejects a non-date string", () => {
    expect(isUsableDate("today")).toBe(false);
  });
});

describe("buildAttendanceDayQuery", () => {
  it("builds a filter for a valid date", () => {
    expect(buildAttendanceDayQuery("2026-09-28")).toBe(
      "AttendanceRecord?date=eq.2026-09-28&select=student_id,status,synced_at",
    );
  });

  it("returns null rather than a query with an empty date", () => {
    // The core assertion. A string here would mean the `date=eq.` request.
    expect(buildAttendanceDayQuery("")).toBeNull();
  });

  it("returns null for null and undefined", () => {
    expect(buildAttendanceDayQuery(null)).toBeNull();
    expect(buildAttendanceDayQuery(undefined)).toBeNull();
  });

  it("never emits a filter with an empty right-hand side", () => {
    // Belt and braces: assert across every value the clock can produce.
    for (const candidate of ["", null, undefined, "2026-09-28T00:00:00.000Z"]) {
      const query = buildAttendanceDayQuery(candidate);
      // Either no query at all, or one with a real date after eq.
      if (query === null) continue;
      expect(query).toContain("date=eq.2026-09-28");
      expect(query).not.toContain("date=eq.&");
      expect(query).not.toContain("date=eq.)");
    }
  });

  it("selects the columns the component actually reads", () => {
    // student_id, status and synced_at are all consumed after the fetch.
    const query = buildAttendanceDayQuery("2026-09-28");
    expect(query).toContain("select=student_id,status,synced_at");
  });

  it("accepts a custom select clause", () => {
    expect(buildAttendanceDayQuery("2026-09-28", "select=student_id")).toBe(
      "AttendanceRecord?date=eq.2026-09-28&select=student_id",
    );
  });

  it("still guards the date when a select is supplied", () => {
    // The guard must not be bypassable by passing options.
    expect(buildAttendanceDayQuery("", "select=student_id")).toBeNull();
  });
});

describe("buildAttendanceSavePath", () => {
  it("upserts on student and date", () => {
    // Without this key, marking a student present then late would append a
    // second row for the same day instead of correcting the first.
    expect(buildAttendanceSavePath()).toBe(
      "AttendanceRecord?on_conflict=student_id,date",
    );
  });

  it("asks PostgREST to merge duplicates", () => {
    expect(ATTENDANCE_SAVE_HEADERS.Prefer).toContain("resolution=merge-duplicates");
  });

  it("does not ask for a representation it would discard", () => {
    // The component ignores the response body, so the round trip is wasted
    // bandwidth and the Prefer header should say so.
    expect(ATTENDANCE_SAVE_HEADERS.Prefer).toContain("return=minimal");
  });

  it("sends JSON", () => {
    expect(ATTENDANCE_SAVE_HEADERS["Content-Type"]).toBe("application/json");
  });
});
