import { describe, expect, it } from "vitest";
import {
  decideNextPoll,
  defaultEquals,
  isStaleResponse,
  payloadChanged,
  statusAfterFailure,
  statusOnFetchStart,
} from "@/lib/live-scheduler";

/**
 * Tests for the pure scheduling decisions extracted from `useLiveQuery`.
 *
 * The hook is the last core logic module without coverage. A bug there
 * causes silent staleness — no error, no crash, just data quietly out of
 * date — which is the hardest failure class to notice in production.
 */

describe("decideNextPoll", () => {
  it("schedules the next poll after the interval when visible", () => {
    expect(decideNextPoll(15_000, "visible")).toEqual({
      shouldSchedule: true,
      delayMs: 15_000,
    });
  });

  it("does not schedule when intervalMs is 0 (fetch once)", () => {
    expect(decideNextPoll(0, "visible")).toEqual({
      shouldSchedule: false,
      delayMs: 0,
    });
  });

  it("does not schedule when intervalMs is negative", () => {
    expect(decideNextPoll(-1, "visible")).toEqual({
      shouldSchedule: false,
      delayMs: 0,
    });
  });

  it("does not schedule when the tab is hidden", () => {
    expect(decideNextPoll(15_000, "hidden")).toEqual({
      shouldSchedule: false,
      delayMs: 0,
    });
  });

  it("does not schedule when hidden even with a large interval", () => {
    expect(decideNextPoll(60_000, "hidden")).toEqual({
      shouldSchedule: false,
      delayMs: 0,
    });
  });

  it("uses the exact interval provided", () => {
    expect(decideNextPoll(5_000, "visible").delayMs).toBe(5_000);
    expect(decideNextPoll(1_000, "visible").delayMs).toBe(1_000);
  });
});

describe("isStaleResponse", () => {
  it("is stale when a newer request has been issued", () => {
    // Request 1 was sent, then request 2 was issued. Response 1 arrives late.
    expect(isStaleResponse(1, 2, true)).toBe(true);
  });

  it("is not stale when this is the latest request", () => {
    expect(isStaleResponse(2, 2, true)).toBe(false);
  });

  it("is stale when the component has unmounted", () => {
    // Even if no newer request was issued, there is no state to update.
    expect(isStaleResponse(1, 1, false)).toBe(true);
  });

  it("is not stale when mounted and latest", () => {
    expect(isStaleResponse(1, 1, true)).toBe(false);
  });

  it("is stale when unmounted even if it was the latest", () => {
    expect(isStaleResponse(5, 5, false)).toBe(true);
  });
});

describe("payloadChanged", () => {
  it("reports changed when current is undefined (first load)", () => {
    expect(payloadChanged([1, 2], undefined)).toBe(true);
  });

  it("reports changed when payloads differ", () => {
    expect(payloadChanged([1, 2], [1, 3])).toBe(true);
  });

  it("reports unchanged when payloads are identical", () => {
    expect(payloadChanged([1, 2], [1, 2])).toBe(false);
  });

  it("reports changed for objects with different values", () => {
    expect(payloadChanged({ a: 1 }, { a: 2 })).toBe(true);
  });

  it("reports unchanged for deeply equal objects", () => {
    expect(payloadChanged({ a: { b: 1 } }, { a: { b: 1 } })).toBe(false);
  });

  it("uses a custom equals function when provided", () => {
    // Returns true when the ids differ (i.e., the payload has changed).
    const byId = (a: { id: number }, b: { id: number } | undefined) =>
      b === undefined || a.id !== b.id;
    expect(payloadChanged({ id: 1, name: "x" }, { id: 1, name: "y" }, byId)).toBe(false);
    expect(payloadChanged({ id: 1 }, { id: 2 }, byId)).toBe(true);
  });
});

describe("defaultEquals", () => {
  it("treats undefined current as changed", () => {
    expect(defaultEquals("anything", undefined)).toBe(true);
  });

  it("treats identical JSON as unchanged", () => {
    expect(defaultEquals({ a: 1 }, { a: 1 })).toBe(false);
  });

  it("treats different JSON as changed", () => {
    expect(defaultEquals({ a: 1 }, { a: 2 })).toBe(true);
  });

  it("is order-sensitive for arrays", () => {
    expect(defaultEquals([1, 2], [2, 1])).toBe(true);
  });
});

describe("statusAfterFailure", () => {
  it("keeps live status when the feed was already live", () => {
    // A transient error must not flicker the UI when data is on screen.
    expect(statusAfterFailure("live")).toBe("live");
  });

  it("downgrades to error when there was no prior successful load", () => {
    expect(statusAfterFailure("idle")).toBe("error");
    expect(statusAfterFailure("loading")).toBe("error");
  });

  it("stays error when already error", () => {
    expect(statusAfterFailure("error")).toBe("error");
  });
});

describe("statusOnFetchStart", () => {
  it("is loading when the current status is idle (first fetch)", () => {
    expect(statusOnFetchStart("idle")).toBe("loading");
  });

  it("keeps live status on subsequent fetches", () => {
    // A background refresh must not flash a spinner over live data.
    expect(statusOnFetchStart("live")).toBe("live");
  });

  it("keeps error status on a retry after failure", () => {
    expect(statusOnFetchStart("error")).toBe("error");
  });

  it("keeps loading status if already loading", () => {
    expect(statusOnFetchStart("loading")).toBe("loading");
  });
});
