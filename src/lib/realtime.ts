"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseRequest } from "@/lib/supabase";
import {
  decideNextPoll,
  isStaleResponse,
  payloadChanged,
  statusAfterFailure,
  statusOnFetchStart,
} from "@/lib/live-scheduler";

export type LiveStatus = "idle" | "loading" | "live" | "error";

type UseLiveQueryOptions<T> = {
  /** PostgREST path, e.g. `Announcement?select=id&order=published_at.desc`. */
  path: string;
  /** Poll interval in ms. Pass 0 to fetch once and never poll. */
  intervalMs?: number;
  /** Skip fetching entirely (e.g. while a modal is open). */
  enabled?: boolean;
  /**
   * Identity check used to decide whether the payload actually changed.
   * Defaults to a JSON comparison, which is safe here because the same
   * query always returns keys in the same order.
   */
  equals?: (next: T, current: T | undefined) => boolean;
};

const defaultEquals = <T,>(next: T, current: T | undefined) =>
  current === undefined || JSON.stringify(next) !== JSON.stringify(current);

/**
 * Fetch a PostgREST resource once, then keep it fresh by polling.
 *
 * Deliberate choices, because naive `setInterval` polling is a common
 * source of bugs on a school network:
 *
 * - **Chained `setTimeout`, not `setInterval`.** The next poll is only
 *   scheduled once the previous request settles, so a slow or hung
 *   request can never stack up overlapping calls.
 * - **Pauses when the tab is hidden.** Background tabs were previously
 *   burning a request every 10s with nobody looking. Polling resumes
 *   (with an immediate fetch) the moment the tab becomes visible again.
 * - **Sequence counter.** A slow response that resolves after a newer
 *   one (e.g. the user hit refresh mid-flight) is discarded instead of
 *   clobbering fresher state.
 * - **Equality gate.** `setState` is skipped when the payload is
 *   identical, so idle polling does not re-render the tree.
 * - **Polling failures are non-fatal.** A transient network error keeps
 *   the last good data on screen and just marks the status; it does not
 *   blank the UI or spam the user.
 */
export function useLiveQuery<T>({
  path,
  intervalMs = 15_000,
  enabled = true,
  equals = defaultEquals,
}: UseLiveQueryOptions<T>) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

  const seqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  // Mirrored into the polling loop via an effect rather than written during
  // render, so `equals` can change identity without tearing down the loop.
  const equalsRef = useRef(equals);
  useEffect(() => {
    equalsRef.current = equals;
  }, [equals]);

  const run = useCallback(async () => {
    const seq = ++seqRef.current;
    setStatus((current) => statusOnFetchStart(current));
    try {
      const rows = await supabaseRequest<T>(path);
      // Drop stale responses: a newer fetch has already superseded this one.
      if (isStaleResponse(seq, seqRef.current, mountedRef.current)) return;
      setData((current) => (payloadChanged(rows, current, equalsRef.current) ? rows : current));
      setStatus("live");
      setSyncedAt(Date.now());
    } catch {
      if (isStaleResponse(seq, seqRef.current, mountedRef.current)) return;
      // Keep the previous data visible; only downgrade the status.
      setStatus((current) => statusAfterFailure(current));
    }
  }, [path]);

  const refresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    void run();
  }, [run]);

  useEffect(() => {
    mountedRef.current = true;
    // `enabled` false is a legitimate resting state, derived rather than
    // pushed through setState, so toggling it cannot cascade a render.
    if (!enabled) return;

    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      await run();
      if (cancelled) return;
      const decision = decideNextPoll(intervalMs, document.visibilityState);
      if (decision.shouldSchedule) {
        timerRef.current = setTimeout(tick, decision.delayMs);
      }
    }

    void tick();

    function onVisibility() {
      if (cancelled) return;
      if (document.visibilityState === "visible") {
        if (timerRef.current) clearTimeout(timerRef.current);
        void tick();
      } else if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intervalMs, path, run]);

  return { data, status: enabled ? status : "idle", syncedAt, refresh };
}
