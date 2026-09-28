"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/components/animated-counter";

const phrases = [
  "The digital heartbeat of your school community.",
  "Where every school day finds its rhythm.",
  "Bringing school life into focus.",
  "Your school, beautifully connected.",
  "The rhythm of school life, captured.",
];

const ROTATE_MS = 4000;
const FADE_MS = 500;

export function RotatingHeadline() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  // Honour the OS "reduce motion" setting: show one static phrase rather
  // than cycling forever.
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;

    // Single chained timeout rather than setInterval wrapping setTimeout.
    // The previous version left the inner timeout uncancelled on unmount,
    // so it could fire after the component was gone and set state on a
    // dead component.
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    function cycle() {
      if (cancelled) return;
      setVisible(false);
      timer = setTimeout(() => {
        if (cancelled) return;
        setIndex((current) => (current + 1) % phrases.length);
        setVisible(true);
        // Recurse from a real timeout so a slow/hidden tab cannot pile up
        // transitions.
        timer = setTimeout(cycle, ROTATE_MS);
      }, FADE_MS);
    }

    timer = setTimeout(cycle, ROTATE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reduceMotion]);

  return (
    <h1 className="font-display mt-5 min-h-[3.5em] text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">
      {/*
        The visible text animates, but the accessible name stays stable.
        Screen readers announce the first phrase once instead of receiving a
        stream of changing content, and `aria-live` is deliberately omitted
        so the swap is not announced either.
      */}
      <span className="sr-only">{phrases[0]}</span>
      <span aria-hidden="true" className="block">
        <span
          className={`block transition-all duration-500 ${
            visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          {phrases[index]}
        </span>
      </span>
    </h1>
  );
}
