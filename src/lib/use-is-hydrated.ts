"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * `false` during SSR and the first client render, `true` from the second
 * client render onward.
 *
 * Used to gate anything that reads the clock or locale. `new Date()`,
 * `toLocaleDateString()` and friends can differ between Node and the
 * browser, so rendering them directly produces a hydration mismatch.
 *
 * Implemented with `useSyncExternalStore` rather than the usual
 * `useState` + `useEffect` pair: the store API is the sanctioned way to tell
 * React "this differs between server and client", so it does not cascade an
 * extra render pass and satisfies the set-state-in-effect rule.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    // getSnapshot: client. The first call must return a value consistent
    // with getServerSnapshot for hydration, then flip on the next render.
    () => true,
    // getServerSnapshot: server and the hydration render.
    () => false,
  );
}

/**
 * Like {@link useIsHydrated}, but returns a fallback during SSR/first paint
 * and the real value afterwards. Prefer this over `mounted ? compute() : null`
 * so the fallback is explicit at each call site.
 */
export function useHydratedValue<T>(compute: () => T, fallback: T): T {
  const hydrated = useIsHydrated();
  return hydrated ? compute() : fallback;
}
