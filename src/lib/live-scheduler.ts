/**
 * Pure scheduling decisions for live polling.
 *
 * Extracted from the `useLiveQuery` hook so they can be tested without a DOM,
 * timers, or a network. The hook is the last core logic module without
 * coverage, and a bug there causes *silent staleness*: no error, no crash,
 * just data quietly out of date. That is the hardest failure class to notice
 * in production, which is why it gets a test suite rather than a click-through.
 *
 * Three separate concerns, kept apart because they fail independently:
 *
 *  1. Chaining. The next poll is scheduled only after the previous request
 *     settles, so a slow or hung request can never stack overlapping calls.
 *     `setInterval` would, and that is the classic bug on a school network.
 *
 *  2. Staleness. A slow response that resolves after a newer one (the user hit
 *     refresh mid-flight, or the tab was hidden and resumed) must be dropped
 *     rather than allowed to clobber fresher state.
 *
 *  3. Equality. `setState` is skipped when the payload is identical, so idle
 *     polling does not re-render the tree every interval.
 */

export type Visibility = "visible" | "hidden";

export type ScheduleDecision = {
  /** Whether to arm the next timer. */
  shouldSchedule: boolean;
  /** Delay before the next poll. Only meaningful when shouldSchedule. */
  delayMs: number;
};

/**
 * Decides whether to arm the next poll after a fetch has settled.
 *
 * Pure function of `(intervalMs, visibility)`, so it can be asserted
 * directly. The rules:
 *
 *  - `intervalMs <= 0` means "fetch once, never poll": no timer.
 *  - A hidden tab must not poll. The timer is simply not armed; the hook
 *    re-fetches immediately when the tab becomes visible again.
 *  - Otherwise, poll after `intervalMs`.
 *
 * The chained-timeout property — that a slow request can never produce
 * overlapping calls — is a consequence of the hook awaiting `run()` before
 * calling this. Testing the decision alone covers the *policy*; the hook's
 * structure covers the *mechanism*.
 */
export function decideNextPoll(
  intervalMs: number,
  visibility: Visibility,
): ScheduleDecision {
  if (intervalMs <= 0) return { shouldSchedule: false, delayMs: 0 };
  if (visibility === "hidden") return { shouldSchedule: false, delayMs: 0 };
  return { shouldSchedule: true, delayMs: intervalMs };
}

/**
 * Decides whether a response is stale and must be discarded.
 *
 * `issuedAt` is the sequence number captured when the request was sent;
 * `currentSeq` is the latest sequence number. If another request has been
 * issued since, this response is out of date and must not be applied.
 *
 * The unmount check is separate: a response arriving after the component is
 * gone must be dropped even if no newer request was issued, because there is
 * no state left to update.
 */
export function isStaleResponse(
  issuedAt: number,
  currentSeq: number,
  mounted: boolean,
): boolean {
  if (!mounted) return true;
  return issuedAt !== currentSeq;
}

/**
 * Decides whether a payload differs from the current state.
 *
 * Defaults to a JSON comparison, which is safe here because the same query
 * always returns keys in the same order. Exposed as a pure function so the
 * default can be asserted, and so callers can supply a cheaper comparison
 * for large payloads.
 */
export function payloadChanged<T>(
  next: T,
  current: T | undefined,
  equals: (a: T, b: T | undefined) => boolean = defaultEquals,
): boolean {
  return equals(next, current);
}

export function defaultEquals<T>(next: T, current: T | undefined): boolean {
  return current === undefined || JSON.stringify(next) !== JSON.stringify(current);
}

/**
 * Decides the status after a failed fetch.
 *
 * A transient error must keep the last good data on screen. The status only
 * downgrades to "error" when there was no prior successful load; if the feed
 * was already live, it stays live so the UI does not flicker on a transient
 * blip.
 */
export function statusAfterFailure(current: "idle" | "loading" | "live" | "error"): "live" | "error" {
  return current === "live" ? "live" : "error";
}

/**
 * Decides the status when a fetch begins.
 *
 * The first load is "loading"; subsequent polls keep the current status so a
 * background refresh does not flash a spinner over live data.
 */
export function statusOnFetchStart(current: "idle" | "loading" | "live" | "error"): "loading" | "live" | "error" {
  return current === "idle" ? "loading" : current;
}
