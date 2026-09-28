"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const REDUCE_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReduceMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCE_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Read a media query as reactive state.
 *
 * `useSyncExternalStore` is the right primitive here: it subscribes to an
 * external system (the OS setting) and stays correct through concurrent
 * rendering, without the setState-in-effect cascade the manual
 * `useState` + `useEffect` pairing would produce. It also returns the
 * server snapshot on the server, so there is no hydration mismatch.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReduceMotion,
    () => window.matchMedia(REDUCE_MOTION_QUERY).matches,
    () => false,
  );
}

/**
 * Counts up from 0 to `value` the first time it scrolls into view.
 *
 * Runs entirely on `requestAnimationFrame` (no layout reads, no per-frame
 * React state churn beyond the single counter) and respects
 * `prefers-reduced-motion` by jumping straight to the final value.
 */
export function AnimatedCounter({ value, duration = 2000 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const reduceMotion = usePrefersReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduceMotion) return;
    const node = ref.current;
    if (!node) return;

    // Guards the animation against a fast scroll past the threshold, and
    // against a value that never actually reaches the viewport.
    let frame = 0;
    let startTime: number | null = null;
    let running = false;

    function tick(now: number) {
      if (startTime === null) startTime = now;
      const progress = Math.min((now - startTime) / duration, 1);
      // easeOutCubic: fast start, gentle settle.
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * value));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        running = false;
      }
    }

    function start() {
      if (running) return;
      running = true;
      frame = requestAnimationFrame(tick);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          start();
          // One shot: disconnecting frees the observer once it has fired.
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      // Without this the rAF callback kept running after unmount and called
      // setState on a torn-down component for the rest of the duration.
      if (frame) cancelAnimationFrame(frame);
    };
  }, [value, duration, reduceMotion]);

  const display = reduceMotion ? value : count;

  return (
    <span ref={ref} aria-label={String(value)}>
      {/* Suppresses the running "3, 4, 5..." chatter for screen readers. */}
      <span aria-hidden="true">{display.toLocaleString()}</span>
    </span>
  );
}
