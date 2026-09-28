/**
 * PostgREST query construction for the attendance recorder.
 *
 * Extracted so it can be unit-tested without a database, for the same reason
 * as `queries/assignments.ts`: a malformed filter here fails as a 400 from
 * Postgres, and in this component that surfaces as a spurious error toast
 * rather than a crash, so nothing else in the toolchain catches it.
 *
 * The bug this guards is specific. `date` is derived from a hydration-gated
 * clock, so it is the empty string on the first effect run. Interpolating that
 * straight into the filter produces `date=eq.`, and Postgres rejects an empty
 * string for a `date` column:
 *
 *   {"code":"22007","message":"invalid input syntax for type date: \"\""}
 *
 * `buildAttendanceDayQuery` therefore refuses to build a query without a
 * usable date, and the component skips the request entirely. Previously the
 * recorder fired that request on every page load and every teacher saw a
 * "Could not load attendance" toast for a fraction of a second, before the
 * effect re-ran with the real date and quietly fixed it.
 */

/** An ISO `YYYY-MM-DD` date, matching the column's type. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True when `value` is safe to interpolate into a `date=eq.` filter.
 *
 * Rejects the empty string, `null` and `undefined`, which are exactly the
 * states the pre-hydration clock produces.
 */
export function isUsableDate(value: string | null | undefined): value is string {
  return typeof value === "string" && ISO_DATE.test(value);
}

const EXISTING_SELECT = "select=student_id,status,synced_at";

/**
 * Builds the query for the day's existing attendance rows, or null when the
 * date is not usable yet.
 *
 * Returning null rather than a broken query makes the "wait for hydration"
 * decision explicit at the call site instead of hiding it behind a string.
 */
export function buildAttendanceDayQuery(
  date: string | null | undefined,
  select: string = EXISTING_SELECT,
): string | null {
  if (!isUsableDate(date)) return null;
  return `AttendanceRecord?date=eq.${encodeURIComponent(date)}&${select}`;
}

/**
 * Build path for saving. Uses an upsert keyed on student and date, so marking
 * a student present and then absent updates the single row rather than
 * appending a second one.
 */
export function buildAttendanceSavePath(): string {
  return "AttendanceRecord?on_conflict=student_id,date";
}

export const ATTENDANCE_SAVE_HEADERS = {
  "Content-Type": "application/json",
  Prefer: "resolution=merge-duplicates,return=minimal",
};

export { EXISTING_SELECT };
